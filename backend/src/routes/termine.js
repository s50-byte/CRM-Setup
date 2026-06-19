// ============================================================
// Route: Termine
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/termine — Termine der eigenen Klienten (?klient_id=uuid für Filter)
router.get('/', auth, async (req, res) => {
    const klientFilter = req.query.klient_id || null;
    console.log('GET /termine user_id:', req.user.user_id, 'klient_id:', klientFilter);
    try {
        const result = await db.query(
            `SELECT
                t.termin_id, t.typ, t.datum, t.zeit, t.status, t.notiz,
                k.nachname, k.vorname, k.klient_id,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'user_id', u.user_id,
                            'full_name', u.full_name,
                            'avatar_initials', u.avatar_initials
                        )
                    ) FILTER (WHERE u.user_id IS NOT NULL),
                    '[]'
                ) AS personen
             FROM termin t
             JOIN klient k ON k.klient_id = t.klient_id
             LEFT JOIN termin_user tu ON tu.termin_id = t.termin_id
             LEFT JOIN benutzer u ON u.user_id = tu.user_id
             WHERE ($1::uuid IS NULL OR t.klient_id = $1::uuid)
               AND (
                   $1::uuid IS NOT NULL
                   OR EXISTS (
                       SELECT 1 FROM dossier d
                       JOIN klient_user ku ON ku.klient_id = d.klient_id
                       WHERE d.klient_id = t.klient_id
                         AND ku.user_id = $2
                         AND ku.aktiv = TRUE
                   )
                   OR EXISTS (
                       SELECT 1 FROM termin_user tu2
                       WHERE tu2.termin_id = t.termin_id
                         AND tu2.user_id = $2
                   )
               )
             GROUP BY t.termin_id, k.klient_id, k.nachname, k.vorname
             ORDER BY t.datum ASC, t.zeit ASC NULLS LAST`,
            [klientFilter, req.user.user_id]
        );
        console.log('GET /termine rows:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Termine' });
    }
});

// POST /api/termine — Neuer Termin
router.post('/', auth, async (req, res) => {
    console.log('POST /termine body:', req.body);
    const { klient_id, typ, datum, zeit, notiz, teilnehmende } = req.body;

    if (!klient_id || !typ || !datum) {
        return res.status(400).json({ error: 'Klient, Typ und Datum erforderlich' });
    }

    const dbClient = await db.connect();
    try {
        await dbClient.query('BEGIN');

        const termin = await dbClient.query(
            `INSERT INTO termin (klient_id, typ, datum, zeit, notiz)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [klient_id, typ, datum, zeit || null, notiz || null]
        );
        const termin_id = termin.rows[0].termin_id;

        // Klient-Name für Meldungstext
        const klientRow = await dbClient.query(
            `SELECT vorname, nachname FROM klient WHERE klient_id = $1`,
            [klient_id]
        );
        const klient_name = klientRow.rows[0]
            ? `${klientRow.rows[0].vorname} ${klientRow.rows[0].nachname}`
            : '';

        // Teilnehmende zuweisen + Dashboard-Meldung an alle ausser Ersteller
        console.log('teilnehmende aus req.body:', teilnehmende);
        if (teilnehmende && teilnehmende.length > 0) {
            for (const user_id of teilnehmende) {
                await dbClient.query(
                    `INSERT INTO termin_user (termin_id, user_id) VALUES ($1, $2)`,
                    [termin_id, user_id]
                );
                if (user_id !== req.user.user_id) {
                    try {
                        await dbClient.query(
                            `INSERT INTO dashboard_meldung (empfaenger_id, datum, aenderungen, erstellt_von)
                             VALUES ($1, CURRENT_DATE, $2::jsonb, $3)`,
                            [
                                user_id,
                                JSON.stringify([{
                                    typ: 'termin_einladung',
                                    termin_id: termin_id,
                                    termin_typ: typ,
                                    datum: datum,
                                    klient_name: klient_name,
                                }]),
                                req.user.user_id,
                            ]
                        );
                        console.log('dashboard_meldung erstellt für user_id:', user_id);
                    } catch (meldungErr) {
                        console.error('Fehler beim Erstellen der dashboard_meldung für user_id:', user_id, meldungErr);
                    }
                } else {
                    console.log('Kein Meldung für Ersteller selbst (user_id:', user_id, ')');
                }
            }
        } else {
            console.log('teilnehmende leer oder undefined — keine dashboard_meldungen erstellt');
        }

        await dbClient.query('COMMIT');
        res.status(201).json(termin.rows[0]);
    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen des Termins' });
    } finally {
        dbClient.release();
    }
});

// GET /api/termine/:id — Einzelner Termin
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                t.termin_id, t.typ, t.datum, t.zeit, t.status, t.notiz,
                k.nachname, k.vorname, k.klient_id,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'user_id', u.user_id,
                            'full_name', u.full_name,
                            'avatar_initials', u.avatar_initials
                        )
                    ) FILTER (WHERE u.user_id IS NOT NULL),
                    '[]'
                ) AS personen
             FROM termin t
             JOIN klient k ON k.klient_id = t.klient_id
             LEFT JOIN termin_user tu ON tu.termin_id = t.termin_id
             LEFT JOIN benutzer u ON u.user_id = tu.user_id
             WHERE t.termin_id = $1
             GROUP BY t.termin_id, k.klient_id, k.nachname, k.vorname`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Termin nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Termins' });
    }
});

// PUT /api/termine/:id/absagen — Termin absagen + Dashboard-Meldungen
router.put('/:id/absagen', auth, async (req, res) => {
    const dbClient = await db.connect();
    try {
        await dbClient.query('BEGIN');

        const terminResult = await dbClient.query(
            `UPDATE termin SET status = 'Abgesagt', updated_at = NOW()
             WHERE termin_id = $1 RETURNING *`,
            [req.params.id]
        );
        if (terminResult.rows.length === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Termin nicht gefunden' });
        }
        const termin = terminResult.rows[0];

        const klientResult = await dbClient.query(
            `SELECT vorname, nachname FROM klient WHERE klient_id = $1`,
            [termin.klient_id]
        );
        const klient_name = klientResult.rows[0]
            ? `${klientResult.rows[0].vorname} ${klientResult.rows[0].nachname}`
            : '';

        const teilnehmende = await dbClient.query(
            `SELECT user_id FROM termin_user WHERE termin_id = $1`,
            [req.params.id]
        );

        for (const row of teilnehmende.rows) {
            try {
                await dbClient.query(
                    `INSERT INTO dashboard_meldung (empfaenger_id, datum, aenderungen, erstellt_von)
                     VALUES ($1, CURRENT_DATE, $2::jsonb, $3)`,
                    [
                        row.user_id,
                        JSON.stringify([{
                            typ: 'termin_absage',
                            termin_id: req.params.id,
                            termin_typ: termin.typ,
                            datum: termin.datum,
                            klient_name,
                        }]),
                        req.user.user_id,
                    ]
                );
            } catch (meldungErr) {
                console.error('Fehler beim Erstellen der dashboard_meldung (absage):', meldungErr);
            }
        }

        await dbClient.query('COMMIT');
        res.json(terminResult.rows[0]);
    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Absagen des Termins' });
    } finally {
        dbClient.release();
    }
});

// PUT /api/termine/:id/status — Status aktualisieren
router.put('/:id/status', auth, async (req, res) => {
    const { status } = req.body;
    try {
        const result = await db.query(
            `UPDATE termin SET status = $1, updated_at = NOW()
             WHERE termin_id = $2 RETURNING *`,
            [status, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

module.exports = router;