-- Migration: Dokumentvorlagen
-- Manuell einspielen

CREATE TABLE IF NOT EXISTS dokument_vorlage (
    vorlage_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    beschreibung TEXT,
    inhalt       TEXT NOT NULL,
    typ          VARCHAR(50) DEFAULT 'brief',
    aktiv        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT ALL PRIVILEGES ON TABLE dokument_vorlage TO crm_user;

CREATE TABLE IF NOT EXISTS phase_vorlage (
    phase_id     UUID NOT NULL REFERENCES phase(phase_id) ON DELETE CASCADE,
    vorlage_id   UUID NOT NULL REFERENCES dokument_vorlage(vorlage_id) ON DELETE CASCADE,
    PRIMARY KEY (phase_id, vorlage_id)
);
GRANT ALL PRIVILEGES ON TABLE phase_vorlage TO crm_user;
