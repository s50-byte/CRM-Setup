-- Migration: updated_at zu praesenz_eintrag hinzufügen
-- Manuell einspielen als DB-Owner (postgres) auf 192.168.130.11
-- psql -U postgres -d iv_crm -f add-updated-at.sql

ALTER TABLE praesenz_eintrag ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE praesenz_eintrag SET updated_at = created_at WHERE updated_at IS NULL;
