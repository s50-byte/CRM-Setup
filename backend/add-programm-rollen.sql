-- ============================================================
-- Migration: Programm/Phase-Rollen + kriterium.typ-Fix
-- Manuell einspielen als DB-Owner (nicht als crm_user)
-- ============================================================

-- Fix: kriterium.typ darf NULL sein (crm_user hat keine ALTER-Berechtigung)
ALTER TABLE kriterium ALTER COLUMN typ DROP NOT NULL;

-- Bestehende leere Strings bereinigen (nach typ || '' Workaround)
UPDATE kriterium SET typ = NULL WHERE typ = '';

-- Rollen pro Programm
CREATE TABLE IF NOT EXISTS programm_rolle (
    programm_id UUID REFERENCES programm(programm_id) ON DELETE CASCADE,
    rolle_name  VARCHAR(50) NOT NULL,
    PRIMARY KEY (programm_id, rolle_name)
);

-- Rollen pro Phase
CREATE TABLE IF NOT EXISTS phase_rolle (
    phase_id   UUID REFERENCES phase(phase_id) ON DELETE CASCADE,
    rolle_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (phase_id, rolle_name)
);
