// ============================================================
// Route: Externe Personen & Organisationen
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/externe — Organisationen und Einzelpersonen getrennt
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                ep.person_id, ep.nachname, ep.vorname, ep.funktion,
                ep.typ, ep.firma, ep.telefon, ep.email, ep.adresse,
                ep.bemerkung, ep.aktiv,
                ep.ist_organisation, ep.organisation_id,
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
                ) AS klienten,
                CASE WHEN ep.ist_organisation = TRUE THEN
                    COALESCE(
                        (SELECT JSON_AGG(JSONB_BUILD_OBJECT(
                            'person_id', m.person_id,
                            'vorname', m.vorname,
                            'nachname', m.nachname,
                            'funktion', m.funktion,
                            'telefon', m.telefon,
                            'email', m.email
                        ) ORDER BY m.nachname, m.vorname)
                         FROM externe_person m
                         WHERE m.organisation_id = ep.person_id AND m.aktiv = TRUE),
                        '[]'
                    )
                ELSE '[]'::json END AS mitglieder
             FROM externe_person ep
             LEFT JOIN externe_person_dossier epd ON epd.person_id = ep.person_id
             LEFT JOIN dossier d ON d.dossier_id = epd.dossier_id
             LEFT JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             WHERE ep.aktiv = TRUE
             GROUP BY ep.person_id
             ORDER BY ep.ist_organisation DESC NULLS LAST, ep.nachname, ep.vorname`
        );
        const alle = result.rows;
        const organisationen = alle.filter(p => p.ist_organisation);
        const personen = alle.filter(p => !p.ist_organisation && !p.organisation_id);
        res.json({ organisationen, personen });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der externen Personen' });
    }
});

// GET /api/externe/:id/stundenpreise — Stundenpreise einer Organisation
router.get('/:id/stundenpreise', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT sp.id, sp.organisation_id, sp.leistung_id, sp.stundenpreis,
                    l.tarifnr, l.bezeichnung, l.einheit
             FROM organisation_stundenpreis sp
             JOIN leistung l ON l.leistung_id = sp.leistung_id
             WHERE sp.organisation_id = $1
             ORDER BY l.tarifnr`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Stundenpreise' });
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

// POST /api/externe — Neue externe Person / Organisation
router.post('/', auth, async (req, res) => {
    console.log('POST /externe body:', req.body);
    const {
        nachname, vorname, funktion, typ,
        firma, telefon, email, adresse, bemerkung,
        ist_organisation, organisation_id,
    } = req.body;

    if (ist_organisation) {
        if (!firma) return res.status(400).json({ error: 'Name der Organisation ist erforderlich' });
    } else {
        if (!nachname || !vorname) return res.status(400).json({ error: 'Nachname und Vorname erforderlich' });
    }

    // vorname ist in der DB NOT NULL — für Organisationen '' als Fallback (kein Einzelkontakt)
    const effectiveNachname = ist_organisation ? (nachname || firma) : nachname;
    const effectiveVorname = ist_organisation ? (vorname || '') : vorname;

    try {
        const result = await db.query(
            `INSERT INTO externe_person
                (nachname, vorname, funktion, typ, firma, telefon, email, adresse, bemerkung,
                 ist_organisation, organisation_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [effectiveNachname, effectiveVorname, funktion || null, typ || 'Sonstiges',
             firma || null, telefon || null, email || null,
             adresse || null, bemerkung || null,
             ist_organisation || false, organisation_id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// POST /api/externe/:id/stundenpreise — Stundenpreis upsert
router.post('/:id/stundenpreise', auth, async (req, res) => {
    const { leistung_id, stundenpreis } = req.body;
    if (!leistung_id || stundenpreis == null) {
        return res.status(400).json({ error: 'leistung_id und stundenpreis erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO organisation_stundenpreis (organisation_id, leistung_id, stundenpreis)
             VALUES ($1, $2, $3)
             ON CONFLICT (organisation_id, leistung_id) DO UPDATE SET stundenpreis = $3
             RETURNING *`,
            [req.params.id, leistung_id, stundenpreis]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Stundenpreises' });
    }
});

// PUT /api/externe/:id — Person / Organisation aktualisieren
router.put('/:id', auth, async (req, res) => {
    console.log('PUT /externe/:id body:', req.body);
    const {
        nachname, vorname, funktion, typ,
        firma, telefon, email, adresse, bemerkung,
        ist_organisation, organisation_id,
    } = req.body;

    try {
        const result = await db.query(
            `UPDATE externe_person SET
                nachname = $1, vorname = $2, funktion = $3, typ = $4,
                firma = $5, telefon = $6, email = $7,
                adresse = $8, bemerkung = $9, updated_at = NOW(),
                ist_organisation = $10, organisation_id = $11
             WHERE person_id = $12
             RETURNING *`,
            [nachname, vorname, funktion || null, typ || 'Sonstiges',
             firma || null, telefon || null, email || null,
             adresse || null, bemerkung || null,
             ist_organisation || false, organisation_id || null,
             req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// DELETE /api/externe/:id/stundenpreise/:leistung_id — Stundenpreis löschen
router.delete('/:id/stundenpreise/:leistung_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM organisation_stundenpreis
             WHERE organisation_id = $1 AND leistung_id = $2
             RETURNING id`,
            [req.params.id, req.params.leistung_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

// DELETE /api/externe/:id/dossier/:dossier_id — Zuweisung entfernen
router.delete('/:id/dossier/:dossier_id', auth, async (req, res) => {
    try {
        await db.query(
            `DELETE FROM externe_person_dossier WHERE person_id = $1 AND dossier_id = $2`,
            [req.params.id, req.params.dossier_id]
        );
        res.json({ message: 'Zuweisung entfernt' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Entfernen' });
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
