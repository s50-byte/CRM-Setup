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
                st.name AS standort_name, st.kuerzel AS standort_kuerzel,
                COALESCE(
                    JSON_AGG(
                        JSONB_BUILD_OBJECT(
                            'rolle_name', r.rolle_name,
                            'pensum_pct', r.pensum_pct,
                            'max_klienten', r.max_klienten
                        )
                    ) FILTER (WHERE r.aufgabe_id IS NOT NULL),
                    '[]'
                ) AS rollen
             FROM benutzer u
             LEFT JOIN benutzer_aufgabe r ON r.user_id = u.user_id
             LEFT JOIN standort st ON st.standort_id = u.standort_id
             WHERE u.aktiv = TRUE
             GROUP BY u.user_id, st.name, st.kuerzel
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
    const GUELTIGE_ROLLEN = ['admin', 'mitarbeitende', 'teamleitung', 'management', 'kader'];

    if (!full_name || !email || !passwort) {
        return res.status(400).json({ error: 'Name, E-Mail und Passwort erforderlich' });
    }

    if (system_rolle && !GUELTIGE_ROLLEN.includes(system_rolle)) {
        return res.status(400).json({ error: `Ungültige Rolle. Erlaubt: ${GUELTIGE_ROLLEN.join(', ')}` });
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

// GET /api/benutzer/mein-profil — Eigenes Profil inkl. Rollen und Programme
router.get('/mein-profil', auth, async (req, res) => {
    try {
        const user = await db.query(
            `SELECT u.user_id, u.full_name, u.email, u.system_rolle, u.pensum_pct, u.avatar_initials,
                    st.name AS standort_name, st.kuerzel AS standort_kuerzel
             FROM benutzer u
             LEFT JOIN standort st ON st.standort_id = u.standort_id
             WHERE u.user_id = $1`,
            [req.user.user_id]
        );
        if (user.rows.length === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

        const rollen = await db.query(
            `SELECT aufgabe_id, rolle_name, max_klienten FROM benutzer_aufgabe WHERE user_id = $1`,
            [req.user.user_id]
        );
        const programme = await db.query(
            `SELECT bp.perm_id, bp.programm_id, p.name AS programm_name, p.farbe_hex
             FROM benutzer_berechtigung bp
             JOIN programm p ON p.programm_id = bp.programm_id
             WHERE bp.user_id = $1`,
            [req.user.user_id]
        );

        res.json({ ...user.rows[0], rollen: rollen.rows, programme: programme.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Profils' });
    }
});

// PUT /api/benutzer/rollen — Eigene Rollen setzen
router.put('/rollen', auth, async (req, res) => {
    const { rollen } = req.body;
    try {
        await db.query(`DELETE FROM benutzer_aufgabe WHERE user_id = $1`, [req.user.user_id]);
        for (const rolle_name of (rollen || [])) {
            await db.query(
                `INSERT INTO benutzer_aufgabe (user_id, rolle_name, max_klienten) VALUES ($1, $2, 15)`,
                [req.user.user_id, rolle_name]
            );
        }
        res.json({ message: 'Rollen aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Rollen' });
    }
});

// PUT /api/benutzer/programme — Eigene Programme setzen
router.put('/programme', auth, async (req, res) => {
    const { programme } = req.body;
    try {
        await db.query(`DELETE FROM benutzer_berechtigung WHERE user_id = $1`, [req.user.user_id]);
        for (const programm_id of (programme || [])) {
            await db.query(
                `INSERT INTO benutzer_berechtigung (user_id, programm_id) VALUES ($1, $2)`,
                [req.user.user_id, programm_id]
            );
        }
        res.json({ message: 'Programme aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Programme' });
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