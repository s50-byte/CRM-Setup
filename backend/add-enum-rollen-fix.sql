-- Migration: Enum-Werte für benutzer_system_rolle anpassen
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-enum-rollen-fix.sql

-- Neue Enum-Werte hinzufügen falls noch nicht vorhanden
ALTER TYPE benutzer_system_rolle ADD VALUE IF NOT EXISTS 'kader';
ALTER TYPE benutzer_system_rolle ADD VALUE IF NOT EXISTS 'leitungsteam';

-- Bestehende Benutzer migrieren
UPDATE benutzer SET system_rolle = 'kader'        WHERE system_rolle = 'mitarbeitende';
UPDATE benutzer SET system_rolle = 'leitungsteam' WHERE system_rolle = 'teamleitung';
UPDATE benutzer SET system_rolle = 'leitungsteam' WHERE system_rolle = 'management';
