-- ============================================================
-- Migration: Enum-Werte umbenennen / ergänzen
-- Manuell einspielen als DB-Owner (postgres) auf 192.168.130.11
-- psql -U postgres -d iv_crm -f add-enum-updates.sql
-- ============================================================

-- 1. 'leitungsteam' zur Benutzerrollen-Enum hinzufügen
ALTER TYPE benutzer_system_rolle ADD VALUE IF NOT EXISTS 'leitungsteam';

-- 2. Journal-Kategorien umbenennen (Anpassung an Frontend-Keys)
ALTER TYPE journal_kategorie RENAME VALUE 'Abwesenheit'              TO 'Absenz';
ALTER TYPE journal_kategorie RENAME VALUE 'Kommunikation Auftraggeber' TO 'Kommunikation zuweisende Stelle';

-- Nach dieser Migration:
-- reset-benutzer.js:   system_rolle 'teamleitung' → 'leitungsteam'
-- reset-testdaten.js:  kat 'Abwesenheit' → 'Absenz',
--                      kat 'Kommunikation Auftraggeber' → 'Kommunikation zuweisende Stelle'
