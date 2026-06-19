// ============================================================
// Route: Klientenbesprechung
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/klientenbesprechung — Aktive Klienten für Besprechung
router.get('/', auth, async (req, res) => {
    const { standort, abteilung, gruppe, kf } = req.query;

    const params = [];
    let p = 1;
    const bedingungen = [
        "k.aktiv = TRUE",
        "(d.status = 'aktiv' OR (d.status IS NULL AND d.intake_abgeschlossen = TRUE))",
        "d.intake_abgeschlossen = TRUE",
    ];

    if (standort) { bedingungen.push(`d.standort_id = $${p++}::uuid`); params.push(standort); }
    if (abteilung) { bedingungen.push(`d.abteilung = $${p++}`); params.push(abteilung); }
    if (gruppe) { bedingungen.push(`p.gruppe = $${p++}`); params.push(gruppe); }
    if (kf) {
        bedingungen.push(`EXISTS (
            SELECT 1 FROM klient_user ku_f
            WHERE ku_f.klient_id = k.klient_id
              AND ku_f.user_id = $${p++}::uuid
              AND ku_f.rolle_im_fall = 'Klientenführung'
              AND ku_f.aktiv = TRUE
        )`);
        params.push(kf);
    }

    const where = bedingungen.join(' AND ');

    try {
        const result = await db.query(
            `SELECT
                k.klient_id,
                d.dossier_id,
                d.standort_id,
                d.abteilung,
                k.vorname,
                k.nachname,
                p.name        AS programm_name,
                p.farbe_hex,
                p.gruppe,
                ph.label      AS phase_label,
                pv.klient_label,
                pv.geplantes_enddatum,
                st.name       AS standort_name,
                st.kuerzel    AS standort_kuerzel,
                kf.user_id    AS kf_user_id,
                kf.full_name  AS klientenfuehrung_name,
                kf.avatar_initials AS kf_avatar,
                -- Stunden Soll (aus aktiver Verfügung)
                (SELECT COALESCE(ROUND(SUM(
                     CASE vp.verrechnungsart
                         WHEN 'monatspauschale' THEN
                             CASE WHEN COALESCE(l.tarif, 0) > 0
                                 THEN COALESCE(vp.betrag, 0) / l.tarif *
                                     GREATEST(1, COALESCE(
                                         (EXTRACT(YEAR FROM age(pv2.geplantes_enddatum, pv2.start_datum)) * 12
                                        + EXTRACT(MONTH FROM age(pv2.geplantes_enddatum, pv2.start_datum)))::int, 1))
                                 ELSE 0 END
                         WHEN 'fallpauschale' THEN
                             CASE WHEN COALESCE(l.tarif, 0) > 0 THEN COALESCE(vp.betrag, 0) / l.tarif ELSE 0 END
                         ELSE COALESCE(vp.soll_stunden, 0)
                     END
                 ), 1), 0)
                 FROM verfuegung_position vp
                 JOIN verfuegung v ON v.verfuegung_id = vp.verfuegung_id
                 JOIN leistung l ON l.leistung_id = vp.leistung_id
                 LEFT JOIN programm_verlauf pv2 ON pv2.dossier_id = d.dossier_id AND pv2.status = 'Laufend'
                 WHERE v.dossier_id = d.dossier_id AND v.status = 'aktiv') AS stunden_soll,
                -- Stunden Ist (alle Journal-Einträge)
                (SELECT COALESCE(ROUND(SUM(j.dauer_minuten) / 60.0, 1), 0)
                 FROM journal_eintrag j WHERE j.klient_id = k.klient_id) AS stunden_ist,
                -- Offene Aufgaben
                (SELECT COALESCE(JSON_AGG(
                    JSONB_BUILD_OBJECT(
                        'task_id', t.task_id,
                        'text', t.text,
                        'faellig_am', t.faellig_am,
                        'prioritaet', t.prioritaet
                    ) ORDER BY t.faellig_am ASC NULLS LAST
                ), '[]')
                 FROM task t WHERE t.klient_id = k.klient_id AND t.erledigt = FALSE) AS offene_aufgaben,
                -- Nächste Termine (max. 3)
                (SELECT COALESCE(JSON_AGG(
                    JSONB_BUILD_OBJECT(
                        'termin_id', nt.termin_id,
                        'typ', nt.typ,
                        'datum', nt.datum,
                        'zeit', nt.zeit
                    ) ORDER BY nt.datum ASC, nt.zeit ASC
                ), '[]')
                 FROM (
                     SELECT termin_id, typ, datum, zeit
                     FROM termin
                     WHERE klient_id = k.klient_id AND datum >= CURRENT_DATE
                     ORDER BY datum ASC, zeit ASC
                     LIMIT 3
                 ) nt) AS naechste_termine,
                -- Letzter Journal-Eintrag
                (SELECT ROW_TO_JSON(j) FROM (
                    SELECT datum, text, kategorie
                    FROM journal_eintrag
                    WHERE klient_id = k.klient_id
                    ORDER BY datum DESC, created_at DESC
                    LIMIT 1
                ) j) AS letzter_journal
            FROM dossier d
            JOIN klient k ON k.klient_id = d.klient_id
            LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
            LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
            LEFT JOIN standort st ON st.standort_id = d.standort_id
            LEFT JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id AND pv.status = 'Laufend'
            LEFT JOIN LATERAL (
                SELECT ku.user_id FROM klient_user ku
                WHERE ku.klient_id = k.klient_id
                  AND ku.rolle_im_fall = 'Klientenführung'
                  AND ku.aktiv = TRUE
                LIMIT 1
            ) ku_kf ON true
            LEFT JOIN benutzer kf ON kf.user_id = ku_kf.user_id
            WHERE ${where}
            ORDER BY k.nachname, k.vorname`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Klientenbesprechung' });
    }
});

module.exports = router;
