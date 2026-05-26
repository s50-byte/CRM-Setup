const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/standorte — Alle Standorte
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM standort WHERE aktiv = TRUE ORDER BY name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Standorte' });
    }
});

// POST /api/standorte — Neuer Standort (nur Management)
router.post('/', auth, async (req, res) => {
    if (req.user.system_rolle !== 'management') {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { name, kuerzel, adresse, plz, ort, telefon, email } = req.body;
    if (!name || !kuerzel) {
        return res.status(400).json({ error: 'Name und Kürzel erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO standort (name, kuerzel, adresse, plz, ort, telefon, email)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, kuerzel, adresse || null, plz || null, ort || null, telefon || null, email || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// PUT /api/standorte/:id — Standort aktualisieren
router.put('/:id', auth, async (req, res) => {
    if (!['teamleitung', 'management'].includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { name, kuerzel, adresse, plz, ort, telefon, email, aktiv } = req.body;
    try {
        const result = await db.query(
            `UPDATE standort SET
                name = $1, kuerzel = $2, adresse = $3, plz = $4,
                ort = $5, telefon = $6, email = $7, aktiv = $8
             WHERE standort_id = $9 RETURNING *`,
            [name, kuerzel, adresse || null, plz || null, ort || null,
             telefon || null, email || null, aktiv !== false, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

module.exports = router;