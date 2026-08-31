# Benutzeranleitung

Für Mitarbeitende im Pilotbetrieb. Fachbegriffe sind in
[terminologie.md](terminologie.md) erklärt, der volle Funktionsumfang in
[funktionsuebersicht.md](funktionsuebersicht.md).

## Anmelden

Aufruf über die Adresse des CRM im internen Netz, Anmeldung mit der
Geschäfts-E-Mail und dem erhaltenen Passwort. Das Passwort lässt sich unter
**Mein Profil** ändern; vergessene Passwörter setzt das Leitungsteam unter
Management → Benutzer zurück.

Die Sitzung läuft nach einiger Zeit ab – dann erscheint wieder die
Anmeldemaske. Das ist kein Fehler, ungespeicherte Eingaben in einem offenen
Dialog gehen dabei aber verloren.

## Sich zurechtfinden

Links steht die Navigation, oben rechts der eigene Name, der Standort und der
Feedback-Knopf.

Wer Managementrechte hat, sieht zusätzlich einen Umschalter zwischen der
normalen Ansicht und dem **Managementbereich** (Auslastung, Reporting,
Leistungskatalog, Benutzer, Vorlagen, Feedback). Der Modus bleibt erhalten, bis
er zurückgeschaltet wird – wer die gewohnten Menüpunkte vermisst, steht meist
noch im Managementmodus.

## Der übliche Arbeitsablauf

### 1. Neue Anfrage erfassen

Eine Anfrage wird über **Neue Anfrage** erfasst: Name, Kontaktangaben, über
welchen Kanal sie hereinkam (Telefon, E-Mail, Online-Formular, direkt,
Empfehlung) und wer zugewiesen hat. Die Anfrage erscheint danach unter
**Intake** – noch nicht als geführter Klient in der Klientenliste.

### 2. Vom Intake ins Dossier

Unter **Intake** wird die Anfrage geprüft und in ein reguläres Dossier
überführt: Programm, Phase und Standort werden gesetzt. Ab diesem Punkt taucht
die Person unter **Klientendossiers** auf.

### 3. Zuständigkeit setzen

Im Dossier unter **Zuweisungen** wird festgelegt, wer welche Rolle im Fall hat,
insbesondere die **Klientenführung**. Erst dann erscheint der Fall bei den
betreffenden Personen unter **Meine Klienten**.

### 4. Laufende Arbeit dokumentieren

- **Journal** – jeder Kontakt und jede Beobachtung, mit Kategorie
  (Standortgespräch, Job Coaching, Beobachtung, Zielfortschritt, Absenz,
  Kommunikation mit der zuweisenden Stelle …). Aufwand wird hier über die Dauer
  und die zugeordnete Leistung erfasst.
- **Termine** – Erstgespräch, Schnuppereinsatz, Standortgespräch, Programmstart,
  Abschlussgespräch, mit den beteiligten Mitarbeitenden.
- **Präsenzkontrolle** – die tägliche Anwesenheit. Der Tag wird abgeschlossen;
  spätere Korrekturen bleiben nachvollziehbar.
- **Ziele** – die Ziele aus der Leistungsvereinbarung und ihr Fortschritt.

Journal und Zeitachse sind nicht dasselbe: ins **Journal** schreibt man selbst,
die **Zeitachse** protokolliert daneben auch automatische Ereignisse wie
Phasenwechsel.

### 5. Phasen weiterschalten

Jede Phase hat Kriterien, die erfüllt sein müssen – ein Dokument liegt vor, eine
Person ist zugewiesen, ein Termin ist gesetzt. Der Erfüllungsstand steht in der
Phasenansicht des Dossiers. Der Wechsel in die nächste Phase wird dort ausgelöst
und im Programmverlauf festgehalten.

### 6. Verfügungen und Leistungen

Unter **Verfügungen** im Dossier wird die Kostengutsprache der IV-Stelle
erfasst: Nummer, Zeitraum, Status, dazu je Leistung eine Position. Die
Leistungen selbst kommen aus dem Leistungskatalog und werden vom Leitungsteam
gepflegt.

## Dokumente aus Vorlagen erstellen

Im Dossier unter **Dokumente**:

1. **Dokument erstellen** wählen.
2. Vorlage auswählen. Die Vorschau zeigt den Text bereits mit den Daten des
   Klienten – Name, Adresse, AHV-Nummer, Programm, Phase, Verfügungsnummer und
   so weiter.
3. Titel vergeben und speichern.
4. Das gespeicherte Dokument lässt sich danach frei bearbeiten.

Ein Strich `—` im Text bedeutet, dass die zugehörige Angabe beim Klienten fehlt
(z. B. keine AHV-Nummer erfasst). Solche Lücken werden am besten in den
Stammdaten geschlossen und das Dokument danach neu erzeugt – nachträgliche
Änderungen an der Vorlage wirken sich nicht auf bereits erstellte Dokumente aus.

## Rückmeldung geben

Der **💬 Feedback**-Knopf oben rechts ist auf jeder Seite erreichbar. Die
aktuelle Seite wird automatisch mitgeschickt, es braucht also keine Beschreibung,
wo man gerade war. Mindestens zehn Zeichen.

Hilfreich ist eine Meldung, die drei Dinge nennt: was erwartet wurde, was
stattdessen passiert ist, und bei welchem Klienten oder Dossier. "Beim Erfassen
eines Termins lassen sich keine Teilnehmenden mehr auswählen" ist verwertbar,
"Termine gehen nicht" nicht.

Jede Meldung geht an das Leitungsteam. Die Antwort erscheint als Meldung auf dem
eigenen Dashboard, zusammen mit dem Status:

| Status | Bedeutung |
|---|---|
| **Implementiert ✓** | Umgesetzt, bitte gegenprüfen. |
| **Backlog** | Anerkannt, aber später eingeplant. |
| **Out of Scope** | Wird bewusst nicht umgesetzt; die Begründung steht in der Antwort. |

## Häufige Stolpersteine

**Ein Klient fehlt unter "Meine Klienten".** Die Zuständigkeit ist nicht gesetzt.
Im Dossier unter Zuweisungen die Rolle im Fall vergeben.

**Eine neue Anfrage taucht nicht in der Klientenliste auf.** Sie steht noch im
Intake und ist erst nach der Überführung ins Dossier ein geführter Fall.

**Änderungen sind nach dem Speichern nicht sichtbar.** Zunächst die Seite neu
laden. Bleibt es dabei, ist es ein Fehler – bitte melden.

**Gewohnte Menüpunkte fehlen.** Vermutlich ist der Managementmodus aktiv, oder
die Rolle deckt den Bereich nicht ab.

**Ein Datum oder Name steht als `—` im Dokument.** Die Angabe fehlt beim
Klienten oder im Dossier, nicht in der Vorlage.
