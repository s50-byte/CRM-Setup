-- Migration: Neue journal_kategorie "Absage"
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-journal-kategorie-absage.sql

ALTER TYPE journal_kategorie ADD VALUE IF NOT EXISTS 'Absage';
