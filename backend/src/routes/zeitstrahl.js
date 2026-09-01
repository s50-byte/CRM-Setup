// ============================================================
// Route: Zeitstrahl — Phaseninstanzen eines Programms
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { hatTabelle } = require('../schema-flags');
const { strangBauen } = require('../zeitstrahl');

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
             ORDER BY l.tarifnr, pp.reihenfolge`,
            [prog.verlauf_id]
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
        await pgClient.query(`DELETE FROM programm_phase WHERE verlauf_id = $1`, [prog.verlauf_id]);

        let angelegt = 0;
        const ohnePhasen = [];
        for (const { leistung_id } of tarife.rows) {
            const phasen = await pgClient.query(
                `SELECT phase_id, label FROM phase WHERE leistung_id = $1 ORDER BY reihenfolge`,
                [leistung_id]
            );
            if (!phasen.rows.length) {
                const l = await pgClient.query('SELECT bezeichnung FROM leistung WHERE leistung_id = $1', [leistung_id]);
                ohnePhasen.push(l.rows[0]?.bezeichnung || leistung_id);
                continue;
            }
            const strang = strangBauen(von, bis, phasen.rows);
            for (const p of strang) {
                await pgClient.query(
                    `INSERT INTO programm_phase (verlauf_id, leistung_id, phase_id, reihenfolge, start_datum, end_datum)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [prog.verlauf_id, leistung_id, p.phase_id, p.reihenfolge, p.start_datum, p.end_datum]
                );
                angelegt++;
            }
        }
        await pgClient.query('COMMIT');
        res.json({ angelegt, straenge: tarife.rows.length - ohnePhasen.length, ohne_phasenmodell: ohnePhasen });
    } catch (err) {
        await pgClient.query('ROLLBACK').catch(() => {});
        console.error('[zeitstrahl]', err.message);
        res.status(400).json({ error: err.message });
    } finally {
        pgClient.release();
    }
});

module.exports = router;
