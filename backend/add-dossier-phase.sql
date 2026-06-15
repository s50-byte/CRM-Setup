CREATE TABLE IF NOT EXISTS dossier_phase (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id      UUID NOT NULL REFERENCES dossier(dossier_id) ON DELETE CASCADE,
    phase_id        UUID NOT NULL REFERENCES phase(phase_id) ON DELETE CASCADE,
    start_datum     DATE,
    end_datum       DATE,
    notiz           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (dossier_id, phase_id)
);
GRANT ALL PRIVILEGES ON TABLE dossier_phase TO crm_user;
CREATE INDEX IF NOT EXISTS idx_dossier_phase_dossier ON dossier_phase(dossier_id);
