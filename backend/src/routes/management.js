// ============================================================
// Route: Management Dashboard
// Nur zugänglich für system_rolle IN ('leitungsteam', 'admin')
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const MANAGEMENT_ROLLEN = ['leitungsteam', 'admin'];

function requireManagement(req, res, next) {
    if (!MANAGEMENT_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
}

// GET /api/management/dashboard
router.get('/dashboard', auth, requireManagement, async (req, res) => {
    try {
        const heute = new Date();
        const jahresstart = `${heute.getFullYear()}-01-01`;
        const jahresende = `${heute.getFullYear()}-12-31`;

        const [
            klientenTotal,
            klientenProProgramm,
            klientenProStandort,
            pipelineCounts,
            umsatzYtd,
            umsatzForecast,
            umsatzProProgramm,
            umsatzProStandort,
            auslastungProPerson,
            auslastungProStandort,
            auslastungProRolle,
        ] = await Promise.all([

            // Aktive Dossiers total
            db.query(`SELECT COUNT(*) AS klienten_total FROM dossier d JOIN klient k ON k.klient_id = d.klient_id WHERE k.aktiv = TRUE`),

            // Klienten pro Programm
            db.query(`
                SELECT p.name AS programm_name, p.farbe_hex, COUNT(d.dossier_id) AS count
                FROM dossier d
                JOIN klient k ON k.klient_id = d.klient_id
                LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
                WHERE k.aktiv = TRUE
                GROUP BY p.name, p.farbe_hex
                ORDER BY count DESC
            `),

            // Klienten pro Standort
            db.query(`
                SELECT st.name AS standort_name, st.kuerzel, COUNT(d.dossier_id) AS count
                FROM dossier d
                JOIN klient k ON k.klient_id = d.klient_id
                LEFT JOIN standort st ON st.standort_id = d.standort_id
                WHERE k.aktiv = TRUE
                GROUP BY st.name, st.kuerzel
                ORDER BY count DESC
            `),

            // Pipeline-Status Counts
            db.query(`
                SELECT d.pipeline_status, COUNT(*) AS count
                FROM dossier d
                JOIN klient k ON k.klient_id = d.klient_id
                WHERE k.aktiv = TRUE
                GROUP BY d.pipeline_status
                ORDER BY count DESC
            `),

            // Umsatz YTD: vergangene Monate seit start_datum für laufende Programme
            db.query(`
                SELECT COALESCE(SUM(
                    p.monatspreis *
                    GREATEST(0, LEAST(
                        (LEAST(CURRENT_DATE, $2::date) - pv.start_datum) / 30.44,
                        ($2::date - $1::date) / 30.44
                    ))
                ), 0) AS umsatz_ytd
                FROM programm_verlauf pv
                JOIN programm p ON p.programm_id = pv.programm_id
                WHERE pv.status = 'Laufend'
                  AND pv.start_datum IS NOT NULL
                  AND p.monatspreis IS NOT NULL
                  AND pv.start_datum <= NOW()
            `, [jahresstart, heute.toISOString().slice(0, 10)]),

            // Forecast bis Jahresende: Restmonate für laufende Programme
            db.query(`
                SELECT COALESCE(SUM(
                    p.monatspreis *
                    GREATEST(0,
                        (LEAST(COALESCE(pv.geplantes_enddatum, $2::date), $2::date) - GREATEST(pv.start_datum, $1::date)) / 30.44
                    )
                ), 0) AS umsatz_forecast
                FROM programm_verlauf pv
                JOIN programm p ON p.programm_id = pv.programm_id
                WHERE pv.status = 'Laufend'
                  AND pv.start_datum IS NOT NULL
                  AND p.monatspreis IS NOT NULL
            `, [jahresstart, jahresende]),

            // Umsatz pro Programm (YTD + Forecast)
            db.query(`
                SELECT
                    p.name AS programm_name,
                    p.farbe_hex,
                    COALESCE(SUM(
                        p.monatspreis *
                        GREATEST(0, LEAST(
                            (LEAST(CURRENT_DATE, $2::date) - pv.start_datum) / 30.44,
                            ($2::date - $1::date) / 30.44
                        ))
                    ), 0) AS umsatz_ytd,
                    COALESCE(SUM(
                        p.monatspreis *
                        GREATEST(0,
                            (LEAST(COALESCE(pv.geplantes_enddatum, $3::date), $3::date) - GREATEST(pv.start_datum, $1::date)) / 30.44
                        )
                    ), 0) AS umsatz_forecast
                FROM programm_verlauf pv
                JOIN programm p ON p.programm_id = pv.programm_id
                WHERE pv.status = 'Laufend'
                  AND pv.start_datum IS NOT NULL
                  AND p.monatspreis IS NOT NULL
                GROUP BY p.name, p.farbe_hex
                ORDER BY umsatz_ytd DESC
            `, [jahresstart, heute.toISOString().slice(0, 10), jahresende]),

            // Umsatz pro Standort (YTD + Forecast)
            db.query(`
                SELECT
                    st.name AS standort_name,
                    st.kuerzel,
                    COALESCE(SUM(
                        p.monatspreis *
                        GREATEST(0, LEAST(
                            (LEAST(CURRENT_DATE, $2::date) - pv.start_datum) / 30.44,
                            ($2::date - $1::date) / 30.44
                        ))
                    ), 0) AS umsatz_ytd,
                    COALESCE(SUM(
                        p.monatspreis *
                        GREATEST(0,
                            (LEAST(COALESCE(pv.geplantes_enddatum, $3::date), $3::date) - GREATEST(pv.start_datum, $1::date)) / 30.44
                        )
                    ), 0) AS umsatz_forecast
                FROM programm_verlauf pv
                JOIN dossier d ON d.dossier_id = pv.dossier_id
                LEFT JOIN standort st ON st.standort_id = d.standort_id
                JOIN programm p ON p.programm_id = pv.programm_id
                WHERE pv.status = 'Laufend'
                  AND pv.start_datum IS NOT NULL
                  AND p.monatspreis IS NOT NULL
                GROUP BY st.name, st.kuerzel
                ORDER BY umsatz_ytd DESC
            `, [jahresstart, heute.toISOString().slice(0, 10), jahresende]),

            // Auslastung pro Person
            db.query(`
                SELECT
                    u.user_id,
                    u.full_name,
                    u.avatar_initials,
                    st.kuerzel AS standort_kuerzel,
                    COALESCE(
                        JSON_AGG(DISTINCT ba.rolle_name) FILTER (WHERE ba.rolle_name IS NOT NULL),
                        '[]'
                    ) AS rollen,
                    COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE) AS aktive_klienten,
                    COALESCE(SUM(ba.max_klienten), 0) AS max_klienten,
                    CASE
                        WHEN COALESCE(SUM(ba.max_klienten), 0) = 0 THEN NULL
                        ELSE ROUND(
                            COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE)::NUMERIC
                            / SUM(ba.max_klienten) * 100
                        )
                    END AS auslastung_pct
                FROM benutzer u
                LEFT JOIN benutzer_aufgabe ba ON ba.user_id = u.user_id
                LEFT JOIN klient_user ku ON ku.user_id = u.user_id
                LEFT JOIN benutzer_standort bs ON bs.user_id = u.user_id
                LEFT JOIN standort st ON st.standort_id = bs.standort_id
                WHERE u.aktiv = TRUE
                GROUP BY u.user_id, u.full_name, u.avatar_initials, st.kuerzel
                ORDER BY auslastung_pct DESC NULLS LAST, u.full_name
            `),

            // Auslastung pro Standort
            db.query(`
                SELECT
                    st.name AS standort_name,
                    st.kuerzel,
                    COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE) AS aktive_klienten,
                    COALESCE(SUM(DISTINCT ba_sum.max_k), 0) AS kapazitaet_total,
                    CASE
                        WHEN COALESCE(SUM(DISTINCT ba_sum.max_k), 0) = 0 THEN NULL
                        ELSE ROUND(
                            COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE)::NUMERIC
                            / SUM(DISTINCT ba_sum.max_k) * 100
                        )
                    END AS auslastung_pct
                FROM standort st
                LEFT JOIN benutzer_standort bs ON bs.standort_id = st.standort_id
                LEFT JOIN benutzer u ON u.user_id = bs.user_id AND u.aktiv = TRUE
                LEFT JOIN (
                    SELECT user_id, SUM(max_klienten) AS max_k
                    FROM benutzer_aufgabe
                    GROUP BY user_id
                ) ba_sum ON ba_sum.user_id = u.user_id
                LEFT JOIN klient_user ku ON ku.user_id = u.user_id
                WHERE st.aktiv = TRUE
                GROUP BY st.name, st.kuerzel
                ORDER BY aktive_klienten DESC
            `),

            // Auslastung pro Rolle (pro Standort + gesamt)
            db.query(`
                SELECT
                    ba.rolle_name,
                    st.kuerzel AS standort_kuerzel,
                    st.name AS standort_name,
                    COUNT(DISTINCT u.user_id) AS anzahl_personen,
                    COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE) AS aktive_klienten_total,
                    COALESCE(SUM(ba.max_klienten), 0) AS kapazitaet_total,
                    CASE
                        WHEN COALESCE(SUM(ba.max_klienten), 0) = 0 THEN NULL
                        ELSE ROUND(
                            COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE)::NUMERIC
                            / SUM(ba.max_klienten) * 100
                        )
                    END AS auslastung_pct
                FROM benutzer u
                JOIN benutzer_aufgabe ba ON ba.user_id = u.user_id
                JOIN benutzer_standort bst ON bst.user_id = u.user_id
                JOIN standort st ON st.standort_id = bst.standort_id
                LEFT JOIN klient_user ku ON ku.user_id = u.user_id
                WHERE u.aktiv = TRUE
                GROUP BY ba.rolle_name, st.standort_id, st.kuerzel, st.name

                UNION ALL

                SELECT
                    ba.rolle_name,
                    NULL::text AS standort_kuerzel,
                    NULL::text AS standort_name,
                    COUNT(DISTINCT u.user_id) AS anzahl_personen,
                    COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE) AS aktive_klienten_total,
                    COALESCE(SUM(ba.max_klienten), 0) AS kapazitaet_total,
                    CASE
                        WHEN COALESCE(SUM(ba.max_klienten), 0) = 0 THEN NULL
                        ELSE ROUND(
                            COUNT(DISTINCT ku.klient_id) FILTER (WHERE ku.aktiv = TRUE)::NUMERIC
                            / SUM(ba.max_klienten) * 100
                        )
                    END AS auslastung_pct
                FROM benutzer u
                JOIN benutzer_aufgabe ba ON ba.user_id = u.user_id
                LEFT JOIN klient_user ku ON ku.user_id = u.user_id
                WHERE u.aktiv = TRUE
                GROUP BY ba.rolle_name

                ORDER BY rolle_name, standort_kuerzel NULLS FIRST
            `),
        ]);

        res.json({
            klienten: {
                total: parseInt(klientenTotal.rows[0].klienten_total),
                pro_programm: klientenProProgramm.rows.map(r => ({ ...r, count: parseInt(r.count) })),
                pro_standort: klientenProStandort.rows.map(r => ({ ...r, count: parseInt(r.count) })),
                pipeline_counts: pipelineCounts.rows.map(r => ({ ...r, count: parseInt(r.count) })),
            },
            finanzen: {
                umsatz_ytd: parseFloat(umsatzYtd.rows[0].umsatz_ytd),
                umsatz_forecast_jahresende: parseFloat(umsatzForecast.rows[0].umsatz_forecast),
                pro_programm: umsatzProProgramm.rows.map(r => ({
                    ...r,
                    umsatz_ytd: parseFloat(r.umsatz_ytd),
                    umsatz_forecast: parseFloat(r.umsatz_forecast),
                })),
                pro_standort: umsatzProStandort.rows.map(r => ({
                    ...r,
                    umsatz_ytd: parseFloat(r.umsatz_ytd),
                    umsatz_forecast: parseFloat(r.umsatz_forecast),
                })),
            },
            auslastung: {
                pro_person: auslastungProPerson.rows.map(r => ({
                    ...r,
                    aktive_klienten: parseInt(r.aktive_klienten),
                    max_klienten: parseInt(r.max_klienten),
                    auslastung_pct: r.auslastung_pct !== null ? parseInt(r.auslastung_pct) : null,
                })),
                pro_standort: auslastungProStandort.rows.map(r => ({
                    ...r,
                    aktive_klienten: parseInt(r.aktive_klienten),
                    kapazitaet_total: parseInt(r.kapazitaet_total),
                    auslastung_pct: r.auslastung_pct !== null ? parseInt(r.auslastung_pct) : null,
                })),
                pro_rolle: auslastungProRolle.rows.map(r => ({
                    ...r,
                    anzahl_personen: parseInt(r.anzahl_personen),
                    aktive_klienten_total: parseInt(r.aktive_klienten_total),
                    kapazitaet_total: parseInt(r.kapazitaet_total),
                    auslastung_pct: r.auslastung_pct !== null ? parseInt(r.auslastung_pct) : null,
                })),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Management-Dashboards' });
    }
});

// GET /api/management/lehrplaetze — Kapazitätsübersicht Lehrberufe pro Standort
router.get('/lehrplaetze', auth, requireManagement, async (req, res) => {
    try {
        const result = await db.query(`
            WITH lehrling AS (
                SELECT
                    d.standort_id,
                    CASE d.ausbildung_beruf
                        WHEN 'Informatiker' THEN 'Informatik'
                        WHEN 'Informatikerin' THEN 'Informatik'
                        WHEN 'Kaufmann' THEN 'Kaufmann/frau'
                        WHEN 'Kauffrau' THEN 'Kaufmann/frau'
                        WHEN 'Logistiker' THEN 'Logistik'
                        WHEN 'Logistikerin' THEN 'Logistik'
                        WHEN 'Kundendialog-Spezialist' THEN 'Kundendialog'
                        WHEN 'Kundendialog-Spezialistin' THEN 'Kundendialog'
                        ELSE NULL
                    END AS beruf,
                    p.name AS programm_name,
                    d.abteilung, d.arbeitgeber_id
                FROM dossier d
                JOIN klient k ON k.klient_id = d.klient_id
                JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id AND pv.status = 'Laufend'
                JOIN programm p ON p.programm_id = pv.programm_id
                WHERE k.aktiv = TRUE AND d.status != 'inaktiv'
                  AND p.name IN ('Erstmalige berufliche Ausbildung', 'Gezielte Vorbereitung')
            )
            SELECT
                sl.standort_id, st.name AS standort_name, st.kuerzel AS standort_kuerzel,
                sl.beruf, sl.bewilligte_plaetze, sl.total_plaetze,
                COUNT(*) FILTER (WHERE l.programm_name = 'Erstmalige berufliche Ausbildung' AND l.abteilung IS NOT NULL) AS belegt_intern,
                COUNT(*) FILTER (WHERE l.programm_name = 'Erstmalige berufliche Ausbildung' AND l.arbeitgeber_id IS NOT NULL) AS belegt_extern,
                COUNT(*) FILTER (WHERE l.programm_name = 'Gezielte Vorbereitung') AS reserviert
            FROM standort_lehrberuf sl
            JOIN standort st ON st.standort_id = sl.standort_id
            LEFT JOIN lehrling l ON l.standort_id = sl.standort_id AND l.beruf = sl.beruf
            WHERE sl.aktiv = TRUE
            GROUP BY sl.standort_id, st.name, st.kuerzel, sl.beruf, sl.bewilligte_plaetze, sl.total_plaetze
            ORDER BY st.name, sl.beruf
        `);
        const rows = result.rows.map(r => {
            const bewilligt = parseInt(r.bewilligte_plaetze);
            const belegtIntern = parseInt(r.belegt_intern);
            const belegtExtern = parseInt(r.belegt_extern);
            const reserviert = parseInt(r.reserviert);
            const freiAktuell = bewilligt - belegtIntern - belegtExtern;
            return {
                standort_id: r.standort_id,
                standort_name: r.standort_name,
                standort_kuerzel: r.standort_kuerzel,
                beruf: r.beruf,
                bewilligte_plaetze: bewilligt,
                total_plaetze: parseInt(r.total_plaetze),
                belegt_intern: belegtIntern,
                belegt_extern: belegtExtern,
                reserviert,
                frei_aktuell: freiAktuell,
                frei_werdend: freiAktuell - reserviert,
            };
        });
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Lehrplätze' });
    }
});

module.exports = router;
