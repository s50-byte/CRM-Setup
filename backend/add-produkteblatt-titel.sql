-- Anzeigename fuer das Produkteblatt.
--
-- Programm- und Phasendokumente fuehren den Anzeigenamen in
-- programm_dokument.dateiname. Das Produkteblatt haengt als einzelner Platz
-- direkt am Tarif und hatte darum kein solches Feld - angezeigt wurde der
-- Originalname der Datei, obwohl das Modal einen Namen abfragt.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE programm
    ADD COLUMN IF NOT EXISTS produkteblatt_titel VARCHAR(255);

SELECT count(*) AS mit_produkteblatt FROM programm WHERE produkteblatt_datei_id IS NOT NULL;

COMMIT;
