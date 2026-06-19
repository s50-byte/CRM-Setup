-- Migration: Taggeldabrechnung (Dossier) + Lehrberufe pro Standort
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-taggeld-lehrberufe.sql

BEGIN;

ALTER TABLE dossier ADD COLUMN IF NOT EXISTS taggeld_abrechnung VARCHAR(10);

CREATE TABLE IF NOT EXISTS standort_lehrberuf (
    standort_id         UUID NOT NULL REFERENCES standort(standort_id) ON DELETE CASCADE,
    beruf               VARCHAR(30) NOT NULL CHECK (beruf IN ('Informatik', 'Kaufmann/frau', 'Kundendialog', 'Logistik')),
    aktiv               BOOLEAN NOT NULL DEFAULT FALSE,
    bewilligte_plaetze  INTEGER NOT NULL DEFAULT 0,
    total_plaetze       INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (standort_id, beruf)
);

GRANT ALL PRIVILEGES ON TABLE standort_lehrberuf TO crm_user;

COMMIT;
