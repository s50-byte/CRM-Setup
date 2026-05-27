CREATE TABLE IF NOT EXISTS vereinbarungsziel (
    ziel_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verlauf_id    UUID NOT NULL REFERENCES programm_verlauf(verlauf_id) ON DELETE CASCADE,
    text          TEXT NOT NULL,
    erreicht      BOOLEAN NOT NULL DEFAULT FALSE,
    erreicht_am   DATE,
    reihenfolge   INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ziel_verlauf ON vereinbarungsziel(verlauf_id);

GRANT ALL PRIVILEGES ON TABLE vereinbarungsziel TO crm_user;
