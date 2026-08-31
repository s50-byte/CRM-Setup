# Funktionsübersicht

Was das KFT-CRM kann, geordnet nach Bereichen der Anwendung. Begriffe sind in
[terminologie.md](terminologie.md) erklärt, Tabellen in [schema.md](schema.md).

Aufbau: React-SPA (`frontend/`) gegen eine Express-API (`backend/`) auf
PostgreSQL. Die Navigation kennt zwei Modi – die normale Sachbearbeitung und den
**Managementmodus**, der über den Schalter im Layout umgeschaltet wird.

## Sachbearbeitung

### Dashboard (`/`)
Einstieg nach dem Login: offene Aufgaben, anstehende Termine und Meldungen
(`dashboard_meldung`) – etwa ein neu eingegangenes Feedback oder die Antwort auf
ein eigenes Feedback. Meldungen lassen sich als gelesen markieren.

### Aufgaben (`/aufgaben`)
Persönliche Aufgabenliste. Aufgaben entstehen entweder aus einer Phasenvorlage
(`task_typ = 'phase'`) oder werden individuell erfasst, mit Priorität und
optionalem Klientenbezug.
API: `/api/tasks`

### Meine Klienten (`/meine`) und Klienten (`/klienten`)
Dieselbe Seite in zwei Ausprägungen – gefiltert auf die eigene Zuständigkeit
(`klient_user`) oder über den Gesamtbestand. Die Klientendetailseite hält
Stammdaten, beliebig viele Notfallkontakte, die Vertretung sowie die
Leistungsvereinbarung mit ihren Zielen.

Offene Intake-Anfragen sind in der Klientenliste standardmässig ausgeblendet –
sie sind noch keine geführten Fälle. Der Schalter „Intake-Anfragen anzeigen"
blendet sie mit dem Vermerk *Anfrage* ein.
API: `/api/klienten` (`?intake=inkl`), `/api/klienten/meine`,
`/api/klienten/:id/notfallkontakte`

### Intake (`/intake`)
Neue Anfragen, die noch kein geführter Fall sind: Kanal (Telefon, E-Mail,
Online-Formular, Direkt, Empfehlung), zuweisende Stelle, erste Einschätzung.
Von hier läuft der Übergang in ein reguläres Dossier.
API: `PUT /api/dossiers/:id/intake`

### Klientendossiers (`/dossiers`, `/dossiers/:id`)
Das Arbeitszentrum. Pro Dossier:

- **Stammdaten und Zuordnung** – Standort, Arbeitgeber, freie Dossierfelder
- **Zuweisungen** – wer im Team welche Rolle im Fall hat
- **Programm und Phase** – aktueller Stand plus Historie über `programm_verlauf`
- **Ziele** – Ziele der Leistungsvereinbarung
- **Journal** – kategorisierte Verlaufseinträge, optional mit Dauer und Leistung
  (das ist die Zeiterfassung)
- **Zeitachse** – Ereignisstrom, teils automatisch erzeugt
- **Termine**, **Externe Beteiligte**, **Verfügungen**, **Dokumente**

Die Phasenansicht (`/dossiers/:id/phase/:phase_id`) zeigt die Kriterien der
Phase und deren Erfüllungsstand sowie den geplanten Zeitraum.
API: `/api/dossiers`, `/api/journal`, `/api/verfuegungen`

### Kliententermine (`/termine`)
Terminarten von Erstgespräch bis Abschlussgespräch, mit Status
(Ausstehend, Bestätigt, Geplant, Abgesagt), teilnehmenden Mitarbeitenden
(`termin_user`) und Absagegrund.
API: `/api/termine`

### Klientenbesprechung (`/klientenbesprechung`)
Aufbereitete Sammelansicht für die Fallbesprechung im Team.
API: `/api/klientenbesprechung`

### Präsenzkontrolle (`/praesenz`)
Tageserfassung der Anwesenheit je Klient mit neun Status. Ein Tag wird
abgeschlossen, Änderungen danach landen in `praesenz_historie`. Ferien werden
separat geplant (`ferienplanung`) und wirken auf die Präsenz.

Eine Dashboard-Meldung an die Zuständigen entsteht nur bei meldenswerten
Erfassungen – krank, unentschuldigt, verspätet, Unfall oder ein Kommentar. Die
routinemässigen Stati (anwesend, Ferien, Feiertag, Schule, externer Termin)
lösen keine Meldung mehr aus, und wer selbst erfasst, bekommt keine Meldung über
die eigene Eingabe.
API: `/api/praesenz`

### Externe Kontakte (`/externe`)
Personen und Organisationen ausserhalb der Organisation, nach Typ (IV-Stelle,
RAV, Arbeitgeber, Arzt, Schule …). Organisationen sind selbst externe Personen;
Mitarbeitende hängen über `organisation_id` daran. Verknüpfung zum Fall über
`externe_person_dossier`.
API: `/api/externe`, `/api/externe/organisationen`

### Programmübersicht (`/programme`)
Programme, ihre Phasen, Kriterien und Rollen – lesend für alle, pflegbar mit
entsprechenden Rechten.
API: `/api/programme`

### Standorte (`/standorte`)
Standorte und die dort angebotenen Lehrberufe.
API: `/api/standorte`

### Mein Profil (`/profil`)
Eigene Angaben, Passwortwechsel, persönliche Einstellungen
(`benutzer_einstellung`), Standortwechsel.

## Managementbereich

Sichtbar im Managementmodus; die API-Guards prüfen je nach Route gegen
`leitungsteam` / `admin`.

| Seite | Inhalt | API |
|---|---|---|
| Dashboard (`/management`) | Kennzahlen über Bestand, Pipeline und Auslastung | `/api/management/dashboard` |
| Auslastung (`/management/auslastung`) | Auslastung pro Rolle, Team und Standort gegen die Kapazität | `/api/management/dashboard` |
| Auslastungsplanung (`/gantt`) | Zeitliche Disposition der laufenden Programmverläufe | `/api/gantt` |
| Reporting (`/management/reporting`) | Frei konfigurierbare Auswertungen über Funnel, Phasen und Kanäle; Ansichten lassen sich speichern | `/api/reporting` |
| Leistungskatalog (`/management/leistungen`) | Leistungen, Tarife, Zeitbasis | `/api/leistungen` |
| Dokumentvorlagen (`/management/vorlagen`) | Vorlagen anlegen und Leistungen zuordnen | `/api/vorlagen` |
| Benutzer (`/management/benutzer`) | Benutzer anlegen, Rollen, Programme, Standorte und Intake-Bereiche zuweisen, Passwort zurücksetzen, deaktivieren | `/api/benutzer` |
| Feedback (`/management/feedback`) | Testuser-Feedback sichten und beantworten | `/api/feedback` |
| Finanzen (`/management/finanzen`) | **Platzhalter, nicht implementiert** | – |

## Dokumente und Vorlagen

Der Ablauf in drei Schritten:

1. **Vorlage pflegen** (Management → Dokumentvorlagen): Fliesstext mit
   Platzhaltern der Form `{vorname}`. Über `vorlage_leistung` lässt sich eine
   Vorlage an Leistungen koppeln, damit im Dossier nur passende Vorlagen
   erscheinen.
2. **Dokument erzeugen** (Dossier → Dokumente → `DokumentErstellenModal`):
   Vorlage wählen, Vorschau wird serverseitig mit den Klientendaten gerendert,
   Titel vergeben, speichern.
3. **Dokument bearbeiten** (`DokumentEditorModal`): der gerenderte Text wird als
   `dossier_dokument` abgelegt und ist danach frei editierbar – die Verbindung
   zur Vorlage bleibt nur als Referenz bestehen, spätere Vorlagenänderungen
   wirken nicht rückwirkend.

Verfügbare Platzhalter sind in `ladeDatenFuerKlient()` und `BEISPIEL_DATEN` in
`backend/src/routes/vorlagen.js` definiert – aktuell Anrede, Vor- und Nachname,
Adresse, PLZ, Ort, AHV-Nummer, Geburtsdatum, Programm, Phase, Standort,
Abteilung, Start- und Enddatum, Verfügungsnummer, zuweisende Stelle,
Klientenführung und `datum_heute`. Ein neuer Platzhalter muss in **beiden**
Objekten ergänzt werden, sonst bricht die Vorschau ohne Klientenbezug.

## Feedback und Backlog

Testuser melden über das `FeedbackModal` aus jedem Screen heraus (der Pfad wird
automatisch mitgeschickt). Jede Meldung erzeugt eine Dashboard-Meldung an
Leitungsteam und Admins. Unter Management → Feedback wird beantwortet und ein
Status gesetzt: `implementiert`, `backlog` oder `out_of_scope`. Die antwortende
Person löst damit eine Rückmeldung an den Melder aus. Der Backlog der Entwicklung
speist sich aus diesen Einträgen.

## Nicht implementiert

Vorhanden im Schema, aber ohne oder mit unvollständiger Anbindung: Finanzen,
Benchmark-Ziele, Kapazitätsengpässe, Auslastungs-Snapshots, Teams
(`team_mitglied` ist leer), Phasen-/Programmdokumente sowie die
Reporting-Aggregattabellen. Geplant: Serienbrief über mehrere Klienten
(Etappe 3) und ein Dark Mode.
