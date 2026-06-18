-- Migration: Neuer Eingangskanal "Empfehlung"
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-kanal-empfehlung.sql

ALTER TYPE kanal_typ ADD VALUE IF NOT EXISTS 'Empfehlung';
