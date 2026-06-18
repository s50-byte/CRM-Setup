-- Migration: Intake-Rolle mit Bereichs-Zuständigkeit
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-intake-rolle.sql

CREATE TABLE IF NOT EXISTS benutzer_intake_bereich (
    user_id     UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    bereich     VARCHAR(20) NOT NULL,  -- 'BM', 'IM', 'BC'
    PRIMARY KEY (user_id, bereich)
);
GRANT ALL PRIVILEGES ON TABLE benutzer_intake_bereich TO crm_user;
