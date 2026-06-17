-- Migration: Alte system_rolle-Werte auf neue Werte umstellen
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/update-system-rollen.sql

UPDATE benutzer SET system_rolle = 'kader'       WHERE system_rolle = 'mitarbeitende';
UPDATE benutzer SET system_rolle = 'leitungsteam' WHERE system_rolle = 'teamleitung';
UPDATE benutzer SET system_rolle = 'leitungsteam' WHERE system_rolle = 'management';

-- Enum anpassen (nur ausführen wenn obige UPDATEs wegen Constraint fehlschlagen):
-- ALTER TYPE benutzer_system_rolle RENAME VALUE 'mitarbeitende' TO 'kader';
-- ALTER TYPE benutzer_system_rolle RENAME VALUE 'teamleitung'   TO 'leitungsteam';
-- ALTER TYPE benutzer_system_rolle RENAME VALUE 'management'    TO 'leitungsteam'; -- geht nicht bei Duplikat, dann manuell lösen
