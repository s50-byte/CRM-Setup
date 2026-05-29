const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Tabelle beim ersten Start anlegen
db.query(`
    CREATE TABLE IF NOT EXISTS dokument (
        dokument_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        klient_id    UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
        phase_id     UUID REFERENCES phase(phase_id) ON DELETE SET NULL,
        dateiname    TEXT NOT NULL,
        typ          TEXT,
        erstellt_am  TIMESTAMPTZ DEFAULT NOW(),
        erstellt_von UUID REFERENCES benutzer(user_id)
    )
`).catch(err => console.error('dokument table init:', err));

// GET /api/dokumente?klient_id=...&phase_id=...
router.get('/', auth, async (req, res) => {
    const { klient_id, phase_id } = req.query;
    if (!klient_id) return res.status(400).json({ error: 'klient_id erforderlich' });
    try {
        const result = await db.query(
            `SELECT d.dokument_id, d.dateiname, d.typ, d.erstellt_am,
                    u.full_name AS erstellt_von_name
             FROM dokument d
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             WHERE d.klient_id = $1
               AND ($2::uuid IS NULL OR d.phase_id = $2)
             ORDER BY d.erstellt_am DESC`,
            [klient_id, phase_id || null]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
    }
});

// POST /api/dokumente
router.post('/', auth, async (req, res) => {
    const { klient_id, phase_id, dateiname, typ } = req.body;
    if (!klient_id || !dateiname?.trim()) {
        return res.status(400).json({ error: 'klient_id und dateiname erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO dokument (klient_id, phase_id, dateiname, typ, erstellt_von)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [klient_id, phase_id || null, dateiname.trim(), typ || null, req.user.user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erfassen des Dokuments' });
    }
});

// DELETE /api/dokumente/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query(`DELETE FROM dokument WHERE dokument_id = $1`, [req.params.id]);
        res.json({ message: 'Dokument gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;
