// ============================================================
// Route: Präsenzkontrolle
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/praesenz/ferien?datum= — alle Klienten mit Ferien an einem Datum
// (MUSS vor /:datum stehen, da /ferien sonst als Datum gematcht wird)
router.get('/ferien', auth, async (req, res) => {
    const { datum } = req.query;
    if (!datum) return res.status(400).json({ error: 'Datum erforderlich' });
    try {
        const result = await db.query(
            `SELECT f.klient_id FROM ferienplanung f
             WHERE $1::date BETWEEN f.von AND f.bis`,
            [datum]
        );
        res.json(result.rows.map(r => r.klient_id));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Ferienplanung' });
    }
});

// GET /api/praesenz/historie — Präsenz-Einträge mit Filtern (für Export)
// (MUSS vor /:datum stehen)
router.get('/historie', auth, async (req, res) => {
    const { datum_von, datum_bis, klient_id, status, abteilung } = req.query;

    const bedingungen = [];
    const params = [];
    let p = 1;

    if (datum_von) { bedingungen.push(`pe.datum >= $${p++}`); params.push(datum_von); }
    if (datum_bis) { bedingungen.push(`pe.datum <= $${p++}`); params.push(datum_bis); }
    if (klient_id) { bedingungen.push(`pe.klient_id = $${p++}`); params.push(klient_id); }
    if (status)    { bedingungen.push(`pe.status = $${p++}`); params.push(status); }
    if (abteilung) { bedingungen.push(`d.abteilung = $${p++}`); params.push(abteilung); }

    const where = bedingungen.length > 0 ? 'WHERE ' + bedingungen.join(' AND ') : '';

    try {
        const result = await db.query(
            `SELECT
                pe.eintrag_id, pe.klient_id, pe.datum, pe.status,
                pe.ankunftszeit, pe.bemerkung, pe.kommentar,
                k.nachname, k.vorname,
                pr.name AS programm_name,
                d.abteilung,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'alter_status', ph.alter_status,
                            'neuer_status', ph.neuer_status,
                            'kommentar', ph.kommentar,
                            'timestamp', ph.timestamp,
                            'erfasst_von', u.full_name
                        ) ORDER BY ph.timestamp
                    ) FILTER (WHERE ph.historie_id IS NOT NULL),
                    '[]'
                ) AS historie
             FROM praesenz_eintrag pe
             JOIN klient k ON k.klient_id = pe.klient_id
             LEFT JOIN dossier d ON d.klient_id = k.klient_id
             LEFT JOIN programm pr ON pr.programm_id = d.akt_programm_id
             LEFT JOIN praesenz_historie ph ON ph.eintrag_id = pe.eintrag_id
             LEFT JOIN benutzer u ON u.user_id = ph.erfasst_von
             ${where}
             GROUP BY pe.eintrag_id, k.klient_id, pr.name, d.abteilung
             ORDER BY pe.datum DESC, k.nachname, k.vorname`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Historie' });
    }
});

// GET /api/praesenz/:datum — Präsenz für ein Datum
router.get('/:datum', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                k.klient_id, k.nachname, k.vorname,
                p.name AS programm_name, p.farbe_hex,
                d.dossier_id, d.abteilung,
                (SELECT pv.klient_label FROM programm_verlauf pv
                 WHERE pv.dossier_id = d.dossier_id AND pv.status = 'Laufend'
                 LIMIT 1) AS klient_label,
                lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                pe.eintrag_id, pe.status, pe.ankunftszeit, pe.bemerkung,
                pe.kommentar, COALESCE(pe.updated_at, pe.created_at) AS updated_at,
                COALESCE(
                    JSON_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'full_name', u.full_name,
                            'rolle_im_fall', ku.rolle_im_fall
                        )
                    ) FILTER (WHERE u.user_id IS NOT NULL),
                    '[]'
                ) AS zugewiesen
             FROM klient k
             JOIN dossier d ON d.klient_id = k.klient_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             LEFT JOIN leistungsvereinbarung lv ON lv.klient_id = k.klient_id
             LEFT JOIN praesenz_eintrag pe ON pe.klient_id = k.klient_id
                AND pe.datum = $1
             LEFT JOIN klient_user ku ON ku.klient_id = k.klient_id AND ku.aktiv = TRUE
             LEFT JOIN benutzer u ON u.user_id = ku.user_id
             WHERE k.aktiv = TRUE
               AND d.pipeline_status != 'Erstkontakt'
             GROUP BY k.klient_id, k.nachname, k.vorname,
                      p.name, p.farbe_hex,
                      d.dossier_id, d.abteilung,
                      lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                      lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                      pe.eintrag_id, pe.status, pe.ankunftszeit, pe.bemerkung,
                      pe.kommentar, pe.updated_at, pe.created_at
             ORDER BY k.nachname, k.vorname`,
            [req.params.datum]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Präsenz' });
    }
});

// POST /api/praesenz — Status erfassen
router.post('/', auth, async (req, res) => {
    const { klient_id, datum, status, ankunftszeit, bemerkung, kommentar } = req.body;

    if (!klient_id || !datum || !status) {
        return res.status(400).json({ error: 'Klient, Datum und Status erforderlich' });
    }

    try {
        const vorher = await db.query(
            `SELECT eintrag_id, status, kommentar FROM praesenz_eintrag WHERE klient_id = $1 AND datum = $2`,
            [klient_id, datum]
        );
        const alterStatus   = vorher.rows[0]?.status    || null;
        const alterKommentar = vorher.rows[0]?.kommentar || null;

        const result = await db.query(
            `INSERT INTO praesenz_eintrag
                (klient_id, datum, status, ankunftszeit, bemerkung, kommentar, erfasst_von)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (klient_id, datum) DO UPDATE SET
                status = $3, ankunftszeit = $4,
                bemerkung = $5, kommentar = $6, erfasst_von = $7,
                updated_at = NOW()
             RETURNING *`,
            [klient_id, datum, status, ankunftszeit || null,
             bemerkung || null, kommentar || null, req.user.user_id]
        );
        const eintrag = result.rows[0];

        const statusGeaendert    = alterStatus !== status;
        const kommentarGeaendert = (kommentar || null) !== alterKommentar;

        if (statusGeaendert || kommentarGeaendert) {
            if (statusGeaendert) {
                await db.query(
                    `INSERT INTO praesenz_historie
                        (eintrag_id, alter_status, neuer_status, kommentar, erfasst_von)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [eintrag.eintrag_id, alterStatus, status, kommentar || null, req.user.user_id]
                );
            }

            const kaderResult = await db.query(
                `SELECT ku.user_id, k.nachname, k.vorname
                 FROM klient_user ku
                 JOIN klient k ON k.klient_id = ku.klient_id
                 WHERE ku.klient_id = $1 AND ku.aktiv = TRUE`,
                [klient_id]
            );

            if (kaderResult.rows.length > 0) {
                const klient = kaderResult.rows[0];
                const aenderung = {
                    klient_id,
                    name: `${klient.vorname} ${klient.nachname}`,
                    alter_status: alterStatus,
                    neuer_status: status,
                    kommentar: kommentar || null,
                };

                const aenderungMitTimestamp = {
                    ...aenderung,
                    timestamp: new Date().toISOString(),
                };

                for (const kader of kaderResult.rows) {
                    await db.query(
                        `INSERT INTO dashboard_meldung
                            (empfaenger_id, datum, aenderungen, erstellt_von)
                         VALUES ($1, $2, $3::jsonb, $4)`,
                        [kader.user_id, datum, JSON.stringify([aenderungMitTimestamp]), req.user.user_id]
                    );
                }
            }
        }

        res.status(201).json(eintrag);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erfassen der Präsenz' });
    }
});

// POST /api/praesenz/abschliessen — Kontrolle abschliessen & Meldungen senden
router.post('/abschliessen', auth, async (req, res) => {
    const { datum } = req.body;

    try {
        const abwesend = await db.query(
            `SELECT
                k.nachname, k.vorname, pe.status,
                JSON_AGG(
                    JSONB_BUILD_OBJECT('full_name', u.full_name, 'email', u.email)
                ) FILTER (WHERE u.user_id IS NOT NULL) AS zu_benachrichtigen
             FROM praesenz_eintrag pe
             JOIN klient k ON k.klient_id = pe.klient_id
             LEFT JOIN klient_user ku ON ku.klient_id = k.klient_id AND ku.aktiv = TRUE
             LEFT JOIN benutzer u ON u.user_id = ku.user_id
             WHERE pe.datum = $1 AND pe.status IN ('unentschuldigt', 'krank')
             GROUP BY k.klient_id, k.nachname, k.vorname, pe.status`,
            [datum]
        );
        res.json({ message: 'Präsenzkontrolle abgeschlossen', meldungen: abwesend.rows, datum });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Abschliessen' });
    }
});

// GET /api/praesenz/ferien/:klient_id — Ferien eines Klienten
router.get('/ferien/:klient_id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT f.*, u.full_name AS abgesprochen_mit_name
             FROM ferienplanung f
             LEFT JOIN benutzer u ON u.user_id = f.abgesprochen_mit
             WHERE f.klient_id = $1
             ORDER BY f.von DESC`,
            [req.params.klient_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Ferien' });
    }
});

// POST /api/praesenz/ferien — Ferien erfassen
router.post('/ferien', auth, async (req, res) => {
    const { klient_id, von, bis, bemerkung } = req.body;

    if (!klient_id || !von || !bis) {
        return res.status(400).json({ error: 'Klient, Von und Bis erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO ferienplanung
                (klient_id, von, bis, abgesprochen_mit, bemerkung, genehmigt)
             VALUES ($1, $2, $3, $4, $5, TRUE)
             RETURNING *`,
            [klient_id, von, bis, req.user.user_id, bemerkung || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erfassen der Ferien' });
    }
});

module.exports = router;
