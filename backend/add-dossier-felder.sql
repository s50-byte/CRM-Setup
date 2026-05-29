-- ============================================================
-- Migration: Dossier — neue Felder zuweisende_person_id + abteilung
-- Manuell einspielen als DB-Owner (postgres) auf 192.168.130.11
-- psql -U postgres -d iv_crm -f add-dossier-felder.sql
-- ============================================================

ALTER TABLE dossier ADD COLUMN IF NOT EXISTS zuweisende_person_id UUID REFERENCES externe_person(person_id);
ALTER TABLE dossier ADD COLUMN IF NOT EXISTS abteilung VARCHAR(50);
