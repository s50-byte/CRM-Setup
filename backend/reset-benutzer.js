require('dotenv').config({ path: __dirname + '/.env' });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const PASSWORT   = 'Test2025!';
const EMAIL_DOMAIN = 'kft-prototyp.ch';

// 7 Benutzer pro Standort — je 3 Standorte → 21 Einträge
// Typen: KF = Klientenführung, JC = Job Coach, FP = Fachperson, KF+FP = beide Rollen
const BENUTZER_PRO_STANDORT = {
    ZH: [
        { vorname: 'Eva',      nachname: 'Schweizer', typ: 'KF',      system_rolle: 'mitarbeitende' },
        { vorname: 'Martin',   nachname: 'Zahnd',     typ: 'KF',      system_rolle: 'mitarbeitende' },
        { vorname: 'Sonja',    nachname: 'Ritter',    typ: 'JC',      system_rolle: 'mitarbeitende' },
        { vorname: 'Felix',    nachname: 'Nauer',     typ: 'FP',      system_rolle: 'mitarbeitende' },
        { vorname: 'Petra',    nachname: 'Lenz',      typ: 'KF+FP',   system_rolle: 'mitarbeitende' },
        { vorname: 'Barbara',  nachname: 'Vogt',      typ: 'TL',      system_rolle: 'teamleitung'   },
        { vorname: 'Werner',   nachname: 'Haas',      typ: 'MG',      system_rolle: 'management'    },
    ],
    WI: [
        { vorname: 'Kathrin',  nachname: 'Bosshard',  typ: 'KF',      system_rolle: 'mitarbeitende' },
        { vorname: 'Reto',     nachname: 'Egger',     typ: 'KF',      system_rolle: 'mitarbeitende' },
        { vorname: 'Cornelia', nachname: 'Mäder',     typ: 'JC',      system_rolle: 'mitarbeitende' },
        { vorname: 'Adrian',   nachname: 'Flück',     typ: 'FP',      system_rolle: 'mitarbeitende' },
        { vorname: 'Sabine',   nachname: 'Frei',      typ: 'KF+FP',   system_rolle: 'mitarbeitende' },
        { vorname: 'Christian',nachname: 'Studer',    typ: 'TL',      system_rolle: 'teamleitung'   },
        { vorname: 'Elisabeth',nachname: 'Hofer',     typ: 'MG',      system_rolle: 'management'    },
    ],
    RI: [
        { vorname: 'Franziska',nachname: 'Blum',      typ: 'KF',      system_rolle: 'mitarbeitende' },
        { vorname: 'Patrick',  nachname: 'Wyss',      typ: 'KF',      system_rolle: 'mitarbeitende' },
        { vorname: 'Nadine',   nachname: 'Spälti',    typ: 'JC',      system_rolle: 'mitarbeitende' },
        { vorname: 'Samuel',   nachname: 'Gut',       typ: 'FP',      system_rolle: 'mitarbeitende' },
        { vorname: 'Miriam',   nachname: 'Senn',      typ: 'KF+FP',   system_rolle: 'mitarbeitende' },
        { vorname: 'Thomas',   nachname: 'Binder',    typ: 'TL',      system_rolle: 'teamleitung'   },
        { vorname: 'Daniela',  nachname: 'Wirth',     typ: 'MG',      system_rolle: 'management'    },
    ],
};

// Programm → benötigte Rollen für Dossier-Zuweisung
const PROG_ROLLEN = {
    'Erstmalige berufliche Abklärung':  ['KF', 'FP'],
    'Gezielte Vorbereitung':            ['KF', 'FP'],
    'Erstmalige berufliche Ausbildung': ['KF', 'FP'],
    'IM für Jugendliche':               ['KF', 'FP'],
    'Aufbautraining':                   ['KF'],
    'Arbeitstraining':                  ['KF'],
    'Beratung & Coaching':              ['JC'],
};

// benutzer_aufgabe-Einträge pro Typ
const AUFGABEN = {
    KF:    [{ rolle_name: 'Klientenführung', max_klienten: 15 }],
    JC:    [{ rolle_name: 'Job Coach',       max_klienten: 20 }],
    FP:    [{ rolle_name: 'Fachperson',      max_klienten: 10 }],
    'KF+FP': [
               { rolle_name: 'Klientenführung', max_klienten: 15 },
               { rolle_name: 'Fachperson',      max_klienten: 10 },
             ],
    TL:    [{ rolle_name: 'Teamleitung',     max_klienten:  8 }],
    MG:    [{ rolle_name: 'Management',      max_klienten:  5 }],
};

function email(vorname, nachname) {
    const v = vorname.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue');
    const n = nachname.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ /g,'-');
    return `${v}.${n}@${EMAIL_DOMAIN}`;
}

function initials(vorname, nachname) {
    return (vorname[0] + nachname[0]).toUpperCase();
}

async function main() {
    const hash = await bcrypt.hash(PASSWORT, 12);
    const db = await pool.connect();

    try {
        await db.query('BEGIN');

        // ── 1. IV-MASSNAHME LÖSCHEN ──────────────────────────────────────────
        console.log('Entferne IV-Massnahme…');
        await db.query(`
            UPDATE dossier SET akt_programm_id = NULL
            WHERE akt_programm_id = (SELECT programm_id FROM programm WHERE name = 'IV-Massnahme')`);
        await db.query(`
            UPDATE dossier SET akt_phase_id = NULL
            WHERE akt_phase_id IN (
                SELECT phase_id FROM phase
                WHERE programm_id = (SELECT programm_id FROM programm WHERE name = 'IV-Massnahme')
            )`);
        await db.query(`
            DELETE FROM programm_verlauf
            WHERE programm_id = (SELECT programm_id FROM programm WHERE name = 'IV-Massnahme')`);
        await db.query(`
            DELETE FROM phase
            WHERE programm_id = (SELECT programm_id FROM programm WHERE name = 'IV-Massnahme')`);
        await db.query(`DELETE FROM programm WHERE name = 'IV-Massnahme'`);
        console.log('  ✓ IV-Massnahme gelöscht');

        // ── 2. BENUTZER LÖSCHEN ──────────────────────────────────────────────
        console.log('\nLösche bestehende Benutzer…');
        await db.query(`DELETE FROM benutzer_aufgabe`);
        await db.query(`DELETE FROM klient_user`);

        // FK-Referenzen auf zu löschende Benutzer neutralisieren
        const simonRes = await db.query(`SELECT user_id FROM benutzer WHERE email = 'simon@iv-crm.ch'`);
        const simonId = simonRes.rows[0]?.user_id;
        const anderen = `(SELECT user_id FROM benutzer WHERE email != 'simon@iv-crm.ch')`;
        if (simonId) {
            // journal_eintrag: NOT NULL → auf simon umhängen
            await db.query(`UPDATE journal_eintrag SET user_id = $1 WHERE user_id IN ${anderen}`, [simonId]);
        }
        // Nullable Felder → NULL setzen
        await db.query(`UPDATE zeitachse_eintrag   SET user_id          = NULL WHERE user_id          IN ${anderen}`);
        await db.query(`UPDATE task                SET user_id          = NULL WHERE user_id          IN ${anderen}`);
        await db.query(`UPDATE dokument            SET user_id          = NULL WHERE user_id          IN ${anderen}`);
        await db.query(`UPDATE praesenz_eintrag    SET erfasst_von      = NULL WHERE erfasst_von      IN ${anderen}`);
        await db.query(`UPDATE ferienplanung       SET abgesprochen_mit = NULL WHERE abgesprochen_mit IN ${anderen}`);
        await db.query(`UPDATE kriterium_status    SET erfuellt_von     = NULL WHERE erfuellt_von     IN ${anderen}`);

        await db.query(`DELETE FROM benutzer WHERE email != 'simon@iv-crm.ch'`);
        console.log('  ✓ Benutzer gelöscht (simon@iv-crm.ch bleibt)');

        // ── 3. STANDORTE laden ───────────────────────────────────────────────
        const standortRes = await db.query(
            `SELECT standort_id, kuerzel FROM standort ORDER BY kuerzel`
        );
        const standortMap = {};
        for (const s of standortRes.rows) standortMap[s.kuerzel] = s.standort_id;

        const fehlend = ['ZH','WI','RI'].filter(k => !standortMap[k]);
        if (fehlend.length) {
            throw new Error(`Standorte fehlen in DB: ${fehlend.join(', ')} — zuerst reset-testdaten.js ausführen`);
        }

        // ── 4. BENUTZER ERSTELLEN ────────────────────────────────────────────
        console.log('\nErstelle Benutzer…');
        // benutzerIndex: kuerzel → { KF: [...], FP: [...], JC: [...], TL: user, MG: user }
        const benutzerIndex = {};

        for (const [kuerzel, liste] of Object.entries(BENUTZER_PRO_STANDORT)) {
            const standort_id = standortMap[kuerzel];
            benutzerIndex[kuerzel] = { KF: [], FP: [], JC: [], TL: null, MG: null };

            for (const b of liste) {
                const mail = email(b.vorname, b.nachname);
                const inits = initials(b.vorname, b.nachname);

                const r = await db.query(
                    `INSERT INTO benutzer
                        (full_name, email, password_hash, system_rolle, standort_id, avatar_initials)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING user_id`,
                    [`${b.vorname} ${b.nachname}`, mail, hash, b.system_rolle, standort_id, inits]
                );
                const user_id = r.rows[0].user_id;

                // benutzer_aufgabe Einträge
                for (const a of AUFGABEN[b.typ]) {
                    await db.query(
                        `INSERT INTO benutzer_aufgabe (user_id, rolle_name, max_klienten)
                         VALUES ($1, $2, $3)`,
                        [user_id, a.rolle_name, a.max_klienten]
                    );
                }

                // benutzer_standort (für N:M Standort-Filter)
                await db.query(
                    `INSERT INTO benutzer_standort (user_id, standort_id)
                     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [user_id, standort_id]
                );

                // Index befüllen für spätere Zuweisung
                if (b.typ === 'KF' || b.typ === 'KF+FP') benutzerIndex[kuerzel].KF.push(user_id);
                if (b.typ === 'FP' || b.typ === 'KF+FP') benutzerIndex[kuerzel].FP.push(user_id);
                if (b.typ === 'JC')  benutzerIndex[kuerzel].JC.push(user_id);
                if (b.typ === 'TL')  benutzerIndex[kuerzel].TL = user_id;
                if (b.typ === 'MG')  benutzerIndex[kuerzel].MG = user_id;

                console.log(`  ✓ [${kuerzel}] ${b.vorname} ${b.nachname} (${b.typ})`);
            }
        }

        // ── 5. DOSSIERS ZUWEISEN ─────────────────────────────────────────────
        console.log('\nWeise Dossiers zu…');

        const dossierRes = await db.query(
            `SELECT d.dossier_id, d.klient_id, p.name AS prog_name, st.kuerzel
             FROM dossier d
             JOIN standort st ON st.standort_id = d.standort_id
             LEFT JOIN programm p ON p.programm_id = d.akt_programm_id
             ORDER BY st.kuerzel, p.name`
        );

        const zuweisungenProStandort = { ZH: 0, WI: 0, RI: 0 };
        // Rotations-Zähler pro Standort + Rolle
        const rot = { ZH: { KF: 0, FP: 0, JC: 0 }, WI: { KF: 0, FP: 0, JC: 0 }, RI: { KF: 0, FP: 0, JC: 0 } };

        for (const d of dossierRes.rows) {
            const kuerzel  = d.kuerzel;
            const progName = d.prog_name;
            const idx      = benutzerIndex[kuerzel];
            if (!idx) continue;

            const rollen = PROG_ROLLEN[progName] || ['KF'];
            const zuweisen = []; // { user_id, rolle_im_fall }

            for (const rolle of rollen) {
                const pool_r = idx[rolle];
                if (!pool_r || pool_r.length === 0) continue;
                const user_id = pool_r[rot[kuerzel][rolle] % pool_r.length];
                rot[kuerzel][rolle]++;
                const rolleName = rolle === 'KF' ? 'Klientenführung'
                                : rolle === 'FP' ? 'Fachperson'
                                : 'Job Coach';
                zuweisen.push({ user_id, rolle_im_fall: rolleName });
            }

            // Teamleitung immer hinzu (wenn noch nicht drin)
            if (idx.TL && !zuweisen.find(z => z.user_id === idx.TL)) {
                zuweisen.push({ user_id: idx.TL, rolle_im_fall: 'Teamleitung' });
            }

            for (const z of zuweisen) {
                await db.query(
                    `INSERT INTO klient_user (klient_id, user_id, rolle_im_fall)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (klient_id, user_id) DO NOTHING`,
                    [d.klient_id, z.user_id, z.rolle_im_fall]
                );
                zuweisungenProStandort[kuerzel]++;
            }
        }

        await db.query('COMMIT');

        const totalBenutzer = Object.values(BENUTZER_PRO_STANDORT).reduce((s, l) => s + l.length, 0);
        console.log('\n════════════════════════════════════════');
        console.log('✓ Benutzer-Reset erfolgreich');
        console.log(`  Benutzer erstellt: ${totalBenutzer} (+ simon@iv-crm.ch bleibt)`);
        console.log(`  Zuweisungen ZH:    ${zuweisungenProStandort.ZH}`);
        console.log(`  Zuweisungen WI:    ${zuweisungenProStandort.WI}`);
        console.log(`  Zuweisungen RI:    ${zuweisungenProStandort.RI}`);
        console.log(`  Passwort:          ${PASSWORT}`);
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
