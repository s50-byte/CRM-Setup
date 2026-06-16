ALTER TABLE journal_eintrag ADD COLUMN IF NOT EXISTS dauer_minuten INT DEFAULT 0;
ALTER TABLE journal_eintrag ADD COLUMN IF NOT EXISTS verrechenbar BOOLEAN DEFAULT FALSE;
ALTER TABLE journal_eintrag ADD COLUMN IF NOT EXISTS leistung_id UUID REFERENCES leistung(leistung_id);
