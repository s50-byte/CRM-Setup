-- Neue Felder für Externe Kontakte: PLZ, Ort, Fax
-- Muss vor dem Backend-Deploy angewendet werden.
ALTER TABLE externe_person
  ADD COLUMN IF NOT EXISTS plz  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS ort  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fax  VARCHAR(50);
