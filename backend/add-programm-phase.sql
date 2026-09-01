-- Etappe E1: Phaseninstanzen am Programm.
--
-- Kette laut Zielmodell: Dossier -> Programm -> Phaseninstanz.
-- Das Programm ist heute programm_verlauf. Weil eine Verfuegung mehrere Tarife
-- tragen kann und jeder Tarif sein eigenes Phasenmodell hat, traegt die Instanz
-- zusaetzlich die leistung_id - sie sagt, zu welchem Strang die Phase gehoert.
--
-- Nicht dossier_phase erweitern: die haengt am Dossier und hat ein UNIQUE auf
-- (dossier_id, phase_id). Durchlaeuft ein Klient denselben Tarif ein zweites
-- Mal, kollidiert das. dossier_phase ist leer und wird spaeter entfernt.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

CREATE TABLE IF NOT EXISTS programm_phase (
    instanz_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verlauf_id   UUID NOT NULL REFERENCES programm_verlauf(verlauf_id) ON DELETE CASCADE,
    leistung_id  UUID NOT NULL REFERENCES leistung(leistung_id),
    phase_id     UUID NOT NULL REFERENCES phase(phase_id),
    reihenfolge  INTEGER NOT NULL DEFAULT 0,
    start_datum  DATE NOT NULL,
    end_datum    DATE NOT NULL,
    notiz        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT programm_phase_eindeutig UNIQUE (verlauf_id, phase_id),
    CONSTRAINT programm_phase_zeitraum  CHECK (end_datum >= start_datum)
);

CREATE INDEX IF NOT EXISTS idx_programm_phase_verlauf
    ON programm_phase (verlauf_id, leistung_id, reihenfolge);

SELECT count(*) AS phaseninstanzen FROM programm_phase;

COMMIT;
