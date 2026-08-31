require('dotenv').config();
const db = require('./src/db');

const GRUPPEN = [
  ['Klient & Dossier', ['klient','dossier','klient_user','klient_notfallkontakt','leistungsvereinbarung','vereinbarungsziel','dossier_phase','dossier_dokument']],
  ['Programme & Phasen', ['programm','phase','programm_verlauf','kriterium','kriterium_status','phase_task_vorlage','phase_rolle','programm_rolle','phase_vorlage','phase_dokument','programm_dokument']],
  ['Leistungen & Verfügungen', ['leistung','verfuegung','verfuegung_position']],
  ['Dokumente & Vorlagen', ['dokument','dokument_vorlage','vorlage_leistung']],
  ['Verlauf & Kommunikation', ['journal_eintrag','zeitachse_eintrag','task','termin','termin_user','dashboard_meldung','feedback']],
  ['Präsenz & Absenzen', ['praesenz_eintrag','praesenz_historie','ferienplanung']],
  ['Externe Kontakte', ['externe_person','externe_person_dossier']],
  ['Benutzer, Rollen & Standorte', ['benutzer','benutzer_aufgabe','benutzer_berechtigung','benutzer_einstellung','benutzer_intake_bereich','benutzer_standort','team','team_mitglied','standort','standort_lehrberuf']],
  ['Auswertung & Reporting', ['auslastung_snapshot','benchmark_ziel','kapazitaets_engpass','funnel_ereignis','phasen_statistik','strategie_kennzahl','reporting_aggregat','reporting_ansicht','kanal_statistik']],
];

(async () => {
  const cols = (await db.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`)).rows;
  const fks = (await db.query(`SELECT c.conrelid::regclass::text tbl,
      (SELECT string_agg(a.attname,',') FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k) col,
      c.confrelid::regclass::text ref
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='f' AND n.nspname='public'`)).rows;
  const pks = (await db.query(`SELECT c.conrelid::regclass::text tbl,
      (SELECT string_agg(a.attname,',') FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k) col
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='p' AND n.nspname='public'`)).rows;
  const tabs = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows.map(r => r.table_name);
  const counts = {};
  for (const t of tabs) counts[t] = (await db.query(`SELECT count(*) n FROM "${t}"`)).rows[0].n;

  const fkMap = {}; fks.forEach(f => { fkMap[f.tbl + '.' + f.col] = f.ref; });
  const pkMap = {}; pks.forEach(p => { pkMap[p.tbl] = p.col; });
  const byTable = {}; cols.forEach(c => { (byTable[c.table_name] = byTable[c.table_name] || []).push(c); });

  const typ = c => {
    if (c.data_type === 'USER-DEFINED') return `\`${c.udt_name}\` ᵉ`;
    if (c.data_type === 'ARRAY') return `${c.udt_name.replace(/^_/, '')}[]`;
    return c.data_type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz')
      .replace('timestamp without time zone', 'timestamp').replace('double precision', 'float8').replace('character', 'char');
  };

  const out = [];
  const gezeigt = new Set();
  for (const [gruppe, tlist] of GRUPPEN) {
    const vorhanden = tlist.filter(t => byTable[t]);
    if (!vorhanden.length) continue;
    out.push(`## ${gruppe}\n`);
    for (const t of vorhanden) {
      gezeigt.add(t);
      out.push(`### \`${t}\`  <sub>${counts[t] ?? '–'} Zeilen</sub>\n`);
      out.push('| Spalte | Typ | | Referenz |');
      out.push('|---|---|---|---|');
      for (const c of byTable[t]) {
        const key = t + '.' + c.column_name;
        const istPk = (pkMap[t] || '').split(',').includes(c.column_name);
        const flags = [istPk ? 'PK' : '', c.is_nullable === 'NO' && !istPk ? 'NOT NULL' : ''].filter(Boolean).join(' ');
        out.push(`| \`${c.column_name}\` | ${typ(c)} | ${flags} | ${fkMap[key] ? '→ `' + fkMap[key] + '`' : ''} |`);
      }
      out.push('');
    }
  }
  const rest = Object.keys(byTable).filter(t => !gezeigt.has(t) && tabs.includes(t));
  if (rest.length) out.push(`## Nicht zugeordnet\n\n${rest.map(t => '`' + t + '`').join(', ')}\n`);

  const enums = (await db.query(`SELECT t.typname, string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) vals
      FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname`)).rows;
  out.push('## Enum-Typen\n');
  out.push('| Typ | Werte |');
  out.push('|---|---|');
  enums.forEach(e => out.push(`| \`${e.typname}\` | ${e.vals.replace(/'/g, '')} |`));
  out.push('');
  console.log(out.join('\n'));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
