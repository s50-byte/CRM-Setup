const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const MANAGEMENT_ROLLEN = ['leitungsteam', 'admin'];

function nurManagement(req, res, next) {
    if (!MANAGEMENT_ROLLEN.includes(req.user?.system_rolle)) {
        console.log('nurManagement: Zugriff verweigert, system_rolle:', req.user?.system_rolle);
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
}

function fuelleVorlage(inhalt, daten) {
    return inhalt.replace(/\{(\w+)\}/g, (match, key) => {
        const val = daten[key];
        return (val !== undefined && val !== null && val !== '') ? val : '—';
    });
}

const BEISPIEL_DATEN = {
    anrede:            'Herr',
    vorname:           'Max',
    nachname:          'Mustermann',
    adresse:           'Musterstrasse 1',
    plz:               '8001',
    ort:               'Zürich',
    ahv_nr:            '756.1234.5678.90',
    geburtsdatum:      '01.01.1980',
    programm:          'Berufliche Integration',
    phase:             'Aktivierungsphase',
    standort:          'Zürich',
    abteilung:         'Berufliche Integration',
    startdatum:        '01.03.2024',
    enddatum:          '28.02.2025',
    verfuegung_nummer: 'VF-2024-001',
    zuweisende_stelle: 'IV-Stelle Zürich',
    klientenfuehrung:  'Anna Beispiel',
    datum_heute:       new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
};

async function ladeDatenFuerKlient(klient_id) {
    const res = await db.query(
        `SELECT
            k.vorname, k.nachname, k.adresse, k.plz, k.ort, k.ahv_nummer AS ahv_nr,
            TO_CHAR(k.geburtsdatum, 'DD.MM.YYYY') AS geburtsdatum,
            d.abteilung,
            p.name  AS programm,
            ph.label AS phase,
            st.name AS standort,
            TO_CHAR(pv.start_datum, 'DD.MM.YYYY')          AS startdatum,
            TO_CHAR(pv.geplantes_enddatum, 'DD.MM.YYYY')   AS enddatum,
            v.verfuegung_nummer,
            d.zuweisende_stelle,
            bf.full_name AS klientenfuehrung,
            CASE
                WHEN k.geschlecht = 'w' THEN 'Frau'
                WHEN k.geschlecht = 'm' THEN 'Herr'
                ELSE ''
            END AS anrede
        FROM klient k
        LEFT JOIN dossier d ON d.klient_id = k.klient_id
        LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
        LEFT JOIN phase ph ON ph.phase_id = d.akt_phase_id
        LEFT JOIN standort st ON st.standort_id = d.standort_id
        LEFT JOIN programm_verlauf pv ON pv.dossier_id = d.dossier_id AND pv.status = 'Laufend'
        LEFT JOIN verfuegung v ON v.dossier_id = d.dossier_id AND v.status = 'aktiv'
        LEFT JOIN LATERAL (
            SELECT bf2.full_name FROM klient_user ku
            JOIN benutzer bf2 ON bf2.user_id = ku.user_id
            WHERE ku.klient_id = k.klient_id AND ku.rolle_im_fall = 'Klientenführung' AND ku.aktiv = TRUE
            LIMIT 1
        ) bf ON true
        WHERE k.klient_id = $1::uuid
        LIMIT 1`,
        [klient_id]
    );
    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
        ...row,
        datum_heute: new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    };
}

// GET /api/vorlagen — optional ?leistung_id= Filter
router.get('/', auth, async (req, res) => {
    try {
        const { leistung_id } = req.query;
        const result = leistung_id
            ? await db.query(
                `SELECT v.vorlage_id, v.name, v.beschreibung, v.typ, v.aktiv, v.created_at, v.updated_at
                 FROM dokument_vorlage v
                 JOIN vorlage_leistung vl ON vl.vorlage_id = v.vorlage_id
                 WHERE v.aktiv = TRUE AND vl.leistung_id = $1::uuid
                 ORDER BY v.name`,
                [leistung_id]
            )
            : await db.query(
                `SELECT vorlage_id, name, beschreibung, typ, aktiv, created_at, updated_at
                 FROM dokument_vorlage
                 WHERE aktiv = TRUE
                 ORDER BY name`
            );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Vorlagen' });
    }
});

// GET /api/vorlagen/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const [vorlageRes, leistungRes] = await Promise.all([
            db.query(`SELECT * FROM dokument_vorlage WHERE vorlage_id = $1::uuid`, [req.params.id]),
            db.query(`SELECT leistung_id FROM vorlage_leistung WHERE vorlage_id = $1::uuid`, [req.params.id]),
        ]);
        if (!vorlageRes.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
        res.json({
            ...vorlageRes.rows[0],
            leistung_ids: leistungRes.rows.map(r => r.leistung_id),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Vorlage' });
    }
});

async function syncLeistungen(vorlage_id, leistung_ids) {
    await db.query(`DELETE FROM vorlage_leistung WHERE vorlage_id = $1::uuid`, [vorlage_id]);
    if (leistung_ids?.length) {
        const vals = leistung_ids.map((_, i) => `($1::uuid, $${i + 2}::uuid)`).join(', ');
        await db.query(
            `INSERT INTO vorlage_leistung (vorlage_id, leistung_id) VALUES ${vals}`,
            [vorlage_id, ...leistung_ids]
        );
    }
}

// POST /api/vorlagen
router.post('/', auth, nurManagement, async (req, res) => {
    console.log('POST /vorlagen user:', req.user?.system_rolle, req.user?.user_id);
    const { name, beschreibung, inhalt, typ, leistung_ids } = req.body;
    if (!name || !inhalt) return res.status(400).json({ error: 'Name und Inhalt erforderlich' });
    try {
        const result = await db.query(
            `INSERT INTO dokument_vorlage (name, beschreibung, inhalt, typ)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, beschreibung || null, inhalt, typ || 'brief']
        );
        const vorlage = result.rows[0];
        await syncLeistungen(vorlage.vorlage_id, leistung_ids);
        res.status(201).json({ ...vorlage, leistung_ids: leistung_ids || [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Vorlage' });
    }
});

// PUT /api/vorlagen/:id
router.put('/:id', auth, nurManagement, async (req, res) => {
    const { name, beschreibung, inhalt, typ, leistung_ids } = req.body;
    if (!name || !inhalt) return res.status(400).json({ error: 'Name und Inhalt erforderlich' });
    try {
        const result = await db.query(
            `UPDATE dokument_vorlage
             SET name = $1, beschreibung = $2, inhalt = $3, typ = $4, updated_at = NOW()
             WHERE vorlage_id = $5::uuid
             RETURNING *`,
            [name, beschreibung || null, inhalt, typ || 'brief', req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
        await syncLeistungen(req.params.id, leistung_ids);
        res.json({ ...result.rows[0], leistung_ids: leistung_ids || [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Vorlage' });
    }
});

// DELETE /api/vorlagen/:id (soft delete)
router.delete('/:id', auth, nurManagement, async (req, res) => {
    try {
        await db.query(
            `UPDATE dokument_vorlage SET aktiv = FALSE, updated_at = NOW() WHERE vorlage_id = $1::uuid`,
            [req.params.id]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Vorlage' });
    }
});

// POST /api/vorlagen/vorschau (live — kein gespeichertes Dokument nötig)
router.post('/vorschau', auth, async (req, res) => {
    const { inhalt, klient_id } = req.body;
    if (!inhalt) return res.status(400).json({ error: 'inhalt erforderlich' });
    let daten = BEISPIEL_DATEN;
    if (klient_id) {
        try {
            const echte = await ladeDatenFuerKlient(klient_id);
            if (echte) daten = echte;
        } catch (e) {
            console.error('ladeDatenFuerKlient fehlgeschlagen, Fallback auf Beispieldaten:', e.message);
        }
    }
    res.json({ vorschau: fuelleVorlage(inhalt, daten) });
});

// POST /api/vorlagen/:id/vorschau
router.post('/:id/vorschau', auth, async (req, res) => {
    const { klient_id } = req.body;
    console.log('[vorschau] vorlage_id:', req.params.id, '| klient_id:', klient_id ?? '(keiner)');
    try {
        const vorlagenRes = await db.query(
            `SELECT inhalt FROM dokument_vorlage WHERE vorlage_id = $1::uuid AND aktiv = TRUE`,
            [req.params.id]
        );
        if (!vorlagenRes.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
        const inhalt = vorlagenRes.rows[0].inhalt;

        let daten = BEISPIEL_DATEN;
        if (klient_id) {
            try {
                const echte = await ladeDatenFuerKlient(klient_id);
                console.log('[vorschau] ladeDatenFuerKlient:', echte ? `OK — ${echte.vorname} ${echte.nachname}` : 'null (kein Treffer)');
                if (echte) daten = echte;
            } catch (e) {
                console.error('[vorschau] ladeDatenFuerKlient Fehler → Fallback Beispieldaten:', e.message);
            }
        } else {
            console.log('[vorschau] kein klient_id → Beispieldaten');
        }
        res.json({ vorschau: fuelleVorlage(inhalt, daten) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler bei der Vorschau' });
    }
});

module.exports = router;
