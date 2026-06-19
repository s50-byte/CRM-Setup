const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const LEITUNGSTEAM = ['kader', 'leitungsteam', 'management', 'teamleitung'];

const FELDER = `leistung_id, tarifnr, bezeichnung, einheit, aktiv,
    tarif, tarifziffer, entschaedigungsart, produkt_nr, kostenart, kostenstelle`;

// GET /api/leistungen — alle aktiven Leistungen (alle authentifizierten Benutzer)
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ${FELDER}
             FROM leistung
             WHERE aktiv = TRUE
             ORDER BY produkt_nr, tarifnr`
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
            `SELECT ${FELDER}
             FROM leistung
             ORDER BY produkt_nr, tarifnr`
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
    const { bezeichnung, einheit, tarif, tarifziffer, entschaedigungsart, produkt_nr, kostenart, kostenstelle } = req.body;
    if (!produkt_nr || !bezeichnung) {
        return res.status(400).json({ error: 'Produkt-Nr. und Bezeichnung sind erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO leistung (tarifnr, bezeichnung, einheit, tarif, tarifziffer, entschaedigungsart, produkt_nr, kostenart, kostenstelle)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING ${FELDER}`,
            [produkt_nr.trim(), bezeichnung.trim(), einheit || null,
             tarif || null, tarifziffer?.trim() || null, entschaedigungsart || null,
             produkt_nr.trim(), kostenart?.trim() || null, kostenstelle?.trim() || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Produkt-Nr. bereits vorhanden' });
        }
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Leistung' });
    }
});

// PUT /api/leistungen/:id — bearbeiten oder aktiv-Status setzen (nur Leitungsteam)
router.put('/:id', auth, async (req, res) => {
    if (!LEITUNGSTEAM.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { bezeichnung, einheit, tarif, tarifziffer, entschaedigungsart, produkt_nr, kostenart, kostenstelle, aktiv } = req.body;

    // Nur aktiv-Toggle (Aktivieren/Deaktivieren ohne Vollupdate)
    if (aktiv !== undefined && !produkt_nr && !bezeichnung) {
        try {
            const result = await db.query(
                `UPDATE leistung SET aktiv = $1, updated_at = NOW()
                 WHERE leistung_id = $2
                 RETURNING ${FELDER}`,
                [aktiv === true, req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
            return res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
        }
    }

    if (!produkt_nr || !bezeichnung) {
        return res.status(400).json({ error: 'Produkt-Nr. und Bezeichnung sind erforderlich' });
    }
    try {
        const result = await db.query(
            `UPDATE leistung
             SET tarifnr = $1, bezeichnung = $2, einheit = $3,
                 tarif = $4, tarifziffer = $5, entschaedigungsart = $6,
                 produkt_nr = $7, kostenart = $8, kostenstelle = $9,
                 updated_at = NOW()
             WHERE leistung_id = $10
             RETURNING ${FELDER}`,
            [produkt_nr.trim(), bezeichnung.trim(), einheit || null,
             tarif || null, tarifziffer?.trim() || null, entschaedigungsart || null,
             produkt_nr.trim(), kostenart?.trim() || null, kostenstelle?.trim() || null,
             req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Produkt-Nr. bereits vorhanden' });
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
