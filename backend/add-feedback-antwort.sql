-- Migration: Feedback-Antwort-Felder hinzufügen
-- Manuell einspielen: psql -U postgres -d iv_crm -f backend/add-feedback-antwort.sql

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'offen';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS antwort TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS beantwortet_von UUID REFERENCES benutzer(user_id);
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS beantwortet_at TIMESTAMPTZ;
