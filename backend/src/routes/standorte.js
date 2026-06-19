const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/standorte — Alle Standorte inkl. zugewiesener Benutzer
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                s.*,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'user_id', u.user_id,
                            'full_name', u.full_name,
                            'avatar_initials', u.avatar_initials,
                            'rollen', (
                                SELECT COALESCE(JSON_AGG(ba.rolle_name ORDER BY ba.rolle_name), '[]'::json)
                                FROM benutzer_aufgabe ba
                                WHERE ba.user_id = u.user_id
                            )
                        ) ORDER BY u.full_name
                    ) FILTER (WHERE u.user_id IS NOT NULL),
                    '[]'
                ) AS benutzer
             FROM standort s
             LEFT JOIN benutzer_standort bs ON bs.standort_id = s.standort_id
             LEFT JOIN benutzer u ON u.user_id = bs.user_id AND u.aktiv = TRUE
             WHERE s.aktiv = TRUE
             GROUP BY s.standort_id
             ORDER BY s.name`
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

const LEHRBERUFE = ['Informatik', 'Kaufmann/frau', 'Kundendialog', 'Logistik'];

// GET /api/standorte/:id/lehrberufe — Alle 4 Lehrberufe mit Status für diesen Standort
router.get('/:id/lehrberufe', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT beruf, aktiv, bewilligte_plaetze, total_plaetze
             FROM standort_lehrberuf WHERE standort_id = $1`,
            [req.params.id]
        );
        const byBeruf = {};
        for (const row of result.rows) byBeruf[row.beruf] = row;
        res.json(LEHRBERUFE.map(beruf => byBeruf[beruf] || {
            beruf, aktiv: false, bewilligte_plaetze: 0, total_plaetze: 0,
        }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Lehrberufe' });
    }
});

// PUT /api/standorte/:id/lehrberufe/:beruf — Lehrberuf-Status für diesen Standort speichern
router.put('/:id/lehrberufe/:beruf', auth, async (req, res) => {
    if (!['leitungsteam', 'admin'].includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    if (!LEHRBERUFE.includes(req.params.beruf)) {
        return res.status(400).json({ error: 'Unbekannter Lehrberuf' });
    }
    const { aktiv, bewilligte_plaetze, total_plaetze } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO standort_lehrberuf (standort_id, beruf, aktiv, bewilligte_plaetze, total_plaetze, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (standort_id, beruf) DO UPDATE SET
                aktiv = $3, bewilligte_plaetze = $4, total_plaetze = $5, updated_at = NOW()
             RETURNING beruf, aktiv, bewilligte_plaetze, total_plaetze`,
            [req.params.id, req.params.beruf, aktiv === true, parseInt(bewilligte_plaetze) || 0, parseInt(total_plaetze) || 0]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Lehrberufs' });
    }
});

module.exports = router;