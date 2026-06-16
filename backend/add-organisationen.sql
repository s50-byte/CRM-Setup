-- Externe Person: Organisation-Felder
ALTER TABLE externe_person ADD COLUMN IF NOT EXISTS ist_organisation BOOLEAN DEFAULT FALSE;
ALTER TABLE externe_person ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES externe_person(person_id);

-- Stundenpreise pro Organisation und Leistung
CREATE TABLE IF NOT EXISTS organisation_stundenpreis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES externe_person(person_id) ON DELETE CASCADE,
    leistung_id     UUID NOT NULL REFERENCES leistung(leistung_id) ON DELETE CASCADE,
    stundenpreis    DECIMAL(8,2) NOT NULL,
    UNIQUE (organisation_id, leistung_id)
);
GRANT ALL PRIVILEGES ON TABLE organisation_stundenpreis TO crm_user;

-- Verrechnungsart in Verfügung
ALTER TABLE verfuegung ADD COLUMN IF NOT EXISTS verrechnungsart VARCHAR(20);
-- Werte: 'monatspauschale', 'fallpauschale', 'stundenpauschale'
ALTER TABLE verfuegung ADD COLUMN IF NOT EXISTS betrag DECIMAL(10,2);
