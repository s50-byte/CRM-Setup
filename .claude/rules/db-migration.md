---
name: db-migration
description: SQL-Migrationen nie selbst ausführen – Datei anlegen, psql-Befehl für postgres ausgeben.
paths: ["migrations/**", "**/*.sql", "backend/*.sql"]
---

# Datenbank-Migrationen

`crm_user` hat keine Owner-Rechte. Migrationen laufen manuell auf crm-db
(192.168.130.11) als `postgres` aus `/tmp` (peer auth + Rechte auf dem
Home-Verzeichnis).

**Migration nicht selbst als `crm_user` ausführen.** Stattdessen:

1. `.sql`-Datei im Repo anlegen (`backend/add-*.sql` bzw. `backend/update-*.sql`,
   Namensschema der bestehenden Dateien übernehmen).
2. Datei nach `/tmp` kopieren.
3. Diesen exakten Befehl ausgeben, damit ich ihn ausführe:

       sudo -u postgres psql -d iv_crm -f /tmp/<migration>.sql

Weiteres:

- Idempotent schreiben (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), es gibt
  keinen Migrations-Runner und keine Versionstabelle.
- Enum-Erweiterungen per `ALTER TYPE ... ADD VALUE` gehören in die Migration,
  nicht in `schema.sql` – `schema.sql` ist der historische Ausgangs-Dump und
  wird nicht nachgeführt.
- Backend-Code, der auf die neue Struktur baut, erst nach der Migration
  deployen (`pm2 restart iv-crm-backend`).
