-- Die eingeschlagene Massnahmenrichtung festhalten (Feedback 01.09.2026).
--
-- Ein Dossier geht durch genau eine der drei Richtungen - Berufsmassnahmen,
-- Integrationsmassnahmen oder Beratung & Coaching - und danach in den
-- Programmstart. Dort war bisher nicht mehr erkennbar, welche es war, weil
-- pipeline_status nur noch 'programmstart' sagt.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE dossier
    ADD COLUMN IF NOT EXISTS massnahme pipeline_status;

-- Bestehende Faelle: steht das Dossier gerade in einer Richtung, ist das die.
UPDATE dossier
   SET massnahme = pipeline_status
 WHERE massnahme IS NULL
   AND pipeline_status IN ('berufsmassnahmen','integrationsmassnahmen','beratung_coaching');

SELECT pipeline_status, massnahme, count(*) FROM dossier GROUP BY 1,2 ORDER BY 1;

COMMIT;
