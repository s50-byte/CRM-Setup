-- Verantwortliche Person je Kriterium (Feedback 23.06.2026)
-- Gilt fuer die Kriteriums-Definition in der Programmverwaltung, nicht fuer den
-- klientenbezogenen Erfuellungsstand (kriterium_status).

ALTER TABLE kriterium
    ADD COLUMN IF NOT EXISTS verantwortlich_user_id UUID REFERENCES benutzer(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kriterium_verantwortlich
    ON kriterium (verantwortlich_user_id);
