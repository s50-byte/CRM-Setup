// ============================================================
// Route: Zeitstrahl — Phaseninstanzen eines Programms
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { hatTabelle, hatSpalte } = require('../schema-flags');
const { straengeErzeugen } = require('../zeitstrahl');
const { zeitraumSetzen } = require('../phasenverschiebung');

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
        if (!prog) return res.json({ programm: null, straenge: [], termine: [] });

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
        // Termine des Klienten: phasengebundene liegen in ihrer Phase, frei
        // erfasste ausserhalb. Beide erscheinen auf dem Zeitstrahl.
        const gebundenDa = await hatSpalte('termin', 'programm_phase_id');
        const termine = await db.query(
            `SELECT t.termin_id, t.typ, t.datum, t.zeit, t.status,
                    ${gebundenDa ? 't.programm_phase_id' : 'NULL::uuid AS programm_phase_id'}
             FROM termin t
             JOIN dossier d ON d.klient_id = t.klient_id
             WHERE d.dossier_id = $1::uuid
               AND t.status <> 'Abgesagt'
             ORDER BY t.datum, t.zeit`,
            [req.params.dossier_id]
        );

        res.json({ programm: prog, straenge, termine: termine.rows });
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

// Laedt einen Strang samt gebundener Termine – die Grundlage jeder Verschiebung.
async function strangLaden(pgClient, instanz_id) {
    const eigen = await pgClient.query(
        `SELECT verlauf_id, leistung_id FROM programm_phase WHERE instanz_id = $1::uuid`,
        [instanz_id]
    );
    if (!eigen.rows.length) return null;
    const { verlauf_id, leistung_id } = eigen.rows[0];

    const phasen = await pgClient.query(
        `SELECT pp.instanz_id, pp.start_datum, pp.end_datum, ph.label AS phase_label
         FROM programm_phase pp JOIN phase ph ON ph.phase_id = pp.phase_id
         WHERE pp.verlauf_id = $1 AND pp.leistung_id = $2
         ORDER BY pp.reihenfolge`,
        [verlauf_id, leistung_id]
    );

    const termine = await pgClient.query(
        `SELECT programm_phase_id, datum FROM termin
         WHERE programm_phase_id = ANY($1::uuid[]) AND status <> 'Abgesagt'`,
        [phasen.rows.map(p => p.instanz_id)]
    );
    const termineJePhase = {};
    for (const t of termine.rows) {
        (termineJePhase[t.programm_phase_id] = termineJePhase[t.programm_phase_id] || [])
            .push({ datum: t.datum.toISOString().slice(0, 10) });
    }

    return {
        phasen: phasen.rows.map(p => ({
            ...p,
            start_datum: p.start_datum.toISOString().slice(0, 10),
            end_datum: p.end_datum.toISOString().slice(0, 10),
        })),
        termineJePhase,
    };
}

// PUT /api/zeitstrahl/phase/:instanz_id — Zeitraum einer Phase setzen.
// Denselben Weg nehmen der Zeitstrahl und die Von/Bis-Felder in der Phase.
router.put('/phase/:instanz_id', auth, async (req, res) => {
    if (!await tabelleDa(res)) return;
    const { start_datum, end_datum } = req.body;
    const pgClient = await db.connect();
    try {
        const strang = await strangLaden(pgClient, req.params.instanz_id);
        if (!strang) return res.status(404).json({ error: 'Phase nicht gefunden' });

        const neu = zeitraumSetzen(
            strang.phasen, req.params.instanz_id,
            { start_datum, end_datum }, strang.termineJePhase
        );

        await pgClient.query('BEGIN');
        for (const p of neu) {
            await pgClient.query(
                `UPDATE programm_phase SET start_datum = $1, end_datum = $2, updated_at = NOW()
                 WHERE instanz_id = $3`,
                [p.start_datum, p.end_datum, p.instanz_id]
            );
        }
        await pgClient.query('COMMIT');
        res.json({ phasen: neu });
    } catch (err) {
        await pgClient.query('ROLLBACK').catch(() => {});
        res.status(400).json({ error: err.message });
    } finally {
        pgClient.release();
    }
});

module.exports = router;
