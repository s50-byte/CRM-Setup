// ============================================================
// Route: Zeitstrahl — Phaseninstanzen eines Programms
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { hatTabelle } = require('../schema-flags');
const { straengeErzeugen } = require('../zeitstrahl');

async function tabelleDa(res) {
    if (await hatTabelle('programm_phase')) return true;
    res.status(503).json({ error: 'Zeitstrahl ist noch nicht migriert (add-programm-phase.sql)' });
    return false;
}

// Laufendes Programm eines Dossiers samt aktiver Verfuegung.
async function programmLaden(dossier_id) {
    const r = await db.query(
        `SELECT pv.verlauf_id, pv.start_datum, pv.geplantes_enddatum,
                v.verfuegung_id, v.nummer AS verfuegung_nummer,
                v.gueltig_von, v.gueltig_bis
         FROM programm_verlauf pv
         LEFT JOIN verfuegung v ON v.dossier_id = pv.dossier_id AND v.status = 'aktiv'
         WHERE pv.dossier_id = $1::uuid AND pv.status = 'Laufend'
         LIMIT 1`,
        [dossier_id]
    );
    return r.rows[0] || null;
}

// GET /api/zeitstrahl/:dossier_id — bestehende Straenge
router.get('/:dossier_id', auth, async (req, res) => {
    if (!await tabelleDa(res)) return;
    try {
        const prog = await programmLaden(req.params.dossier_id);
        if (!prog) return res.json({ programm: null, straenge: [] });

        const r = await db.query(
            `SELECT pp.instanz_id, pp.leistung_id, pp.phase_id, pp.reihenfolge,
                    pp.start_datum, pp.end_datum,
                    ph.label AS phase_label,
                    l.bezeichnung AS tarif_bezeichnung, l.tarifnr,
                    (SELECT count(*) FROM kriterium k WHERE k.phase_id = ph.phase_id) AS kriterien,
                    (SELECT count(*) FROM kriterium k WHERE k.phase_id = ph.phase_id AND k.pflicht) AS kriterien_pflicht
             FROM programm_phase pp
             JOIN phase ph ON ph.phase_id = pp.phase_id
             JOIN leistung l ON l.leistung_id = pp.leistung_id
             WHERE pp.verlauf_id = $1
               AND EXISTS (SELECT 1 FROM verfuegung_position vp
                           WHERE vp.verfuegung_id = $2 AND vp.leistung_id = pp.leistung_id)
             ORDER BY l.tarifnr, pp.reihenfolge`,
            [prog.verlauf_id, prog.verfuegung_id]
        );

        // Nach Tarif gruppieren – je Tarif ein Strang.
        const straenge = [];
        for (const zeile of r.rows) {
            let strang = straenge.find(s => s.leistung_id === zeile.leistung_id);
            if (!strang) {
                strang = {
                    leistung_id: zeile.leistung_id,
                    tarifnr: zeile.tarifnr,
                    bezeichnung: zeile.tarif_bezeichnung,
                    phasen: [],
                };
                straenge.push(strang);
            }
            strang.phasen.push(zeile);
        }
        res.json({ programm: prog, straenge });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Zeitstrahls' });
    }
});

// POST /api/zeitstrahl/:dossier_id/erzeugen — Straenge aus der Verfuegung anlegen
router.post('/:dossier_id/erzeugen', auth, async (req, res) => {
    if (!await tabelleDa(res)) return;
    const pgClient = await db.connect();
    try {
        const prog = await programmLaden(req.params.dossier_id);
        if (!prog) return res.status(400).json({ error: 'Kein laufendes Programm am Dossier' });

        const von = prog.gueltig_von || prog.start_datum;
        const bis = prog.gueltig_bis || prog.geplantes_enddatum;
        if (!von || !bis) {
            return res.status(400).json({
                error: 'Die aktive Verfügung braucht einen Gültigkeitszeitraum (von und bis)',
            });
        }

        // Ein Strang je verfuegtem Tarif, dessen Phasen am Tarif haengen.
        const tarife = await pgClient.query(
            `SELECT DISTINCT vp.leistung_id
             FROM verfuegung_position vp
             WHERE vp.verfuegung_id = $1`,
            [prog.verfuegung_id]
        );
        if (!tarife.rows.length) {
            return res.status(400).json({ error: 'Die Verfügung hat keine Tarife als Positionen' });
        }

        await pgClient.query('BEGIN');
        const ergebnis = await straengeErzeugen(pgClient, {
            verlauf_id: prog.verlauf_id,
            verfuegung_id: prog.verfuegung_id,
            von, bis,
        });
        await pgClient.query('COMMIT');
        res.json(ergebnis);
    } catch (err) {
        await pgClient.query('ROLLBACK').catch(() => {});
        console.error('[zeitstrahl]', err.message);
        res.status(400).json({ error: err.message });
    } finally {
        pgClient.release();
    }
});

module.exports = router;
