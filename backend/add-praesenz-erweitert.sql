-- ============================================================
-- Migration: Präsenzerfassung erweitert
-- Manuell einspielen als DB-Owner (postgres) auf 192.168.130.11
-- psql -U postgres -d iv_crm -f add-praesenz-erweitert.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS benutzer_einstellung (
    user_id     UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    schluessel  VARCHAR(50) NOT NULL,
    wert        TEXT,
    PRIMARY KEY (user_id, schluessel)
);

CREATE TABLE IF NOT EXISTS praesenz_historie (
    historie_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eintrag_id   UUID NOT NULL REFERENCES praesenz_eintrag(eintrag_id) ON DELETE CASCADE,
    alter_status praesenz_status,
    neuer_status praesenz_status NOT NULL,
    kommentar    TEXT,
    erfasst_von  UUID REFERENCES benutzer(user_id),
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_meldung (
    meldung_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empfaenger_id   UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    datum           DATE NOT NULL,
    aenderungen     JSONB NOT NULL,
    erstellt_von    UUID REFERENCES benutzer(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_am TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_praesenz_historie_eintrag ON praesenz_historie(eintrag_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_meldung_empfaenger ON dashboard_meldung(empfaenger_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_meldung_datum ON dashboard_meldung(datum);

GRANT ALL PRIVILEGES ON TABLE benutzer_einstellung TO crm_user;
GRANT ALL PRIVILEGES ON TABLE praesenz_historie TO crm_user;
GRANT ALL PRIVILEGES ON TABLE dashboard_meldung TO crm_user;

-- Neue Spalten zu praesenz_eintrag hinzufügen
ALTER TABLE praesenz_eintrag ADD COLUMN IF NOT EXISTS kommentar TEXT;
ALTER TABLE praesenz_eintrag ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
