// ============================================================
// Route: Programme
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

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
    for (const prog of progRows) {
        const phasen = await db.query(
            `SELECT
                ph.phase_id, ph.label, ph.reihenfolge, ph.avg_dauer_tage,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'kriterium_id', k.kriterium_id,
                            'text', k.text,
                            'typ', k.typ,
                            'pflicht', k.pflicht
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
    if (!['teamleitung', 'management'].includes(req.user.system_rolle)) {
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
    if (!['teamleitung', 'management'].includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    const { name, farbe_hex, monatspreis, avg_dauer_monate, aufwand_h_monat } = req.body;
    if (!name || !monatspreis) return res.status(400).json({ error: 'Name und Monatspreis erforderlich' });
    try {
        await db.query(
            `UPDATE programm SET name=$1, farbe_hex=$2, monatspreis=$3, avg_dauer_monate=$4,
             tarif_pro_tag=$5, avg_dauer_tage=$6, aufwand_h_monat=$7
             WHERE programm_id=$8`,
            [name, farbe_hex || '#2563EB', monatspreis, avg_dauer_monate || null,
             monatspreis, (avg_dauer_monate || 1) * 30, aufwand_h_monat || 10, req.params.id]
        );
        res.json({ message: 'Programm aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
});

// PUT /api/programme/:id/rollen — Rollen für Programm setzen
router.put('/:id/rollen', auth, async (req, res) => {
    if (!['teamleitung', 'management'].includes(req.user.system_rolle)) {
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
    const { label, avg_dauer_tage } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label erforderlich' });
    try {
        const count = await db.query(
            `SELECT COUNT(*) FROM phase WHERE programm_id = $1`, [req.params.id]
        );
        const reihenfolge = parseInt(count.rows[0].count);
        const result = await db.query(
            `INSERT INTO phase (programm_id, label, reihenfolge, avg_dauer_tage)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, label.trim(), reihenfolge, avg_dauer_tage || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen der Phase' });
    }
});

// PUT /api/programme/:id/phasen/:phase_id — Phase umbenennen
router.put('/:id/phasen/:phase_id', auth, async (req, res) => {
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'Label erforderlich' });
    try {
        await db.query(`UPDATE phase SET label = $1 WHERE phase_id = $2`, [label.trim(), req.params.phase_id]);
        res.json({ message: 'Phase umbenannt' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Umbenennen' });
    }
});

// PUT /api/programme/:id/phasen/:phase_id/rollen — Rollen für Phase setzen
router.put('/:id/phasen/:phase_id/rollen', auth, async (req, res) => {
    if (!['teamleitung', 'management'].includes(req.user.system_rolle)) {
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
    const { text, typ, pflicht } = req.body;
    console.log('[POST /phasen/' + req.params.phase_id + '/kriterien] body:', req.body);
    if (!text?.trim()) return res.status(400).json({ error: 'Text erforderlich' });
    try {
        const count = await db.query(
            `SELECT COUNT(*) FROM kriterium WHERE phase_id = $1`, [req.params.phase_id]
        );
        const reihenfolge = parseInt(count.rows[0].count);
        const result = await db.query(
            `INSERT INTO kriterium (phase_id, text, typ, pflicht, reihenfolge)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.params.phase_id, text.trim(), typ || null, pflicht || false, reihenfolge]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen: ' + err.message });
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
