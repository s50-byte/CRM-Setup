// ============================================================
// Route: Gantt / Auslastungsplanung
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const ERLAUBTE_ROLLEN = ['kader', 'leitungsteam', 'management', 'teamleitung'];

function isoDate(d) {
    return d.toISOString().slice(0, 10);
}

// GET /api/gantt — Massnahmen + Phasen für Auslastungsplanung
router.get('/', auth, async (req, res) => {
    if (!ERLAUBTE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const heute = new Date();
    const heutePlus6 = new Date(heute);
    heutePlus6.setMonth(heutePlus6.getMonth() + 6);

    const von = req.query.von || isoDate(heute);
    const bis = req.query.bis || isoDate(heutePlus6);
    const standortIds = req.query.standort_ids ? req.query.standort_ids.split(',').filter(Boolean) : null;
    const programmIds = req.query.programm_ids ? req.query.programm_ids.split(',').filter(Boolean) : null;
    const userId = req.query.user_id || null;
    const rolle = req.query.rolle || null;

    try {
        const result = await db.query(
            `SELECT
                d.dossier_id,
                CONCAT(k.vorname, ' ', k.nachname) AS klient_name,
                p.name AS programm_name,
                p.farbe_hex AS programm_farbe,
                pv.klient_label,
                pv.start_datum,
                pv.geplantes_enddatum,
                st.name AS standort_name,
                (SELECT COALESCE(ROUND(SUM(vp2.soll_stunden), 1), 0)
                 FROM verfuegung_position vp2
                 JOIN verfuegung v2 ON v2.verfuegung_id = vp2.verfuegung_id
                 WHERE v2.dossier_id = d.dossier_id AND v2.status = 'aktiv') AS soll_total,
                (SELECT COALESCE(ROUND(SUM(j.dauer_minuten) FILTER (WHERE j.verrechenbar = TRUE) / 60.0, 1), 0)
                 FROM journal_eintrag j WHERE j.klient_id = k.klient_id) AS ist_verrechenbar,
                (SELECT COALESCE(ROUND(SUM(j.dauer_minuten) FILTER (WHERE j.verrechenbar = FALSE) / 60.0, 1), 0)
                 FROM journal_eintrag j WHERE j.klient_id = k.klient_id) AS ist_nicht_verrechenbar,
                (SELECT COALESCE(ROUND(SUM(j.dauer_minuten) / 60.0, 1), 0)
                 FROM journal_eintrag j WHERE j.klient_id = k.klient_id) AS ist_total,
                COALESCE(
                    (SELECT JSON_AGG(JSONB_BUILD_OBJECT(
                        'tarifnr', l.tarifnr,
                        'bezeichnung', l.bezeichnung,
                        'soll_stunden', vp2.soll_stunden,
                        'ist_stunden', COALESCE(ROUND(
                            (SELECT SUM(j2.dauer_minuten) / 60.0
                             FROM journal_eintrag j2
                             WHERE j2.klient_id = k.klient_id AND j2.leistung_id = vp2.leistung_id), 1), 0)
                    ) ORDER BY vp2.reihenfolge)
                     FROM verfuegung_position vp2
                     JOIN verfuegung v2 ON v2.verfuegung_id = vp2.verfuegung_id
                     JOIN leistung l ON l.leistung_id = vp2.leistung_id
                     WHERE v2.dossier_id = d.dossier_id AND v2.status = 'aktiv'),
                    '[]'
                ) AS positionen,
                COALESCE(
                    (SELECT JSON_AGG(JSONB_BUILD_OBJECT(
                        'phase_id', dp.phase_id,
                        'phase_label', ph.label,
                        'start_datum', dp.start_datum,
                        'end_datum', dp.end_datum,
                        'rollen', COALESCE((
                            SELECT JSON_AGG(pr.rolle_name) FROM phase_rolle pr WHERE pr.phase_id = dp.phase_id
                        ), '[]')
                    ) ORDER BY ph.reihenfolge)
                     FROM dossier_phase dp
                     JOIN phase ph ON ph.phase_id = dp.phase_id
                     WHERE dp.dossier_id = d.dossier_id),
                    '[]'
                ) AS phasen,
                COALESCE(
                    JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
                        'user_id', u.user_id,
                        'full_name', u.full_name,
                        'rolle_im_fall', ku.rolle_im_fall
                    )) FILTER (WHERE u.user_id IS NOT NULL),
                    '[]'
                ) AS zugewiesen
             FROM dossier d
             JOIN klient k ON k.klient_id = d.klient_id
             JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id AND pv.status = 'Laufend'
             LEFT JOIN programm p ON p.programm_id = pv.programm_id
             LEFT JOIN standort st ON st.standort_id = d.standort_id
             LEFT JOIN klient_user ku ON ku.klient_id = k.klient_id AND ku.aktiv = TRUE
             LEFT JOIN benutzer u ON u.user_id = ku.user_id
             WHERE k.aktiv = TRUE
               AND d.pipeline_status != 'Erstkontakt'
               AND (pv.start_datum IS NULL OR pv.start_datum <= $2::date)
               AND (pv.geplantes_enddatum IS NULL OR pv.geplantes_enddatum >= $1::date)
               AND ($3::uuid[] IS NULL OR d.standort_id = ANY($3::uuid[]))
               AND ($4::uuid[] IS NULL OR pv.programm_id = ANY($4::uuid[]))
               AND ($5::uuid IS NULL OR EXISTS (
                   SELECT 1 FROM klient_user ku2
                   WHERE ku2.klient_id = k.klient_id AND ku2.user_id = $5::uuid AND ku2.aktiv = TRUE
               ))
             GROUP BY d.dossier_id, k.klient_id, k.vorname, k.nachname, p.name, p.farbe_hex,
                      pv.klient_label, pv.start_datum, pv.geplantes_enddatum, st.name
             ORDER BY k.nachname, k.vorname`,
            [von, bis, standortIds, programmIds, userId]
        );

        let rows = result.rows;

        if (rolle && rolle !== 'Alle') {
            rows = rows
                .map(r => ({ ...r, phasen: (r.phasen || []).filter(p => (p.rollen || []).includes(rolle)) }))
                .filter(r => r.phasen.length > 0);
        }

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Auslastungsplanung' });
    }
});

module.exports = router;
