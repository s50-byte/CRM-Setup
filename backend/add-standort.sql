BEGIN;

CREATE TABLE IF NOT EXISTS standort (
    standort_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    kuerzel     VARCHAR(10) NOT NULL UNIQUE,
    adresse     TEXT,
    plz         VARCHAR(10),
    ort         VARCHAR(100),
    telefon     VARCHAR(30),
    email       VARCHAR(150),
    aktiv       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES standort(standort_id);
ALTER TABLE dossier ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES standort(standort_id);
ALTER TABLE programm_verlauf ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES standort(standort_id);

CREATE INDEX IF NOT EXISTS idx_benutzer_standort ON benutzer(standort_id);
CREATE INDEX IF NOT EXISTS idx_dossier_standort ON dossier(standort_id);
CREATE INDEX IF NOT EXISTS idx_verlauf_standort ON programm_verlauf(standort_id);

GRANT ALL PRIVILEGES ON TABLE standort TO crm_user;

INSERT INTO standort (name, kuerzel, ort) VALUES
    ('Zürich Hauptsitz', 'ZH', 'Zürich'),
    ('Bern Filiale', 'BE', 'Bern')
ON CONFLICT (kuerzel) DO NOTHING;

COMMIT;