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
                p.name AS programm_name, p.farbe_hex,
                ph.label AS phase_label,
                d.standort_id,
                st.name AS standort_name,
                st.kuerzel AS standort_kuerzel,
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
                -- Klient-Label aus laufendem Programmverlauf
                (SELECT pv2.klient_label FROM programm_verlauf pv2
                 WHERE pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend'
                 LIMIT 1) AS klient_label,
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
                COUNT(DISTINCT t.task_id) FILTER (WHERE t.erledigt = FALSE) AS offene_tasks
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
             WHERE k.aktiv = TRUE
             GROUP BY d.dossier_id, k.klient_id, k.nachname, k.vorname,
                      p.name, p.farbe_hex, ph.label,
                      d.standort_id, st.name, st.kuerzel
             ORDER BY k.nachname, k.vorname`
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
            `SELECT d.*, k.*, p.name AS programm_name, p.farbe_hex,
                    ph.label AS phase_label,
                    st.name AS standort_name, st.kuerzel AS standort_kuerzel,
                    lv.pensum_pct
             FROM dossier d
             JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
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
        res.json({
            ...dossier.rows[0],
            klient_label: aktVerlauf?.klient_label || null,
            programm_verlauf: verlauf.rows,
            zugewiesen: zugewiesen.rows
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

module.exports = router;