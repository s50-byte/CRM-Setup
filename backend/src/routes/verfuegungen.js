const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/verfuegungen/:dossier_id
router.get('/:dossier_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT v.verfuegung_id, v.nummer, v.datum, v.bemerkung, v.status,
                    v.verrechnungsart, v.betrag,
                    (SELECT GREATEST(1, COALESCE(
                        (EXTRACT(YEAR FROM age(pv.geplantes_enddatum, pv.start_datum)) * 12
                       + EXTRACT(MONTH FROM age(pv.geplantes_enddatum, pv.start_datum)))::int,
                        1
                    ))
                     FROM programm_verlauf pv
                     WHERE pv.dossier_id = $1 AND pv.status = 'Laufend'
                     LIMIT 1) AS dauer_monate,
                    COALESCE(
                        JSON_AGG(
                            JSONB_BUILD_OBJECT(
                                'position_id', vp.position_id,
                                'leistung_id', vp.leistung_id,
                                'leistung_bezeichnung', l.bezeichnung,
                                'leistung_tarifnr', l.tarifnr,
                                'einheit', l.einheit,
                                'soll_stunden', vp.soll_stunden,
                                'reihenfolge', vp.reihenfolge,
                                'stundenpreis', (
                                    SELECT sp.stundenpreis
                                    FROM organisation_stundenpreis sp
                                    JOIN dossier d ON d.zuweisende_person_id = sp.organisation_id
                                    WHERE d.dossier_id = $1 AND sp.leistung_id = vp.leistung_id
                                    LIMIT 1
                                )
                            ) ORDER BY vp.reihenfolge
                        ) FILTER (WHERE vp.position_id IS NOT NULL),
                        '[]'
                    ) AS positionen
             FROM verfuegung v
             LEFT JOIN verfuegung_position vp ON vp.verfuegung_id = v.verfuegung_id
             LEFT JOIN leistung l ON l.leistung_id = vp.leistung_id
             WHERE v.dossier_id = $1
             GROUP BY v.verfuegung_id
             ORDER BY (v.status = 'aktiv') DESC, v.datum DESC NULLS LAST`,
            [req.params.dossier_id]
        );

        const rows = result.rows.map(v => {
            const dauerMonate = Math.max(1, parseInt(v.dauer_monate) || 1);
            const betrag = parseFloat(v.betrag) || 0;
            const positionen = v.positionen || [];
            const sollStunden = positionen.reduce((s, p) => s + (parseFloat(p.soll_stunden) || 0), 0);
            const stundenpreis = parseFloat(positionen[0]?.stundenpreis) || 0;

            let soll_total_ertrag = null;
            let soll_stunden_total = null;
            let soll_stunden_monat = null;

            if (v.verrechnungsart && betrag > 0) {
                const r1 = n => Math.round(n * 10) / 10;
                const r2 = n => Math.round(n * 100) / 100;
                switch (v.verrechnungsart) {
                    case 'monatspauschale':
                        soll_total_ertrag = r2(betrag * dauerMonate);
                        soll_stunden_monat = stundenpreis > 0 ? r1(betrag / stundenpreis) : null;
                        soll_stunden_total = soll_stunden_monat !== null ? r1(soll_stunden_monat * dauerMonate) : null;
                        break;
                    case 'fallpauschale':
                        soll_total_ertrag = r2(betrag);
                        soll_stunden_total = stundenpreis > 0 ? r1(betrag / stundenpreis) : null;
                        soll_stunden_monat = soll_stunden_total !== null ? r1(soll_stunden_total / dauerMonate) : null;
                        break;
                    case 'stundenpauschale':
                        soll_stunden_total = r1(sollStunden);
                        soll_stunden_monat = dauerMonate > 0 ? r1(sollStunden / dauerMonate) : null;
                        soll_total_ertrag = stundenpreis > 0 ? r2(sollStunden * stundenpreis) : null;
                        break;
                    default:
                        break;
                }
            }

            return { ...v, dauer_monate: dauerMonate, soll_total_ertrag, soll_stunden_total, soll_stunden_monat };
        });

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Verfügungen' });
    }
});

// POST /api/verfuegungen
router.post('/', auth, async (req, res) => {
    const { dossier_id, nummer, datum, bemerkung, status, verrechnungsart, betrag } = req.body;
    if (!dossier_id || !nummer) {
        return res.status(400).json({ error: 'dossier_id und Nummer sind erforderlich' });
    }
    const pgClient = await db.connect();
    try {
        await pgClient.query('BEGIN');
        const stat = status || 'aktiv';
        if (stat === 'aktiv') {
            await pgClient.query(
                `UPDATE verfuegung SET status = 'abgeschlossen', updated_at = NOW()
                 WHERE dossier_id = $1 AND status = 'aktiv'`,
                [dossier_id]
            );
        }
        const result = await pgClient.query(
            `INSERT INTO verfuegung (dossier_id, nummer, datum, bemerkung, status, verrechnungsart, betrag)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [dossier_id, nummer.trim(), datum || null, bemerkung?.trim() || null, stat,
             verrechnungsart || null, betrag || null]
        );
        await pgClient.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Verfügung' });
    } finally {
        pgClient.release();
    }
});

// PUT /api/verfuegungen/:id
router.put('/:id', auth, async (req, res) => {
    const { dossier_id, nummer, datum, bemerkung, status, verrechnungsart, betrag } = req.body;
    if (!nummer) return res.status(400).json({ error: 'Nummer ist erforderlich' });
    const pgClient = await db.connect();
    try {
        await pgClient.query('BEGIN');
        if (status === 'aktiv' && dossier_id) {
            await pgClient.query(
                `UPDATE verfuegung SET status = 'abgeschlossen', updated_at = NOW()
                 WHERE dossier_id = $1 AND status = 'aktiv' AND verfuegung_id != $2`,
                [dossier_id, req.params.id]
            );
        }
        const result = await pgClient.query(
            `UPDATE verfuegung
             SET nummer = $1, datum = $2, bemerkung = $3, status = $4,
                 verrechnungsart = $5, betrag = $6, updated_at = NOW()
             WHERE verfuegung_id = $7
             RETURNING *`,
            [nummer.trim(), datum || null, bemerkung?.trim() || null, status || 'aktiv',
             verrechnungsart || null, betrag || null, req.params.id]
        );
        if (result.rows.length === 0) {
            await pgClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Nicht gefunden' });
        }
        await pgClient.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Verfügung' });
    } finally {
        pgClient.release();
    }
});

// DELETE /api/verfuegungen/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM verfuegung WHERE verfuegung_id = $1 RETURNING verfuegung_id',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Verfügung' });
    }
});

// POST /api/verfuegungen/:id/positionen
router.post('/:id/positionen', auth, async (req, res) => {
    const { leistung_id, soll_stunden, reihenfolge } = req.body;
    if (!leistung_id) return res.status(400).json({ error: 'leistung_id erforderlich' });
    try {
        const result = await db.query(
            `INSERT INTO verfuegung_position (verfuegung_id, leistung_id, soll_stunden, reihenfolge)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, leistung_id, soll_stunden || 0, reihenfolge || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Position' });
    }
});

// PUT /api/verfuegungen/:id/positionen/:pos_id
router.put('/:id/positionen/:pos_id', auth, async (req, res) => {
    const { leistung_id, soll_stunden, reihenfolge } = req.body;
    if (!leistung_id) return res.status(400).json({ error: 'leistung_id erforderlich' });
    try {
        const result = await db.query(
            `UPDATE verfuegung_position
             SET leistung_id = $1, soll_stunden = $2, reihenfolge = $3
             WHERE position_id = $4 AND verfuegung_id = $5 RETURNING *`,
            [leistung_id, soll_stunden || 0, reihenfolge || 0, req.params.pos_id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Position' });
    }
});

// DELETE /api/verfuegungen/:id/positionen/:pos_id
router.delete('/:id/positionen/:pos_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM verfuegung_position WHERE position_id = $1 AND verfuegung_id = $2 RETURNING position_id',
            [req.params.pos_id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Position' });
    }
});

module.exports = router;
