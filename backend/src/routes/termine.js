// ============================================================
// Route: Termine
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/termine — Alle Termine
router.get('/', auth, async (req, res) => {
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
             GROUP BY t.termin_id, k.klient_id, k.nachname, k.vorname
             ORDER BY t.datum ASC, t.zeit ASC NULLS LAST`,
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Termine' });
    }
});

// POST /api/termine — Neuer Termin
router.post('/', auth, async (req, res) => {
    const { klient_id, typ, datum, zeit, notiz, personen } = req.body;

    if (!klient_id || !typ || !datum) {
        return res.status(400).json({ error: 'Klient, Typ und Datum erforderlich' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const termin = await client.query(
            `INSERT INTO termin (klient_id, typ, datum, zeit, notiz)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [klient_id, typ, datum, zeit || null, notiz || null]
        );

        // Personen zuweisen
        if (personen && personen.length > 0) {
            for (const user_id of personen) {
                await client.query(
                    `INSERT INTO termin_user (termin_id, user_id) VALUES ($1, $2)`,
                    [termin.rows[0].termin_id, user_id]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json(termin.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen des Termins' });
    } finally {
        client.release();
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