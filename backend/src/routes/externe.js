// ============================================================
// Route: Externe Personen
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/externe — Alle externen Personen
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                ep.person_id, ep.nachname, ep.vorname, ep.funktion,
                ep.typ, ep.firma, ep.telefon, ep.email, ep.adresse,
                ep.bemerkung, ep.aktiv,
                COUNT(DISTINCT epd.dossier_id) AS anzahl_klienten,
                COALESCE(
                    JSON_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'dossier_id', d.dossier_id,
                            'nachname', k.nachname,
                            'vorname', k.vorname,
                            'programm_name', p.name,
                            'farbe_hex', p.farbe_hex,
                            'rolle', epd.rolle
                        )
                    ) FILTER (WHERE epd.dossier_id IS NOT NULL),
                    '[]'
                ) AS klienten
             FROM externe_person ep
             LEFT JOIN externe_person_dossier epd ON epd.person_id = ep.person_id
             LEFT JOIN dossier d ON d.dossier_id = epd.dossier_id
             LEFT JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             WHERE ep.aktiv = TRUE
             GROUP BY ep.person_id
             ORDER BY ep.nachname, ep.vorname`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der externen Personen' });
    }
});

// GET /api/externe/:id — Einzelne externe Person
router.get('/:id', auth, async (req, res) => {
    try {
        const person = await db.query(
            `SELECT * FROM externe_person WHERE person_id = $1`,
            [req.params.id]
        );

        if (person.rows.length === 0) {
            return res.status(404).json({ error: 'Person nicht gefunden' });
        }

        const klienten = await db.query(
            `SELECT
                d.dossier_id, k.nachname, k.vorname,
                p.name AS programm_name, p.farbe_hex,
                ph.label AS phase_label,
                d.pipeline_status, epd.rolle
             FROM externe_person_dossier epd
             JOIN dossier d ON d.dossier_id = epd.dossier_id
             JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             WHERE epd.person_id = $1`,
            [req.params.id]
        );

        res.json({ ...person.rows[0], klienten: klienten.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// POST /api/externe — Neue externe Person
router.post('/', auth, async (req, res) => {
    const {
        nachname, vorname, funktion, typ,
        firma, telefon, email, adresse, bemerkung
    } = req.body;

    if (!nachname || !vorname) {
        return res.status(400).json({ error: 'Nachname und Vorname erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO externe_person
                (nachname, vorname, funktion, typ, firma, telefon, email, adresse, bemerkung)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [nachname, vorname, funktion || null, typ || 'Sonstiges',
             firma || null, telefon || null, email || null,
             adresse || null, bemerkung || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// PUT /api/externe/:id — Person aktualisieren
router.put('/:id', auth, async (req, res) => {
    const {
        nachname, vorname, funktion, typ,
        firma, telefon, email, adresse, bemerkung
    } = req.body;

    try {
        const result = await db.query(
            `UPDATE externe_person SET
                nachname = $1, vorname = $2, funktion = $3, typ = $4,
                firma = $5, telefon = $6, email = $7,
                adresse = $8, bemerkung = $9, updated_at = NOW()
             WHERE person_id = $10
             RETURNING *`,
            [nachname, vorname, funktion || null, typ || 'Sonstiges',
             firma || null, telefon || null, email || null,
             adresse || null, bemerkung || null, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// POST /api/externe/:id/dossier — Person einem Dossier zuweisen
router.post('/:id/dossier', auth, async (req, res) => {
    const { dossier_id, rolle } = req.body;

    try {
        await db.query(
            `INSERT INTO externe_person_dossier (person_id, dossier_id, rolle)
             VALUES ($1, $2, $3)
             ON CONFLICT (person_id, dossier_id) DO UPDATE SET rolle = $3`,
            [req.params.id, dossier_id, rolle || 'Sonstiges']
        );
        res.json({ message: 'Person zugewiesen' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler bei der Zuweisung' });
    }
});

module.exports = router;