CREATE TABLE IF NOT EXISTS verfuegung (
    verfuegung_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id      UUID NOT NULL REFERENCES dossier(dossier_id) ON DELETE CASCADE,
    nummer          VARCHAR(50) NOT NULL,
    datum           DATE,
    bemerkung       TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'aktiv',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verfuegung_position (
    position_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verfuegung_id   UUID NOT NULL REFERENCES verfuegung(verfuegung_id) ON DELETE CASCADE,
    leistung_id     UUID NOT NULL REFERENCES leistung(leistung_id),
    soll_stunden    DECIMAL(6,2) NOT NULL DEFAULT 0,
    reihenfolge     INT NOT NULL DEFAULT 0
);

GRANT ALL PRIVILEGES ON TABLE verfuegung TO crm_user;
GRANT ALL PRIVILEGES ON TABLE verfuegung_position TO crm_user;
CREATE INDEX IF NOT EXISTS idx_verfuegung_dossier ON verfuegung(dossier_id);
