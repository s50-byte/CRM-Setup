CREATE TABLE IF NOT EXISTS leistung (
    leistung_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarifnr       VARCHAR(20) NOT NULL UNIQUE,
    bezeichnung   VARCHAR(100) NOT NULL,
    einheit       VARCHAR(20) NOT NULL DEFAULT 'Stunden',
    aktiv         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT ALL PRIVILEGES ON TABLE leistung TO crm_user;

-- Beispiel-Einträge
INSERT INTO leistung (tarifnr, bezeichnung) VALUES
('1001', 'Klientenführung'),
('1002', 'Schnuppercoaching'),
('1003', 'Lehrstellensuche'),
('1004', 'Standortgespräch'),
('1005', 'Job Coaching'),
('1006', 'Abklärung'),
('1007', 'Beratung & Coaching'),
('1008', 'Nachbegleitung');
