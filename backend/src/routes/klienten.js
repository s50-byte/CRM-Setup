// ============================================================
// Route: Klienten (Stammdaten)
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/klienten — Alle Klienten
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                k.klient_id, k.nachname, k.vorname, k.geburtsdatum,
                k.ahv_nummer, k.telefon, k.email, k.adresse, k.plz, k.ort,
                k.notfall_name, k.notfall_beziehung, k.notfall_telefon,
                k.vertreter_name, k.vertreter_funktion, k.vertreter_telefon,
                k.created_at,
                lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                d.dossier_id, d.auftraggeber, d.pipeline_status,
                p.name AS programm_name, p.farbe_hex,
                ph.label AS phase_label
             FROM klient k
             LEFT JOIN leistungsvereinbarung lv ON lv.klient_id = k.klient_id
             LEFT JOIN dossier d ON d.klient_id = k.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             WHERE k.aktiv = TRUE
             ORDER BY k.nachname, k.vorname`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Klienten' });
    }
});

// GET /api/klienten/:id — Einzelner Klient
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                k.*,
                lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                lv.bemerkung AS lv_bemerkung
             FROM klient k
             LEFT JOIN leistungsvereinbarung lv ON lv.klient_id = k.klient_id
             WHERE k.klient_id = $1 AND k.aktiv = TRUE`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klient nicht gefunden' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Klienten' });
    }
});

// POST /api/klienten — Neuer Klient
router.post('/', auth, async (req, res) => {
    const {
        nachname, vorname, geburtsdatum, ahv_nummer,
        adresse, plz, ort, telefon, email,
        notfall_name, notfall_beziehung, notfall_telefon,
        vertreter_name, vertreter_funktion, vertreter_telefon
    } = req.body;

    if (!nachname || !vorname) {
        return res.status(400).json({ error: 'Nachname und Vorname erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO klient (
                nachname, vorname, geburtsdatum, ahv_nummer,
                adresse, plz, ort, telefon, email,
                notfall_name, notfall_beziehung, notfall_telefon,
                vertreter_name, vertreter_funktion, vertreter_telefon
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [
                nachname, vorname, geburtsdatum || null, ahv_nummer || null,
                adresse || null, plz || null, ort || null,
                telefon || null, email || null,
                notfall_name || null, notfall_beziehung || null, notfall_telefon || null,
                vertreter_name || null, vertreter_funktion || null, vertreter_telefon || null
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'AHV-Nummer bereits vorhanden' });
        }
        res.status(500).json({ error: 'Fehler beim Erstellen des Klienten' });
    }
});

// PUT /api/klienten/:id — Klient aktualisieren
router.put('/:id', auth, async (req, res) => {
    const {
        nachname, vorname, geburtsdatum, ahv_nummer,
        adresse, plz, ort, telefon, email,
        notfall_name, notfall_beziehung, notfall_telefon,
        vertreter_name, vertreter_funktion, vertreter_telefon
    } = req.body;

    try {
        const result = await db.query(
            `UPDATE klient SET
                nachname = $1, vorname = $2, geburtsdatum = $3,
                ahv_nummer = $4, adresse = $5, plz = $6, ort = $7,
                telefon = $8, email = $9,
                notfall_name = $10, notfall_beziehung = $11, notfall_telefon = $12,
                vertreter_name = $13, vertreter_funktion = $14, vertreter_telefon = $15,
                updated_at = NOW()
             WHERE klient_id = $16 AND aktiv = TRUE
             RETURNING *`,
            [
                nachname, vorname, geburtsdatum || null, ahv_nummer || null,
                adresse || null, plz || null, ort || null,
                telefon || null, email || null,
                notfall_name || null, notfall_beziehung || null, notfall_telefon || null,
                vertreter_name || null, vertreter_funktion || null, vertreter_telefon || null,
                req.params.id
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Klient nicht gefunden' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// DELETE /api/klienten/:id — Klient deaktivieren (soft delete)
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query(
            `UPDATE klient SET aktiv = FALSE, updated_at = NOW()
             WHERE klient_id = $1`,
            [req.params.id]
        );
        res.json({ message: 'Klient deaktiviert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Deaktivieren' });
    }
});

module.exports = router;