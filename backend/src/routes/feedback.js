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
        const fb = result.rows[0];

        const empfaenger = await db.query(
            `SELECT user_id FROM benutzer WHERE system_rolle IN ('leitungsteam', 'admin') AND aktiv = TRUE`
        );
        for (const u of empfaenger.rows) {
            await db.query(
                `INSERT INTO dashboard_meldung (empfaenger_id, datum, aenderungen, erstellt_von)
                 VALUES ($1, CURRENT_DATE, $2::jsonb, $3)`,
                [
                    u.user_id,
                    JSON.stringify([{ typ: 'feedback_eingang', screen: fb.screen, notiz: fb.notiz }]),
                    fb.user_id,
                ]
            );
        }

        res.status(201).json(fb);
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

// PUT /api/feedback/:id/antwort — Antwort erfassen (nur Leitungsteam/Admin)
router.put('/:id/antwort', auth, async (req, res) => {
    if (!['leitungsteam', 'admin'].includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { status, antwort } = req.body;
    if (!antwort || !antwort.trim()) {
        return res.status(400).json({ error: 'Antwort ist erforderlich' });
    }
    if (!['implementiert', 'out_of_scope', 'backlog'].includes(status)) {
        return res.status(400).json({ error: 'Ungültiger Status' });
    }
    try {
        const result = await db.query(
            `UPDATE feedback
             SET status = $1, antwort = $2, beantwortet_von = $3, beantwortet_at = NOW()
             WHERE feedback_id = $4
             RETURNING *`,
            [status, antwort.trim(), req.user.user_id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });

        const fb = result.rows[0];
        if (fb.user_id) {
            const STATUS_LABELS = { implementiert: 'Implementiert ✓', out_of_scope: 'Out of Scope', backlog: 'Backlog' };
            await db.query(
                `INSERT INTO dashboard_meldung (empfaenger_id, datum, aenderungen, erstellt_von)
                 VALUES ($1, CURRENT_DATE, $2::jsonb, $3)`,
                [
                    fb.user_id,
                    JSON.stringify([{
                        typ: 'feedback_antwort',
                        feedback_notiz: fb.notiz,
                        antwort: antwort.trim(),
                        status,
                        status_label: STATUS_LABELS[status] || status,
                    }]),
                    req.user.user_id,
                ]
            );
        }
        res.json(fb);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Antwort' });
    }
});

module.exports = router;
