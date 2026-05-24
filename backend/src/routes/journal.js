// ============================================================
// Route: Journal
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/journal/:klient_id — Journal eines Klienten
router.get('/:klient_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                j.eintrag_id, j.kategorie, j.datum, j.text, j.created_at,
                u.full_name AS erfasst_von, u.avatar_initials
             FROM journal_eintrag j
             JOIN benutzer u ON u.user_id = j.user_id
             WHERE j.klient_id = $1
             ORDER BY j.datum DESC, j.created_at DESC`,
            [req.params.klient_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Journals' });
    }
});

// POST /api/journal — Neuer Eintrag
router.post('/', auth, async (req, res) => {
    const { klient_id, kategorie, datum, text } = req.body;

    if (!klient_id || !text) {
        return res.status(400).json({ error: 'Klient und Text erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO journal_eintrag (klient_id, user_id, kategorie, datum, text)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [klient_id, req.user.user_id, kategorie || 'Sonstiges',
             datum || new Date().toISOString().slice(0, 10), text]
        );

        // Zeitachse-Eintrag
        await db.query(
            `INSERT INTO zeitachse_eintrag (klient_id, user_id, typ, titel, text)
             VALUES ($1, $2, 'Kommentar', $3, $4)`,
            [klient_id, req.user.user_id, kategorie || 'Journal', text.slice(0, 100)]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen des Eintrags' });
    }
});

// PUT /api/journal/:id — Eintrag bearbeiten
router.put('/:id', auth, async (req, res) => {
    const { kategorie, datum, text } = req.body;

    try {
        const result = await db.query(
            `UPDATE journal_eintrag SET
                kategorie = $1, datum = $2, text = $3, updated_at = NOW()
             WHERE eintrag_id = $4 AND user_id = $5
             RETURNING *`,
            [kategorie, datum, text, req.params.id, req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Eintrag nicht gefunden oder keine Berechtigung' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// DELETE /api/journal/:id — Eintrag löschen
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query(
            `DELETE FROM journal_eintrag WHERE eintrag_id = $1 AND user_id = $2`,
            [req.params.id, req.user.user_id]
        );
        res.json({ message: 'Eintrag gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;