-- Anzeigename fuer das Verfuegungsdokument.
--
-- Wie bei den Programm- und Phasendokumenten soll die Datei einen frei
-- waehlbaren Anzeigenamen tragen; der Originalname bleibt in datei.dateiname
-- und wird beim Download verwendet.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE verfuegung
    ADD COLUMN IF NOT EXISTS datei_titel VARCHAR(255);

SELECT count(*) AS verfuegungen FROM verfuegung;

COMMIT;
