// ============================================================
// Route: Authentifizierung
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, passwort } = req.body;

    if (!email || !passwort) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    try {
        const result = await db.query(
            `SELECT user_id, full_name, email, password_hash, system_rolle, pensum_pct, avatar_initials
             FROM benutzer WHERE email = $1 AND aktiv = TRUE`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const user = result.rows[0];
        const passwortKorrekt = await bcrypt.compare(passwort, user.password_hash);

        if (!passwortKorrekt) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // Rollen laden
        const rollenResult = await db.query(
            `SELECT rolle_name, pensum_pct, max_klienten
             FROM benutzer_rolle WHERE user_id = $1`,
            [user.user_id]
        );

        const token = jwt.sign(
            {
                user_id:     user.user_id,
                email:       user.email,
                full_name:   user.full_name,
                system_rolle: user.system_rolle,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            token,
            benutzer: {
                user_id:        user.user_id,
                full_name:      user.full_name,
                email:          user.email,
                system_rolle:   user.system_rolle,
                pensum_pct:     user.pensum_pct,
                avatar_initials: user.avatar_initials,
                rollen:         rollenResult.rows
            }
        });

    } catch (err) {
        console.error('Login Fehler:', err);
        res.status(500).json({ error: 'Serverfehler beim Login' });
    }
});

// POST /api/auth/logout (Token-Invalidierung ist clientseitig)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout erfolgreich' });
});

module.exports = router;