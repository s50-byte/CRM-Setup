const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Standort-Tabelle
        await client.query(`
            CREATE TABLE IF NOT EXISTS standort (
                standort_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name          VARCHAR(100) NOT NULL UNIQUE,
                kuerzel       VARCHAR(10) NOT NULL UNIQUE,
                adresse       TEXT,
                plz           VARCHAR(10),
                ort           VARCHAR(100),
                telefon       VARCHAR(30),
                email         VARCHAR(150),
                aktiv         BOOLEAN NOT NULL DEFAULT TRUE,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Standort zu Benutzer
        await client.query(`
            ALTER TABLE benutzer
            ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES standort(standort_id)
        `);

        // Standort zu Dossier (Hauptstandort des Klienten)
        await client.query(`
            ALTER TABLE dossier
            ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES standort(standort_id)
        `);

        // Standort zu Programm_Verlauf (welcher Standort betreut aktuell)
        await client.query(`
            ALTER TABLE programm_verlauf
            ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES standort(standort_id)
        `);

        // Index
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_benutzer_standort ON benutzer(standort_id);
            CREATE INDEX IF NOT EXISTS idx_dossier_standort ON dossier(standort_id);
            CREATE INDEX IF NOT EXISTS idx_verlauf_standort ON programm_verlauf(standort_id);
        `);

        // Berechtigungen
        await client.query(`
            GRANT ALL PRIVILEGES ON TABLE standort TO crm_user
        `);

        // Testdaten — zwei Standorte
        await client.query(`
            INSERT INTO standort (name, kuerzel, ort) VALUES
                ('Zürich Hauptsitz', 'ZH', 'Zürich'),
                ('Bern Filiale',     'BE', 'Bern')
            ON CONFLICT (kuerzel) DO NOTHING
        `);

        await client.query('COMMIT');
        console.log('✓ Standort-Logik erfolgreich hinzugefügt');
        console.log('  - Tabelle standort erstellt');
        console.log('  - benutzer.standort_id hinzugefügt');
        console.log('  - dossier.standort_id hinzugefügt');
        console.log('  - programm_verlauf.standort_id hinzugefügt');
        console.log('  - 2 Teststandorte: ZH, BE');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Fehler:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

run();