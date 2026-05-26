CREATE TABLE IF NOT EXISTS benutzer_standort (
    user_id     UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    standort_id UUID NOT NULL REFERENCES standort(standort_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, standort_id)
);

GRANT ALL PRIVILEGES ON TABLE benutzer_standort TO crm_user;

-- Bestehende standort_id aus benutzer migrieren:
INSERT INTO benutzer_standort (user_id, standort_id)
SELECT user_id, standort_id FROM benutzer WHERE standort_id IS NOT NULL
ON CONFLICT DO NOTHING;
