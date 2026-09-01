const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { hatSpalte } = require('../schema-flags');

// Separate Tabelle (nicht die schema.sql-Tabelle 'dokument', die dateipfad NOT NULL hat)
db.query(`
    CREATE TABLE IF NOT EXISTS phase_dokument (
        dokument_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        klient_id    UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
        phase_id     UUID REFERENCES phase(phase_id) ON DELETE SET NULL,
        dateiname    TEXT NOT NULL,
        typ          TEXT,
        erstellt_am  TIMESTAMPTZ DEFAULT NOW(),
        erstellt_von UUID REFERENCES benutzer(user_id)
    )
`).catch(err => console.error('phase_dokument table init:', err));

// GET /api/dokumente?klient_id=...&phase_id=...
router.get('/', auth, async (req, res) => {
    const { klient_id, phase_id } = req.query;
    if (!klient_id) return res.status(400).json({ error: 'klient_id erforderlich' });
    try {
        const result = await db.query(
            `SELECT d.dokument_id, d.dateiname, d.typ, d.erstellt_am,
                    u.full_name AS erstellt_von_name
             FROM phase_dokument d
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             WHERE d.klient_id = $1
               AND ($2::uuid IS NULL OR d.phase_id = $2)
             ORDER BY d.erstellt_am DESC`,
            [klient_id, phase_id || null]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
    }
});

// POST /api/dokumente
router.post('/', auth, async (req, res) => {
    const { klient_id, phase_id, dateiname, typ } = req.body;
    console.log('[POST /api/dokumente] body:', req.body);
    if (!klient_id || !dateiname?.trim()) {
        return res.status(400).json({ error: 'klient_id und dateiname erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO phase_dokument (klient_id, phase_id, dateiname, typ, erstellt_von)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [klient_id, phase_id || null, dateiname.trim(), typ || null, req.user.user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erfassen des Dokuments' });
    }
});

// GET /api/dokumente/:dok_id — einzelnes Dossier-Dokument
router.get('/:dok_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.dok_id, d.titel, d.inhalt, d.created_at, d.updated_at,
                    v.name AS vorlage_name,
                    u.full_name AS erstellt_von_name
             FROM dossier_dokument d
             LEFT JOIN dokument_vorlage v ON v.vorlage_id = d.vorlage_id
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             WHERE d.dok_id = $1::uuid`,
            [req.params.dok_id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// PUT /api/dokumente/:dok_id — Dossier-Dokument bearbeiten
router.put('/:dok_id', auth, async (req, res) => {
    const { titel, inhalt } = req.body;
    if (!titel?.trim() || !inhalt?.trim()) {
        return res.status(400).json({ error: 'Titel und Inhalt erforderlich' });
    }
    try {
        const result = await db.query(
            `UPDATE dossier_dokument
             SET titel = $1, inhalt = $2, updated_at = NOW()
             WHERE dok_id = $3::uuid
             RETURNING *`,
            [titel.trim(), inhalt.trim(), req.params.dok_id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern' });
    }
});

// DELETE /api/dokumente/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        // Ohne Treffer ein 404: vorher meldete die Route auch dann Erfolg, wenn
        // gar nichts geloescht wurde – die Oberflaeche entfernte den Eintrag
        // lokal, und beim naechsten Laden war er wieder da.
        const r = await db.query(
            `DELETE FROM phase_dokument WHERE dokument_id = $1 RETURNING dokument_id`,
            [req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Dokument nicht gefunden' });
        res.json({ message: 'Dokument gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

// ── Programm-Dokumente (Knowledge Pool) ────────────────────────────────────

db.query(`
    CREATE TABLE IF NOT EXISTS programm_dokument (
        pdok_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        programm_id  UUID NOT NULL REFERENCES programm(programm_id) ON DELETE CASCADE,
        phase_id     UUID REFERENCES phase(phase_id) ON DELETE CASCADE,
        dateiname    TEXT NOT NULL,
        typ          TEXT,
        erstellt_am  TIMESTAMPTZ DEFAULT NOW(),
        erstellt_von UUID REFERENCES benutzer(user_id)
    )
`).catch(err => console.error('programm_dokument table init:', err));

// GET /api/dokumente/programm/:programm_id — Programm-Dokumente (phase_id IS NULL)
// ?mit_phasen=1 liefert zusaetzlich die Dokumente aller Phasen des Programms.
// Die Uebersicht ist eine Zusammenfassung des Ganzen und soll alles zeigen.
router.get('/programm/:programm_id', auth, async (req, res) => {
    try {
        const dateiDa = await hatSpalte('programm_dokument', 'datei_id');
        const mitPhasen = req.query.mit_phasen === '1';
        const result = await db.query(
            `SELECT d.pdok_id, d.dateiname, d.typ, d.erstellt_am,
                    ${dateiDa ? 'd.datei_id,' : 'NULL::uuid AS datei_id,'}
                    d.phase_id, ph.label AS phase_label,
                    u.full_name AS erstellt_von_name
             FROM programm_dokument d
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             LEFT JOIN phase ph ON ph.phase_id = d.phase_id
             WHERE d.programm_id = $1
               ${mitPhasen ? '' : 'AND d.phase_id IS NULL'}
             ORDER BY ph.reihenfolge NULLS FIRST, d.dateiname`,
            [req.params.programm_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// GET /api/dokumente/phase/:phase_id — Phasen-Dokumente
router.get('/phase/:phase_id', auth, async (req, res) => {
    try {
        const dateiDa = await hatSpalte('programm_dokument', 'datei_id');
        const result = await db.query(
            `SELECT d.pdok_id, d.dateiname, d.typ, d.erstellt_am,
                    ${dateiDa ? 'd.datei_id,' : 'NULL::uuid AS datei_id,'}
                    u.full_name AS erstellt_von_name
             FROM programm_dokument d
             LEFT JOIN benutzer u ON u.user_id = d.erstellt_von
             WHERE d.phase_id = $1
             ORDER BY d.erstellt_am DESC`,
            [req.params.phase_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// POST /api/dokumente/programm — Programm-/Phasen-Dokument erstellen
router.post('/programm', auth, async (req, res) => {
    const { programm_id, phase_id, dateiname, typ, datei_id } = req.body;
    if (!programm_id || !dateiname?.trim()) {
        return res.status(400).json({ error: 'programm_id und dateiname erforderlich' });
    }
    try {
        const dateiDa = await hatSpalte('programm_dokument', 'datei_id');
        const result = await db.query(
            dateiDa
                ? `INSERT INTO programm_dokument (programm_id, phase_id, dateiname, typ, erstellt_von, datei_id)
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`
                : `INSERT INTO programm_dokument (programm_id, phase_id, dateiname, typ, erstellt_von)
                   VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            dateiDa
                ? [programm_id, phase_id || null, dateiname.trim(), typ || null, req.user.user_id, datei_id || null]
                : [programm_id, phase_id || null, dateiname.trim(), typ || null, req.user.user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// DELETE /api/dokumente/programm/:id — Programm-Dokument löschen
router.delete('/programm/:id', auth, async (req, res) => {
    try {
        // Die Datei geht mit – sonst bleibt sie als Waise auf der Ablage liegen.
        const dateiDa = await hatSpalte('programm_dokument', 'datei_id');
        const weg = await db.query(
            dateiDa
                ? `DELETE FROM programm_dokument WHERE pdok_id = $1 RETURNING datei_id`
                : `DELETE FROM programm_dokument WHERE pdok_id = $1 RETURNING NULL::uuid AS datei_id`,
            [req.params.id]
        );
        const datei_id = weg.rows[0]?.datei_id;
        if (datei_id) {
            const d = await db.query(
                `DELETE FROM datei WHERE datei_id = $1 RETURNING ablage, schluessel`, [datei_id]
            );
            if (d.rows.length) {
                await require('../dateiablage').loeschen(d.rows[0].ablage, d.rows[0].schluessel);
            }
        }
        res.json({ message: 'Dokument gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;
