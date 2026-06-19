const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/feedback — Feedback erfassen (alle authentifizierten Benutzer)
router.post('/', auth, async (req, res) => {
    const { screen, notiz } = req.body;
    if (!notiz || notiz.trim().length < 10) {
        return res.status(400).json({ error: 'Feedback muss mindestens 10 Zeichen enthalten' });
    }
    try {
        const result = await db.query(
            `INSERT INTO feedback (user_id, screen, notiz)
             VALUES ($1, $2, $3) RETURNING *`,
            [req.user.user_id, screen || null, notiz.trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Feedbacks' });
    }
});

// GET /api/feedback — Alle Feedbacks (nur Leitungsteam/Admin)
router.get('/', auth, async (req, res) => {
    if (!['leitungsteam', 'admin'].includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    try {
        const result = await db.query(
            `SELECT f.*, b.full_name, b.email
             FROM feedback f
             LEFT JOIN benutzer b ON b.user_id = f.user_id
             ORDER BY f.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Feedbacks' });
    }
});

module.exports = router;
