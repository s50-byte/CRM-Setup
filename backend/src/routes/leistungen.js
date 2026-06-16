const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const LEITUNGSTEAM = ['kader', 'leitungsteam', 'management', 'teamleitung'];

// GET /api/leistungen — alle aktiven Leistungen (alle authentifizierten Benutzer)
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT leistung_id, tarifnr, bezeichnung, einheit, aktiv
             FROM leistung
             WHERE aktiv = TRUE
             ORDER BY tarifnr`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Leistungen' });
    }
});

// GET /api/leistungen/alle — alle inkl. inaktive (nur Leitungsteam)
router.get('/alle', auth, async (req, res) => {
    if (!LEITUNGSTEAM.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    try {
        const result = await db.query(
            `SELECT leistung_id, tarifnr, bezeichnung, einheit, aktiv
             FROM leistung
             ORDER BY tarifnr`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Leistungen' });
    }
});

// POST /api/leistungen — neue Leistung (nur Leitungsteam)
router.post('/', auth, async (req, res) => {
    if (!LEITUNGSTEAM.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { tarifnr, bezeichnung, einheit } = req.body;
    if (!tarifnr || !bezeichnung) {
        return res.status(400).json({ error: 'Tarifnr. und Bezeichnung sind erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO leistung (tarifnr, bezeichnung, einheit)
             VALUES ($1, $2, $3)
             RETURNING leistung_id, tarifnr, bezeichnung, einheit, aktiv`,
            [tarifnr.trim(), bezeichnung.trim(), einheit || 'Stunden']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Tarifnr. bereits vorhanden' });
        }
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Leistung' });
    }
});

// PUT /api/leistungen/:id — bearbeiten (nur Leitungsteam)
router.put('/:id', auth, async (req, res) => {
    if (!LEITUNGSTEAM.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { tarifnr, bezeichnung, einheit } = req.body;
    if (!tarifnr || !bezeichnung) {
        return res.status(400).json({ error: 'Tarifnr. und Bezeichnung sind erforderlich' });
    }
    try {
        const result = await db.query(
            `UPDATE leistung
             SET tarifnr = $1, bezeichnung = $2, einheit = $3, updated_at = NOW()
             WHERE leistung_id = $4
             RETURNING leistung_id, tarifnr, bezeichnung, einheit, aktiv`,
            [tarifnr.trim(), bezeichnung.trim(), einheit || 'Stunden', req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Tarifnr. bereits vorhanden' });
        }
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Leistung' });
    }
});

// DELETE /api/leistungen/:id — deaktivieren (nur Leitungsteam)
router.delete('/:id', auth, async (req, res) => {
    if (!LEITUNGSTEAM.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    try {
        const result = await db.query(
            `UPDATE leistung SET aktiv = FALSE, updated_at = NOW()
             WHERE leistung_id = $1
             RETURNING leistung_id`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Deaktivieren der Leistung' });
    }
});

module.exports = router;
