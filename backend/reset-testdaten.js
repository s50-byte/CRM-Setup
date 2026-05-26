require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const VORNAMEN = [
    'Anna', 'Peter', 'Maria', 'Thomas', 'Lisa', 'Hans', 'Sandra', 'Michael',
    'Claudia', 'Daniel', 'Ursula', 'Stefan', 'Monika', 'Andreas', 'Petra',
    'Roland', 'Brigitte', 'Markus', 'Nicole', 'Beat'
];
const NACHNAMEN = [
    'Müller', 'Schmid', 'Keller', 'Weber', 'Zimmermann', 'Meier', 'Huber',
    'Steiner', 'Brunner', 'Widmer', 'Berger', 'Fischer', 'Baumann',
    'Schneider', 'Koch', 'Bürki', 'Wenger', 'Gerber', 'Lüthi', 'Graf'
];

const KANAELE   = ['Telefon', 'E-Mail', 'Direkt'];
const LABELS    = ['LE', 'TN', 'MA'];

function zufallsDatumLetzte6Monate() {
    const jetzt = new Date();
    const vor6M = new Date();
    vor6M.setMonth(vor6M.getMonth() - 6);
    const delta = jetzt - vor6M;
    return new Date(vor6M.getTime() + Math.random() * delta).toISOString().slice(0, 10);
}

async function main() {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');

        // ── 1. LÖSCHEN ──────────────────────────────────────────────────────
        console.log('Lösche bestehende Testdaten…');
        // benutzer.standort_id nullen damit DELETE FROM standort nicht scheitert
        await db.query('UPDATE benutzer SET standort_id = NULL');
        const zuLoeschen = [
            'praesenz_eintrag', 'ferienplanung', 'journal_eintrag',
            'zeitachse_eintrag', 'task', 'termin_user', 'termin',
            'kriterium_status', 'klient_user', 'externe_person_dossier',
            'programm_verlauf', 'dossier', 'leistungsvereinbarung',
            'klient', 'standort',
        ];
        for (const tabelle of zuLoeschen) {
            await db.query(`DELETE FROM ${tabelle}`);
            process.stdout.write(`  ✓ ${tabelle}\n`);
        }

        // ── 2. STANDORTE ────────────────────────────────────────────────────
        console.log('\nErstelle Standorte…');
        const standortDaten = [
            { name: 'Zürich',      kuerzel: 'ZH', ort: 'Zürich'      },
            { name: 'Winterthur',  kuerzel: 'WI', ort: 'Winterthur'  },
            { name: 'Richterswil', kuerzel: 'RI', ort: 'Richterswil' },
        ];
        const standorte = [];
        for (const s of standortDaten) {
            const r = await db.query(
                `INSERT INTO standort (name, kuerzel, ort)
                 VALUES ($1, $2, $3) RETURNING standort_id, kuerzel`,
                [s.name, s.kuerzel, s.ort]
            );
            standorte.push(r.rows[0]);
            console.log(`  ✓ ${s.name} (${s.kuerzel})`);
        }

        // ── 3. PROGRAMME + PHASEN aus DB laden ──────────────────────────────
        console.log('\nLade Programme und Phasen aus DB…');
        const progRows = await db.query(
            `SELECT p.programm_id, p.name AS prog_name,
                    ph.phase_id, ph.label AS phase_label, ph.reihenfolge
             FROM programm p
             JOIN phase ph ON ph.programm_id = p.programm_id
             WHERE p.aktiv = TRUE
             ORDER BY p.name, ph.reihenfolge`
        );

        const programmeMap = {};
        for (const row of progRows.rows) {
            if (!programmeMap[row.programm_id]) {
                programmeMap[row.programm_id] = {
                    programm_id: row.programm_id,
                    name: row.prog_name,
                    phasen: [],
                };
            }
            programmeMap[row.programm_id].phasen.push({
                phase_id: row.phase_id,
                label: row.phase_label,
            });
        }
        const programme = Object.values(programmeMap);
        console.log(`  ${programme.length} Programme, ${progRows.rows.length} Phasen total`);

        // ── 4. KLIENTEN + DOSSIERS + PROGRAMMVERLAUF ────────────────────────
        console.log('\nErstelle Klienten und Dossiers…');
        let counter    = 0;
        let klientAnz  = 0;
        let dossierAnz = 0;

        for (const standort of standorte) {
            const auftraggeber = standort.kuerzel === 'WI' ? 'IV-Stelle WI' : 'IV-Stelle ZH';

            for (const prog of programme) {
                for (const phase of prog.phasen) {
                    const vorname  = VORNAMEN[counter % VORNAMEN.length];
                    const nachname = NACHNAMEN[Math.floor(counter / VORNAMEN.length) % NACHNAMEN.length];
                    const kanal    = KANAELE[counter % KANAELE.length];
                    const label    = LABELS[counter % LABELS.length];
                    const start    = zufallsDatumLetzte6Monate();
                    const pipeline = phase.label === 'Erstkontakt' ? 'Erstkontakt' : 'Programmstart';

                    // Klient
                    const klientRes = await db.query(
                        `INSERT INTO klient (nachname, vorname) VALUES ($1, $2) RETURNING klient_id`,
                        [nachname, vorname]
                    );
                    const klient_id = klientRes.rows[0].klient_id;
                    klientAnz++;

                    // Dossier
                    const dossierRes = await db.query(
                        `INSERT INTO dossier
                            (klient_id, auftraggeber, kanal, akt_programm_id, akt_phase_id,
                             pipeline_status, standort_id)
                         VALUES ($1, $2, $3, $4, $5, $6::pipeline_status, $7)
                         RETURNING dossier_id`,
                        [klient_id, auftraggeber, kanal,
                         prog.programm_id, phase.phase_id, pipeline, standort.standort_id]
                    );
                    const dossier_id = dossierRes.rows[0].dossier_id;
                    dossierAnz++;

                    // Programmverlauf
                    await db.query(
                        `INSERT INTO programm_verlauf
                            (dossier_id, programm_id, phase_id, start_datum, status, klient_label)
                         VALUES ($1, $2, $3, $4, 'Laufend', $5)`,
                        [dossier_id, prog.programm_id, phase.phase_id, start, label]
                    );

                    counter++;
                }
            }
        }

        await db.query('COMMIT');

        console.log('\n════════════════════════════════');
        console.log('✓ Testdaten erfolgreich erstellt');
        console.log(`  Standorte: ${standorte.length}`);
        console.log(`  Klienten:  ${klientAnz}`);
        console.log(`  Dossiers:  ${dossierAnz}`);
        console.log('════════════════════════════════');

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
