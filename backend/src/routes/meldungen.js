// ============================================================
// Route: Dashboard-Meldungen
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/meldungen — eigene unacknowledged Meldungen
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                m.meldung_id, m.datum, m.aenderungen, m.created_at,
                u.full_name AS erstellt_von_name
             FROM dashboard_meldung m
             LEFT JOIN benutzer u ON u.user_id = m.erstellt_von
             WHERE m.empfaenger_id = $1 AND m.acknowledged = FALSE
             ORDER BY m.created_at DESC`,
            [req.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Meldungen' });
    }
});

// GET /api/meldungen/alle — alle Meldungen inkl. acknowledged, filterbar
router.get('/alle', auth, async (req, res) => {
    const { datum_von, datum_bis, acknowledged } = req.query;

    const bedingungen = ['m.empfaenger_id = $1'];
    const params = [req.user.user_id];
    let p = 2;

    if (datum_von) { bedingungen.push(`m.datum >= $${p++}`); params.push(datum_von); }
    if (datum_bis) { bedingungen.push(`m.datum <= $${p++}`); params.push(datum_bis); }
    if (acknowledged === 'true')  { bedingungen.push(`m.acknowledged = TRUE`); }
    if (acknowledged === 'false') { bedingungen.push(`m.acknowledged = FALSE`); }

    try {
        const result = await db.query(
            `SELECT
                m.meldung_id, m.datum, m.aenderungen, m.created_at,
                m.acknowledged, m.acknowledged_am,
                u.full_name AS erstellt_von_name
             FROM dashboard_meldung m
             LEFT JOIN benutzer u ON u.user_id = m.erstellt_von
             WHERE ${bedingungen.join(' AND ')}
             ORDER BY m.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Meldungen' });
    }
});

// PUT /api/meldungen/:id/acknowledge — Meldung als gelesen markieren
router.put('/:id/acknowledge', auth, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE dashboard_meldung
             SET acknowledged = TRUE, acknowledged_am = NOW()
             WHERE meldung_id = $1 AND empfaenger_id = $2
             RETURNING meldung_id`,
            [req.params.id, req.user.user_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meldung nicht gefunden' });
        }
        res.json({ message: 'Meldung als gelesen markiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Meldung' });
    }
});

module.exports = router;
