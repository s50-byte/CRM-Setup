CREATE TABLE IF NOT EXISTS reporting_ansicht (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES benutzer(user_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  konfiguration JSONB NOT NULL,
  erstellt_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON TABLE reporting_ansicht TO crm_user;
