// ============================================================
// Route: Dateien (Upload / Download)
// ============================================================
const router = require('express').Router();
const multer = require('multer');
const db = require('../db');
const auth = require('../middleware/auth');
const ablage = require('../dateiablage');
const { hatTabelle } = require('../schema-flags');

// Code und Datenbank werden getrennt deployed – klare Meldung statt 500er,
// solange add-dateien.sql noch nicht eingespielt ist.
async function tabelleDa(res) {
    if (await hatTabelle('datei')) return true;
    res.status(503).json({ error: 'Dateiablage ist noch nicht migriert (add-dateien.sql)' });
    return false;
}

// In den Speicher, nicht auf die Platte: multer soll keine temporaeren Dateien
// hinterlassen, die niemand aufraeumt. Bei 20 MB Obergrenze unproblematisch.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: ablage.MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!ablage.istErlaubt(file.mimetype)) {
            return cb(new Error('Dateityp nicht erlaubt: ' + file.mimetype));
        }
        cb(null, true);
    },
});

// POST /api/dateien — Datei hochladen, liefert die datei_id zurueck.
// Die Verknuepfung mit der besitzenden Zeile macht die jeweilige Fachroute.
router.post('/', auth, (req, res) => {
    upload.single('datei')(req, res, async (err) => {
        if (err) {
            const zuGross = err.code === 'LIMIT_FILE_SIZE';
            return res.status(400).json({
                error: zuGross
                    ? `Datei zu gross (max. ${Math.round(ablage.MAX_BYTES / 1024 / 1024)} MB)`
                    : err.message,
            });
        }
        if (!req.file) return res.status(400).json({ error: 'Keine Datei erhalten' });
        if (!await tabelleDa(res)) return;

        try {
            const { ablage: wo, schluessel } = await ablage.speichern(req.file.buffer, req.file.mimetype);
            const r = await db.query(
                `INSERT INTO datei (ablage, schluessel, dateiname, mime_typ, groesse_bytes, hochgeladen_von)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING datei_id, dateiname, mime_typ, groesse_bytes, created_at`,
                [wo, schluessel, req.file.originalname.slice(0, 255), req.file.mimetype,
                 req.file.size, req.user.user_id]
            );
            res.status(201).json(r.rows[0]);
        } catch (e) {
            console.error('[dateien] Upload fehlgeschlagen:', e.message);
            res.status(500).json({ error: 'Datei konnte nicht gespeichert werden' });
        }
    });
});

// GET /api/dateien/:id — Datei ausliefern.
//
// Bewusst ueber das Backend und nicht ueber nginx: /var/www wird ohne jede
// Pruefung ausgeliefert, eine Verfuegung darf dort nie liegen.
router.get('/:id', auth, async (req, res) => {
    if (!await tabelleDa(res)) return;
    try {
        const r = await db.query(
            `SELECT ablage, schluessel, dateiname, mime_typ, groesse_bytes
             FROM datei WHERE datei_id = $1::uuid`,
            [req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });
        const d = r.rows[0];

        if (!await ablage.existiert(d.ablage, d.schluessel)) {
            console.error('[dateien] Eintrag ohne Datei auf der Ablage:', req.params.id, d.schluessel);
            return res.status(404).json({ error: 'Datei liegt nicht mehr in der Ablage' });
        }

        // Typ aus der Whitelist, nie ungeprueft aus der Datenbank – und immer als
        // Download, damit nichts im Browser ausgefuehrt wird.
        const typ = ablage.istErlaubt(d.mime_typ) ? d.mime_typ : 'application/octet-stream';
        res.setHeader('Content-Type', typ);
        res.setHeader('Content-Length', d.groesse_bytes);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`
        );

        const strom = ablage.lesen(d.ablage, d.schluessel);
        strom.on('error', e => {
            console.error('[dateien] Lesefehler:', e.message);
            if (!res.headersSent) res.status(500).json({ error: 'Datei konnte nicht gelesen werden' });
            else res.destroy();
        });
        strom.pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Datei' });
    }
});

// DELETE /api/dateien/:id — Datei entfernen.
// Erst die Zeile, dann die Datei: bleibt eine Datei liegen, ist das Platzverlust;
// bliebe die Zeile ohne Datei, waere es ein toter Verweis.
router.delete('/:id', auth, async (req, res) => {
    if (!await tabelleDa(res)) return;
    try {
        const r = await db.query(
            `DELETE FROM datei WHERE datei_id = $1::uuid RETURNING ablage, schluessel`,
            [req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Datei nicht gefunden' });
        await ablage.loeschen(r.rows[0].ablage, r.rows[0].schluessel);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Löschen der Datei' });
    }
});

module.exports = router;
