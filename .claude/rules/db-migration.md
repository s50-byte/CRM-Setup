---
name: db-migration
description: SQL-Migrationen nie selbst ausführen – Datei anlegen, psql-Befehl für postgres ausgeben.
paths: ["migrations/**", "**/*.sql", "backend/*.sql"]
---

# Datenbank-Migrationen

`crm_user` hat keine Owner-Rechte. Migrationen laufen manuell auf crm-db
(192.168.130.11) als `postgres` aus `/tmp` (peer auth + Rechte auf dem
Home-Verzeichnis).

**Den Benutzer `postgres` gibt es nur auf crm-db, nicht auf crm-app.** Ein
`sudo -u postgres …` auf crm-app scheitert mit `unknown user postgres`. Die
Datei muss zuerst auf crm-db.

**Migration nicht selbst ausführen.** Stattdessen:

1. `.sql`-Datei im Repo anlegen (`backend/add-*.sql` bzw. `backend/update-*.sql`,
   Namensschema der bestehenden Dateien übernehmen).
2. Diese beiden Befehle ausgeben, damit ich sie ausführe:

       scp backend/<migration>.sql 192.168.130.11:/tmp/
       ssh -t 192.168.130.11 'sudo -u postgres psql -P pager=off -d iv_crm -f /tmp/<migration>.sql'

   `-P pager=off` verhindert, dass psql die Ausgabe in `less` schiebt – ein
   wartender Pager sieht aus wie ein haengendes Skript.

   `ssh -t` ist Pflicht – `sudo` auf crm-db verlangt ein Passwort und scheitert
   ohne Terminal mit `sudo: a terminal is required to read the password`.
   Mehrere Migrationen: weitere `-f <datei>` an denselben Aufruf anhängen.

Weiteres:

- Idempotent schreiben (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), es gibt
  keinen Migrations-Runner und keine Versionstabelle.
- Enum-Erweiterungen per `ALTER TYPE ... ADD VALUE` gehören in die Migration,
  nicht in `schema.sql` – `schema.sql` ist der historische Ausgangs-Dump und
  wird nicht nachgeführt.
- Code darf die Migration nicht voraussetzen: Code und Datenbank werden getrennt
  deployed. Neue Spalten/Tabellen über `backend/src/schema-flags.js` abfragen
  (`hatSpalte` / `hatTabelle`) und das SQL entsprechend bauen, sonst liefern
  bestehende Seiten zwischen Deployment und Migration 500er.
- Der Schema-Check ist gecacht: nach dem Einspielen einer Migration
  `pm2 restart iv-crm-backend`, damit die neuen Felder genutzt werden.
- Jede Migration beginnt mit `\set ON_ERROR_STOP on` und `SET lock_timeout =
  '15s';`. Ohne das wartet ein Skript unbegrenzt, wenn eine andere offene
  Transaktion dieselben Tabellen haelt – und eine vergessene psql-Sitzung mit
  offener Transaktion blockiert jeden weiteren Versuch stumm. Bei Verdacht:
  `SELECT pid FROM pg_stat_activity WHERE datname='iv_crm' AND usename='postgres'`.
