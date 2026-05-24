// ============================================================
// Route: Programme
// ============================================================
const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/programme — Alle Programme mit Phasen
router.get('/', auth, async (req, res) => {
    try {
        const programme = await db.query(
            `SELECT * FROM programm WHERE aktiv = TRUE ORDER BY name`
        );

        // Phasen und Kriterien für jedes Programm laden
        for (const prog of programme.rows) {
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
        }

        res.json(programme.rows);
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

    const { name, farbe_hex, tarif_pro_tag, avg_dauer_tage, aufwand_h_monat } = req.body;

    if (!name || !tarif_pro_tag) {
        return res.status(400).json({ error: 'Name und Tarif erforderlich' });
    }

    try {
        const result = await db.query(
            `INSERT INTO programm (name, farbe_hex, tarif_pro_tag, avg_dauer_tage, aufwand_h_monat)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, farbe_hex || '#2563EB', tarif_pro_tag,
             avg_dauer_tage || 30, aufwand_h_monat || 10]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

module.exports = router;