# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

KFT (iv-crm) – deutschsprachiges Sozial-CRM für eine Schweizer IV-Organisation
(berufliche Eingliederung). UI-Sprache und Domänenbegriffe sind Deutsch:
Klient, Dossier, Leistung, Verfügung, Disposition, Vorlage/Platzhalter,
Zeiterfassung, Taggeld, Lehrplatz, Etappe.
Stack: React 18 / Node.js + Express / PostgreSQL 16.

Code, Kommentare, Variablennamen, API-Felder und Fehlermeldungen sind durchgehend
deutsch – neuer Code folgt dem (kein Umbenennen auf Englisch).

## Infrastruktur

- crm-app  192.168.130.10 – nginx, Backend via PM2 (`iv-crm-backend`), Frontend aus `/var/www/iv-crm`
- crm-db   192.168.130.11 – PostgreSQL 16, Datenbank `iv_crm`
- Repo: github.com/s50-byte/CRM-Setup (PAT ist in der Remote-URL hinterlegt)
- Immer aus `/home/simon/iv-crm` arbeiten, nie aus einem Unterverzeichnis.

Simon sitzt auf **crm-app**. Bei jedem Befehl, den er ausführen soll, dazusagen,
auf welcher Maschine er läuft – oder den Sprung gleich einbauen
(`ssh -t 192.168.130.11 '…'`). Ohne Angabe wird auf crm-app ausgeführt und
scheitert, wenn es auf crm-db gehört. Dasselbe gilt für Dateien: `/tmp` ist auf
jeder Maschine ein anderes.

## Deployment (kritisch)

Frontend-Änderungen werden erst sichtbar nach:

    npm --prefix frontend run build
    rsync -a --delete frontend/build/ /var/www/iv-crm/

Ein PM2-Restart allein reicht NICHT und hat schon zu vermeintlich wirkungslosen
Fixes geführt. Backend-Änderungen: PM2-Restart.

    pm2 restart iv-crm-backend
    pm2 logs iv-crm-backend --lines 50

`frontend/build/` ist eingecheckt – nach einem Build gehören die geänderten
Bundles mit in den Commit.

## Datenbank-Migrationen

`crm_user` hat keine Owner-Rechte. Migrationen werden manuell **auf crm-db**
(192.168.130.11) als `postgres` ausgeführt, aus `/tmp` (peer auth +
Home-Verzeichnis-Rechte).

Wichtig: Den Benutzer `postgres` gibt es nur auf crm-db, nicht auf crm-app. Die
`.sql`-Datei muss also zuerst dorthin – sonst kommt
`sudo: unknown user postgres`. Ab `/home/simon/iv-crm`:

    scp backend/<migration>.sql 192.168.130.11:/tmp/
    ssh -t 192.168.130.11 'sudo -u postgres psql -d iv_crm -f /tmp/<migration>.sql'

`ssh -t` ist nötig: `sudo` auf crm-db verlangt ein Passwort und braucht dafür ein
Terminal, sonst kommt `sudo: a terminal is required to read the password`.
Mehrere Migrationen in einem Rutsch: weitere `-f <datei>` anhängen, dann wird das
Passwort nur einmal abgefragt.

Führe Migrationen nicht selbst aus – lege die `.sql`-Datei an, kopiere sie nach
crm-db und gib mir den exakten Befehl.

Ablage: Migrationen liegen als `backend/add-*.sql` / `backend/update-*.sql`
(kein Migrations-Runner, keine Versionstabelle – Reihenfolge ergibt sich aus dem
Dateidatum). `schema.sql` im Root ist der Ausgangs-Dump und wird nicht
nachgeführt. `backend/migrate.js` ist ein Einzelfall-Skript, kein Framework.

### Offene Migrationen

Code darf nie eine Migration voraussetzen, die noch nicht eingespielt ist – Code
und Datenbank werden getrennt deployed. `backend/src/schema-flags.js` prüft zur
Laufzeit (gecacht), ob eine Spalte oder Tabelle existiert, und baut das SQL
entsprechend. Nach dem Einspielen einer Migration braucht es darum einen
PM2-Restart, damit die neuen Felder genutzt werden.

Aktuell keine offene Migration.

## Arbeitsweise

- Ich melde Ergebnisse mit: `dgok` = deployed und getestet OK,
  `dgnok` = deployed und getestet nicht OK (meist mit Beschreibung).
- Bei Implementierungsaufgaben: umsetzen und deployen, keine langen Erklärungen.

## Dokumentation

Ausführliche Fach- und Schemadoku liegt in `docs/` (Funktionsübersicht,
Terminologie, Schema, Benutzeranleitung). Bei Bedarf gezielt nachlesen,
nicht pauschal einlesen.

## Aktueller Stand

- Etappe 2a (n:m `dokument_vorlage` <-> `leistung` via `vorlage_leistung`) implementiert
- Etappe 2b (`DokumentErstellenModal`, `DokumentEditorModal` im Dossier) implementiert
- Vorschau-Bug (Beispieldaten statt Klientendaten) erledigt. Ursache war **nicht**
  die `klient_id` – die kam immer korrekt an. Die SQL in `ladeDatenFuerKlient()`
  lief auf falsche Spaltennamen (`k.ahv_nr`, `v.verfuegung_nummer`), und ein
  `catch` schaltete still auf `BEISPIEL_DATEN` um. Spalten sind korrigiert, der
  stille Fallback ist entfernt: Beispieldaten gibt es nur noch ohne `klient_id`,
  ein fehlgeschlagener Lookup wird zum Fehler, ein unbekannter Klient zu einer
  sichtbaren Warnung im Modal.
- Backlog aus dem Feedback abgearbeitet (31.08.2026): User-Reaktivierung,
  mehrere Notfallkontakte, Präsenz-Meldungen nur noch bei Meldenswertem,
  Benachrichtigungszähler in der Navigation, Verantwortliche je Kriterium,
  Intake-Hinweis, Intake-Anfragen aus der Klientenliste, +41-Vorwahl,
  Produkteblatt-Link am Programm.
- Fallrollen Abteilungsleitung (AL) und Bereichsleitung (BL) ergänzt. Sie sind
  gleichrangige Fallrollen ohne besondere Systemrechte. Die Liste stand an sieben
  Stellen dupliziert und liegt jetzt zentral in
  `frontend/src/constants/rollen.js` – neue Fallrollen nur noch dort ergänzen.
- Backlog: Etappe 3 (Serienbrief-Multi), Dark Mode
- Entschieden: `{klientenfuehrung}` zieht ausschliesslich eine Zuweisung mit
  `rolle_im_fall = 'Klientenführung'`. Klientenführung ist eine eigenständige
  Rolle – „Fachperson" ist etwas anderes und darf nicht ersatzweise einspringen.
  Fehlt die Zuweisung, bleibt der Platzhalter korrekterweise `—`.

Was tatsächlich ansteht, steht im Tool unter Management → Feedback (Status
`offen` / `backlog`), nicht hier – dieser Abschnitt ist nur eine Momentaufnahme.

## Befehle

Backend (aus `backend/`, bzw. mit `--prefix backend`):

    npm start                      # node server.js, Port aus .env (3000)
    npm run dev                    # nodemon
    node create-admin.js           # Admin-Benutzer anlegen
    node reset-testdaten.js        # Testdatensatz neu aufbauen (destruktiv)
    node reset-benutzer.js         # Benutzer/Rollen zurücksetzen

Frontend (aus `frontend/`, bzw. mit `--prefix frontend`):

    npm start                      # CRA Dev-Server, proxy -> http://192.168.130.10
    npm run build                  # Produktionsbuild nach frontend/build/
    npm test                       # react-scripts test (Watch-Modus)
    npm test -- --watchAll=false -t "Testname"    # einzelner Test

Es gibt derzeit keine Testdateien und kein Lint-Skript; `npx eslint <datei>`
nutzt die `react-app`-Konfiguration aus `frontend/package.json`.

Smoke-Test der API:

    curl -s http://localhost:3000/api/health

## Architektur

### Backend (`backend/`)

`server.js` ist der einzige Einstiegspunkt: Helmet, CORS (fix auf
`http://192.168.130.10`), JSON-Body, danach ein `app.use('/api/<bereich>', ...)`
pro Datei in `src/routes/`. Ein neuer Bereich = neue Datei in `src/routes/` +
eine Zeile in `server.js`.

- `src/db.js` – einzelner `pg.Pool` aus den `DB_*`-Variablen in `backend/.env`;
  alle Routen nutzen `db.query(sql, params)` direkt. Kein ORM, keine
  Query-Builder, kein Repository-Layer – SQL steht inline in der Route.
- `src/middleware/auth.js` – verifiziert das Bearer-JWT gegen `JWT_SECRET` und
  legt den Payload auf `req.user` (u. a. `user_id`, `system_rolle`). Jede
  geschützte Route hängt `auth` einzeln ein; es gibt keine globale Absicherung.
- Rollenprüfung ist pro Routendatei als lokaler Guard dupliziert (z. B.
  `nurManagement` mit `MANAGEMENT_ROLLEN = ['leitungsteam','admin']` in
  `routes/vorlagen.js`). System-Rollen im Umlauf: `admin`, `leitungsteam`,
  `kader`, `mitarbeitende`, `intake` (Enum `benutzer_system_rolle`).
- Fehlerbehandlung: ein Catch-all-Handler in `server.js` gibt
  `{ error: 'Interner Serverfehler' }` mit 500 zurück.

### Vorlagen / Dokumente

Die Vorlagen-Engine ist bewusst simpel: `fuelleVorlage()` in
`routes/vorlagen.js` ersetzt `{platzhalter}` per Regex; fehlende Werte werden zu
`—`. `ladeDatenFuerKlient(klient_id)` baut den Platzhalter-Kontext aus einem
grossen LEFT-JOIN über `klient`, `dossier`, `programm`, `phase`, `standort`,
`programm_verlauf`, `verfuegung`, `externe_person` und `klient_user`. Ohne
`klient_id` – oder wenn der Join nichts liefert – fällt die Route stillschweigend
auf `BEISPIEL_DATEN` zurück (Ursache des offenen Vorschau-Bugs). Neue Platzhalter
müssen in beiden Objekten ergänzt werden.

Gespeicherte Dokumente liegen in `dossier_dokument` (Dossier + optionale
Vorlagen-Referenz + gerenderter Text), die Zuordnung Vorlage↔Leistung in
`vorlage_leistung`.

### Frontend (`frontend/src/`)

CRA ohne TypeScript. `App.js` hält nur `AuthProvider` + `BrowserRouter`; alles
ausser `/login` läuft über `PrivateRoute` in `components/Layout.js`. Layout ist
gleichzeitig Navigation **und** Router: die Seitenliste (`NAV`) und alle
`<Route>`-Einträge stehen dort – eine neue Seite braucht beide.

- `api/client.js` – axios mit `baseURL: '/api'`; Request-Interceptor hängt das
  Token aus `localStorage`, Response-Interceptor wirft bei 401/403 die Session
  weg und leitet hart auf `/login`. Immer diesen Client verwenden, nie `fetch`.
- `context/AuthContext.js` – `benutzer`, `login`, `logout` plus
  `managementModus`: ein persistenter Umschalter, der zwischen Sachbearbeitungs-
  und Management-Navigation wechselt (`pages/management/*`).
- `components/` sind fast durchgehend Modals über dem generischen `Modal.js`;
  Formularfelder über `FormField.js`. Styling ist Inline-Styles in lokalen
  `S`-Objekten pro Datei, kein CSS-Framework, keine Style-Bibliothek.
- Der Dev-Server proxyt `/api` auf `http://192.168.130.10`, d. h. lokales
  `npm start` arbeitet gegen das Backend auf crm-app.

### Datenmodell

`schema.sql` legt UUID-PKs und viele Postgres-Enums an (`pipeline_status`,
`journal_kategorie`, `termin_typ`, `praesenz_status`, `funnel_stufe` …). Zentral:
`klient` -> `dossier` (aktives Programm/Phase/Standort) -> `programm_verlauf`,
dazu `klient_user` (Rolle im Fall, z. B. `Klientenführung`), `journal_eintrag`,
`task`, `termin`, `praesenz_eintrag`, `verfuegung`, `leistung`/Tarife und die
Reporting-Aggregate. Enum-Werte werden per `ALTER TYPE ... ADD VALUE` in den
`add-*.sql` erweitert – neue Werte gehören in eine Migration, nicht in
`schema.sql`.
