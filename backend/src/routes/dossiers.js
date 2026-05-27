// ============================================================
// Route: Dossiers
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/dossiers — Alle Dossiers
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                d.dossier_id, d.auftraggeber, d.kanal,
                d.eingang_datum, d.pipeline_status, d.abbruch_grund,
                k.klient_id, k.nachname, k.vorname,
                p.name AS programm_name, p.farbe_hex, p.avg_dauer_tage,
                ph.label AS phase_label,
                d.standort_id,
                st.name AS standort_name,
                st.kuerzel AS standort_kuerzel,
                ag.person_id AS arbeitgeber_id,
                ag.vorname AS arbeitgeber_vorname,
                ag.nachname AS arbeitgeber_nachname,
                ag.firma AS arbeitgeber_firma,
                -- Zugewiesene Personen
                COALESCE(
                    JSON_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'user_id', u.user_id,
                            'full_name', u.full_name,
                            'rolle_im_fall', ku.rolle_im_fall,
                            'stellvertretung', ku.stellvertretung,
                            'avatar_initials', u.avatar_initials
                        )
                    ) FILTER (WHERE u.user_id IS NOT NULL),
                    '[]'
                ) AS zugewiesen,
                -- Klient-Label + Start-Datum aus laufendem Programmverlauf
                (SELECT pv2.klient_label FROM programm_verlauf pv2
                 WHERE pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend'
                 LIMIT 1) AS klient_label,
                (SELECT pv2.start_datum FROM programm_verlauf pv2
                 WHERE pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend'
                 LIMIT 1) AS laufend_start_datum,
                -- Programmverlauf
                COALESCE(
                    JSON_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'verlauf_id', pv.verlauf_id,
                            'programm_name', pp.name,
                            'farbe_hex', pp.farbe_hex,
                            'start_datum', pv.start_datum,
                            'end_datum', pv.end_datum,
                            'status', pv.status,
                            'klient_label', pv.klient_label
                        )
                    ) FILTER (WHERE pv.verlauf_id IS NOT NULL),
                    '[]'
                ) AS programm_verlauf,
                -- Offene Tasks
                COUNT(DISTINCT t.task_id) FILTER (WHERE t.erledigt = FALSE) AS offene_tasks,
                -- Ziele (laufendes Programm)
                (SELECT COUNT(*) FROM vereinbarungsziel vz
                 JOIN programm_verlauf pv2 ON pv2.verlauf_id = vz.verlauf_id
                 WHERE pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend') AS ziele_total,
                (SELECT COUNT(*) FROM vereinbarungsziel vz
                 JOIN programm_verlauf pv2 ON pv2.verlauf_id = vz.verlauf_id
                 WHERE pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend' AND vz.erreicht = TRUE) AS ziele_erreicht
             FROM dossier d
             JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             LEFT JOIN klient_user ku ON ku.klient_id = k.klient_id AND ku.aktiv = TRUE
             LEFT JOIN benutzer u ON u.user_id = ku.user_id
             LEFT JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id
             LEFT JOIN programm pp ON pp.programm_id = pv.programm_id
             LEFT JOIN task t ON t.klient_id = k.klient_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             LEFT JOIN externe_person ag ON ag.person_id = d.arbeitgeber_id
             WHERE k.aktiv = TRUE
             AND ($1::uuid IS NULL OR EXISTS (
                 SELECT 1 FROM klient_user ku2
                 WHERE ku2.klient_id = k.klient_id
                 AND ku2.user_id = $1
                 AND ku2.aktiv = TRUE
             ))
             GROUP BY d.dossier_id, k.klient_id, k.nachname, k.vorname,
                      p.name, p.farbe_hex, p.avg_dauer_tage, ph.label,
                      d.standort_id, st.name, st.kuerzel,
                      ag.person_id, ag.vorname, ag.nachname, ag.firma
             ORDER BY k.nachname, k.vorname`,
            [req.query.meine === 'true' ? req.user.user_id : null]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Dossiers' });
    }
});

// GET /api/dossiers/:id — Einzelnes Dossier
router.get('/:id', auth, async (req, res) => {
    try {
        const dossier = await db.query(
            `SELECT d.*, k.*, p.name AS programm_name, p.farbe_hex, p.avg_dauer_tage,
                    ph.label AS phase_label,
                    st.name AS standort_name, st.kuerzel AS standort_kuerzel,
                    lv.pensum_pct,
                    ag.person_id AS arbeitgeber_id,
                    ag.vorname AS arbeitgeber_vorname,
                    ag.nachname AS arbeitgeber_nachname,
                    ag.firma AS arbeitgeber_firma
             FROM dossier d
             JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             LEFT JOIN externe_person ag ON ag.person_id = d.arbeitgeber_id
             LEFT JOIN LATERAL (
                 SELECT pensum_pct FROM leistungsvereinbarung
                 WHERE klient_id = d.klient_id
                 ORDER BY created_at DESC LIMIT 1
             ) lv ON TRUE
             WHERE d.dossier_id = $1`,
            [req.params.id]
        );

        if (dossier.rows.length === 0) {
            return res.status(404).json({ error: 'Dossier nicht gefunden' });
        }

        // Programmverlauf
        const verlauf = await db.query(
            `SELECT pv.*, p.name AS programm_name, p.farbe_hex,
                    ph.label AS phase_label
             FROM programm_verlauf pv
             JOIN programm p ON p.programm_id = pv.programm_id
             LEFT JOIN phase ph ON ph.phase_id = pv.phase_id
             WHERE pv.dossier_id = $1
             ORDER BY pv.start_datum ASC NULLS LAST`,
            [req.params.id]
        );

        // Zugewiesene Personen
        const zugewiesen = await db.query(
            `SELECT u.user_id, u.full_name, u.avatar_initials,
                    ku.rolle_im_fall, ku.stellvertretung
             FROM klient_user ku
             JOIN benutzer u ON u.user_id = ku.user_id
             WHERE ku.klient_id = $1 AND ku.aktiv = TRUE`,
            [dossier.rows[0].klient_id]
        );

        const aktVerlauf = verlauf.rows.find(v => v.status === 'Laufend')
            || verlauf.rows.find(v => v.klient_label);

        const ziele = aktVerlauf ? await db.query(
            `SELECT * FROM vereinbarungsziel WHERE verlauf_id = $1 ORDER BY reihenfolge`,
            [aktVerlauf.verlauf_id]
        ) : { rows: [] };

        res.json({
            ...dossier.rows[0],
            klient_label: aktVerlauf?.klient_label || null,
            programm_verlauf: verlauf.rows,
            zugewiesen: zugewiesen.rows,
            ziele: ziele.rows,
            akt_verlauf_id: aktVerlauf?.verlauf_id || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Dossiers' });
    }
});

// POST /api/dossiers — Neues Dossier
router.post('/', auth, async (req, res) => {
    const { klient_id, auftraggeber, kanal, programm_id, standort_id, klient_label } = req.body;

    if (!klient_id || !auftraggeber) {
        return res.status(400).json({ error: 'Klient und Auftraggeber erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO dossier (klient_id, auftraggeber, kanal, akt_programm_id, standort_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [klient_id, auftraggeber, kanal || null, programm_id || null, standort_id || null]
        );

        if (programm_id) {
            await db.query(
                `INSERT INTO programm_verlauf (dossier_id, programm_id, status, klient_label)
                 VALUES ($1, $2, 'Geplant', $3)`,
                [result.rows[0].dossier_id, programm_id, klient_label || null]
            );
        }

        // Zeitachse-Eintrag
        await db.query(
            `INSERT INTO zeitachse_eintrag (klient_id, user_id, typ, titel, auto_generated)
             VALUES ($1, $2, 'Anfrage', 'Dossier eröffnet', TRUE)`,
            [klient_id, req.user.user_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen des Dossiers' });
    }
});

// PUT /api/dossiers/:id/phase — Phase wechseln
router.put('/:id/phase', auth, async (req, res) => {
    const { phase_id, programm_id } = req.body;

    try {
        const phase = await db.query(
            `SELECT label FROM phase WHERE phase_id = $1`,
            [phase_id]
        );

        const dossier = await db.query(
            `UPDATE dossier SET
                akt_phase_id = $1,
                akt_programm_id = COALESCE($2, akt_programm_id),
                pipeline_status = CASE
                    WHEN $3 = 'Erstkontakt'   THEN 'Erstkontakt'::pipeline_status
                    WHEN $3 = 'Abklärung'     THEN 'In Abklärung'::pipeline_status
                    WHEN $3 = 'Erstgespräch'  THEN 'Erstgespräch'::pipeline_status
                    WHEN $3 = 'Schnupper'     THEN 'Schnupper'::pipeline_status
                    WHEN $3 = 'Programmstart' THEN 'Programmstart'::pipeline_status
                    ELSE pipeline_status
                END,
                updated_at = NOW()
             WHERE dossier_id = $4
             RETURNING *`,
            [phase_id, programm_id || null, phase.rows[0]?.label, req.params.id]
        );

        // Zeitachse-Eintrag
        const klientId = dossier.rows[0].klient_id;
        await db.query(
            `INSERT INTO zeitachse_eintrag (klient_id, user_id, typ, titel, auto_generated)
             VALUES ($1, $2, 'Phasenwechsel', $3, TRUE)`,
            [klientId, req.user.user_id, `Phase gewechselt → ${phase.rows[0]?.label}`]
        );

        res.json(dossier.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Phasenwechsel' });
    }
});

// DELETE /api/dossiers/:id/zuweisung/:user_id — Zuweisung entfernen
router.delete('/:id/zuweisung/:user_id', auth, async (req, res) => {
    try {
        const dossier = await db.query(
            `SELECT klient_id FROM dossier WHERE dossier_id = $1`,
            [req.params.id]
        );
        if (dossier.rows.length === 0) {
            return res.status(404).json({ error: 'Dossier nicht gefunden' });
        }
        await db.query(
            `DELETE FROM klient_user WHERE klient_id = $1 AND user_id = $2`,
            [dossier.rows[0].klient_id, req.params.user_id]
        );
        res.json({ message: 'Zuweisung entfernt' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Entfernen der Zuweisung' });
    }
});

// POST /api/dossiers/:id/zuweisung — Person zuweisen
router.post('/:id/zuweisung', auth, async (req, res) => {
    const { user_id, rolle_im_fall, stellvertretung } = req.body;

    try {
        const dossier = await db.query(
            `SELECT klient_id FROM dossier WHERE dossier_id = $1`,
            [req.params.id]
        );

        await db.query(
            `INSERT INTO klient_user (klient_id, user_id, rolle_im_fall, stellvertretung)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (klient_id, user_id) DO UPDATE SET
                rolle_im_fall = $3, stellvertretung = $4, aktiv = TRUE`,
            [dossier.rows[0].klient_id, user_id, rolle_im_fall, stellvertretung || false]
        );

        res.json({ message: 'Person zugewiesen' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler bei der Zuweisung' });
    }
});

// POST /api/dossiers/:id/ziele — Neues Ziel erstellen
router.post('/:id/ziele', auth, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text erforderlich' });
    try {
        const verlauf = await db.query(
            `SELECT verlauf_id FROM programm_verlauf WHERE dossier_id = $1 AND status = 'Laufend' LIMIT 1`,
            [req.params.id]
        );
        if (verlauf.rows.length === 0) return res.status(404).json({ error: 'Kein laufender Programmverlauf' });
        const verlauf_id = verlauf.rows[0].verlauf_id;
        const count = await db.query(`SELECT COUNT(*) FROM vereinbarungsziel WHERE verlauf_id = $1`, [verlauf_id]);
        const reihenfolge = parseInt(count.rows[0].count);
        const result = await db.query(
            `INSERT INTO vereinbarungsziel (verlauf_id, text, reihenfolge) VALUES ($1,$2,$3) RETURNING *`,
            [verlauf_id, text.trim(), reihenfolge]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen des Ziels' });
    }
});

// PUT /api/dossiers/:id/ziele/:ziel_id — Ziel abhaken
router.put('/:id/ziele/:ziel_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE vereinbarungsziel
             SET erreicht = NOT erreicht,
                 erreicht_am = CASE WHEN erreicht = FALSE THEN CURRENT_DATE ELSE NULL END
             WHERE ziel_id = $1 RETURNING *`,
            [req.params.ziel_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ziel nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Ziels' });
    }
});

// DELETE /api/dossiers/:id/ziele/:ziel_id — Ziel löschen
router.delete('/:id/ziele/:ziel_id', auth, async (req, res) => {
    try {
        await db.query(`DELETE FROM vereinbarungsziel WHERE ziel_id = $1`, [req.params.ziel_id]);
        res.json({ message: 'Ziel gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen des Ziels' });
    }
});

// PUT /api/dossiers/:id/arbeitgeber — Arbeitgeber zuweisen
router.put('/:id/arbeitgeber', auth, async (req, res) => {
    const { arbeitgeber_id } = req.body;
    try {
        await db.query(
            `UPDATE dossier SET arbeitgeber_id = $1 WHERE dossier_id = $2`,
            [arbeitgeber_id || null, req.params.id]
        );
        res.json({ message: 'Arbeitgeber aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Setzen des Arbeitgebers' });
    }
});

module.exports = router;