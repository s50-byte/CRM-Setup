# Terminologie

Begriffe, wie sie im KFT-CRM verwendet werden – im UI, im Code und in der
Datenbank. Die Anwendung ist durchgehend deutsch; englische Entsprechungen
kommen nur dort vor, wo sie technisch bedingt sind (`user_id`, `task`).

## Personen und Fälle

| Begriff | Bedeutung | Im Code |
|---|---|---|
| **Klient** | Die betreute Person. Im Gespräch mit der IV-Stelle auch "Versicherte:r", bei Testusern gelegentlich "TN" (Teilnehmende:r). | `klient` |
| **Dossier** | Der Fall zu einem Klienten: aktuelles Programm, aktuelle Phase, Standort, zuweisende Stelle. Ein Klient hat genau ein Dossier. | `dossier` |
| **Intake** | Eingangsstufe: eine neue Anfrage, die noch nicht als Fall geführt wird. Wird über "Neue Anfrage" erfasst und wandert in die Intake-Liste, bevor daraus ein Dossier entsteht. | `dossier.intake_*`, Seite `/intake` |
| **Zuweisende Stelle** | Wer den Klienten geschickt hat – meist eine IV-Stelle, teils RAV oder Sozialdienst. Als externe Person/Organisation am Dossier hinterlegt. | `dossier.zuweisende_person_id` |
| **Klientenführung** | Die fallführende Person aus dem Team. Zuständigkeiten hängen am Klienten, nicht am Dossier, und es können mehrere Rollen gleichzeitig zugewiesen sein. | `klient_user.rolle_im_fall` |
| **Externe Person** | Alle Beteiligten ausserhalb der Organisation: IV-Stelle, Arbeitgeber, Arzt, gesetzliche Vertretung, Schule. Organisationen sind ebenfalls `externe_person` (mit `organisation_id` als Selbstreferenz). | `externe_person` |

## Ablauf

| Begriff | Bedeutung | Im Code |
|---|---|---|
| **Programm** | Das Angebot, das ein Klient durchläuft (z. B. berufliche Integration). Enthält Phasen und ist an eine Leistung gekoppelt. | `programm` |
| **Phase** | Abschnitt innerhalb eines Programms mit eigenen Kriterien, Zeitraum und Rollen. | `phase` |
| **Etappe** | Ausbaustufe der *Software*, nicht des Programms – Simons Planungsbegriff für Entwicklungsschritte (Etappe 2a, 2b, 3). Nicht mit Phase verwechseln. | – |
| **Kriterium** | Bedingung, die in einer Phase erfüllt sein muss. Typ `doc` (Dokument liegt vor), `person` (Person zugewiesen) oder `date` (Termin gesetzt). | `kriterium`, `kriterium_status` |
| **Programmverlauf** | Historie der Programm-/Phasendurchläufe eines Dossiers mit Start-, geplantem und tatsächlichem Enddatum. | `programm_verlauf` |
| **Disposition** | Die Planung, wer wann wo eingesetzt bzw. betreut wird – im UI als Auslastungsplanung/Gantt sichtbar. | Seite `/gantt` |
| **Pipeline / Funnel** | Weg von der Anfrage bis zum Programmstart: Erstkontakt → Eingeladen → Erstgespräch → Schnupper → Programmstart. | `pipeline_status`, `funnel_stufe` |

## Leistung und Abrechnung

| Begriff | Bedeutung | Im Code |
|---|---|---|
| **Leistung** | Ein abrechenbares Angebot aus dem Leistungskatalog, mit Tarif und Zeitbasis (Stunden-, Halbtages-, Ganztagesbasis). | `leistung` |
| **Verfügung** | Die Kostengutsprache der IV-Stelle für einen Klienten: Nummer, Zeitraum, Status, dazu einzelne Positionen je Leistung. | `verfuegung`, `verfuegung_position` |
| **Leistungsvereinbarung** | Vereinbarung mit dem Klienten inkl. Zielen. Nicht dasselbe wie die Verfügung. | `leistungsvereinbarung`, `vereinbarungsziel` |
| **Taggeld** | IV-Taggeld während einer Massnahme. Im CRM über Verfügungspositionen und Präsenz abgebildet. | – |
| **Lehrplatz / Lehrberuf** | Ausbildungsplätze, die ein Standort anbietet. | `standort_lehrberuf` |
| **Zeiterfassung** | Aufwanderfassung am Journaleintrag (Dauer in Minuten, verknüpfte Leistung). | `journal_eintrag.leistung_id` |

## Dokumente

| Begriff | Bedeutung | Im Code |
|---|---|---|
| **Vorlage** | Dokumentvorlage mit Platzhaltern, gepflegt unter Management → Dokumentvorlagen. | `dokument_vorlage` |
| **Platzhalter** | Marker der Form `{vorname}`, `{ahv_nr}`, `{datum_heute}` im Vorlagentext, der beim Erzeugen durch echte Klientendaten ersetzt wird. Nicht gefüllte Platzhalter werden zu `—`. | `fuelleVorlage()` in `backend/src/routes/vorlagen.js` |
| **Vorschau** | Gerenderte Vorlage vor dem Speichern. Ohne Klientenbezug wird mit Beispieldaten (Max Mustermann) gerendert. | `POST /api/vorlagen/:id/vorschau` |
| **Serienbrief** | Geplant: eine Vorlage für mehrere Klienten gleichzeitig erzeugen (Etappe 3). | – |

## Betrieb und Erfassung

| Begriff | Bedeutung | Im Code |
|---|---|---|
| **Präsenzkontrolle** | Tägliche Anwesenheitserfassung je Klient mit Status anwesend, krank, unentschuldigt, verspätet, Schule, Ferien, Feiertag, Unfall, externer Termin. | `praesenz_eintrag`, `praesenz_historie` |
| **Journal** | Verlaufseinträge zum Klienten, kategorisiert (Standortgespräch, Job Coaching, Beobachtung, Absenz …). | `journal_eintrag` |
| **Zeitachse** | Automatisch und manuell erzeugte Ereignisse am Klienten (Anfrage, Telefonat, Phasenwechsel, System). Getrennt vom Journal. | `zeitachse_eintrag` |
| **Meldung** | Dashboard-Benachrichtigung an eine:n Benutzer:in, z. B. bei neuem Feedback oder einer Feedback-Antwort. | `dashboard_meldung` |
| **Klientenbesprechung** | Aufbereitete Sicht für die Fallbesprechung im Team. | Seite `/klientenbesprechung` |
| **Feedback** | Rückmeldung der Testuser aus dem laufenden Betrieb, mit Status offen / Backlog / implementiert / out of scope. Quelle des Entwicklungs-Backlogs. | `feedback` |

## Rollen

Die System-Rolle (`benutzer.system_rolle`, Enum `benutzer_system_rolle`) steuert
die Berechtigungen:

| Rolle | Bedeutung |
|---|---|
| `mitarbeitende` | Standardrolle: eigene Klienten, Dossiers, Journal, Präsenz, Termine. |
| `kader` | Erweiterter Zugriff über das eigene Team hinaus. |
| `teamleitung` | Historischer Wert, im Code kaum genutzt. |
| `management` | Historischer Wert; die Management-Auswertungen prüfen heute meist gegen `leitungsteam`/`admin`. |
| `leitungsteam` | Zugriff auf Managementbereich: Auslastung, Reporting, Leistungskatalog, Vorlagen, Feedback, Benutzerverwaltung. |
| `admin` | Vollzugriff. |

Achtung: Die Prüfung ist pro Routendatei einzeln als lokale Konstante
implementiert (z. B. `MANAGEMENT_ROLLEN = ['leitungsteam','admin']`), nicht
zentral. Neue Rollen wirken erst, wenn die jeweiligen Guards angepasst sind.

Davon zu unterscheiden ist die **Rolle im Fall** (`klient_user.rolle_im_fall`,
z. B. `Klientenführung`) – sie sagt, wer für einen konkreten Klienten zuständig
ist, und hat mit Berechtigungen nichts zu tun.

**Managementmodus** ist kein Recht, sondern ein Ansichtsschalter: er blendet die
Management-Navigation ein und wird im `localStorage` gehalten.
