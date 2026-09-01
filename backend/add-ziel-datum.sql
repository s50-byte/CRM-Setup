-- Ziele bekommen ein Datum (Feedback 01.09.2026).
--
-- erreicht_am haelt fest, WANN ein Ziel erreicht wurde. Was fehlte, ist das
-- angestrebte Datum - bis wann es erreicht sein soll.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE vereinbarungsziel
    ADD COLUMN IF NOT EXISTS ziel_datum DATE;

SELECT count(*) AS ziele FROM vereinbarungsziel;

COMMIT;
