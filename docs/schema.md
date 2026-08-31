# Datenbankschema

Stand: aus der Live-Datenbank `iv_crm` auf crm-db (192.168.130.11) generiert.

`schema.sql` im Repo-Root ist der ursprüngliche Aufbau-Dump und wird **nicht**
nachgeführt – die Wahrheit steht in der Datenbank. Alles ab "Klient & Dossier"
ist generiert; nach einer Migration so aktualisieren:

```bash
(cd backend && node schema-doku.js) > /tmp/schema-body.md
```

Danach den Inhalt von `/tmp/schema-body.md` ab der Zeile `## Klient & Dossier`
in diese Datei übernehmen (Kopf bis hierhin bleibt von Hand gepflegt). Neue
Tabellen ohne Zuordnung landen im Abschnitt "Nicht zugeordnet" und gehören in
`GRUPPEN` in `backend/schema-doku.js` einsortiert.

## Konventionen

- Primärschlüssel sind durchgehend `uuid` mit `gen_random_uuid()`, benannt nach
  dem Muster `<tabelle>_id` (`klient_id`, `dossier_id`, …). Ausnahme: `benutzer`
  hat `user_id`.
- Zeitstempel sind `timestamptz`, meist `created_at` / `updated_at` mit
  `DEFAULT NOW()`. `updated_at` wird von der Anwendung gesetzt, nicht per Trigger.
- Statusfelder sind überwiegend Postgres-Enums (Übersicht am Ende). Neue Werte
  kommen per `ALTER TYPE … ADD VALUE` in einer Migration dazu; alte Werte werden
  nicht entfernt, weshalb einzelne Enums historische Doppelspurigkeiten enthalten
  (siehe `pipeline_status`, `externe_typ`).
- Mit `ᵉ` markierte Typen sind Enums.
- Zeilenzahlen sind eine Momentaufnahme des Pilotbestands und dienen nur der
  Einordnung, welche Tabellen produktiv genutzt werden und welche (noch) leer sind.

## Kern des Modells

`klient` ist die Person, `dossier` der Fall dazu (1:1 in der Praxis). Das Dossier
hält den aktuellen Zustand – `akt_programm_id`, `akt_phase_id`, `standort_id`,
`zuweisende_person_id` – während `programm_verlauf` die Historie der Programm-
und Phasendurchläufe führt (Status `Geplant` / `Laufend` / `Abgeschlossen` /
`Abgebrochen`).

Ein `programm` besteht aus `phase`-Einträgen, eine Phase aus `kriterium`-Einträgen;
`kriterium_status` hält fest, welches Kriterium bei welchem Klienten erfüllt ist.

Zuständigkeiten hängen an `klient_user` (`rolle_im_fall`, z. B. `Klientenführung`),
nicht am Dossier. Externe Beteiligte hängen über `externe_person_dossier` am Fall.

Abgerechnet wird über `leistung` (Katalog inkl. Tarife) → `verfuegung` →
`verfuegung_position`. Dokumentvorlagen sind über `vorlage_leistung` n:m mit
Leistungen verknüpft; erzeugte Dokumente landen in `dossier_dokument`.

## Klient & Dossier

### `klient`  <sub>15 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `klient_id` | uuid | PK |  |
| `nachname` | varchar | NOT NULL |  |
| `vorname` | varchar | NOT NULL |  |
| `geburtsdatum` | date |  |  |
| `ahv_nummer` | varchar |  |  |
| `adresse` | text |  |  |
| `plz` | varchar |  |  |
| `ort` | varchar |  |  |
| `telefon` | varchar |  |  |
| `email` | varchar |  |  |
| `notfall_name` | varchar |  |  |
| `notfall_beziehung` | varchar |  |  |
| `notfall_telefon` | varchar |  |  |
| `vertreter_name` | varchar |  |  |
| `vertreter_funktion` | varchar |  |  |
| `vertreter_telefon` | varchar |  |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `anrede` | varchar |  |  |

### `dossier`  <sub>11 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `dossier_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `auftraggeber` | varchar | NOT NULL |  |
| `kanal` | `kanal_typ` ᵉ |  |  |
| `eingang_datum` | date | NOT NULL |  |
| `pipeline_status` | `pipeline_status` ᵉ | NOT NULL |  |
| `akt_programm_id` | uuid |  | → `programm` |
| `akt_phase_id` | uuid |  | → `phase` |
| `abbruch_grund` | text |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `standort_id` | uuid |  | → `standort` |
| `arbeitgeber_id` | uuid |  | → `externe_person` |
| `zuweisende_person_id` | uuid |  | → `externe_person` |
| `abteilung` | varchar |  |  |
| `ausbildung_beruf` | varchar |  |  |
| `ausbildung_abschluss` | varchar |  |  |
| `ausbildung_fachrichtung` | varchar |  |  |
| `ausbildung_lehrjahr` | varchar |  |  |
| `intake_abgeschlossen` | boolean |  |  |
| `absage_grund` | text |  |  |
| `absage_notiz` | text |  |  |
| `status` | varchar |  |  |
| `taggeld_abrechnung` | varchar |  |  |

### `klient_user`  <sub>8 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `klient_id` | uuid | PK | → `klient` |
| `user_id` | uuid | PK | → `benutzer` |
| `rolle_im_fall` | varchar | NOT NULL |  |
| `stellvertretung` | boolean | NOT NULL |  |
| `zugewiesen_am` | date | NOT NULL |  |
| `aktiv` | boolean | NOT NULL |  |

### `leistungsvereinbarung`  <sub>1 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `lv_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `pensum_pct` | integer | NOT NULL |  |
| `tage_mo` | boolean | NOT NULL |  |
| `tage_di` | boolean | NOT NULL |  |
| `tage_mi` | boolean | NOT NULL |  |
| `tage_do` | boolean | NOT NULL |  |
| `tage_fr` | boolean | NOT NULL |  |
| `zeit_von` | time without time zone | NOT NULL |  |
| `zeit_bis` | time without time zone | NOT NULL |  |
| `zeitbasis` | `zeitbasis` ᵉ | NOT NULL |  |
| `bemerkung` | text |  |  |
| `gueltig_ab` | date | NOT NULL |  |
| `gueltig_bis` | date |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `vereinbarungsziel`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `ziel_id` | uuid | PK |  |
| `verlauf_id` | uuid | NOT NULL | → `programm_verlauf` |
| `text` | text | NOT NULL |  |
| `erreicht` | boolean | NOT NULL |  |
| `erreicht_am` | date |  |  |
| `reihenfolge` | integer | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `dossier_phase`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `id` | uuid | PK |  |
| `dossier_id` | uuid | NOT NULL | → `dossier` |
| `phase_id` | uuid | NOT NULL | → `phase` |
| `start_datum` | date |  |  |
| `end_datum` | date |  |  |
| `notiz` | text |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `dossier_dokument`  <sub>1 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `dok_id` | uuid | PK |  |
| `dossier_id` | uuid | NOT NULL | → `dossier` |
| `vorlage_id` | uuid |  | → `dokument_vorlage` |
| `titel` | varchar | NOT NULL |  |
| `inhalt` | text | NOT NULL |  |
| `erstellt_von` | uuid |  | → `benutzer` |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

## Programme & Phasen

### `programm`  <sub>36 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `programm_id` | uuid | PK |  |
| `name` | varchar | NOT NULL |  |
| `farbe_hex` | varchar | NOT NULL |  |
| `tarif_pro_tag` | numeric | NOT NULL |  |
| `avg_dauer_tage` | integer | NOT NULL |  |
| `aufwand_h_monat` | numeric | NOT NULL |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `monatspreis` | numeric |  |  |
| `avg_dauer_monate` | integer |  |  |
| `gruppe` | varchar |  |  |
| `leistung_id` | uuid |  | → `leistung` |

### `phase`  <sub>36 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `phase_id` | uuid | PK |  |
| `programm_id` | uuid | NOT NULL | → `programm` |
| `label` | varchar | NOT NULL |  |
| `reihenfolge` | integer | NOT NULL |  |
| `avg_dauer_tage` | integer |  |  |
| `created_at` | timestamptz | NOT NULL |  |

### `programm_verlauf`  <sub>5 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `verlauf_id` | uuid | PK |  |
| `dossier_id` | uuid | NOT NULL | → `dossier` |
| `programm_id` | uuid | NOT NULL | → `programm` |
| `phase_id` | uuid |  | → `phase` |
| `start_datum` | date |  |  |
| `end_datum` | date |  |  |
| `status` | `prog_verlauf_status` ᵉ | NOT NULL |  |
| `abbruch_grund` | text |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `standort_id` | uuid |  | → `standort` |
| `klient_label` | varchar |  |  |
| `geplantes_enddatum` | date |  |  |
| `verlaengert_um_monate` | integer |  |  |

### `kriterium`  <sub>1 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `kriterium_id` | uuid | PK |  |
| `phase_id` | uuid | NOT NULL | → `phase` |
| `text` | text | NOT NULL |  |
| `typ` | `kriterium_typ` ᵉ |  |  |
| `detail_text` | text |  |  |
| `pflicht` | boolean | NOT NULL |  |
| `reihenfolge` | integer | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `kriterium_status`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `kriterium_id` | uuid | PK | → `kriterium` |
| `klient_id` | uuid | PK | → `klient` |
| `erfuellt` | boolean | NOT NULL |  |
| `erfuellt_am` | date |  |  |
| `erfuellt_von` | uuid |  | → `benutzer` |

### `phase_task_vorlage`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `vorlage_id` | uuid | PK |  |
| `phase_id` | uuid | NOT NULL | → `phase` |
| `task_text` | text | NOT NULL |  |
| `standard` | boolean | NOT NULL |  |
| `reihenfolge` | integer | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `phase_rolle`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `phase_id` | uuid | PK | → `phase` |
| `rolle_name` | varchar | PK |  |

### `programm_rolle`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `programm_id` | uuid | PK | → `programm` |
| `rolle_name` | varchar | PK |  |

### `phase_vorlage`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `phase_id` | uuid | PK | → `phase` |
| `vorlage_id` | uuid | PK | → `dokument_vorlage` |

### `phase_dokument`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `dokument_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `phase_id` | uuid |  | → `phase` |
| `dateiname` | text | NOT NULL |  |
| `typ` | text |  |  |
| `erstellt_am` | timestamptz |  |  |
| `erstellt_von` | uuid |  | → `benutzer` |

### `programm_dokument`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `pdok_id` | uuid | PK |  |
| `programm_id` | uuid | NOT NULL | → `programm` |
| `phase_id` | uuid |  | → `phase` |
| `dateiname` | text | NOT NULL |  |
| `typ` | text |  |  |
| `erstellt_am` | timestamptz |  |  |
| `erstellt_von` | uuid |  | → `benutzer` |

## Leistungen & Verfügungen

### `leistung`  <sub>36 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `leistung_id` | uuid | PK |  |
| `tarifnr` | varchar | NOT NULL |  |
| `bezeichnung` | varchar | NOT NULL |  |
| `einheit` | varchar | NOT NULL |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `tarif` | numeric |  |  |
| `tarifziffer` | varchar |  |  |
| `entschaedigungsart` | varchar |  |  |
| `produkt_nr` | varchar |  |  |
| `kostenart` | varchar |  |  |
| `kostenstelle` | varchar |  |  |

### `verfuegung`  <sub>9 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `verfuegung_id` | uuid | PK |  |
| `dossier_id` | uuid | NOT NULL | → `dossier` |
| `nummer` | varchar | NOT NULL |  |
| `datum` | date |  |  |
| `bemerkung` | text |  |  |
| `status` | varchar | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `verrechnungsart` | varchar |  |  |
| `betrag` | numeric |  |  |

### `verfuegung_position`  <sub>13 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `position_id` | uuid | PK |  |
| `verfuegung_id` | uuid | NOT NULL | → `verfuegung` |
| `leistung_id` | uuid | NOT NULL | → `leistung` |
| `soll_stunden` | numeric | NOT NULL |  |
| `reihenfolge` | integer | NOT NULL |  |
| `verrechnungsart` | varchar |  |  |
| `betrag` | numeric |  |  |

## Dokumente & Vorlagen

### `dokument`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `dokument_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `user_id` | uuid |  | → `benutzer` |
| `typ` | `dokument_typ` ᵉ | NOT NULL |  |
| `dateiname` | varchar | NOT NULL |  |
| `dateipfad` | text | NOT NULL |  |
| `groesse_kb` | integer |  |  |
| `hochgeladen_am` | timestamptz | NOT NULL |  |

### `dokument_vorlage`  <sub>4 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `vorlage_id` | uuid | PK |  |
| `name` | varchar | NOT NULL |  |
| `beschreibung` | text |  |  |
| `inhalt` | text | NOT NULL |  |
| `typ` | varchar |  |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `vorlage_leistung`  <sub>2 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `vorlage_id` | uuid | PK | → `dokument_vorlage` |
| `leistung_id` | uuid | PK | → `leistung` |

## Verlauf & Kommunikation

### `journal_eintrag`  <sub>53 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `eintrag_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `user_id` | uuid | NOT NULL | → `benutzer` |
| `kategorie` | `journal_kategorie` ᵉ | NOT NULL |  |
| `datum` | date | NOT NULL |  |
| `text` | text | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `dauer_minuten` | integer |  |  |
| `verrechenbar` | boolean |  |  |
| `leistung_id` | uuid |  | → `leistung` |

### `zeitachse_eintrag`  <sub>57 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `eintrag_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `user_id` | uuid |  | → `benutzer` |
| `typ` | `zeitachse_typ` ᵉ | NOT NULL |  |
| `titel` | varchar |  |  |
| `text` | text |  |  |
| `datum` | timestamptz | NOT NULL |  |
| `auto_generated` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `task`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `task_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `user_id` | uuid |  | → `benutzer` |
| `phase_id` | uuid |  | → `phase` |
| `text` | text | NOT NULL |  |
| `prioritaet` | `task_prioritaet` ᵉ | NOT NULL |  |
| `typ` | `task_typ` ᵉ | NOT NULL |  |
| `faellig_am` | date |  |  |
| `erledigt` | boolean | NOT NULL |  |
| `erledigt_am` | date |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `termin`  <sub>17 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `termin_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `typ` | `termin_typ` ᵉ | NOT NULL |  |
| `datum` | date | NOT NULL |  |
| `zeit` | time without time zone |  |  |
| `status` | `termin_status` ᵉ | NOT NULL |  |
| `notiz` | text |  |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

### `termin_user`  <sub>9 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `termin_id` | uuid | PK | → `termin` |
| `user_id` | uuid | PK | → `benutzer` |

### `dashboard_meldung`  <sub>223 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `meldung_id` | uuid | PK |  |
| `empfaenger_id` | uuid | NOT NULL | → `benutzer` |
| `datum` | date | NOT NULL |  |
| `aenderungen` | jsonb | NOT NULL |  |
| `erstellt_von` | uuid |  | → `benutzer` |
| `created_at` | timestamptz | NOT NULL |  |
| `acknowledged` | boolean | NOT NULL |  |
| `acknowledged_am` | timestamptz |  |  |

### `feedback`  <sub>21 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `feedback_id` | uuid | PK |  |
| `user_id` | uuid |  | → `benutzer` |
| `screen` | varchar |  |  |
| `notiz` | text | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `status` | varchar |  |  |
| `antwort` | text |  |  |
| `beantwortet_von` | uuid |  | → `benutzer` |
| `beantwortet_at` | timestamptz |  |  |

## Präsenz & Absenzen

### `praesenz_eintrag`  <sub>48 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `eintrag_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `datum` | date | NOT NULL |  |
| `status` | `praesenz_status` ᵉ | NOT NULL |  |
| `ankunftszeit` | time without time zone |  |  |
| `bemerkung` | text |  |  |
| `erfasst_von` | uuid |  | → `benutzer` |
| `created_at` | timestamptz | NOT NULL |  |
| `kommentar` | text |  |  |
| `updated_at` | timestamptz |  |  |

### `praesenz_historie`  <sub>55 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `historie_id` | uuid | PK |  |
| `eintrag_id` | uuid | NOT NULL | → `praesenz_eintrag` |
| `alter_status` | `praesenz_status` ᵉ |  |  |
| `neuer_status` | `praesenz_status` ᵉ | NOT NULL |  |
| `kommentar` | text |  |  |
| `erfasst_von` | uuid |  | → `benutzer` |
| `timestamp` | timestamptz | NOT NULL |  |

### `ferienplanung`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `ferien_id` | uuid | PK |  |
| `klient_id` | uuid | NOT NULL | → `klient` |
| `von` | date | NOT NULL |  |
| `bis` | date | NOT NULL |  |
| `abgesprochen_mit` | uuid |  | → `benutzer` |
| `bemerkung` | text |  |  |
| `genehmigt` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

## Externe Kontakte

### `externe_person`  <sub>5 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `person_id` | uuid | PK |  |
| `nachname` | varchar |  |  |
| `vorname` | varchar |  |  |
| `funktion` | varchar |  |  |
| `typ` | `externe_typ` ᵉ | NOT NULL |  |
| `firma` | varchar |  |  |
| `telefon` | varchar |  |  |
| `email` | varchar |  |  |
| `adresse` | text |  |  |
| `bemerkung` | text |  |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `ist_organisation` | boolean |  |  |
| `organisation_id` | uuid |  | → `externe_person` |
| `plz` | varchar |  |  |
| `ort` | varchar |  |  |
| `fax` | varchar |  |  |

### `externe_person_dossier`  <sub>7 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `person_id` | uuid | PK | → `externe_person` |
| `dossier_id` | uuid | PK | → `dossier` |
| `rolle` | varchar | NOT NULL |  |

## Benutzer, Rollen & Standorte

### `benutzer`  <sub>11 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `user_id` | uuid | PK |  |
| `full_name` | varchar | NOT NULL |  |
| `email` | varchar | NOT NULL |  |
| `password_hash` | varchar | NOT NULL |  |
| `pensum_pct` | integer | NOT NULL |  |
| `avatar_initials` | varchar |  |  |
| `system_rolle` | `benutzer_system_rolle` ᵉ | NOT NULL |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |
| `standort_id` | uuid |  | → `standort` |

### `benutzer_aufgabe`  <sub>11 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `aufgabe_id` | uuid | PK |  |
| `user_id` | uuid | NOT NULL | → `benutzer` |
| `rolle_name` | varchar | NOT NULL |  |
| `pensum_pct` | integer | NOT NULL |  |
| `max_klienten` | integer | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `benutzer_berechtigung`  <sub>32 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `perm_id` | uuid | PK |  |
| `user_id` | uuid | NOT NULL | → `benutzer` |
| `programm_id` | uuid | NOT NULL | → `programm` |
| `created_at` | timestamptz | NOT NULL |  |

### `benutzer_einstellung`  <sub>3 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `user_id` | uuid | PK | → `benutzer` |
| `schluessel` | varchar | PK |  |
| `wert` | text |  |  |

### `benutzer_intake_bereich`  <sub>1 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `user_id` | uuid | PK | → `benutzer` |
| `bereich` | varchar | PK |  |

### `benutzer_standort`  <sub>11 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `user_id` | uuid | PK | → `benutzer` |
| `standort_id` | uuid | PK | → `standort` |

### `team`  <sub>4 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `team_id` | uuid | PK |  |
| `name` | varchar | NOT NULL |  |
| `farbe_hex` | varchar | NOT NULL |  |
| `icon` | varchar |  |  |
| `created_at` | timestamptz | NOT NULL |  |

### `team_mitglied`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `team_id` | uuid | PK | → `team` |
| `user_id` | uuid | PK | → `benutzer` |
| `aufgabe_id` | uuid |  | → `benutzer_aufgabe` |
| `pensum_pct_in_team` | integer | NOT NULL |  |
| `max_klienten_in_team` | integer | NOT NULL |  |

### `standort`  <sub>3 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `standort_id` | uuid | PK |  |
| `name` | varchar | NOT NULL |  |
| `kuerzel` | varchar | NOT NULL |  |
| `adresse` | text |  |  |
| `plz` | varchar |  |  |
| `ort` | varchar |  |  |
| `telefon` | varchar |  |  |
| `email` | varchar |  |  |
| `aktiv` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `standort_lehrberuf`  <sub>9 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `standort_id` | uuid | PK | → `standort` |
| `beruf` | varchar | PK |  |
| `aktiv` | boolean | NOT NULL |  |
| `bewilligte_plaetze` | integer | NOT NULL |  |
| `total_plaetze` | integer | NOT NULL |  |
| `updated_at` | timestamptz | NOT NULL |  |

## Auswertung & Reporting

### `auslastung_snapshot`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `snapshot_id` | uuid | PK |  |
| `team_id` | uuid |  | → `team` |
| `programm_id` | uuid |  | → `programm` |
| `monat` | date | NOT NULL |  |
| `klienten_ist` | integer | NOT NULL |  |
| `kapazitaet_total` | integer | NOT NULL |  |
| `auslastung_pct` | numeric |  |  |
| `umsatz_ist` | numeric |  |  |
| `created_at` | timestamptz | NOT NULL |  |

### `benchmark_ziel`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `ziel_id` | uuid | PK |  |
| `team_id` | uuid |  | → `team` |
| `programm_id` | uuid |  | → `programm` |
| `parameter` | `benchmark_parameter` ᵉ | NOT NULL |  |
| `zielwert` | numeric | NOT NULL |  |
| `einheit` | varchar |  |  |
| `gueltig_ab` | date | NOT NULL |  |
| `gueltig_bis` | date |  |  |
| `created_at` | timestamptz | NOT NULL |  |

### `kapazitaets_engpass`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `engpass_id` | uuid | PK |  |
| `team_id` | uuid |  | → `team` |
| `benchmark_id` | uuid |  | → `benchmark_ziel` |
| `monat` | date | NOT NULL |  |
| `typ` | `engpass_typ` ᵉ | NOT NULL |  |
| `schweregrad` | `engpass_schwere` ᵉ | NOT NULL |  |
| `beschreibung` | text |  |  |
| `auto_generated` | boolean | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `funnel_ereignis`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `ereignis_id` | uuid | PK |  |
| `klient_id` | uuid |  | → `klient` |
| `stufe` | `funnel_stufe` ᵉ | NOT NULL |  |
| `datum` | date | NOT NULL |  |
| `resultat` | `funnel_resultat` ᵉ | NOT NULL |  |
| `abbruch_grund` | text |  |  |
| `kanal` | `kanal_typ` ᵉ |  |  |
| `programm_id` | uuid |  | → `programm` |
| `created_at` | timestamptz | NOT NULL |  |

### `phasen_statistik`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `stat_id` | uuid | PK |  |
| `phase_id` | uuid | NOT NULL | → `phase` |
| `monat` | date | NOT NULL |  |
| `avg_verweildauer_tage` | numeric |  |  |
| `klienten_in_phase` | integer | NOT NULL |  |
| `abgeschlossen` | integer | NOT NULL |  |
| `abgebrochen` | integer | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `strategie_kennzahl`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `kz_id` | uuid | PK |  |
| `programm_id` | uuid | NOT NULL | → `programm` |
| `monat` | date | NOT NULL |  |
| `ertrag_pro_monat` | numeric |  |  |
| `aufwand_h_ist` | numeric |  |  |
| `chf_pro_h` | numeric |  |  |
| `effizienz_index` | numeric |  |  |
| `freie_plaetze` | integer | NOT NULL |  |
| `created_at` | timestamptz | NOT NULL |  |

### `reporting_aggregat`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `report_id` | uuid | PK |  |
| `typ` | `reporting_typ` ᵉ | NOT NULL |  |
| `zeitraum_von` | date | NOT NULL |  |
| `zeitraum_bis` | date | NOT NULL |  |
| `kanal` | varchar |  |  |
| `programm_id` | uuid |  | → `programm` |
| `anfragen` | integer | NOT NULL |  |
| `starts` | integer | NOT NULL |  |
| `abbrueche` | integer | NOT NULL |  |
| `konversionsrate` | numeric |  |  |
| `umsatz_gesamt` | numeric |  |  |
| `created_at` | timestamptz | NOT NULL |  |

### `reporting_ansicht`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `id` | uuid | PK |  |
| `user_id` | uuid |  | → `benutzer` |
| `name` | varchar | NOT NULL |  |
| `konfiguration` | jsonb | NOT NULL |  |
| `erstellt_at` | timestamptz |  |  |

### `kanal_statistik`  <sub>0 Zeilen</sub>

| Spalte | Typ | | Referenz |
|---|---|---|---|
| `ks_id` | uuid | PK |  |
| `kanal` | `kanal_typ` ᵉ | NOT NULL |  |
| `auftraggeber` | varchar |  |  |
| `monat` | date | NOT NULL |  |
| `anfragen` | integer | NOT NULL |  |
| `starts` | integer | NOT NULL |  |
| `konversionsrate` | numeric |  |  |
| `created_at` | timestamptz | NOT NULL |  |

## Enum-Typen

| Typ | Werte |
|---|---|
| `benchmark_parameter` | breakeven, plan, auslastung_ziel, konversionsrate |
| `benutzer_system_rolle` | admin, mitarbeitende, teamleitung, management, kader, leitungsteam |
| `dokument_typ` | IV-Verfügung, Lebenslauf, Arztbericht, Anmeldeformular, Leistungsvereinbarung, Abschlussbericht, Erstgesprächsprotokoll, Sonstiges |
| `engpass_schwere` | niedrig, mittel, hoch, kritisch |
| `engpass_typ` | kapazitaet, auslastung, forecast |
| `externe_typ` | IV-Stelle, RAV, Sozialdienst, Arbeitgeber, Arzt / Therapeut, Gesetzl. Vertreter, Sonstiges, Elternteil, Gesetzlicher Vertreter, Partner/in, Lehrperson, Therapeut, Arzt, Krankenversicherung, Betreutes Wohnen, Schule, Ausgleichskasse |
| `funnel_resultat` | weiter, abgebrochen, abgelehnt |
| `funnel_stufe` | Erstkontakt, Eingeladen, Erstgespräch, Schnupper, Programmstart |
| `journal_kategorie` | Standortgespräch, Job Coaching, Beobachtung, Zielfortschritt, Absenz, Kommunikation zuweisende Stelle, Externe Person, Sonstiges, Absage |
| `kanal_typ` | Telefon, E-Mail, Online-Formular, Direkt, Empfehlung |
| `kriterium_typ` | doc, person, date |
| `pipeline_status` | Erstkontakt, In Abklärung, Erstgespräch, Schnupper, Programmstart, vorabklaerung, berufsmassnahmen, integrationsmassnahmen, beratung_coaching, programmstart |
| `praesenz_status` | anwesend, krank, unentschuldigt, verspaetet, schule, ferien, feiertag, unfall, termin_extern |
| `prog_verlauf_status` | Geplant, Laufend, Abgeschlossen, Abgebrochen |
| `reporting_typ` | funnel, phase, kanal |
| `task_prioritaet` | Hoch, Mittel, Niedrig |
| `task_typ` | phase, individuell |
| `termin_status` | Ausstehend, Bestätigt, Geplant, Abgesagt |
| `termin_typ` | Erstgespräch, Schnuppereinsatz, Standortgespräch, Programmstart, Abschlussgespräch |
| `zeitachse_typ` | Anfrage, Telefonat, E-Mail, Übergabe, Phasenwechsel, Kommentar, System |
| `zeitbasis` | Stundenbasis, Halbtagesbasis, Ganztagesbasis |

