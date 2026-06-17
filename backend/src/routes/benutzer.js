// ============================================================
// Route: Benutzer
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');

const MANAGEMENT_ROLLEN = ['leitungsteam', 'admin'];

const DEFAULT_MAX_KLIENTEN = {
    'Klientenführung': 15,
    'Job Coach': 20,
    'Fachperson': 10,
    'Teamleitung': 8,
    'Management': 5,
};

function requireManagement(req, res, next) {
    if (!MANAGEMENT_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
}

// GET /api/benutzer — Alle Benutzer (?aktiv=alle für inkl. inaktive)
router.get('/', auth, async (req, res) => {
    const alleAnzeigen = req.query.aktiv === 'alle';
    try {
        const result = await db.query(
            `SELECT
                u.user_id, u.full_name, u.email, u.system_rolle,
                u.pensum_pct, u.avatar_initials, u.aktiv,
                COALESCE(
                    JSON_AGG(DISTINCT
                        JSONB_BUILD_OBJECT(
                            'rolle_name', r.rolle_name,
                            'pensum_pct', r.pensum_pct,
                            'max_klienten', r.max_klienten
                        )
                    ) FILTER (WHERE r.aufgabe_id IS NOT NULL),
                    '[]'
                ) AS rollen,
                COALESCE(
                    JSON_AGG(DISTINCT
                        JSONB_BUILD_OBJECT(
                            'standort_id', st2.standort_id,
                            'name', st2.name,
                            'kuerzel', st2.kuerzel
                        )
                    ) FILTER (WHERE st2.standort_id IS NOT NULL),
                    '[]'
                ) AS standorte,
                COALESCE(
                    JSON_AGG(DISTINCT
                        JSONB_BUILD_OBJECT(
                            'programm_id', p.programm_id,
                            'name', p.name,
                            'farbe_hex', p.farbe_hex
                        )
                    ) FILTER (WHERE p.programm_id IS NOT NULL),
                    '[]'
                ) AS programme
             FROM benutzer u
             LEFT JOIN benutzer_aufgabe r ON r.user_id = u.user_id
             LEFT JOIN benutzer_standort bs ON bs.user_id = u.user_id
             LEFT JOIN standort st2 ON st2.standort_id = bs.standort_id
             LEFT JOIN benutzer_berechtigung bb ON bb.user_id = u.user_id
             LEFT JOIN programm p ON p.programm_id = bb.programm_id
             WHERE ($1 OR u.aktiv = TRUE)
             GROUP BY u.user_id
             ORDER BY u.full_name`,
            [alleAnzeigen]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
    }
});

// POST /api/benutzer — Neuer Benutzer (nur Management)
router.post('/', auth, async (req, res) => {
    if (!MANAGEMENT_ROLLEN.includes(req.user.system_rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const { full_name, email, passwort, system_rolle, pensum_pct, avatar_initials } = req.body;
    const GUELTIGE_ROLLEN = ['kader', 'leitungsteam'];

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
            [full_name, email, hash, system_rolle || 'kader',
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

// GET /api/benutzer/mein-profil — Eigenes Profil inkl. Rollen, Programme und Standorte
router.get('/mein-profil', auth, async (req, res) => {
    try {
        const user = await db.query(
            `SELECT u.user_id, u.full_name, u.email, u.system_rolle, u.pensum_pct, u.avatar_initials
             FROM benutzer u
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
        const standorte = await db.query(
            `SELECT s.standort_id, s.name, s.kuerzel
             FROM benutzer_standort bs
             JOIN standort s ON s.standort_id = bs.standort_id
             WHERE bs.user_id = $1`,
            [req.user.user_id]
        );
        const abteilungenEinst = await db.query(
            `SELECT wert FROM benutzer_einstellung WHERE user_id = $1 AND schluessel = 'abteilungen'`,
            [req.user.user_id]
        );
        const abteilungen = abteilungenEinst.rows[0]?.wert ? JSON.parse(abteilungenEinst.rows[0].wert) : [];

        res.json({ ...user.rows[0], rollen: rollen.rows, programme: programme.rows, standorte: standorte.rows, abteilungen });
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

// PUT /api/benutzer/standorte — Eigene Standorte setzen
router.put('/standorte', auth, async (req, res) => {
    const { standorte } = req.body;
    try {
        await db.query(`DELETE FROM benutzer_standort WHERE user_id = $1`, [req.user.user_id]);
        for (const standort_id of (standorte || [])) {
            await db.query(
                `INSERT INTO benutzer_standort (user_id, standort_id) VALUES ($1, $2)`,
                [req.user.user_id, standort_id]
            );
        }
        res.json({ message: 'Standorte aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Standorte' });
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

// GET /api/benutzer/einstellung/:schluessel — Eigene Einstellung laden
router.get('/einstellung/:schluessel', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT wert FROM benutzer_einstellung WHERE user_id = $1 AND schluessel = $2`,
            [req.user.user_id, req.params.schluessel]
        );
        if (result.rows.length === 0) {
            return res.json({ wert: null });
        }
        res.json({ wert: result.rows[0].wert });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Einstellung' });
    }
});

// PUT /api/benutzer/einstellung/:schluessel — Eigene Einstellung speichern
router.put('/einstellung/:schluessel', auth, async (req, res) => {
    const { wert } = req.body;
    try {
        await db.query(
            `INSERT INTO benutzer_einstellung (user_id, schluessel, wert)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = $3`,
            [req.user.user_id, req.params.schluessel, wert ?? null]
        );
        res.json({ message: 'Einstellung gespeichert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Speichern der Einstellung' });
    }
});

// GET /api/benutzer/:id — Einzelner Benutzer mit vollem Profil
router.get('/:id', auth, requireManagement, async (req, res) => {
    try {
        const user = await db.query(
            `SELECT u.user_id, u.full_name, u.email, u.system_rolle, u.pensum_pct, u.avatar_initials, u.aktiv
             FROM benutzer u WHERE u.user_id = $1`,
            [req.params.id]
        );
        if (user.rows.length === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

        const [rollen, programme, standorte] = await Promise.all([
            db.query(`SELECT aufgabe_id, rolle_name, max_klienten FROM benutzer_aufgabe WHERE user_id = $1`, [req.params.id]),
            db.query(`SELECT bp.perm_id, bp.programm_id, p.name AS programm_name FROM benutzer_berechtigung bp JOIN programm p ON p.programm_id = bp.programm_id WHERE bp.user_id = $1`, [req.params.id]),
            db.query(`SELECT s.standort_id, s.name, s.kuerzel FROM benutzer_standort bs JOIN standort s ON s.standort_id = bs.standort_id WHERE bs.user_id = $1`, [req.params.id]),
        ]);

        res.json({ ...user.rows[0], rollen: rollen.rows, programme: programme.rows, standorte: standorte.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden des Benutzers' });
    }
});

// PUT /api/benutzer/:id — Benutzer aktualisieren (Management/Teamleitung)
router.put('/:id', auth, requireManagement, async (req, res) => {
    const { full_name, email, system_rolle, pensum_pct, avatar_initials, standorte, rollen, programme } = req.body;
    const GUELTIGE_ROLLEN = ['kader', 'leitungsteam'];

    if (!full_name || !email) {
        return res.status(400).json({ error: 'Name und E-Mail erforderlich' });
    }
    if (system_rolle && !GUELTIGE_ROLLEN.includes(system_rolle)) {
        return res.status(400).json({ error: 'Ungültige System-Rolle' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE benutzer SET full_name=$1, email=$2, system_rolle=$3, pensum_pct=$4, avatar_initials=$5, updated_at=NOW()
             WHERE user_id=$6`,
            [full_name, email, system_rolle || 'kader', pensum_pct || 100,
             avatar_initials || full_name.split(' ').map(n => n[0]).join('').slice(0, 3),
             req.params.id]
        );

        await client.query(`DELETE FROM benutzer_standort WHERE user_id=$1`, [req.params.id]);
        for (const standort_id of (standorte || [])) {
            await client.query(`INSERT INTO benutzer_standort (user_id, standort_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, standort_id]);
        }

        await client.query(`DELETE FROM benutzer_aufgabe WHERE user_id=$1`, [req.params.id]);
        for (const rolle_name of (rollen || [])) {
            const max_k = DEFAULT_MAX_KLIENTEN[rolle_name] || 15;
            await client.query(`INSERT INTO benutzer_aufgabe (user_id, rolle_name, max_klienten) VALUES ($1,$2,$3)`, [req.params.id, rolle_name, max_k]);
        }

        await client.query(`DELETE FROM benutzer_berechtigung WHERE user_id=$1`, [req.params.id]);
        for (const programm_id of (programme || [])) {
            await client.query(`INSERT INTO benutzer_berechtigung (user_id, programm_id) VALUES ($1,$2)`, [req.params.id, programm_id]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Benutzer aktualisiert' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') return res.status(409).json({ error: 'E-Mail bereits vorhanden' });
        res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    } finally {
        client.release();
    }
});

// PUT /api/benutzer/:id/deaktivieren — Benutzer deaktivieren
router.put('/:id/deaktivieren', auth, requireManagement, async (req, res) => {
    try {
        const r = await db.query(
            `UPDATE benutzer SET aktiv=FALSE, updated_at=NOW() WHERE user_id=$1 RETURNING user_id`,
            [req.params.id]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        res.json({ message: 'Benutzer deaktiviert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Deaktivieren' });
    }
});

module.exports = router;