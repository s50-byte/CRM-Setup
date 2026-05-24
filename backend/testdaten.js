const bcrypt = require('bcryptjs');
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

        // Benutzer
        const hash = await bcrypt.hash('Test2025!', 12);
        await client.query(`
            INSERT INTO benutzer (full_name, email, password_hash, system_rolle, pensum_pct, avatar_initials)
            VALUES
                ('Anna Meier', 'a.meier@iv-crm.ch', $1, 'mitarbeitende', 100, 'AM'),
                ('Bruno Keller', 'b.keller@iv-crm.ch', $1, 'mitarbeitende', 80, 'BK'),
                ('Christine Huber', 'c.huber@iv-crm.ch', $1, 'teamleitung', 80, 'CH')
            ON CONFLICT (email) DO NOTHING
        `, [hash]);

        // Klienten
        const k1 = await client.query(`
            INSERT INTO klient (nachname, vorname, geburtsdatum, ahv_nummer, adresse, plz, ort, telefon, email, notfall_name, notfall_beziehung, notfall_telefon)
            VALUES ('Frei', 'Jonas', '1993-03-12', '756.1234.5678.97', 'Musterstrasse 12', '8000', 'Zürich', '+41 79 123 45 67', 'jonas.frei@gmail.com', 'Maria Frei', 'Ehefrau', '+41 79 234 56 78')
            RETURNING klient_id
        `);
        const k2 = await client.query(`
            INSERT INTO klient (nachname, vorname, geburtsdatum, ahv_nummer, adresse, plz, ort, telefon, email)
            VALUES ('Koch', 'Nadine', '1988-07-05', '756.9876.5432.10', 'Bahnhofstrasse 5', '8001', 'Zürich', '+41 76 987 65 43', 'n.koch@outlook.com')
            RETURNING klient_id
        `);
        const k3 = await client.query(`
            INSERT INTO klient (nachname, vorname, geburtsdatum, ahv_nummer, adresse, plz, ort, telefon, email)
            VALUES ('Berisha', 'Ahmed', '1995-11-22', '756.5678.9012.34', 'Langstrasse 88', '8004', 'Zürich', '+41 78 456 78 90', 'ahmed.b@proton.me')
            RETURNING klient_id
        `);

        const kId1 = k1.rows[0].klient_id;
        const kId2 = k2.rows[0].klient_id;
        const kId3 = k3.rows[0].klient_id;

        // Leistungsvereinbarungen
        await client.query(`
            INSERT INTO leistungsvereinbarung (klient_id, pensum_pct, zeit_von, zeit_bis, zeitbasis)
            VALUES
                ($1, 100, '08:00', '17:00', 'Ganztagesbasis'),
                ($2, 50,  '08:00', '12:00', 'Halbtagesbasis'),
                ($3, 80,  '08:00', '16:00', 'Ganztagesbasis')
        `, [kId1, kId2, kId3]);

        // Dossiers
        const d1 = await client.query(`
            INSERT INTO dossier (klient_id, auftraggeber, kanal, pipeline_status, akt_programm_id)
            VALUES ($1, 'IV-Stelle ZH', 'Telefon', 'Erstgespräch',
                '11111111-1111-1111-1111-111111111111')
            RETURNING dossier_id
        `, [kId1]);
        const d2 = await client.query(`
            INSERT INTO dossier (klient_id, auftraggeber, kanal, pipeline_status, akt_programm_id)
            VALUES ($1, 'RAV Zürich', 'E-Mail', 'Programmstart',
                '11111111-1111-1111-1111-111111111111')
            RETURNING dossier_id
        `, [kId2]);
        const d3 = await client.query(`
            INSERT INTO dossier (klient_id, auftraggeber, kanal, pipeline_status, akt_programm_id)
            VALUES ($1, 'IV-Stelle ZH', 'Telefon', 'Programmstart',
                '22222222-2222-2222-2222-222222222222')
            RETURNING dossier_id
        `, [kId3]);

        // Programmverlauf
        await client.query(`
            INSERT INTO programm_verlauf (dossier_id, programm_id, status, start_datum)
            VALUES
                ($1, '11111111-1111-1111-1111-111111111111', 'Laufend', '2025-05-01'),
                ($2, '11111111-1111-1111-1111-111111111111', 'Laufend', '2025-04-01'),
                ($3, '22222222-2222-2222-2222-222222222222', 'Laufend', '2025-05-01')
        `, [d1.rows[0].dossier_id, d2.rows[0].dossier_id, d3.rows[0].dossier_id]);

        // Tasks
        await client.query(`
            INSERT INTO task (klient_id, user_id, text, prioritaet, faellig_am)
            SELECT $1, user_id, 'IV-Verfügung anfordern', 'Hoch', '2025-05-30'
            FROM benutzer WHERE email = 'simon@iv-crm.ch'
        `, [kId1]);
        await client.query(`
            INSERT INTO task (klient_id, user_id, text, prioritaet, faellig_am)
            SELECT $1, user_id, 'Erstgespräch protokollieren', 'Mittel', '2025-05-28'
            FROM benutzer WHERE email = 'simon@iv-crm.ch'
        `, [kId1]);

        // Termine
        await client.query(`
            INSERT INTO termin (klient_id, typ, datum, zeit, status)
            VALUES
                ($1, 'Erstgespräch', '2025-05-28', '10:00', 'Ausstehend'),
                ($2, 'Standortgespräch', '2025-05-30', '14:00', 'Bestätigt')
        `, [kId1, kId2]);

        // Journal
        await client.query(`
            INSERT INTO journal_eintrag (klient_id, user_id, kategorie, datum, text)
            SELECT $1, user_id, 'Standortgespräch', '2025-05-20',
                'Klient motiviert und pünktlich erschienen. Kaufmännischer Bereich bleibt Hauptinteresse.'
            FROM benutzer WHERE email = 'simon@iv-crm.ch'
        `, [kId1]);
        await client.query(`
            INSERT INTO journal_eintrag (klient_id, user_id, kategorie, datum, text)
            SELECT $1, user_id, 'Kommunikation Auftraggeber', '2025-05-19',
                'Rückfrage bei IV-Stelle ZH. Verfügung wird in KW 21 erwartet.'
            FROM benutzer WHERE email = 'simon@iv-crm.ch'
        `, [kId1]);

        await client.query('COMMIT');
        console.log('✓ Testdaten erfolgreich eingespielt');
        console.log('  3 Klienten, 3 Dossiers, Tasks, Termine, Journal');
        console.log('');
        console.log('  Zusätzliche Benutzer:');
        console.log('  a.meier@iv-crm.ch / Test2025!');
        console.log('  b.keller@iv-crm.ch / Test2025!');
        console.log('  c.huber@iv-crm.ch  / Test2025!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Fehler:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

run();