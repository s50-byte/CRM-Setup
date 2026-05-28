-- Migration: Phasen-Datum-Tracking pro Dossier
-- Wann wurde welche Phase betreten (start_datum) und verlassen (end_datum)?
-- Spielen Sie diese Datei manuell ein: psql -d iv_crm -f add-phase-verlauf.sql

CREATE TABLE IF NOT EXISTS dossier_phase_verlauf (
    id          SERIAL PRIMARY KEY,
    dossier_id  UUID NOT NULL REFERENCES dossier(dossier_id) ON DELETE CASCADE,
    phase_id    UUID NOT NULL REFERENCES phase(phase_id)    ON DELETE CASCADE,
    start_datum DATE NOT NULL DEFAULT CURRENT_DATE,
    end_datum   DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpv_dossier ON dossier_phase_verlauf(dossier_id);
