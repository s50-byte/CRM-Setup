-- Migration: Dossier-Status (aktiv/inaktiv)
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-dossier-status.sql

ALTER TABLE dossier ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'aktiv';
-- Werte: 'aktiv', 'inaktiv'
