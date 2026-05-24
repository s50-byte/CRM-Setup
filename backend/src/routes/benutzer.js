// ============================================================
// Route: Benutzer
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/benutzer — Alle Benutzer
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                u.user_id, u.full_name, u.email, u.system_rolle,
                u.pensum_pct, u.avatar_initials, u.aktiv,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'rolle_name', r.rolle_name,
                            'pensum_pct', r.pensum_pct,
                            'max_klienten', r.max_klienten
                        )
                    ) FILTER (WHERE r.rolle_id IS NOT NULL),
                    '[]'
                ) AS rollen
             FROM benutzer u
             LEFT JOIN benutzer_rolle r ON r.user_id = u.user_id
             WHERE u.aktiv = TRUE
             GROUP BY u.user_id
             ORDER BY u.full_name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
    }
});

// POST /api/benutzer — Neuer Benutzer (nur Management)
router.post('/', auth, async (req, res) => {
    if (req.user.system_rolle !== 'management') {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { full_name, email, passwort, system_rolle, pensum_pct, avatar_initials } = req.body;

    if (!full_name || !email || !passwort) {
        return res.status(400).json({ error: 'Name, E-Mail und Passwort erforderlich' });
    }

    try {
        const hash = await bcrypt.hash(passwort, 12);
        const result = await db.query(
            `INSERT INTO benutzer
                (full_name, email, password_hash, system_rolle, pensum_pct, avatar_initials)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING user_id, full_name, email, system_rolle, pensum_pct, avatar_initials`,
            [full_name, email, hash, system_rolle || 'mitarbeitende',
             pensum_pct || 100,
             avatar_initials || full_name.split(' ').map(n => n[0]).join('').slice(0, 3)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'E-Mail bereits vorhanden' });
        }
        res.status(500).json({ error: 'Fehler beim Erstellen' });
    }
});

// PUT /api/benutzer/passwort — Eigenes Passwort ändern
router.put('/passwort', auth, async (req, res) => {
    const { altes_passwort, neues_passwort } = req.body;

    try {
        const user = await db.query(
            `SELECT password_hash FROM benutzer WHERE user_id = $1`,
            [req.user.user_id]
        );

        const korrekt = await bcrypt.compare(altes_passwort, user.rows[0].password_hash);
        if (!korrekt) {
            return res.status(401).json({ error: 'Altes Passwort falsch' });
        }

        const hash = await bcrypt.hash(neues_passwort, 12);
        await db.query(
            `UPDATE benutzer SET password_hash = $1, updated_at = NOW()
             WHERE user_id = $2`,
            [hash, req.user.user_id]
        );

        res.json({ message: 'Passwort geändert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
    }
});

module.exports = router;