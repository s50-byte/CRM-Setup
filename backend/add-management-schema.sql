-- Programm: Monatspreis und Durchschnittsdauer in Monaten
ALTER TABLE programm ADD COLUMN IF NOT EXISTS monatspreis DECIMAL(10,2);
ALTER TABLE programm ADD COLUMN IF NOT EXISTS avg_dauer_monate INT;

-- Platzhalter-Preise setzen
UPDATE programm SET monatspreis = 3200, avg_dauer_monate = 3  WHERE name = 'Erstmalige berufliche Abklärung';
UPDATE programm SET monatspreis = 4800, avg_dauer_monate = 12 WHERE name = 'Erstmalige berufliche Ausbildung';
UPDATE programm SET monatspreis = 2800, avg_dauer_monate = 6  WHERE name = 'Beratung & Coaching';
UPDATE programm SET monatspreis = 3600, avg_dauer_monate = 4  WHERE name = 'Gezielte Vorbereitung';
UPDATE programm SET monatspreis = 4200, avg_dauer_monate = 9  WHERE name = 'Aufbautraining';
UPDATE programm SET monatspreis = 4500, avg_dauer_monate = 12 WHERE name = 'Arbeitstraining';
UPDATE programm SET monatspreis = 5200, avg_dauer_monate = 18 WHERE name = 'IM für Jugendliche';

-- Programm-Verlauf: individuelles Enddatum und Verlängerungen
ALTER TABLE programm_verlauf ADD COLUMN IF NOT EXISTS geplantes_enddatum DATE;
ALTER TABLE programm_verlauf ADD COLUMN IF NOT EXISTS verlaengert_um_monate INT DEFAULT 0;

-- Bestehendes geplantes_enddatum aus start_datum + avg_dauer_monate berechnen
UPDATE programm_verlauf pv
SET geplantes_enddatum = pv.start_datum + (p.avg_dauer_monate * INTERVAL '1 month')
FROM programm p
WHERE pv.programm_id = p.programm_id
  AND pv.start_datum IS NOT NULL
  AND p.avg_dauer_monate IS NOT NULL
  AND pv.geplantes_enddatum IS NULL;
