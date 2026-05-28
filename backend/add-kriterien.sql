-- Migration: Phasen-Kriterien (Checkliste pro Phase)
-- Spielen Sie diese Datei manuell ein: psql -d iv_crm -f add-kriterien.sql

-- Kriterien-Definitionen pro Phase
CREATE TABLE IF NOT EXISTS kriterium (
    kriterium_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id        UUID NOT NULL REFERENCES phase(phase_id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    typ             TEXT,
    pflicht         BOOLEAN NOT NULL DEFAULT FALSE,
    reihenfolge     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Status pro Klient (welche Kriterien wurden erfüllt)
CREATE TABLE IF NOT EXISTS kriterium_status (
    kriterium_id    UUID NOT NULL REFERENCES kriterium(kriterium_id) ON DELETE CASCADE,
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    erfuellt        BOOLEAN NOT NULL DEFAULT FALSE,
    erfuellt_am     DATE,
    erfuellt_von    UUID REFERENCES benutzer(user_id),
    PRIMARY KEY (kriterium_id, klient_id)
);
