// ============================================================
// Route: Klienten (Stammdaten)
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { hatTabelle } = require('../schema-flags');

// Ein Dossier gilt als reine Intake-Anfrage, solange der Intake nicht
// abgeschlossen ist. Solche Datensaetze sind noch keine gefuehrten Klienten und
// werden in der Klientenliste nur auf Wunsch angezeigt (Feedback 06.07.2026).
const INTAKE_PENDING = `(d.intake_abgeschlossen IS NOT TRUE AND d.dossier_id IS NOT NULL)`;

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
                ph.label AS phase_label,
                st.kuerzel AS standort_kuerzel, st.name AS standort_name,
                ${INTAKE_PENDING} AS intake_pending
             FROM klient k
             LEFT JOIN leistungsvereinbarung lv ON lv.klient_id = k.klient_id
             LEFT JOIN dossier d ON d.klient_id = k.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             WHERE k.aktiv = TRUE
               AND ($1 OR NOT ${INTAKE_PENDING})
             ORDER BY k.nachname, k.vorname`,
            [req.query.intake === 'inkl']
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Klienten' });
    }
});

// GET /api/klienten/meine — Klienten des eingeloggten Benutzers
router.get('/meine', auth, async (req, res) => {
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
                ph.label AS phase_label,
                st.kuerzel AS standort_kuerzel, st.name AS standort_name
             FROM klient k
             JOIN klient_user ku ON ku.klient_id = k.klient_id
                AND ku.user_id = $1 AND ku.aktiv = TRUE
             LEFT JOIN leistungsvereinbarung lv ON lv.klient_id = k.klient_id
             LEFT JOIN dossier d ON d.klient_id = k.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             WHERE k.aktiv = TRUE
             ORDER BY k.nachname, k.vorname`,
            [req.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der eigenen Klienten' });
    }
});

// GET /api/klienten/:id — Einzelner Klient
router.get('/:id', auth, async (req, res) => {
    try {
        const nkDa = await hatTabelle('klient_notfallkontakt');
        const result = await db.query(
            `SELECT
                k.*,
                lv.lv_id, lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                lv.bemerkung AS lv_bemerkung,
                lv.gueltig_ab, lv.gueltig_bis,
                d.dossier_id,
                ${nkDa ? "COALESCE(nk.kontakte, '[]'::json)" : "'[]'::json"} AS notfallkontakte
             FROM klient k
             ${nkDa ? `LEFT JOIN LATERAL (
                 SELECT JSON_AGG(JSON_BUILD_OBJECT(
                            'kontakt_id', kontakt_id,
                            'name',       name,
                            'beziehung',  beziehung,
                            'telefon',    telefon,
                            'reihenfolge', reihenfolge
                        ) ORDER BY reihenfolge, created_at) AS kontakte
                 FROM klient_notfallkontakt
                 WHERE klient_id = k.klient_id
             ) nk ON TRUE` : ''}
             LEFT JOIN LATERAL (
                 SELECT * FROM leistungsvereinbarung
                 WHERE klient_id = k.klient_id
                 ORDER BY created_at DESC LIMIT 1
             ) lv ON TRUE
             LEFT JOIN dossier d ON d.klient_id = k.klient_id
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
        vertreter_name, vertreter_funktion, vertreter_telefon,
        anrede
    } = req.body;

    try {
        const result = await db.query(
            `UPDATE klient SET
                nachname = $1, vorname = $2, geburtsdatum = $3,
                ahv_nummer = $4, adresse = $5, plz = $6, ort = $7,
                telefon = $8, email = $9,
                notfall_name = $10, notfall_beziehung = $11, notfall_telefon = $12,
                vertreter_name = $13, vertreter_funktion = $14, vertreter_telefon = $15,
                anrede = $16,
                updated_at = NOW()
             WHERE klient_id = $17 AND aktiv = TRUE
             RETURNING *`,
            [
                nachname, vorname, geburtsdatum || null, ahv_nummer || null,
                adresse || null, plz || null, ort || null,
                telefon || null, email || null,
                notfall_name || null, notfall_beziehung || null, notfall_telefon || null,
                vertreter_name || null, vertreter_funktion || null, vertreter_telefon || null,
                anrede || null,
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
// POST /api/klienten/:id/lv — Neue Leistungsvereinbarung erstellen
router.post('/:id/lv', auth, async (req, res) => {
    const { pensum_pct, tage_mo, tage_di, tage_mi, tage_do, tage_fr,
            zeit_von, zeit_bis, zeitbasis, bemerkung, gueltig_ab, gueltig_bis } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO leistungsvereinbarung
                (klient_id, pensum_pct, tage_mo, tage_di, tage_mi, tage_do, tage_fr,
                 zeit_von, zeit_bis, zeitbasis, bemerkung, gueltig_ab, gueltig_bis)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [req.params.id, pensum_pct,
             tage_mo ?? true, tage_di ?? true, tage_mi ?? true, tage_do ?? true, tage_fr ?? true,
             zeit_von || '08:00', zeit_bis || '17:00',
             zeitbasis || 'Ganztagesbasis',
             bemerkung || null,
             gueltig_ab || new Date().toISOString().slice(0, 10),
             gueltig_bis || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der LV' });
    }
});

// PUT /api/klienten/:id/lv — Bestehende Leistungsvereinbarung aktualisieren
router.put('/:id/lv', auth, async (req, res) => {
    const { pensum_pct, tage_mo, tage_di, tage_mi, tage_do, tage_fr,
            zeit_von, zeit_bis, zeitbasis, bemerkung, gueltig_ab, gueltig_bis } = req.body;
    try {
        const result = await db.query(
            `UPDATE leistungsvereinbarung SET
                pensum_pct = $1, tage_mo = $2, tage_di = $3, tage_mi = $4,
                tage_do = $5, tage_fr = $6, zeit_von = $7, zeit_bis = $8,
                zeitbasis = $9, bemerkung = $10, gueltig_ab = $11,
                gueltig_bis = $12, updated_at = NOW()
             WHERE klient_id = $13
             RETURNING *`,
            [pensum_pct,
             tage_mo ?? true, tage_di ?? true, tage_mi ?? true, tage_do ?? true, tage_fr ?? true,
             zeit_von || '08:00', zeit_bis || '17:00',
             zeitbasis || 'Ganztagesbasis',
             bemerkung || null,
             gueltig_ab || new Date().toISOString().slice(0, 10),
             gueltig_bis || null,
             req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der LV' });
    }
});

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

// ------------------------------------------------------------------
// Notfallkontakte — mehrere je Klient
// ------------------------------------------------------------------

// GET /api/klienten/:id/notfallkontakte
router.get('/:id/notfallkontakte', auth, async (req, res) => {
    if (!await hatTabelle('klient_notfallkontakt')) {
        return res.status(503).json({ error: 'Notfallkontakte sind noch nicht migriert (add-notfallkontakte.sql)' });
    }
    try {
        const r = await db.query(
            `SELECT kontakt_id, name, beziehung, telefon, reihenfolge
             FROM klient_notfallkontakt WHERE klient_id = $1
             ORDER BY reihenfolge, created_at`,
            [req.params.id]
        );
        res.json(r.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Notfallkontakte' });
    }
});

// POST /api/klienten/:id/notfallkontakte
router.post('/:id/notfallkontakte', auth, async (req, res) => {
    const { name, beziehung, telefon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });
    if (!await hatTabelle('klient_notfallkontakt')) {
        return res.status(503).json({ error: 'Notfallkontakte sind noch nicht migriert (add-notfallkontakte.sql)' });
    }
    try {
        const r = await db.query(
            `INSERT INTO klient_notfallkontakt (klient_id, name, beziehung, telefon, reihenfolge)
             VALUES ($1, $2, $3, $4,
                     COALESCE((SELECT MAX(reihenfolge) + 1 FROM klient_notfallkontakt WHERE klient_id = $1), 0))
             RETURNING kontakt_id, name, beziehung, telefon, reihenfolge`,
            [req.params.id, name.trim(), beziehung || null, telefon || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Notfallkontakts' });
    }
});

// PUT /api/klienten/:id/notfallkontakte/:kontakt_id
router.put('/:id/notfallkontakte/:kontakt_id', auth, async (req, res) => {
    const { name, beziehung, telefon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name ist erforderlich' });
    if (!await hatTabelle('klient_notfallkontakt')) {
        return res.status(503).json({ error: 'Notfallkontakte sind noch nicht migriert (add-notfallkontakte.sql)' });
    }
    try {
        const r = await db.query(
            `UPDATE klient_notfallkontakt
             SET name = $1, beziehung = $2, telefon = $3, updated_at = NOW()
             WHERE kontakt_id = $4 AND klient_id = $5
             RETURNING kontakt_id, name, beziehung, telefon, reihenfolge`,
            [name.trim(), beziehung || null, telefon || null, req.params.kontakt_id, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Notfallkontakt nicht gefunden' });
        res.json(r.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Notfallkontakts' });
    }
});

// DELETE /api/klienten/:id/notfallkontakte/:kontakt_id
router.delete('/:id/notfallkontakte/:kontakt_id', auth, async (req, res) => {
    if (!await hatTabelle('klient_notfallkontakt')) {
        return res.status(503).json({ error: 'Notfallkontakte sind noch nicht migriert (add-notfallkontakte.sql)' });
    }
    try {
        const r = await db.query(
            `DELETE FROM klient_notfallkontakt WHERE kontakt_id = $1 AND klient_id = $2 RETURNING kontakt_id`,
            [req.params.kontakt_id, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Notfallkontakt nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen des Notfallkontakts' });
    }
});

module.exports = router;