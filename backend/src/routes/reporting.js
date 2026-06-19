const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const ERLAUBTE_ROLLEN = ['management', 'teamleitung', 'kader', 'leitungsteam'];
const TIME_SPALTEN = ['monate', 'quartale', 'wochen', 'jahr'];

function generierePeriodenListe(typ, von, bis) {
    const result = [];
    const startDate = new Date(von);
    const endDate = new Date(bis);

    if (typ === 'quartale') {
        let year = startDate.getFullYear();
        let q = Math.floor(startDate.getMonth() / 3);
        while (true) {
            const qStart = new Date(year, q * 3, 1);
            if (qStart > endDate) break;
            const qEnd = new Date(year, q * 3 + 3, 0);
            result.push({ key: `Q${q + 1} ${year}`, von: qStart, bis: qEnd });
            q++;
            if (q > 3) { q = 0; year++; }
        }
    } else if (typ === 'jahr') {
        for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
            result.push({ key: `${y}`, von: new Date(y, 0, 1), bis: new Date(y, 11, 31) });
        }
    } else if (typ === 'wochen') {
        const wochentag = startDate.getDay();
        const diff = startDate.getDate() - wochentag + (wochentag === 0 ? -6 : 1);
        let current = new Date(startDate);
        current.setDate(diff);
        while (current <= endDate) {
            const ende = new Date(current);
            ende.setDate(ende.getDate() + 6);
            const d = new Date(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const kw = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            result.push({ key: `KW ${kw} ${current.getFullYear()}`, von: new Date(current), bis: ende });
            current.setDate(current.getDate() + 7);
        }
    } else {
        // Monate (default)
        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        while (current <= endDate) {
            const monatsEnde = new Date(current.getFullYear(), current.getMonth() + 1, 0);
            const label = current.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' });
            result.push({ key: label, von: new Date(current), bis: monatsEnde });
            current.setMonth(current.getMonth() + 1);
        }
    }
    return result;
}

function ueberlapp(startA, endA, startB, endB) {
    const sa = startA instanceof Date ? startA : new Date(startA);
    const ea = endA instanceof Date ? endA : new Date(endA);
    return sa <= endB && ea >= startB;
}

function getDimKey(row, dim) {
    switch (dim) {
        case 'kader': return row.kader_id ? String(row.kader_id) : '__kein_kader__';
        case 'klient': return row.klient_id ? String(row.klient_id) : '__';
        case 'standort': return row.standort_id ? String(row.standort_id) : '__kein_standort__';
        case 'massnahme': return row.programm_id ? String(row.programm_id) : '__kein_programm__';
        case 'abteilung': return row.abteilung || 'Keine Abteilung';
        case 'auftraggeber_typ': return row.auftraggeber || 'Unbekannt';
        default: return '__';
    }
}

function getDimLabel(row, dim) {
    switch (dim) {
        case 'kader': return row.kader_name || '(Kein Kader)';
        case 'klient': return row.klient_name || '(Unbekannt)';
        case 'standort': return row.standort_name || '(Kein Standort)';
        case 'massnahme': return row.programm_name || '(Kein Programm)';
        case 'abteilung': return row.abteilung || 'Keine Abteilung';
        case 'auftraggeber_typ': return row.auftraggeber || 'Unbekannt';
        default: return '(Unbekannt)';
    }
}

function berechneWerte(dossierList, journalList, periode, kennzahlen) {
    const { von: vonDate, bis: bisDate } = periode;
    let einnahmen_soll = 0;
    let stunden_soll = 0;
    const klientenSet = new Set();

    for (const dos of dossierList) {
        if (!ueberlapp(dos.start_datum, dos.geplantes_enddatum, vonDate, bisDate)) continue;
        const dauerMonate = Math.max(1, parseInt(dos.dauer_monate) || 1);
        const sollLeistungTotal = parseFloat(dos.soll_leistung_total) || 0;
        const sollStundenTotal = parseFloat(dos.soll_stunden_total) || 0;
        const kaderCount = Math.max(1, parseInt(dos.kader_count) || 1);

        einnahmen_soll += sollLeistungTotal / dauerMonate / kaderCount;
        stunden_soll += sollStundenTotal / dauerMonate / kaderCount;
        klientenSet.add(String(dos.klient_id));
    }

    let einnahmen_ist = 0;
    let stunden_ist = 0;
    for (const j of (journalList || [])) {
        const jDate = new Date(j.datum);
        if (jDate < vonDate || jDate > bisDate) continue;
        const minuten = parseFloat(j.dauer_minuten) || 0;
        const stunden = minuten / 60;
        const kaderCount = Math.max(1, parseInt(j.kader_count) || 1);
        stunden_ist += stunden / kaderCount;
        if (j.verrechenbar) einnahmen_ist += stunden * (parseFloat(j.tarif) || 0) / kaderCount;
        klientenSet.add(String(j.klient_id));
    }

    const anzahl_klienten = klientenSet.size;
    const r = {};
    if (kennzahlen.includes('einnahmen_soll')) r.einnahmen_soll = Math.round(einnahmen_soll * 100) / 100;
    if (kennzahlen.includes('einnahmen_ist'))  r.einnahmen_ist  = Math.round(einnahmen_ist * 100) / 100;
    if (kennzahlen.includes('stunden_soll'))   r.stunden_soll   = Math.round(stunden_soll * 10) / 10;
    if (kennzahlen.includes('stunden_ist'))    r.stunden_ist    = Math.round(stunden_ist * 10) / 10;
    if (kennzahlen.includes('anzahl_klienten')) r.anzahl_klienten = anzahl_klienten;
    if (kennzahlen.includes('auslastung_pct'))  r.auslastung_pct  = einnahmen_soll > 0 ? Math.round(einnahmen_ist / einnahmen_soll * 1000) / 10 : null;
    if (kennzahlen.includes('avg_std_klient'))  r.avg_std_klient  = anzahl_klienten > 0 ? Math.round(stunden_ist / anzahl_klienten * 100) / 100 : 0;
    if (kennzahlen.includes('freie_kapazitaet')) r.freie_kapazitaet = Math.round((stunden_soll - stunden_ist) * 10) / 10;
    return r;
}

// GET /api/reporting/optionen
router.get('/optionen', auth, async (req, res) => {
    if (!ERLAUBTE_ROLLEN.includes(req.user.system_rolle)) return res.status(403).json({ error: 'Keine Berechtigung' });
    try {
        const [kader, klienten, standorte, massnahmen, abteilungen] = await Promise.all([
            db.query(`SELECT user_id, full_name FROM benutzer WHERE aktiv = TRUE ORDER BY full_name`),
            db.query(`SELECT k.klient_id, k.vorname || ' ' || k.nachname AS name
                      FROM klient k
                      WHERE k.aktiv = TRUE
                        AND EXISTS (SELECT 1 FROM dossier d JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id WHERE d.klient_id = k.klient_id AND pv.status = 'Laufend')
                      ORDER BY k.nachname, k.vorname`),
            db.query(`SELECT standort_id, name FROM standort ORDER BY name`),
            db.query(`SELECT programm_id, name FROM programm WHERE aktiv = TRUE ORDER BY name`),
            db.query(`SELECT DISTINCT abteilung FROM dossier WHERE abteilung IS NOT NULL AND abteilung != '' ORDER BY abteilung`),
        ]);
        res.json({
            kader: kader.rows,
            klienten: klienten.rows,
            standorte: standorte.rows,
            massnahmen: massnahmen.rows,
            abteilungen: abteilungen.rows.map(r => r.abteilung),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Optionen' });
    }
});

// GET /api/reporting/ansichten
router.get('/ansichten', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, konfiguration, erstellt_at FROM reporting_ansicht
             WHERE user_id = $1 ORDER BY erstellt_at DESC`,
            [req.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Ansichten' });
    }
});

// POST /api/reporting/ansichten
router.post('/ansichten', auth, async (req, res) => {
    const { name, konfiguration } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });
    try {
        const result = await db.query(
            `INSERT INTO reporting_ansicht (user_id, name, konfiguration) VALUES ($1, $2, $3) RETURNING *`,
            [req.user.user_id, name, JSON.stringify(konfiguration)]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Ansicht' });
    }
});

// DELETE /api/reporting/ansichten/:id
router.delete('/ansichten/:id', auth, async (req, res) => {
    try {
        await db.query(
            `DELETE FROM reporting_ansicht WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.user_id]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Ansicht' });
    }
});

// POST /api/reporting/query
router.post('/query', auth, async (req, res) => {
    if (!ERLAUBTE_ROLLEN.includes(req.user.system_rolle)) return res.status(403).json({ error: 'Keine Berechtigung' });

    const { zeilen = ['kader'], spalten = ['monate'], kennzahlen = ['einnahmen_soll', 'einnahmen_ist'], filter = {} } = req.body;
    const von = filter.von || new Date().toISOString().slice(0, 10);
    const bis = filter.bis || new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().slice(0, 10);
    const zeileDim = zeilen[0] || 'kader';
    const spaltenTyp = spalten[0] || 'monate';
    const isTimeSpalte = TIME_SPALTEN.includes(spaltenTyp);
    const isTimeZeile  = TIME_SPALTEN.includes(zeileDim);
    const kaderIsDim = zeileDim === 'kader' || spaltenTyp === 'kader';
    const standortIsDim = zeileDim === 'standort' || spaltenTyp === 'standort';
    const massnahmeIsDim = zeileDim === 'massnahme' || spaltenTyp === 'massnahme';
    const abteilungIsDim = zeileDim === 'abteilung' || spaltenTyp === 'abteilung';
    const auftraggeberIsDim = zeileDim === 'auftraggeber_typ' || spaltenTyp === 'auftraggeber_typ';

    try {
        const params = [von, bis];
        const dossierClauses = [];
        const journalClauses = [];

        if (filter.standort_ids?.length > 0) {
            params.push(filter.standort_ids);
            const p = `$${params.length}::uuid[]`;
            dossierClauses.push(`d.standort_id = ANY(${p})`);
            journalClauses.push(`d.standort_id = ANY(${p})`);
        }
        if (filter.programm_ids?.length > 0) {
            params.push(filter.programm_ids);
            const p = `$${params.length}::uuid[]`;
            dossierClauses.push(`pv.programm_id = ANY(${p})`);
            journalClauses.push(`d.programm_id = ANY(${p})`);
        }
        let userIdsParamRef = null;
        if (filter.user_ids?.length > 0) {
            params.push(filter.user_ids);
            userIdsParamRef = `$${params.length}::uuid[]`;
            const c = `EXISTS (SELECT 1 FROM klient_user ku2 WHERE ku2.klient_id = k.klient_id AND ku2.user_id = ANY(${userIdsParamRef}) AND ku2.aktiv = TRUE)`;
            dossierClauses.push(c);
            journalClauses.push(c);
        }
        if (filter.abteilungen?.length > 0) {
            params.push(filter.abteilungen);
            const p = `$${params.length}::text[]`;
            dossierClauses.push(`d.abteilung = ANY(${p})`);
            journalClauses.push(`d.abteilung = ANY(${p})`);
        }
        if (filter.klient_ids?.length > 0) {
            params.push(filter.klient_ids);
            const p = `$${params.length}::uuid[]`;
            dossierClauses.push(`k.klient_id = ANY(${p})`);
            journalClauses.push(`k.klient_id = ANY(${p})`);
        }
        if (filter.auftraggeber_typ) {
            params.push(filter.auftraggeber_typ);
            const p = `$${params.length}`;
            dossierClauses.push(`d.auftraggeber ILIKE '%' || ${p} || '%'`);
            journalClauses.push(`d.auftraggeber ILIKE '%' || ${p} || '%'`);
        }

        const dossierWhere = dossierClauses.length > 0 ? 'AND ' + dossierClauses.join(' AND ') : '';
        const journalWhere = journalClauses.length > 0 ? 'AND ' + journalClauses.join(' AND ') : '';
        // When kader filter active: restrict LATERAL JOIN results to selected kaders
        const kaderDossierOuterWhere = userIdsParamRef ? `WHERE kader_row.kader_id = ANY(${userIdsParamRef})` : '';
        const kaderJournalFilter = userIdsParamRef ? `AND kader_row.kader_id = ANY(${userIdsParamRef})` : '';

        const [dossierResult, journalResult, alleKaderResult, standorteResult, massnahmenResult, abteilungenResult, auftraggeberResult] = await Promise.all([
            db.query(
                `WITH agg AS (
                    SELECT
                        d.dossier_id, k.klient_id,
                        k.vorname || ' ' || k.nachname AS klient_name,
                        d.standort_id, st.name AS standort_name,
                        d.abteilung, d.auftraggeber,
                        pv.programm_id, prog.name AS programm_name,
                        pv.start_datum, pv.geplantes_enddatum,
                        GREATEST(1, COALESCE(
                            (EXTRACT(YEAR FROM age(pv.geplantes_enddatum, pv.start_datum)) * 12
                           + EXTRACT(MONTH FROM age(pv.geplantes_enddatum, pv.start_datum)))::int, 1
                        )) AS dauer_monate,
                        v.betrag, v.verrechnungsart,
                        COALESCE(SUM(
                            CASE vp.verrechnungsart
                                WHEN 'monatspauschale' THEN COALESCE(vp.betrag, 0) * GREATEST(1, COALESCE(
                                    (EXTRACT(YEAR FROM age(pv.geplantes_enddatum, pv.start_datum)) * 12
                                   + EXTRACT(MONTH FROM age(pv.geplantes_enddatum, pv.start_datum)))::int, 1))
                                WHEN 'fallpauschale' THEN COALESCE(vp.betrag, 0)
                                ELSE COALESCE(vp.soll_stunden, 0) * COALESCE(l.tarif, 0)
                            END
                        ), 0) AS soll_leistung_total,
                        COALESCE(SUM(
                            CASE vp.verrechnungsart
                                WHEN 'monatspauschale' THEN
                                    CASE WHEN COALESCE(l.tarif, 0) > 0
                                        THEN COALESCE(vp.betrag, 0) / l.tarif * GREATEST(1, COALESCE(
                                             (EXTRACT(YEAR FROM age(pv.geplantes_enddatum, pv.start_datum)) * 12
                                            + EXTRACT(MONTH FROM age(pv.geplantes_enddatum, pv.start_datum)))::int, 1))
                                        ELSE 0 END
                                WHEN 'fallpauschale' THEN
                                    CASE WHEN COALESCE(l.tarif, 0) > 0 THEN COALESCE(vp.betrag, 0) / l.tarif ELSE 0 END
                                ELSE COALESCE(vp.soll_stunden, 0)
                            END
                        ), 0) AS soll_stunden_total
                    FROM dossier d
                    JOIN klient k ON k.klient_id = d.klient_id
                    JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id AND pv.status = 'Laufend'
                    LEFT JOIN standort st ON st.standort_id = d.standort_id
                    LEFT JOIN programm prog ON prog.programm_id = pv.programm_id
                    LEFT JOIN LATERAL (
                        SELECT v2.verfuegung_id, v2.betrag, v2.verrechnungsart
                        FROM verfuegung v2
                        WHERE v2.dossier_id = d.dossier_id AND v2.status = 'aktiv'
                        LIMIT 1
                    ) v ON true
                    LEFT JOIN verfuegung_position vp ON vp.verfuegung_id = v.verfuegung_id
                    LEFT JOIN leistung l ON l.leistung_id = vp.leistung_id
                    WHERE k.aktiv = TRUE
                      AND pv.geplantes_enddatum >= $1 AND pv.start_datum <= $2
                      ${dossierWhere}
                    GROUP BY d.dossier_id, k.klient_id, k.vorname, k.nachname, d.standort_id, st.name,
                             d.abteilung, d.auftraggeber, pv.programm_id, prog.name,
                             pv.start_datum, pv.geplantes_enddatum, v.betrag, v.verrechnungsart
                )
                SELECT
                    agg.*,
                    kader_row.kader_id,
                    kader_row.kader_name,
                    GREATEST(1, (SELECT COUNT(*)::int FROM klient_user ku WHERE ku.klient_id = agg.klient_id AND ku.aktiv = TRUE)) AS kader_count
                FROM agg
                LEFT JOIN LATERAL (
                    SELECT ku.user_id AS kader_id, b.full_name AS kader_name
                    FROM klient_user ku
                    JOIN benutzer b ON b.user_id = ku.user_id
                    WHERE ku.klient_id = agg.klient_id AND ku.aktiv = TRUE
                ) kader_row ON TRUE
                ${kaderDossierOuterWhere}`,
                params
            ),
            db.query(
                `SELECT
                    j.klient_id, j.datum, j.dauer_minuten, j.verrechenbar,
                    COALESCE(l.tarif, 0) AS tarif,
                    k.vorname || ' ' || k.nachname AS klient_name,
                    kader_row.kader_id,
                    kader_row.kader_name,
                    d.standort_id,
                    (SELECT st.name FROM standort st WHERE st.standort_id = d.standort_id) AS standort_name,
                    d.abteilung, d.auftraggeber,
                    d.programm_id,
                    (SELECT prog.name FROM programm prog WHERE prog.programm_id = d.programm_id) AS programm_name,
                    GREATEST(1, (SELECT COUNT(*)::int FROM klient_user ku WHERE ku.klient_id = j.klient_id AND ku.aktiv = TRUE)) AS kader_count
                 FROM journal_eintrag j
                 JOIN klient k ON k.klient_id = j.klient_id
                 LEFT JOIN LATERAL (
                     SELECT dos.standort_id, dos.abteilung, dos.auftraggeber, pv_l.programm_id
                     FROM dossier dos
                     JOIN programm_verlauf pv_l ON pv_l.dossier_id = dos.dossier_id AND pv_l.status = 'Laufend'
                     WHERE dos.klient_id = j.klient_id
                     LIMIT 1
                 ) d ON true
                 LEFT JOIN LATERAL (
                     SELECT ku.user_id AS kader_id, b.full_name AS kader_name
                     FROM klient_user ku
                     JOIN benutzer b ON b.user_id = ku.user_id
                     WHERE ku.klient_id = j.klient_id AND ku.aktiv = TRUE
                 ) kader_row ON TRUE
                 LEFT JOIN leistung l ON l.leistung_id = j.leistung_id
                 WHERE k.aktiv = TRUE
                   AND j.datum BETWEEN $1 AND $2
                   ${journalWhere}
                   ${kaderJournalFilter}`,
                params
            ),
            kaderIsDim
                ? db.query(`SELECT user_id, full_name FROM benutzer WHERE aktiv = TRUE ORDER BY full_name`)
                : Promise.resolve({ rows: [] }),
            standortIsDim
                ? db.query(`SELECT standort_id, name FROM standort ORDER BY name`)
                : Promise.resolve({ rows: [] }),
            massnahmeIsDim
                ? db.query(`SELECT programm_id, name FROM programm WHERE aktiv = TRUE ORDER BY name`)
                : Promise.resolve({ rows: [] }),
            abteilungIsDim
                ? db.query(`SELECT DISTINCT abteilung FROM dossier WHERE abteilung IS NOT NULL AND abteilung != '' ORDER BY abteilung`)
                : Promise.resolve({ rows: [] }),
            auftraggeberIsDim
                ? db.query(`SELECT DISTINCT auftraggeber FROM dossier WHERE auftraggeber IS NOT NULL AND auftraggeber != '' ORDER BY auftraggeber`)
                : Promise.resolve({ rows: [] }),
        ]);

        const dossiers = dossierResult.rows;
        const journalRows = journalResult.rows;
        const alleKader = alleKaderResult.rows;
        const alleStandorte = standorteResult.rows;
        const alleMassnahmen = massnahmenResult.rows;
        const alleAbteilungen = abteilungenResult.rows.map(r => r.abteilung);
        const alleAuftraggeber = auftraggeberResult.rows.map(r => r.auftraggeber);

        const selectedUserIds = new Set((filter.user_ids || []).map(String));
        const selectedStandortIds = new Set((filter.standort_ids || []).map(String));
        const selectedProgrammIds = new Set((filter.programm_ids || []).map(String));
        const selectedAbteilungen = new Set(filter.abteilungen || []);

        const totalPeriode = { von: new Date(von), bis: new Date(bis) };

        function alleWerteForDim(dim) {
            switch (dim) {
                case 'kader':          return alleKader.map(k => ({ key: String(k.user_id), label: k.full_name }));
                case 'standort':       return alleStandorte.map(s => ({ key: String(s.standort_id), label: s.name }));
                case 'massnahme':      return alleMassnahmen.map(m => ({ key: String(m.programm_id), label: m.name }));
                case 'abteilung':      return alleAbteilungen.map(a => ({ key: a, label: a }));
                case 'auftraggeber_typ': return alleAuftraggeber.map(a => ({ key: a, label: a }));
                default:               return [];
            }
        }

        function dimFilterSkip(dim, key) {
            if (dim === 'kader' && selectedUserIds.size > 0 && !selectedUserIds.has(key)) return true;
            if (dim === 'standort' && selectedStandortIds.size > 0 && !selectedStandortIds.has(key)) return true;
            if (dim === 'massnahme' && selectedProgrammIds.size > 0 && !selectedProgrammIds.has(key)) return true;
            if (dim === 'abteilung' && selectedAbteilungen.size > 0 && !selectedAbteilungen.has(key)) return true;
            if (dim === 'auftraggeber_typ' && filter.auftraggeber_typ) return true;
            return false;
        }

        // Fill into a gruppenMap (isTimeSpalte branch): key → { id, label, dossiers: [] }
        function fillInGruppen(dim, gruppenMap) {
            for (const { key, label } of alleWerteForDim(dim)) {
                if (gruppenMap.has(key) || dimFilterSkip(dim, key)) continue;
                gruppenMap.set(key, { id: key, label, dossiers: [] });
            }
        }

        // Fill into a metaMap (+ optional groupsMap for isTimeZeile/dim×dim)
        function fillInMeta(dim, metaMap, groupsMap) {
            for (const { key, label } of alleWerteForDim(dim)) {
                if (metaMap.has(key) || dimFilterSkip(dim, key)) continue;
                metaMap.set(key, { id: key, label });
                if (groupsMap && !groupsMap.has(key)) groupsMap.set(key, { dossiers: [], journal: [] });
            }
        }

        // Suppress "(Kein X)" rows when the corresponding filter is active or dimension is active
        function shouldSuppress(key, dim) {
            if (key === '__kein_kader__' && (filter.user_ids?.length > 0 || kaderIsDim)) return true;
            if (key === '__kein_standort__' && (filter.standort_ids?.length > 0 || standortIsDim)) return true;
            if (key === '__kein_programm__' && (filter.programm_ids?.length > 0 || massnahmeIsDim)) return true;
            if (key === '__' && dim === 'klient' && filter.klient_ids?.length > 0) return true;
            if (key === 'Keine Abteilung' && dim === 'abteilung' && (filter.abteilungen?.length > 0 || abteilungIsDim)) return true;
            return false;
        }

        if (isTimeZeile) {
            // --- Zeit als Zeilen, Dimension als Spalten ---
            const perioden = generierePeriodenListe(zeileDim, von, bis);

            const colGroups = new Map(); // ck → { dossiers: [], journal: [] }
            const colMeta   = new Map(); // ck → { id, label }

            for (const dos of dossiers) {
                const ck = getDimKey(dos, spaltenTyp);
                if (shouldSuppress(ck, spaltenTyp)) continue;
                if (!colGroups.has(ck)) colGroups.set(ck, { dossiers: [], journal: [] });
                colGroups.get(ck).dossiers.push(dos);
                if (!colMeta.has(ck)) colMeta.set(ck, { id: ck, label: getDimLabel(dos, spaltenTyp) });
            }
            for (const j of journalRows) {
                const ck = getDimKey(j, spaltenTyp);
                if (shouldSuppress(ck, spaltenTyp)) continue;
                if (!colGroups.has(ck)) colGroups.set(ck, { dossiers: [], journal: [] });
                colGroups.get(ck).journal.push(j);
                if (!colMeta.has(ck)) colMeta.set(ck, { id: ck, label: getDimLabel(j, spaltenTyp) });
            }

            fillInMeta(spaltenTyp, colMeta, colGroups);

            const sortedCols = [...colMeta.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'de'));
            const colLabels  = sortedCols.map(([, m]) => m.label);
            const effDoss = dossiers.filter(d => !shouldSuppress(getDimKey(d, spaltenTyp), spaltenTyp));
            const effJ    = journalRows.filter(j => !shouldSuppress(getDimKey(j, spaltenTyp), spaltenTyp));

            const zeilen_result = [];
            for (const periode of perioden) {
                const werte = {};
                for (const [ck, colInfo] of sortedCols) {
                    const grp = colGroups.get(ck) || { dossiers: [], journal: [] };
                    werte[colInfo.label] = berechneWerte(grp.dossiers, grp.journal, periode, kennzahlen);
                }
                zeilen_result.push({
                    label: periode.key, id: periode.key, werte,
                    total: berechneWerte(effDoss, effJ, periode, kennzahlen),
                });
            }

            const globalTotal = {};
            for (const [ck, colInfo] of sortedCols) {
                const grp = colGroups.get(ck) || { dossiers: [], journal: [] };
                globalTotal[colInfo.label] = berechneWerte(grp.dossiers, grp.journal, totalPeriode, kennzahlen);
            }

            return res.json({
                spalten: colLabels,
                zeilen: zeilen_result,
                total: globalTotal,
                total_gesamt: berechneWerte(effDoss, effJ, totalPeriode, kennzahlen),
            });
        }

        if (isTimeSpalte) {
            // --- Dimension als Zeilen, Zeit als Spalten ---
            const perioden = generierePeriodenListe(spaltenTyp, von, bis);
            const gruppenMap = new Map();

            for (const dos of dossiers) {
                const key = getDimKey(dos, zeileDim);
                if (shouldSuppress(key, zeileDim)) continue;
                if (!gruppenMap.has(key)) gruppenMap.set(key, { id: key, label: getDimLabel(dos, zeileDim), dossiers: [] });
                gruppenMap.get(key).dossiers.push(dos);
            }

            const journalByDim = new Map();
            for (const j of journalRows) {
                const key = getDimKey(j, zeileDim);
                if (shouldSuppress(key, zeileDim)) continue;
                if (!journalByDim.has(key)) journalByDim.set(key, []);
                journalByDim.get(key).push(j);
                if (!gruppenMap.has(key)) gruppenMap.set(key, { id: key, label: getDimLabel(j, zeileDim), dossiers: [] });
            }

            fillInGruppen(zeileDim, gruppenMap);

            const zeilen_result = [];
            for (const [key, gruppe] of gruppenMap) {
                const jList = journalByDim.get(key) || [];
                const werte = {};
                for (const p of perioden) {
                    werte[p.key] = berechneWerte(gruppe.dossiers, jList, p, kennzahlen);
                }
                zeilen_result.push({
                    label: gruppe.label, id: gruppe.id, werte,
                    total: berechneWerte(gruppe.dossiers, jList, totalPeriode, kennzahlen),
                });
            }
            zeilen_result.sort((a, b) => a.label.localeCompare(b.label, 'de'));

            const effDoss = dossiers.filter(d => !shouldSuppress(getDimKey(d, zeileDim), zeileDim));
            const effJ = journalRows.filter(j => !shouldSuppress(getDimKey(j, zeileDim), zeileDim));
            const globalTotal = {};
            for (const p of perioden) globalTotal[p.key] = berechneWerte(effDoss, effJ, p, kennzahlen);

            return res.json({
                spalten: perioden.map(p => p.key),
                zeilen: zeilen_result,
                total: globalTotal,
                total_gesamt: berechneWerte(effDoss, effJ, totalPeriode, kennzahlen),
            });
        }

        // --- Dimension-based columns ---
        const cellMap = new Map();
        const rowMeta = new Map();
        const colMeta = new Map();

        function cellKey(rk, ck) { return `${rk}|||${ck}`; }
        function getCell(rk, ck) {
            const k = cellKey(rk, ck);
            if (!cellMap.has(k)) cellMap.set(k, { dossiers: [], journal: [] });
            return cellMap.get(k);
        }

        for (const dos of dossiers) {
            const rk = getDimKey(dos, zeileDim);
            const ck = getDimKey(dos, spaltenTyp);
            if (shouldSuppress(rk, zeileDim) || shouldSuppress(ck, spaltenTyp)) continue;
            getCell(rk, ck).dossiers.push(dos);
            if (!rowMeta.has(rk)) rowMeta.set(rk, { id: rk, label: getDimLabel(dos, zeileDim) });
            if (!colMeta.has(ck)) colMeta.set(ck, { id: ck, label: getDimLabel(dos, spaltenTyp) });
        }

        for (const j of journalRows) {
            const rk = getDimKey(j, zeileDim);
            const ck = getDimKey(j, spaltenTyp);
            if (shouldSuppress(rk, zeileDim) || shouldSuppress(ck, spaltenTyp)) continue;
            getCell(rk, ck).journal.push(j);
            if (!rowMeta.has(rk)) rowMeta.set(rk, { id: rk, label: getDimLabel(j, zeileDim) });
            if (!colMeta.has(ck)) colMeta.set(ck, { id: ck, label: getDimLabel(j, spaltenTyp) });
        }

        fillInMeta(zeileDim, rowMeta);
        fillInMeta(spaltenTyp, colMeta);

        const sortedCols = [...colMeta.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'de'));
        const sortedRows = [...rowMeta.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'de'));
        const colLabels = sortedCols.map(([, m]) => m.label);

        const zeilen_result = [];
        for (const [rk, rowInfo] of sortedRows) {
            const werte = {};
            const allDos = [];
            const allJ = [];
            for (const [ck, colInfo] of sortedCols) {
                const cell = cellMap.get(cellKey(rk, ck)) || { dossiers: [], journal: [] };
                allDos.push(...cell.dossiers);
                allJ.push(...cell.journal);
                werte[colInfo.label] = berechneWerte(cell.dossiers, cell.journal, totalPeriode, kennzahlen);
            }
            zeilen_result.push({
                label: rowInfo.label, id: rk, werte,
                total: berechneWerte(allDos, allJ, totalPeriode, kennzahlen),
            });
        }

        const globalTotal = {};
        for (const [ck, colInfo] of sortedCols) {
            const allDos = [];
            const allJ = [];
            for (const [rk] of sortedRows) {
                const cell = cellMap.get(cellKey(rk, ck)) || { dossiers: [], journal: [] };
                allDos.push(...cell.dossiers);
                allJ.push(...cell.journal);
            }
            globalTotal[colInfo.label] = berechneWerte(allDos, allJ, totalPeriode, kennzahlen);
        }

        const grandDos = [...cellMap.values()].flatMap(c => c.dossiers);
        const grandJ = [...cellMap.values()].flatMap(c => c.journal);

        res.json({
            spalten: colLabels,
            zeilen: zeilen_result,
            total: globalTotal,
            total_gesamt: berechneWerte(grandDos, grandJ, totalPeriode, kennzahlen),
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Ausführen der Abfrage' });
    }
});

module.exports = router;
