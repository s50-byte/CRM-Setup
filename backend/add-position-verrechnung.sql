-- Verrechnungsart und Betrag pro Position
ALTER TABLE verfuegung_position ADD COLUMN IF NOT EXISTS verrechnungsart VARCHAR(20);
ALTER TABLE verfuegung_position ADD COLUMN IF NOT EXISTS betrag DECIMAL(10,2);

-- Bestehende Werte von Verfügung auf Positionen übertragen
UPDATE verfuegung_position vp
SET verrechnungsart = v.verrechnungsart, betrag = v.betrag
FROM verfuegung v
WHERE vp.verfuegung_id = v.verfuegung_id;

-- verrechnungsart/betrag auf Verfügung bleiben vorerst (für Rückwärtskompatibilität)
