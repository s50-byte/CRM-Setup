const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/verfuegungen/:dossier_id
router.get('/:dossier_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT v.verfuegung_id, v.nummer, v.datum, v.bemerkung, v.status,
                    COALESCE(
                        JSON_AGG(
                            JSONB_BUILD_OBJECT(
                                'position_id', vp.position_id,
                                'leistung_id', vp.leistung_id,
                                'leistung_bezeichnung', l.bezeichnung,
                                'leistung_tarifnr', l.tarifnr,
                                'einheit', l.einheit,
                                'soll_stunden', vp.soll_stunden,
                                'reihenfolge', vp.reihenfolge
                            ) ORDER BY vp.reihenfolge
                        ) FILTER (WHERE vp.position_id IS NOT NULL),
                        '[]'
                    ) AS positionen
             FROM verfuegung v
             LEFT JOIN verfuegung_position vp ON vp.verfuegung_id = v.verfuegung_id
             LEFT JOIN leistung l ON l.leistung_id = vp.leistung_id
             WHERE v.dossier_id = $1
             GROUP BY v.verfuegung_id
             ORDER BY (v.status = 'aktiv') DESC, v.datum DESC NULLS LAST`,
            [req.params.dossier_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Verfügungen' });
    }
});

// POST /api/verfuegungen
router.post('/', auth, async (req, res) => {
    const { dossier_id, nummer, datum, bemerkung, status } = req.body;
    if (!dossier_id || !nummer) {
        return res.status(400).json({ error: 'dossier_id und Nummer sind erforderlich' });
    }
    const pgClient = await db.connect();
    try {
        await pgClient.query('BEGIN');
        const stat = status || 'aktiv';
        if (stat === 'aktiv') {
            await pgClient.query(
                `UPDATE verfuegung SET status = 'abgeschlossen', updated_at = NOW()
                 WHERE dossier_id = $1 AND status = 'aktiv'`,
                [dossier_id]
            );
        }
        const result = await pgClient.query(
            `INSERT INTO verfuegung (dossier_id, nummer, datum, bemerkung, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [dossier_id, nummer.trim(), datum || null, bemerkung?.trim() || null, stat]
        );
        await pgClient.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Verfügung' });
    } finally {
        pgClient.release();
    }
});

// PUT /api/verfuegungen/:id
router.put('/:id', auth, async (req, res) => {
    const { dossier_id, nummer, datum, bemerkung, status } = req.body;
    if (!nummer) return res.status(400).json({ error: 'Nummer ist erforderlich' });
    const pgClient = await db.connect();
    try {
        await pgClient.query('BEGIN');
        if (status === 'aktiv' && dossier_id) {
            await pgClient.query(
                `UPDATE verfuegung SET status = 'abgeschlossen', updated_at = NOW()
                 WHERE dossier_id = $1 AND status = 'aktiv' AND verfuegung_id != $2`,
                [dossier_id, req.params.id]
            );
        }
        const result = await pgClient.query(
            `UPDATE verfuegung
             SET nummer = $1, datum = $2, bemerkung = $3, status = $4, updated_at = NOW()
             WHERE verfuegung_id = $5
             RETURNING *`,
            [nummer.trim(), datum || null, bemerkung?.trim() || null, status || 'aktiv', req.params.id]
        );
        if (result.rows.length === 0) {
            await pgClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Nicht gefunden' });
        }
        await pgClient.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Verfügung' });
    } finally {
        pgClient.release();
    }
});

// DELETE /api/verfuegungen/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM verfuegung WHERE verfuegung_id = $1 RETURNING verfuegung_id',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Verfügung' });
    }
});

// POST /api/verfuegungen/:id/positionen
router.post('/:id/positionen', auth, async (req, res) => {
    const { leistung_id, soll_stunden, reihenfolge } = req.body;
    if (!leistung_id) return res.status(400).json({ error: 'leistung_id erforderlich' });
    try {
        const result = await db.query(
            `INSERT INTO verfuegung_position (verfuegung_id, leistung_id, soll_stunden, reihenfolge)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, leistung_id, soll_stunden || 0, reihenfolge || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Position' });
    }
});

// PUT /api/verfuegungen/:id/positionen/:pos_id
router.put('/:id/positionen/:pos_id', auth, async (req, res) => {
    const { leistung_id, soll_stunden, reihenfolge } = req.body;
    if (!leistung_id) return res.status(400).json({ error: 'leistung_id erforderlich' });
    try {
        const result = await db.query(
            `UPDATE verfuegung_position
             SET leistung_id = $1, soll_stunden = $2, reihenfolge = $3
             WHERE position_id = $4 AND verfuegung_id = $5 RETURNING *`,
            [leistung_id, soll_stunden || 0, reihenfolge || 0, req.params.pos_id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Position' });
    }
});

// DELETE /api/verfuegungen/:id/positionen/:pos_id
router.delete('/:id/positionen/:pos_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM verfuegung_position WHERE position_id = $1 AND verfuegung_id = $2 RETURNING position_id',
            [req.params.pos_id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Position' });
    }
});

module.exports = router;
