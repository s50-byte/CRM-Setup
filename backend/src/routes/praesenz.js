// ============================================================
// Route: Präsenzkontrolle
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/praesenz/:datum — Präsenz für ein Datum
router.get('/:datum', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                k.klient_id, k.nachname, k.vorname,
                p.name AS programm_name, p.farbe_hex,
                lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                pe.eintrag_id, pe.status, pe.ankunftszeit, pe.bemerkung,
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
                      lv.pensum_pct, lv.zeit_von, lv.zeit_bis, lv.zeitbasis,
                      lv.tage_mo, lv.tage_di, lv.tage_mi, lv.tage_do, lv.tage_fr,
                      pe.eintrag_id, pe.status, pe.ankunftszeit, pe.bemerkung
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
    const { klient_id, datum, status, ankunftszeit, bemerkung } = req.body;

    if (!klient_id || !datum || !status) {
        return res.status(400).json({ error: 'Klient, Datum und Status erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO praesenz_eintrag
                (klient_id, datum, status, ankunftszeit, bemerkung, erfasst_von)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (klient_id, datum) DO UPDATE SET
                status = $3, ankunftszeit = $4,
                bemerkung = $5, erfasst_von = $6
             RETURNING *`,
            [klient_id, datum, status, ankunftszeit || null,
             bemerkung || null, req.user.user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erfassen der Präsenz' });
    }
});

// POST /api/praesenz/abschliessen — Kontrolle abschliessen & Meldungen senden
router.post('/abschliessen', auth, async (req, res) => {
    const { datum } = req.body;

    try {
        // Unentschuldigte und kranke Klienten laden
        const abwesend = await db.query(
            `SELECT
                k.nachname, k.vorname, pe.status,
                JSON_AGG(
                    JSONB_BUILD_OBJECT(
                        'full_name', u.full_name,
                        'email', u.email
                    )
                ) FILTER (WHERE u.user_id IS NOT NULL) AS zu_benachrichtigen
             FROM praesenz_eintrag pe
             JOIN klient k ON k.klient_id = pe.klient_id
             LEFT JOIN klient_user ku ON ku.klient_id = k.klient_id AND ku.aktiv = TRUE
             LEFT JOIN benutzer u ON u.user_id = ku.user_id
             WHERE pe.datum = $1
               AND pe.status IN ('unentschuldigt', 'krank')
             GROUP BY k.klient_id, k.nachname, k.vorname, pe.status`,
            [datum]
        );

        // In einer echten Implementierung würden hier E-Mails gesendet
        // Für jetzt geben wir die Liste zurück
        res.json({
            message: 'Präsenzkontrolle abgeschlossen',
            meldungen: abwesend.rows,
            datum
        });
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