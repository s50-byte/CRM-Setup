-- Migration: Intake (vormals Pipeline)
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-intake.sql

ALTER TABLE dossier ADD COLUMN IF NOT EXISTS intake_abgeschlossen BOOLEAN DEFAULT FALSE;
ALTER TABLE dossier ADD COLUMN IF NOT EXISTS absage_grund TEXT;
ALTER TABLE dossier ADD COLUMN IF NOT EXISTS absage_notiz TEXT;

-- Neue pipeline_status Werte (Intake-Buckets)
ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'vorabklaerung';
ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'berufsmassnahmen';
ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'integrationsmassnahmen';
ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'beratung_coaching';
ALTER TYPE pipeline_status ADD VALUE IF NOT EXISTS 'programmstart';
