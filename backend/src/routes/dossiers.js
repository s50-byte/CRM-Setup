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
                d.intake_abgeschlossen, d.absage_grund, d.absage_notiz,
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
                zp.person_id AS zuweisende_person_id,
                zp.vorname AS zuweisende_person_vorname,
                zp.nachname AS zuweisende_person_nachname,
                zp.firma AS zuweisende_person_firma,
                d.abteilung,
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
                (SELECT pv2.geplantes_enddatum FROM programm_verlauf pv2
                 WHERE pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend'
                 LIMIT 1) AS geplantes_enddatum,
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
             LEFT JOIN externe_person zp ON zp.person_id = d.zuweisende_person_id
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
                      ag.person_id, ag.vorname, ag.nachname, ag.firma,
                      zp.person_id, zp.vorname, zp.nachname, zp.firma,
                      d.abteilung
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
                    (SELECT COALESCE(ROUND(SUM(dauer_minuten) FILTER (WHERE verrechenbar = TRUE) / 60.0, 1), 0)
                     FROM journal_eintrag WHERE klient_id = d.klient_id) AS ist_verrechenbar,
                    (SELECT COALESCE(ROUND(SUM(dauer_minuten) FILTER (WHERE verrechenbar = FALSE) / 60.0, 1), 0)
                     FROM journal_eintrag WHERE klient_id = d.klient_id) AS ist_nicht_verrechenbar,
                    (SELECT COALESCE(ROUND(SUM(dauer_minuten) / 60.0, 1), 0)
                     FROM journal_eintrag WHERE klient_id = d.klient_id) AS ist_total,
                    (SELECT COALESCE(ROUND(SUM(vp.soll_stunden), 1), 0)
                     FROM verfuegung_position vp
                     JOIN verfuegung v ON v.verfuegung_id = vp.verfuegung_id
                     WHERE v.dossier_id = d.dossier_id AND v.status = 'aktiv') AS soll_total,
                    ag.person_id AS arbeitgeber_id,
                    ag.vorname AS arbeitgeber_vorname,
                    ag.nachname AS arbeitgeber_nachname,
                    ag.firma AS arbeitgeber_firma,
                    zp.person_id AS zuweisende_person_id,
                    zp.vorname AS zuweisende_person_vorname,
                    zp.nachname AS zuweisende_person_nachname,
                    zp.firma AS zuweisende_person_firma
             FROM dossier d
             JOIN klient k ON k.klient_id = d.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             LEFT JOIN externe_person ag ON ag.person_id = d.arbeitgeber_id
             LEFT JOIN externe_person zp ON zp.person_id = d.zuweisende_person_id
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

        const [ziele, externePersonen, phasen] = await Promise.all([
            aktVerlauf
                ? db.query(`SELECT * FROM vereinbarungsziel WHERE verlauf_id = $1 ORDER BY reihenfolge`, [aktVerlauf.verlauf_id])
                : Promise.resolve({ rows: [] }),
            db.query(
                `SELECT ep.person_id, ep.vorname, ep.nachname, ep.typ, ep.firma, epd.rolle
                 FROM externe_person_dossier epd
                 JOIN externe_person ep ON ep.person_id = epd.person_id
                 WHERE epd.dossier_id = $1
                 ORDER BY ep.nachname, ep.vorname`,
                [req.params.id]
            ),
            dossier.rows[0].akt_programm_id
                ? db.query(
                    `SELECT phase_id, label, reihenfolge FROM phase
                     WHERE programm_id = $1 ORDER BY reihenfolge`,
                    [dossier.rows[0].akt_programm_id]
                  )
                : Promise.resolve({ rows: [] }),
        ]);

        res.json({
            ...dossier.rows[0],
            klient_label: aktVerlauf?.klient_label || null,
            programm_verlauf: verlauf.rows,
            zugewiesen: zugewiesen.rows,
            ziele: ziele.rows,
            akt_verlauf_id: aktVerlauf?.verlauf_id || null,
            externe_personen: externePersonen.rows,
            phasen: phasen.rows,
            laufend_start_datum: aktVerlauf?.start_datum || null,
            geplantes_enddatum: aktVerlauf?.geplantes_enddatum || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Dossiers' });
    }
});

// POST /api/dossiers — Neues Dossier
router.post('/', auth, async (req, res) => {
    const { klient_id, auftraggeber, kanal, programm_id, standort_id, klient_label } = req.body;

    if (!klient_id) {
        return res.status(400).json({ error: 'Klient erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO dossier (klient_id, auftraggeber, kanal, akt_programm_id, standort_id, pipeline_status)
             VALUES ($1, $2, $3, $4, $5, 'vorabklaerung')
             RETURNING *`,
            [klient_id, auftraggeber || '', kanal || null, programm_id || null, standort_id || null]
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

// PUT /api/dossiers/:id/intake — Intake-Bucket wechseln oder abschliessen
router.put('/:id/intake', auth, async (req, res) => {
    const { pipeline_status, intake_abgeschlossen, absage_grund, absage_notiz } = req.body;

    try {
        const result = await db.query(
            `UPDATE dossier SET
                pipeline_status = $1, intake_abgeschlossen = $2,
                absage_grund = $3, absage_notiz = $4, updated_at = NOW()
             WHERE dossier_id = $5
             RETURNING *`,
            [pipeline_status, intake_abgeschlossen || false, absage_grund || null, absage_notiz || null, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Dossier nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Intake-Status' });
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

// PUT /api/dossiers/:id/standort — Standortwechsel
router.put('/:id/standort', auth, async (req, res) => {
    const { standort_id, neuer_user_id, alter_user_id, bemerkung } = req.body;
    if (!standort_id) return res.status(400).json({ error: 'standort_id erforderlich' });

    const cl = await require('../db').connect();
    try {
        await cl.query('BEGIN');

        const dosRes = await cl.query(
            `SELECT d.klient_id, st.name AS alter_standort
             FROM dossier d
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             WHERE d.dossier_id = $1`,
            [req.params.id]
        );
        if (dosRes.rows.length === 0) {
            await cl.query('ROLLBACK');
            return res.status(404).json({ error: 'Dossier nicht gefunden' });
        }
        const { klient_id, alter_standort } = dosRes.rows[0];

        const neuerStRes = await cl.query(`SELECT name FROM standort WHERE standort_id = $1`, [standort_id]);
        const neuer_standort = neuerStRes.rows[0]?.name || '';

        await cl.query(
            `UPDATE dossier SET standort_id = $1, updated_at = NOW() WHERE dossier_id = $2`,
            [standort_id, req.params.id]
        );

        if (alter_user_id) {
            await cl.query(
                `UPDATE klient_user SET aktiv = FALSE WHERE klient_id = $1 AND user_id = $2`,
                [klient_id, alter_user_id]
            );
        }
        if (neuer_user_id) {
            await cl.query(
                `INSERT INTO klient_user (klient_id, user_id, rolle_im_fall, stellvertretung)
                 VALUES ($1, $2, 'Klientenführung', FALSE)
                 ON CONFLICT (klient_id, user_id) DO UPDATE SET aktiv = TRUE, rolle_im_fall = 'Klientenführung'`,
                [klient_id, neuer_user_id]
            );
        }

        const titel = `Standortwechsel${alter_standort ? ` von ${alter_standort}` : ''} nach ${neuer_standort}${bemerkung ? ` — ${bemerkung}` : ''}`;
        await cl.query(
            `INSERT INTO zeitachse_eintrag (klient_id, user_id, typ, titel, auto_generated)
             VALUES ($1, $2, 'System', $3, TRUE)`,
            [klient_id, req.user.user_id, titel]
        );

        await cl.query('COMMIT');
        res.json({ message: 'Standort gewechselt' });
    } catch (err) {
        await cl.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Standortwechsel' });
    } finally {
        cl.release();
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

// PUT /api/dossiers/:id/felder — Zuweisende Person + Abteilung + Arbeitgeber + Ausbildung
router.put('/:id/felder', auth, async (req, res) => {
    console.log('PUT /dossiers/:id/felder – req.body:', req.body);
    const erlaubteFelder = [
        'zuweisende_person_id', 'abteilung', 'arbeitgeber_id',
        'ausbildung_beruf', 'ausbildung_abschluss', 'ausbildung_fachrichtung', 'ausbildung_lehrjahr',
    ];
    const sets = [];
    const params = [];
    let p = 1;
    for (const feld of erlaubteFelder) {
        if (feld in req.body) {
            sets.push(`${feld} = $${p++}`);
            params.push(req.body[feld] || null);
        }
    }
    if (sets.length === 0 && !('geplantes_enddatum' in req.body)) {
        return res.json({ message: 'Keine Änderungen' });
    }
    try {
        if (sets.length > 0) {
            params.push(req.params.id);
            await db.query(`UPDATE dossier SET ${sets.join(', ')} WHERE dossier_id = $${p}`, params);
        }
        if ('geplantes_enddatum' in req.body) {
            await db.query(
                `UPDATE programm_verlauf SET geplantes_enddatum = $1 WHERE dossier_id = $2 AND status = 'Laufend'`,
                [req.body.geplantes_enddatum || null, req.params.id]
            );
        }
        res.json({ message: 'Felder aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Felder' });
    }
});

// GET /api/dossiers/:id/phase/:phase_id/kriterien
router.get('/:id/phase/:phase_id/kriterien', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT k.kriterium_id, k.text, k.typ, k.pflicht, k.reihenfolge,
                    ks.erfuellt, ks.erfuellt_am
             FROM kriterium k
             LEFT JOIN kriterium_status ks
               ON ks.kriterium_id = k.kriterium_id
               AND ks.klient_id = (SELECT klient_id FROM dossier WHERE dossier_id = $1)
             WHERE k.phase_id = $2
             ORDER BY k.reihenfolge`,
            [req.params.id, req.params.phase_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Kriterien' });
    }
});

// GET /api/dossiers/:id/phase/:phase_id/zeitraum — Start/Enddatum der Phase
router.get('/:id/phase/:phase_id/zeitraum', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT start_datum, end_datum FROM dossier_phase WHERE dossier_id = $1 AND phase_id = $2`,
            [req.params.id, req.params.phase_id]
        );
        res.json(result.rows[0] || { start_datum: null, end_datum: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Phasen-Zeitraums' });
    }
});

// PUT /api/dossiers/:id/phase/:phase_id/zeitraum — Start/Enddatum der Phase speichern
router.put('/:id/phase/:phase_id/zeitraum', auth, async (req, res) => {
    const { start_datum, end_datum } = req.body;
    try {
        const dossier = await db.query(`SELECT klient_id FROM dossier WHERE dossier_id = $1`, [req.params.id]);
        if (dossier.rows.length === 0) return res.status(404).json({ error: 'Dossier nicht gefunden' });

        const phase = await db.query(`SELECT label FROM phase WHERE phase_id = $1`, [req.params.phase_id]);

        const result = await db.query(
            `INSERT INTO dossier_phase (dossier_id, phase_id, start_datum, end_datum)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (dossier_id, phase_id) DO UPDATE SET
                start_datum = $3, end_datum = $4, updated_at = NOW()
             RETURNING start_datum, end_datum`,
            [req.params.id, req.params.phase_id, start_datum || null, end_datum || null]
        );

        const fmtD = d => d ? new Date(d).toLocaleDateString('de-CH') : '?';
        await db.query(
            `INSERT INTO zeitachse_eintrag (klient_id, user_id, typ, titel, auto_generated)
             VALUES ($1, $2, 'System', $3, TRUE)`,
            [
                dossier.rows[0].klient_id, req.user.user_id,
                `Phase ${phase.rows[0]?.label || ''}: Zeitraum ${fmtD(start_datum)} – ${fmtD(end_datum)} erfasst`,
            ]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Phasen-Zeitraums' });
    }
});

// PUT /api/dossiers/:id/phase/:phase_id/kriterien/:kriterium_id — abhaken toggle
router.put('/:id/phase/:phase_id/kriterien/:kriterium_id', auth, async (req, res) => {
    try {
        const klientRes = await db.query(
            `SELECT klient_id FROM dossier WHERE dossier_id = $1`,
            [req.params.id]
        );
        if (klientRes.rows.length === 0) return res.status(404).json({ error: 'Dossier nicht gefunden' });
        const klient_id = klientRes.rows[0].klient_id;

        const result = await db.query(
            `INSERT INTO kriterium_status (kriterium_id, klient_id, erfuellt, erfuellt_am, erfuellt_von)
             VALUES ($1, $2, TRUE, CURRENT_DATE, $3)
             ON CONFLICT (kriterium_id, klient_id) DO UPDATE
               SET erfuellt    = NOT kriterium_status.erfuellt,
                   erfuellt_am = CASE WHEN kriterium_status.erfuellt = FALSE THEN CURRENT_DATE ELSE NULL END,
                   erfuellt_von = $3
             RETURNING erfuellt, erfuellt_am`,
            [req.params.kriterium_id, klient_id, req.user.user_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Kriteriums' });
    }
});

module.exports = router;
