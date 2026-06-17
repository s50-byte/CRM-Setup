require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function main() {
    const db = await pool.connect();

    try {
        await db.query('BEGIN');

        // ── Präsenz ──────────────────────────────────────────────────────
        await db.query('DELETE FROM praesenz_historie');
        await db.query('DELETE FROM dashboard_meldung');
        await db.query('DELETE FROM praesenz_eintrag');
        await db.query('DELETE FROM ferienplanung');

        // ── Aktivitäten ──────────────────────────────────────────────────
        await db.query('DELETE FROM journal_eintrag');
        await db.query('DELETE FROM zeitachse_eintrag');
        await db.query('DELETE FROM task');
        await db.query('DELETE FROM termin_user');
        await db.query('DELETE FROM termin');

        // ── Verfügungen ──────────────────────────────────────────────────
        await db.query('DELETE FROM verfuegung_position');
        await db.query('DELETE FROM verfuegung');

        // ── Dokumente ────────────────────────────────────────────────────
        await db.query('DELETE FROM phase_dokument');

        // ── Dossier-Daten ────────────────────────────────────────────────
        await db.query('DELETE FROM vereinbarungsziel');
        await db.query('DELETE FROM kriterium_status');
        await db.query('DELETE FROM dossier_phase');
        await db.query('DELETE FROM externe_person_dossier');
        await db.query('DELETE FROM klient_user');
        await db.query('DELETE FROM programm_verlauf');
        await db.query('DELETE FROM dossier');
        await db.query('DELETE FROM leistungsvereinbarung');

        // ── Klienten ─────────────────────────────────────────────────────
        await db.query('DELETE FROM klient');

        // ── Externe Kontakte ─────────────────────────────────────────────
        await db.query('DELETE FROM externe_person');

        // ── Benutzer (ausser simon@iv-crm.ch) ───────────────────────────
        await db.query('DELETE FROM benutzer_berechtigung');
        await db.query('DELETE FROM benutzer_aufgabe');
        await db.query('DELETE FROM benutzer_standort');
        await db.query('DELETE FROM benutzer_einstellung');
        await db.query("DELETE FROM benutzer WHERE email != 'simon@iv-crm.ch'");

        // ── Reporting Ansichten ──────────────────────────────────────────
        await db.query('DELETE FROM reporting_ansicht');

        await db.query('COMMIT');

        console.log('✓ Klienten gelöscht');
        console.log('✓ Dossiers gelöscht');
        console.log('✓ Benutzer gelöscht (ausser Admin)');
        console.log('✓ Externe Kontakte gelöscht');
        console.log('✓ Präsenzdaten gelöscht');
        console.log('✓ Pilot-Reset abgeschlossen');

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('\n✗ Fehler — Rollback durchgeführt');
        console.error(err.message);
        process.exit(1);
    } finally {
        db.release();
        await pool.end();
    }
}

main();
