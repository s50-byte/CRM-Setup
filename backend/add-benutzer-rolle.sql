CREATE TABLE benutzer_rolle (
    rolle_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    rolle_name   VARCHAR(50) NOT NULL,
    pensum_pct   INT NOT NULL DEFAULT 0,
    max_klienten INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON TABLE benutzer_rolle TO crm_user;