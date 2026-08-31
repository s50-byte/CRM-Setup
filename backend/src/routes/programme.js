// ============================================================
// Route: Programme
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { hatSpalte } = require('../schema-flags');

// Wer Programme, Phasen und Kriterien pflegen darf. Die Werte 'teamleitung' und
// 'management' sind historisch und kommen im Bestand nicht mehr vor – sie bleiben
// zur Sicherheit drin, damit alte Konten nichts verlieren. Massgebend ist, dass
// die Liste zur Bearbeiten-Freigabe im Frontend passt (kader/leitungsteam).
const PROGRAMM_PFLEGE_ROLLEN = ['leitungsteam', 'admin', 'kader', 'teamleitung', 'management'];

// Rollen-Tabellen anlegen (crm_user-owned, kein ALTER auf Fremdtabellen nötig)
db.query(`
    CREATE TABLE IF NOT EXISTS programm_rolle (
        programm_id UUID REFERENCES programm(programm_id) ON DELETE CASCADE,
        rolle_name  VARCHAR(50) NOT NULL,
        PRIMARY KEY (programm_id, rolle_name)
    )
`).catch(err => console.error('programm_rolle table init:', err));

db.query(`
    CREATE TABLE IF NOT EXISTS phase_rolle (
        phase_id   UUID REFERENCES phase(phase_id) ON DELETE CASCADE,
        rolle_name VARCHAR(50) NOT NULL,
        PRIMARY KEY (phase_id, rolle_name)
    )
`).catch(err => console.error('phase_rolle table init:', err));

const GRUPPEN_META = {
    'BM': 'Berufliche Massnahmen',
    'IM': 'Integrationsmassnahmen',
    'BC': 'Beratung & Coaching',
    'GM': 'Gemeinde',
};

async function ladePhasenUndRollen(progRows) {
    const vwDa = await hatSpalte('kriterium', 'verantwortlich_rolle');
    for (const prog of progRows) {
        const phasen = await db.query(
            `SELECT
                ph.phase_id, ph.label, ph.reihenfolge,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'kriterium_id', k.kriterium_id,
                            'text', k.text,
                            'typ', k.typ,
                            'pflicht', k.pflicht
                            ${vwDa ? `, 'verantwortlich_rolle', k.verantwortlich_rolle` : ''}
                        ) ORDER BY k.reihenfolge
                    ) FILTER (WHERE k.kriterium_id IS NOT NULL),
                    '[]'
                ) AS kriterien,
                COALESCE(
                    JSON_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'vorlage_id', ptv.vorlage_id,
                            'task_text', ptv.task_text,
                            'reihenfolge', ptv.reihenfolge
                        )
                    ) FILTER (WHERE ptv.vorlage_id IS NOT NULL),
                    '[]'
                ) AS task_vorlagen
             FROM phase ph
             LEFT JOIN kriterium k ON k.phase_id = ph.phase_id
             LEFT JOIN phase_task_vorlage ptv ON ptv.phase_id = ph.phase_id
             WHERE ph.programm_id = $1
             GROUP BY ph.phase_id
             ORDER BY ph.reihenfolge`,
            [prog.programm_id]
        );
        prog.phasen = phasen.rows;

        try {
            const progRollenRes = await db.query(
                `SELECT rolle_name FROM programm_rolle WHERE programm_id = $1`,
                [prog.programm_id]
            );
            prog.rollen = progRollenRes.rows.map(r => r.rolle_name);
        } catch { prog.rollen = []; }

        try {
            const phaseRollenRes = await db.query(
                `SELECT pr.phase_id, pr.rolle_name
                 FROM phase_rolle pr
                 JOIN phase ph ON ph.phase_id = pr.phase_id
                 WHERE ph.programm_id = $1`,
                [prog.programm_id]
            );
            const map = {};
            for (const r of phaseRollenRes.rows) {
                if (!map[r.phase_id]) map[r.phase_id] = [];
                map[r.phase_id].push(r.rolle_name);
            }
            prog.phasen.forEach(ph => { ph.rollen = map[ph.phase_id] || []; });
        } catch { prog.phasen.forEach(ph => { ph.rollen = []; }); }
    }
}

// GET /api/programme — Alle Programme (flach oder gruppiert via ?grouped=true)
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT p.*,
                l.tarifziffer, l.tarif, l.entschaedigungsart
             FROM programm p
             LEFT JOIN leistung l ON l.leistung_id = p.leistung_id
             WHERE p.aktiv = TRUE
             ORDER BY p.gruppe NULLS LAST, p.name`
        );

        await ladePhasenUndRollen(result.rows);

        if (req.query.grouped === 'true') {
            const gruppenMap = {};
            for (const prog of result.rows) {
                const g = prog.gruppe || 'Weitere';
                if (!gruppenMap[g]) gruppenMap[g] = [];
                gruppenMap[g].push(prog);
            }
            const gruppen = Object.entries(GRUPPEN_META)
                .filter(([g]) => gruppenMap[g])
                .map(([g, label]) => ({ gruppe: g, label, programme: gruppenMap[g] }));
            if (gruppenMap['Weitere']?.length) {
                gruppen.push({ gruppe: 'Weitere', label: 'Weitere Programme', programme: gruppenMap['Weitere'] });
            }
            return res.json({ gruppen });
        }

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Programme' });
    }
});

// GET /api/programme/:id — Einzelnes Programm
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM programm WHERE programm_id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Programm nicht gefunden' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// POST /api/programme — Neues Programm (nur Teamleitung/Management)
router.post('/', auth, async (req, res) => {
    if (!PROGRAMM_PFLEGE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { name, farbe_hex, monatspreis, avg_dauer_monate, aufwand_h_monat } = req.body;
    if (!name || !monatspreis) {
        return res.status(400).json({ error: 'Name und Monatspreis erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO programm (name, farbe_hex, monatspreis, avg_dauer_monate, tarif_pro_tag, avg_dauer_tage, aufwand_h_monat)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, farbe_hex || '#2563EB', monatspreis, avg_dauer_monate || null,
             monatspreis, (avg_dauer_monate || 1) * 30, aufwand_h_monat || 10]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// PUT /api/programme/:id — Programm bearbeiten
router.put('/:id', auth, async (req, res) => {
    if (!PROGRAMM_PFLEGE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { name, farbe_hex, monatspreis, avg_dauer_monate, aufwand_h_monat, produkteblatt_url } = req.body;
    if (!name || !monatspreis) return res.status(400).json({ error: 'Name und Monatspreis erforderlich' });
    try {
        const pbDa = await hatSpalte('programm', 'produkteblatt_url');
        const basis = [name, farbe_hex || '#2563EB', monatspreis, avg_dauer_monate || null,
                       monatspreis, (avg_dauer_monate || 1) * 30, aufwand_h_monat || 10];
        await db.query(
            pbDa
                ? `UPDATE programm SET name=$1, farbe_hex=$2, monatspreis=$3, avg_dauer_monate=$4,
                   tarif_pro_tag=$5, avg_dauer_tage=$6, aufwand_h_monat=$7, produkteblatt_url=$8
                   WHERE programm_id=$9`
                : `UPDATE programm SET name=$1, farbe_hex=$2, monatspreis=$3, avg_dauer_monate=$4,
                   tarif_pro_tag=$5, avg_dauer_tage=$6, aufwand_h_monat=$7
                   WHERE programm_id=$8`,
            pbDa ? [...basis, produkteblatt_url?.trim() || null, req.params.id]
                 : [...basis, req.params.id]
        );
        res.json({ message: 'Programm aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// PUT /api/programme/:id/rollen — Rollen für Programm setzen
router.put('/:id/rollen', auth, async (req, res) => {
    if (!PROGRAMM_PFLEGE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { rollen } = req.body;
    if (!Array.isArray(rollen)) return res.status(400).json({ error: 'rollen muss ein Array sein' });
    console.log('[PUT /programme/' + req.params.id + '/rollen] body:', rollen);
    try {
        await db.query(`DELETE FROM programm_rolle WHERE programm_id = $1`, [req.params.id]);
        if (rollen.length > 0) {
            const vals = rollen.map((_, i) => `($1, $${i + 2})`).join(', ');
            await db.query(
                `INSERT INTO programm_rolle (programm_id, rolle_name) VALUES ${vals}`,
                [req.params.id, ...rollen]
            );
        }
        res.json({ message: 'Rollen aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Rollen' });
    }
});

// POST /api/programme/:id/phasen — Phase hinzufügen
router.post('/:id/phasen', auth, async (req, res) => {
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label erforderlich' });
    try {
        // Das Phasenmodell haengt fachlich am Tarif (Etappe A1). Solange der
        // Programm-Katalog noch existiert, werden beide Spalten gefuehrt – sonst
        // haetten neue Phasen keinen Tarifbezug und fielen beim Aufloesen des
        // Katalogs hinten runter.
        const tarifDa = await hatSpalte('phase', 'leistung_id');
        // MAX+1 statt COUNT: auf (programm_id, reihenfolge) liegt ein UNIQUE, und
        // die bestehenden Phasen beginnen bei 1, nicht bei 0. Mit COUNT kollidierte
        // jede zweite Phase mit der ersten – Phasen liessen sich so nie ergaenzen.
        const naechste = await db.query(
            `SELECT COALESCE(MAX(reihenfolge) + 1, 0) AS n FROM phase WHERE programm_id = $1`,
            [req.params.id]
        );
        const reihenfolge = parseInt(naechste.rows[0].n, 10);
        const result = await db.query(
            tarifDa
                ? `INSERT INTO phase (programm_id, label, reihenfolge, leistung_id)
                   VALUES ($1, $2, $3, (SELECT leistung_id FROM programm WHERE programm_id = $1))
                   RETURNING *`
                : `INSERT INTO phase (programm_id, label, reihenfolge)
                   VALUES ($1, $2, $3) RETURNING *`,
            [req.params.id, label.trim(), reihenfolge]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Phase' });
    }
});

// PUT /api/programme/:id/phasen/:phase_id — Phase umbenennen
//
// Eine Phase im Tarifkatalog hat bewusst KEINE Solldauer: die Aufteilung ergibt
// sich erst am Fall aus der Programmdauer und wird dort von Hand verschoben.
router.put('/:id/phasen/:phase_id', auth, async (req, res) => {
    if (!PROGRAMM_PFLEGE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Bezeichnung erforderlich' });
    try {
        const r = await db.query(
            `UPDATE phase SET label = $1 WHERE phase_id = $2
             RETURNING phase_id, label, reihenfolge`,
            [label.trim(), req.params.phase_id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Phase nicht gefunden' });
        res.json(r.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Phase' });
    }
});

// PUT /api/programme/:id/phasen-reihenfolge — Reihenfolge der Phasen setzen
// Erwartet { phase_ids: [...] } in der gewuenschten Abfolge.
router.put('/:id/phasen-reihenfolge', auth, async (req, res) => {
    if (!PROGRAMM_PFLEGE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { phase_ids } = req.body;
    if (!Array.isArray(phase_ids) || phase_ids.length === 0) {
        return res.status(400).json({ error: 'phase_ids erforderlich' });
    }
    const pgClient = await db.connect();
    try {
        await pgClient.query('BEGIN');
        // Zweistufig: die Spalte haengt an einem UNIQUE (programm_id, reihenfolge),
        // ein direktes Umnummerieren kollidiert unterwegs mit sich selbst.
        for (let i = 0; i < phase_ids.length; i++) {
            await pgClient.query(
                `UPDATE phase SET reihenfolge = $1 WHERE phase_id = $2 AND programm_id = $3`,
                [-(i + 1), phase_ids[i], req.params.id]
            );
        }
        for (let i = 0; i < phase_ids.length; i++) {
            await pgClient.query(
                `UPDATE phase SET reihenfolge = $1 WHERE phase_id = $2 AND programm_id = $3`,
                [i, phase_ids[i], req.params.id]
            );
        }
        await pgClient.query('COMMIT');
        res.json({ ok: true });
    } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Sortieren der Phasen' });
    } finally {
        pgClient.release();
    }
});

// PUT /api/programme/:id/phasen/:phase_id/rollen — Rollen für Phase setzen
router.put('/:id/phasen/:phase_id/rollen', auth, async (req, res) => {
    if (!PROGRAMM_PFLEGE_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { rollen } = req.body;
    if (!Array.isArray(rollen)) return res.status(400).json({ error: 'rollen muss ein Array sein' });
    console.log('[PUT /phasen/' + req.params.phase_id + '/rollen] body:', rollen);
    try {
        await db.query(`DELETE FROM phase_rolle WHERE phase_id = $1`, [req.params.phase_id]);
        if (rollen.length > 0) {
            const vals = rollen.map((_, i) => `($1, $${i + 2})`).join(', ');
            await db.query(
                `INSERT INTO phase_rolle (phase_id, rolle_name) VALUES ${vals}`,
                [req.params.phase_id, ...rollen]
            );
        }
        res.json({ message: 'Rollen aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Rollen' });
    }
});

// DELETE /api/programme/phasen/:phase_id — Phase löschen
router.delete('/phasen/:phase_id', auth, async (req, res) => {
    try {
        await db.query(`DELETE FROM phase WHERE phase_id = $1`, [req.params.phase_id]);
        res.json({ message: 'Phase gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

// POST /api/programme/phasen/:phase_id/kriterien — Kriterium hinzufügen
router.post('/phasen/:phase_id/kriterien', auth, async (req, res) => {
    const { text, typ, pflicht, verantwortlich_rolle } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text erforderlich' });
    try {
        const vwDa = await hatSpalte('kriterium', 'verantwortlich_rolle');
        const naechste = await db.query(
            `SELECT COALESCE(MAX(reihenfolge) + 1, 0) AS n FROM kriterium WHERE phase_id = $1`,
            [req.params.phase_id]
        );
        const reihenfolge = parseInt(naechste.rows[0].n, 10);
        const result = await db.query(
            vwDa
                ? `INSERT INTO kriterium (phase_id, text, typ, pflicht, reihenfolge, verantwortlich_rolle)
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`
                : `INSERT INTO kriterium (phase_id, text, typ, pflicht, reihenfolge)
                   VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            vwDa
                ? [req.params.phase_id, text.trim(), typ || null, pflicht || false, reihenfolge,
                   verantwortlich_rolle || null]
                : [req.params.phase_id, text.trim(), typ || null, pflicht || false, reihenfolge]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen: ' + err.message });
    }
});

// PUT /api/programme/kriterien/:kriterium_id — Kriterium aendern (inkl. Verantwortliche)
router.put('/kriterien/:kriterium_id', auth, async (req, res) => {
    const { text, typ, pflicht, verantwortlich_rolle } = req.body;
    try {
        if (!await hatSpalte('kriterium', 'verantwortlich_rolle')) {
            return res.status(503).json({ error: 'Verantwortliche Rolle je Kriterium ist noch nicht migriert (add-kriterium-rolle.sql)' });
        }
        const result = await db.query(
            `UPDATE kriterium SET
                text = COALESCE($1, text),
                typ = COALESCE($2, typ),
                pflicht = COALESCE($3, pflicht),
                verantwortlich_rolle = $4
             WHERE kriterium_id = $5
             RETURNING *`,
            [text?.trim() || null, typ || null,
             typeof pflicht === 'boolean' ? pflicht : null,
             verantwortlich_rolle || null, req.params.kriterium_id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Kriterium nicht gefunden' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern des Kriteriums' });
    }
});

// DELETE /api/programme/kriterien/:kriterium_id — Kriterium löschen
router.delete('/kriterien/:kriterium_id', auth, async (req, res) => {
    try {
        await db.query(`DELETE FROM kriterium WHERE kriterium_id = $1`, [req.params.kriterium_id]);
        res.json({ message: 'Kriterium gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

module.exports = router;
