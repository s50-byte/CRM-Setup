-- Termine koennen an eine Phaseninstanz gebunden sein.
--
-- Zwei Arten von Terminen (Entscheid 31.08.2026):
--   frei erfasst      - liegt wo er liegt, schraenkt nichts ein
--   phasengebunden    - erfuellt ein Muss-Kriterium einer Phase, gehoert zu
--                       ihr und darf nicht ausserhalb ihres Fensters liegen
--
-- programm_phase_id unterscheidet beides. Der Bezug zum Kriterium kommt mit
-- Etappe F dazu, wenn der Erfuellungsstand gefuehrt wird.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE termin
    ADD COLUMN IF NOT EXISTS programm_phase_id UUID
        REFERENCES programm_phase(instanz_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_termin_programm_phase
    ON termin (programm_phase_id);

SELECT count(*) AS termine, count(programm_phase_id) AS davon_phasengebunden FROM termin;

COMMIT;
