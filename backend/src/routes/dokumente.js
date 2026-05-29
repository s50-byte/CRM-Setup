const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Separate Tabelle (nicht die schema.sql-Tabelle 'dokument', die dateipfad NOT NULL hat)
db.query(`
    CREATE TABLE IF NOT EXISTS phase_dokument (
        dokument_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        klient_id    UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
        phase_id     UUID REFERENCES phase(phase_id) ON DELETE SET NULL,
        dateiname    TEXT NOT NULL,
        typ          TEXT,
        erstellt_am  TIMESTAMPTZ DEFAULT NOW(),
        erstellt_von UUID REFERENCES benutzer(user_id)
    )
`).catch(err => console.error('phase_dokument table init:', err));

// GET /api/dokumente?klient_id=...&phase_id=...
router.get('/', auth, async (req, res) => {
    const { klient_id, phase_id } = req.query;
    if (!klient_id) return res.status(400).json({ error: 'klient_id erforderlich' });
    try {
        const result = await db.query(
            `SELECT d.dokument_id, d.dateiname, d.typ, d.erstellt_am,
                    u.full_name AS erstellt_von_name
             FROM phase_dokument d
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
    console.log('[POST /api/dokumente] body:', req.body);
    if (!klient_id || !dateiname?.trim()) {
        return res.status(400).json({ error: 'klient_id und dateiname erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO phase_dokument (klient_id, phase_id, dateiname, typ, erstellt_von)
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
        await db.query(`DELETE FROM phase_dokument WHERE dokument_id = $1`, [req.params.id]);
        res.json({ message: 'Dokument gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

// ── Programm-Dokumente (Knowledge Pool) ────────────────────────────────────

db.query(`
    CREATE TABLE IF NOT EXISTS programm_dokument (
        pdok_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        programm_id  UUID NOT NULL REFERENCES programm(programm_id) ON DELETE CASCADE,
        phase_id     UUID REFERENCES phase(phase_id) ON DELETE CASCADE,
        dateiname    TEXT NOT NULL,
        typ          TEXT,
        erstellt_am  TIMESTAMPTZ DEFAULT NOW(),
        erstellt_von UUID REFERENCES benutzer(user_id)
    )
`).catch(err => console.error('programm_dokument table init:', err));

// GET /api/dokumente/programm/:programm_id — Programm-Dokumente (phase_id IS NULL)
router.get('/programm/:programm_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.pdok_id, d.dateiname, d.typ, d.erstellt_am,
                    u.full_name AS erstellt_von_name
             FROM programm_dokument d
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             WHERE d.programm_id = $1 AND d.phase_id IS NULL
             ORDER BY d.erstellt_am DESC`,
            [req.params.programm_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// GET /api/dokumente/phase/:phase_id — Phasen-Dokumente
router.get('/phase/:phase_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.pdok_id, d.dateiname, d.typ, d.erstellt_am,
                    u.full_name AS erstellt_von_name
             FROM programm_dokument d
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             WHERE d.phase_id = $1
             ORDER BY d.erstellt_am DESC`,
            [req.params.phase_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// POST /api/dokumente/programm — Programm-/Phasen-Dokument erstellen
router.post('/programm', auth, async (req, res) => {
    const { programm_id, phase_id, dateiname, typ } = req.body;
    if (!programm_id || !dateiname?.trim()) {
        return res.status(400).json({ error: 'programm_id und dateiname erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO programm_dokument (programm_id, phase_id, dateiname, typ, erstellt_von)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [programm_id, phase_id || null, dateiname.trim(), typ || null, req.user.user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// DELETE /api/dokumente/programm/:id — Programm-Dokument löschen
router.delete('/programm/:id', auth, async (req, res) => {
    try {
        await db.query(`DELETE FROM programm_dokument WHERE pdok_id = $1`, [req.params.id]);
        res.json({ message: 'Dokument gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;
