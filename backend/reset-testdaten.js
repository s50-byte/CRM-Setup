require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const VORNAMEN  = ['Anna','Peter','Maria','Thomas','Lisa','Hans','Sandra','Michael','Claudia','Daniel','Ursula','Stefan','Monika','Andreas','Petra','Roland','Brigitte','Markus','Nicole','Beat'];
const NACHNAMEN = ['Müller','Schmid','Keller','Weber','Zimmermann','Meier','Huber','Steiner','Brunner','Widmer','Berger','Fischer','Baumann','Schneider','Koch','Bürki','Wenger','Gerber','Lüthi','Graf'];
const KANAELE   = ['Telefon', 'E-Mail', 'Direkt'];
const LABELS    = ['LE', 'TN', 'MA'];

const ORTE = [
    { plz: '8001', ort: 'Zürich' },    { plz: '8004', ort: 'Zürich' },
    { plz: '8050', ort: 'Zürich' },    { plz: '8400', ort: 'Winterthur' },
    { plz: '8404', ort: 'Winterthur' },{ plz: '8712', ort: 'Stäfa' },
    { plz: '8800', ort: 'Thalwil' },   { plz: '8810', ort: 'Horgen' },
    { plz: '8805', ort: 'Richterswil'},{ plz: '8600', ort: 'Dübendorf' },
];
const STRASSEN = ['Bahnhofstrasse','Hauptstrasse','Dorfstrasse','Seestrasse','Bergstrasse','Gartenstrasse','Schulstrasse','Industriestrasse','Rosenweg','Lindenstrasse'];

function pick(arr, i) { return arr[i % arr.length]; }

function zufallsDatumLetzte6Monate() {
    const jetzt = new Date();
    const vor6M = new Date();
    vor6M.setMonth(vor6M.getMonth() - 6);
    return new Date(vor6M.getTime() + Math.random() * (jetzt - vor6M)).toISOString().slice(0, 10);
}

function zukunftDatum(tage) {
    const d = new Date();
    d.setDate(d.getDate() + tage);
    return d.toISOString().slice(0, 10);
}

function geburtsdatum(i) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - (25 + (i % 30)));
    d.setMonth(i % 12);
    d.setDate(1 + (i % 28));
    return d.toISOString().slice(0, 10);
}

function ahvNummer(i) {
    const a = String(1000 + i).slice(0, 4);
    const b = String(2000 + i * 3).slice(0, 4);
    const c = String(10 + (i % 87)).padStart(2, '0');
    return `756.${a}.${b}.${c}`;
}

function telefon(i) {
    const pre = pick(['79', '76', '78', '77'], i);
    return `+41 ${pre} ${String(100 + (i * 7) % 900).padStart(3, '0')} ${String(10 + (i * 3) % 90).padStart(2, '0')} ${String(10 + (i * 11) % 90).padStart(2, '0')}`;
}

async function main() {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');

        // ── 1. LÖSCHEN ──────────────────────────────────────────────────
        console.log('Lösche bestehende Testdaten…');
        await db.query('UPDATE benutzer SET standort_id = NULL');
        const zuLoeschen = [
            'praesenz_eintrag', 'ferienplanung', 'journal_eintrag',
            'zeitachse_eintrag', 'task', 'termin_user', 'termin',
            'kriterium_status', 'klient_user', 'externe_person_dossier',
            'programm_verlauf', 'dossier', 'externe_person',
            'leistungsvereinbarung', 'klient', 'benutzer_standort', 'standort',
        ];
        for (const t of zuLoeschen) {
            await db.query(`DELETE FROM ${t}`);
            process.stdout.write(`  ✓ ${t}\n`);
        }

        // ── Benutzer laden (für Journal/Task-Zuweisung) ──────────────────
        const benutzerRes = await db.query('SELECT user_id FROM benutzer WHERE aktiv = TRUE ORDER BY full_name LIMIT 1');
        if (benutzerRes.rows.length === 0) throw new Error('Kein aktiver Benutzer vorhanden — zuerst einen Benutzer anlegen');
        const user_id = benutzerRes.rows[0].user_id;

        // ── 2. STANDORTE ─────────────────────────────────────────────────
        console.log('\nErstelle Standorte…');
        const standortDaten = [
            { name: 'Zürich',      kuerzel: 'ZH', adresse: 'Bahnhofstrasse 10',  plz: '8001', ort: 'Zürich',      telefon: '+41 44 200 10 00', email: 'zuerich@firma.ch'      },
            { name: 'Winterthur',  kuerzel: 'WI', adresse: 'Marktgasse 5',        plz: '8400', ort: 'Winterthur',  telefon: '+41 52 200 20 00', email: 'winterthur@firma.ch'  },
            { name: 'Richterswil', kuerzel: 'RI', adresse: 'Dorfstrasse 12',      plz: '8805', ort: 'Richterswil', telefon: '+41 44 787 10 00', email: 'richterswil@firma.ch' },
        ];
        const standorte = [];
        for (const s of standortDaten) {
            const r = await db.query(
                `INSERT INTO standort (name, kuerzel, adresse, plz, ort, telefon, email)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING standort_id, kuerzel`,
                [s.name, s.kuerzel, s.adresse, s.plz, s.ort, s.telefon, s.email]
            );
            standorte.push(r.rows[0]);
            console.log(`  ✓ ${s.name} (${s.kuerzel})`);
        }

        // ── 3. EXTERNE PERSONEN ──────────────────────────────────────────
        console.log('\nErstelle externe Personen…');
        const externeDaten = [
            { nachname: 'Brunner',      vorname: 'Christine', funktion: 'Sachbearbeiterin',              typ: 'IV-Stelle',          firma: 'IV-Stelle Kanton Zürich',                       telefon: '+41 44 448 58 00', email: 'c.brunner@ivzh.ch',          adresse: 'Schaffhauserstrasse 72, 8090 Zürich'     },
            { nachname: 'Schwarz',      vorname: 'Hanspeter',  funktion: 'Fallführer',                   typ: 'IV-Stelle',          firma: 'IV-Stelle Kanton Zürich – Filiale Winterthur', telefon: '+41 52 234 56 78', email: 'hp.schwarz@ivzh.ch',         adresse: 'Technikumstrasse 1, 8401 Winterthur'     },
            { nachname: 'Frei',         vorname: 'Sabine',     funktion: 'Beraterin Integration',        typ: 'IV-Stelle',          firma: 'IV-Stelle Kanton Zürich – Region See',          telefon: '+41 44 787 30 00', email: 's.frei@ivzh.ch',             adresse: 'Seestrasse 55, 8805 Richterswil'         },
            { nachname: 'Pfister',      vorname: 'Roland',     funktion: 'Arbeitsvermittler',            typ: 'RAV',                firma: 'RAV Zürich Aussersihl',                         telefon: '+41 43 259 10 00', email: 'r.pfister@rav-zh.ch',        adresse: 'Stauffacherstrasse 46, 8004 Zürich'      },
            { nachname: 'Hauenstein',   vorname: 'Martina',    funktion: 'Beraterin',                    typ: 'RAV',                firma: 'RAV Winterthur',                                telefon: '+41 52 267 40 00', email: 'm.hauenstein@rav-wt.ch',     adresse: 'Zürcherstrasse 177, 8406 Winterthur'     },
            { nachname: 'Weidmann',     vorname: 'Urs',        funktion: 'Sozialarbeiter',               typ: 'Sozialdienst',       firma: 'Sozialdienst der Stadt Zürich',                 telefon: '+41 44 412 60 00', email: 'u.weidmann@sozialamt.ch',    adresse: 'Werdstrasse 75, 8004 Zürich'             },
            { nachname: 'Baumann',      vorname: 'Regula',     funktion: 'Sozialberaterin',              typ: 'Sozialdienst',       firma: 'Sozialdienst Winterthur',                       telefon: '+41 52 267 50 00', email: 'r.baumann@winterthur.ch',    adresse: 'Pionierstrasse 9, 8400 Winterthur'       },
            { nachname: 'Huber',        vorname: 'Ernst',      funktion: 'Inhaber',                      typ: 'Arbeitgeber',        firma: 'Schreinerei Huber & Söhne GmbH',                telefon: '+41 44 741 23 45', email: 'e.huber@schreinerei-huber.ch', adresse: 'Industriestrasse 14, 8712 Stäfa'        },
            { nachname: 'Meier',        vorname: 'Doris',      funktion: 'Betriebsleiterin',             typ: 'Arbeitgeber',        firma: 'Bäckerei Meier AG',                             telefon: '+41 52 212 34 56', email: 'd.meier@baeckerei-meier.ch', adresse: 'Marktgasse 22, 8400 Winterthur'          },
            { nachname: 'Keller',       vorname: 'Bruno',      funktion: 'HR-Manager',                   typ: 'Arbeitgeber',        firma: 'Lagerlogistik Zürich GmbH',                     telefon: '+41 44 882 11 22', email: 'b.keller@llzh.ch',           adresse: 'Freilagerstrasse 98, 8047 Zürich'        },
            { nachname: 'Zimmermann',   vorname: 'Petra',      funktion: 'Geschäftsführerin',            typ: 'Arbeitgeber',        firma: 'Büroservice Zimmermann',                        telefon: '+41 44 531 60 70', email: 'p.zimmermann@bueroservice.ch', adresse: 'Langstrasse 200, 8004 Zürich'           },
            { nachname: 'Müller',       vorname: 'Andreas',    funktion: 'Facharzt für Psychiatrie',     typ: 'Arzt / Therapeut',   firma: 'Psychiatrische Praxis Zürich',                  telefon: '+41 44 362 14 50', email: 'a.mueller@psychiatrie-zh.ch', adresse: 'Frankengasse 3, 8001 Zürich'            },
            { nachname: 'Röthlisberger',vorname: 'Claudia',    funktion: 'Physiotherapeutin',            typ: 'Arzt / Therapeut',   firma: 'PhysioVital Winterthur',                        telefon: '+41 52 213 44 55', email: 'c.roethlisberger@physiovital.ch', adresse: 'Rudolfstrasse 22, 8400 Winterthur'    },
        ];
        const externePersonen = [];
        for (const ep of externeDaten) {
            const r = await db.query(
                `INSERT INTO externe_person (nachname, vorname, funktion, typ, firma, telefon, email, adresse)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING person_id, typ, firma, nachname`,
                [ep.nachname, ep.vorname, ep.funktion, ep.typ, ep.firma, ep.telefon, ep.email, ep.adresse]
            );
            externePersonen.push(r.rows[0]);
            console.log(`  ✓ ${ep.typ}: ${ep.firma || ep.nachname}`);
        }
        const arbeitgeber = externePersonen.filter(p => p.typ === 'Arbeitgeber');

        // ── 4. PROGRAMME + PHASEN ────────────────────────────────────────
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
                programmeMap[row.programm_id] = { programm_id: row.programm_id, name: row.prog_name, phasen: [] };
            }
            programmeMap[row.programm_id].phasen.push({ phase_id: row.phase_id, label: row.phase_label });
        }
        const programme = Object.values(programmeMap);
        console.log(`  ${programme.length} Programme, ${progRows.rows.length} Phasen total`);

        // ── 5. KLIENTEN + DOSSIERS + LV + JOURNAL + TASKS + TERMINE ─────
        console.log('\nErstelle Klienten, Dossiers, LVs, Journal, Tasks, Termine…');

        const JOURNAL_POOL = [
            { kat: 'Standortgespräch',          text: 'Monatliches Standortgespräch durchgeführt. Klient berichtet von guten Fortschritten am Einsatzort. Stimmung stabil, Motivation deutlich vorhanden. Nächste Schritte gemeinsam besprochen.' },
            { kat: 'Job Coaching',              text: 'Intensives Job-Coaching zur Vorbereitung auf ein Vorstellungsgespräch. Typische Fragen geübt, Auftreten und Körpersprache besprochen. Klient wirkt deutlich selbstsicherer als zu Programmbeginn.' },
            { kat: 'Kommunikation Auftraggeber',text: 'Telefonisches Gespräch mit der IV-Stelle bezüglich Verlängerung der Massnahme. Kostengutsprache für weitere 3 Monate wurde mündlich bestätigt, schriftliche Bestätigung folgt per Post.' },
            { kat: 'Beobachtung',               text: 'Besuch am Einsatzort: Klient zeigt gute Integration ins Team. Arbeitstempo und -qualität entsprechen den Erwartungen. Leichte Schwierigkeiten bei komplexen Mehrfachaufgaben beobachtet.' },
            { kat: 'Zielfortschritt',           text: 'Zwischenevaluation der vereinbarten Ziele: 2 von 3 Zielen auf gutem Weg. Beim dritten Ziel (Pünktlichkeit) besteht weiterhin Handlungsbedarf — konkrete Massnahmen vereinbart.' },
            { kat: 'Externe Person',            text: 'Koordinationsgespräch mit dem begleitenden Psychiater. Aktuelle Belastbarkeit wird als ausreichend für eine 50%-Beschäftigung beurteilt. Keine Medikationsanpassung vorgesehen.' },
            { kat: 'Sonstiges',                 text: 'Administrative Arbeiten erledigt: Dossier aktualisiert, Verlaufsbericht erstellt, Korrespondenz abgelegt. Nächster Termin für Standortgespräch wurde vereinbart.' },
            { kat: 'Standortgespräch',          text: 'Halbjahres-Review mit Klient und Arbeitgeber. Rückmeldung des Arbeitgebers sehr positiv. Klient wünscht schrittweise Erhöhung des Pensums auf 80%. Massnahme wird entsprechend angepasst.' },
            { kat: 'Abwesenheit',               text: 'Klient war heute unentschuldigt abwesend. Telefonischer Kontakt konnte nicht hergestellt werden. E-Mail mit Bitte um Kontaktaufnahme versendet. Situation wird weiter beobachtet.' },
            { kat: 'Job Coaching',              text: 'Erarbeitung eines aktualisierten Bewerbungsdossiers. Lebenslauf und Motivationsschreiben überarbeitet. Klient hat konkrete Stellen identifiziert, Bewerbungen werden diese Woche versendet.' },
        ];

        const TASKS_POOL = [
            { text: 'Bewerbungsunterlagen überarbeiten',        prioritaet: 'Hoch'    },
            { text: 'Arztbericht bei Hausarzt anfordern',       prioritaet: 'Hoch'    },
            { text: 'Schnupperlehre organisieren',              prioritaet: 'Mittel'  },
            { text: 'Verlaufsbericht an IV-Stelle senden',      prioritaet: 'Hoch'    },
            { text: 'Klientenakte aktualisieren',               prioritaet: 'Niedrig' },
            { text: 'Zeugnisse und Diplome kopieren lassen',    prioritaet: 'Mittel'  },
            { text: 'Nächsten Termin mit RAV vereinbaren',      prioritaet: 'Mittel'  },
            { text: 'Kostengutsprache schriftlich bestätigen',  prioritaet: 'Hoch'    },
            { text: 'Zwischenbericht verfassen',                prioritaet: 'Mittel'  },
            { text: 'Sprachkurs anmelden',                      prioritaet: 'Niedrig' },
            { text: 'Pensumserhöhung mit Arbeitgeber besprechen', prioritaet: 'Mittel' },
            { text: 'Notfallkontakt aktualisieren',             prioritaet: 'Niedrig' },
        ];

        const TERMIN_TYPEN = ['Erstgespräch', 'Schnuppereinsatz', 'Standortgespräch', 'Programmstart', 'Abschlussgespräch'];
        const TERMIN_ZEITEN = ['08:30', '09:00', '10:00', '10:30', '11:00', '13:30', '14:00', '15:00', '15:30'];

        let counter = 0, klientAnz = 0, dossierAnz = 0, lvAnz = 0;
        let journalAnz = 0, taskAnz = 0, terminAnz = 0;

        for (const standort of standorte) {
            const auftraggeber = standort.kuerzel === 'WI' ? 'IV-Stelle WI' : 'IV-Stelle ZH';

            for (const prog of programme) {
                for (const phase of prog.phasen) {
                    const vorname  = pick(VORNAMEN, counter);
                    const nachname = pick(NACHNAMEN, Math.floor(counter / VORNAMEN.length));
                    const kanal    = pick(KANAELE, counter);
                    const label    = pick(LABELS, counter);
                    const start    = zufallsDatumLetzte6Monate();
                    const pipeline = phase.label === 'Erstkontakt' ? 'Erstkontakt' : 'Programmstart';
                    const ort      = pick(ORTE, counter);

                    // Klient
                    const klientRes = await db.query(
                        `INSERT INTO klient
                            (nachname, vorname, geburtsdatum, ahv_nummer,
                             adresse, plz, ort, telefon, email,
                             notfall_name, notfall_beziehung, notfall_telefon)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                         RETURNING klient_id`,
                        [
                            nachname, vorname, geburtsdatum(counter), ahvNummer(counter),
                            `${pick(STRASSEN, counter)} ${1 + (counter % 30)}`,
                            ort.plz, ort.ort, telefon(counter),
                            `${vorname.toLowerCase()}.${nachname.toLowerCase()}@example.ch`,
                            `${pick(NACHNAMEN, counter + 5)} ${pick(VORNAMEN, counter + 3)}`,
                            pick(['Mutter', 'Vater', 'Partner/in', 'Geschwister', 'Freund/in'], counter),
                            telefon(counter + 50),
                        ]
                    );
                    const klient_id = klientRes.rows[0].klient_id;
                    klientAnz++;

                    // Leistungsvereinbarung
                    const pensum   = [50, 80, 100][counter % 3];
                    const zeitbasis = counter % 2 === 0 ? 'Ganztagesbasis' : 'Halbtagesbasis';
                    await db.query(
                        `INSERT INTO leistungsvereinbarung
                            (klient_id, pensum_pct, tage_mo, tage_di, tage_mi, tage_do, tage_fr,
                             zeit_von, zeit_bis, zeitbasis, gueltig_ab)
                         VALUES ($1,$2,true,true,true,true,true,'08:00','17:00',$3,$4)`,
                        [klient_id, pensum, zeitbasis, start]
                    );
                    lvAnz++;

                    // Dossier
                    const dossierRes = await db.query(
                        `INSERT INTO dossier
                            (klient_id, auftraggeber, kanal, akt_programm_id, akt_phase_id,
                             pipeline_status, standort_id)
                         VALUES ($1,$2,$3,$4,$5,$6::pipeline_status,$7)
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
                         VALUES ($1,$2,$3,$4,'Laufend',$5)`,
                        [dossier_id, prog.programm_id, phase.phase_id, start, label]
                    );

                    // Arbeitgeber zuweisen (MA + TN)
                    if ((label === 'MA' || label === 'TN') && arbeitgeber.length > 0) {
                        await db.query(
                            `UPDATE dossier SET arbeitgeber_id = $1 WHERE dossier_id = $2`,
                            [pick(arbeitgeber, counter).person_id, dossier_id]
                        );
                    }

                    // Journal-Einträge (2–3)
                    const anzJ = 2 + (counter % 2);
                    for (let j = 0; j < anzJ; j++) {
                        const e = pick(JOURNAL_POOL, counter + j * 3);
                        await db.query(
                            `INSERT INTO journal_eintrag (klient_id, user_id, kategorie, datum, text)
                             VALUES ($1,$2,$3::journal_kategorie,$4,$5)`,
                            [klient_id, user_id, e.kat, zufallsDatumLetzte6Monate(), e.text]
                        );
                        journalAnz++;
                    }

                    // Tasks (2–3)
                    const anzT = 2 + (counter % 2);
                    for (let t = 0; t < anzT; t++) {
                        const task     = pick(TASKS_POOL, counter + t * 4);
                        const erledigt = (t === 0 && counter % 3 === 0);
                        await db.query(
                            `INSERT INTO task (klient_id, user_id, text, prioritaet, faellig_am, typ, erledigt)
                             VALUES ($1,$2,$3,$4::task_prioritaet,$5,'individuell',$6)`,
                            [klient_id, user_id, task.text, task.prioritaet,
                             zukunftDatum(7 + (counter % 21)), erledigt]
                        );
                        taskAnz++;
                    }

                    // Termine (1–2)
                    const anzTe = 1 + (counter % 2);
                    for (let t = 0; t < anzTe; t++) {
                        await db.query(
                            `INSERT INTO termin (klient_id, typ, datum, zeit)
                             VALUES ($1,$2::termin_typ,$3,$4)`,
                            [klient_id, pick(TERMIN_TYPEN, counter + t),
                             zufallsDatumLetzte6Monate(), pick(TERMIN_ZEITEN, counter + t * 2)]
                        );
                        terminAnz++;
                    }

                    counter++;
                }
            }
        }

        await db.query('COMMIT');

        console.log('\n════════════════════════════════════════');
        console.log('✓ Testdaten erfolgreich erstellt');
        console.log(`  Standorte:          ${standorte.length}`);
        console.log(`  Externe Personen:   ${externePersonen.length}`);
        console.log(`  Klienten:           ${klientAnz}`);
        console.log(`  Dossiers:           ${dossierAnz}`);
        console.log(`  Leistungsver.:      ${lvAnz}`);
        console.log(`  Journal-Einträge:   ${journalAnz}`);
        console.log(`  Tasks:              ${taskAnz}`);
        console.log(`  Termine:            ${terminAnz}`);
        console.log('════════════════════════════════════════');

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
