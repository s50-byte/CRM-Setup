// ============================================================
// Route: Tasks
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/tasks — Alle Tasks des eingeloggten Benutzers
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                t.task_id, t.text, t.prioritaet, t.typ,
                t.faellig_am, t.erledigt, t.erledigt_am,
                k.nachname, k.vorname,
                ph.label AS phase_label
             FROM task t
             JOIN klient k ON k.klient_id = t.klient_id
             LEFT JOIN phase ph ON ph.phase_id = t.phase_id
             WHERE t.user_id = $1
             ORDER BY t.erledigt ASC, t.faellig_am ASC NULLS LAST`,
            [req.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Tasks' });
    }
});

// GET /api/tasks/klient/:klient_id — Tasks eines Klienten
router.get('/klient/:klient_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                t.task_id, t.text, t.prioritaet, t.typ,
                t.faellig_am, t.erledigt, t.erledigt_am,
                t.phase_id,
                u.full_name AS zugewiesen_an, u.avatar_initials,
                ph.label AS phase_label
             FROM task t
             LEFT JOIN benutzer u ON u.user_id = t.user_id
             LEFT JOIN phase ph ON ph.phase_id = t.phase_id
             WHERE t.klient_id = $1
             ORDER BY t.erledigt ASC, t.faellig_am ASC NULLS LAST`,
            [req.params.klient_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Tasks' });
    }
});

// POST /api/tasks — Neuer Task
router.post('/', auth, async (req, res) => {
    const { klient_id, text, prioritaet, faellig_am, phase_id, typ } = req.body;

    if (!klient_id || !text) {
        return res.status(400).json({ error: 'Klient und Text erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO task (klient_id, user_id, text, prioritaet, faellig_am, phase_id, typ)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [klient_id, req.user.user_id, text,
             prioritaet || 'Mittel', faellig_am || null,
             phase_id || null, typ || 'individuell']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen des Tasks' });
    }
});

// PUT /api/tasks/:id/erledigt — Task als erledigt markieren
router.put('/:id/erledigt', auth, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE task SET
                erledigt = NOT erledigt,
                erledigt_am = CASE WHEN erledigt = FALSE THEN CURRENT_DATE ELSE NULL END,
                updated_at = NOW()
             WHERE task_id = $1
             RETURNING *`,
            [req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// DELETE /api/tasks/:id — Task löschen
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query(`DELETE FROM task WHERE task_id = $1`, [req.params.id]);
        res.json({ message: 'Task gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;