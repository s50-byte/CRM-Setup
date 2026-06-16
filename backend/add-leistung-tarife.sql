-- Leistungskatalog erweitern & organisation_stundenpreis entfernen

-- organisation_stundenpreis Tabelle löschen
DROP TABLE IF EXISTS organisation_stundenpreis;

-- Leistung Tabelle erweitern
ALTER TABLE leistung ADD COLUMN IF NOT EXISTS tarif DECIMAL(8,2);
ALTER TABLE leistung ADD COLUMN IF NOT EXISTS tarifziffer VARCHAR(20);
ALTER TABLE leistung ADD COLUMN IF NOT EXISTS entschaedigungsart VARCHAR(30);
ALTER TABLE leistung ADD COLUMN IF NOT EXISTS produkt_nr VARCHAR(10);
ALTER TABLE leistung ADD COLUMN IF NOT EXISTS kostenart VARCHAR(10);
ALTER TABLE leistung ADD COLUMN IF NOT EXISTS kostenstelle VARCHAR(50);

-- Bestehende Beispiel-Einträge löschen
DELETE FROM leistung;

-- Alle 36 offiziellen Tarife einfügen
INSERT INTO leistung (produkt_nr, tarifziffer, bezeichnung, tarifnr, entschaedigungsart, tarif, kostenart, kostenstelle) VALUES
-- Berufsintegration IV — Abklärung
('4500', '905.052.2.1', 'Berufliche Abklärung', '4500', 'Monatspauschale', 5300, '6200', '1511/2511/3511'),
-- Berufsintegration IV — AMOV
('4511', '905.069.2.5', 'Arbeitsmarktorientierte Vorbereitung (AMOV)', '4511', 'Monatspauschale', 4150, '6200', '1512/2512/3512'),
-- Berufsintegration IV — Berufsvorbereitung
('4620', '905.066.2.1', 'Gezielte Vorbereitung', '4620', 'Monatspauschale', 4720, '6200', '1513/2513/3513'),
-- Berufsintegration IV — Ausbildung
('4630', '905.060.2.1', 'Erstmalige berufliche Ausbildung intern', '4630', 'Monatspauschale', 4720, '6200', '1520/2520/3520'),
('4533', '905.061.2.1', 'Lehrvertrag bei Integrationspartner (ab 4. Monat)', '4533', 'Monatspauschale', 2450, '6200', '1520/2520/3520'),
('4539', '905.040.2.1', 'IM für Jugendliche', '4539', 'Monatspauschale', 4000, '6200', '1520/2520/3520'),
-- Berufsintegration IV — Integration
('4540', '905.041.2.1', 'Aufbautraining intern', '4540', 'Monatspauschale', 3690, '6201', '1530/2530/3530'),
('4640', '905.042.2.1', 'Arbeitstraining intern', '4640', 'Monatspauschale', 3690, '6201', '1530/2530/3530'),
('4570', '905.052.1.1', 'Potenzialabklärung', '4570', 'Fallpauschale', 5850, '6201', '1530/2530/3530'),
-- Beratung & Coaching
('4568', '905.030.1.1', 'Suche Einsatzplatz IM', '4568', 'Fallpauschale', 2400, '6202', '1540'),
('4574', '905.030.1.8', 'Nachbegleitungspauschale Art. 14a', '4574', 'Fallpauschale', 3500, '6202', '1540'),
('4575', '905.030.2.3', 'Supported Education bei der Institution', '4575', 'Monatspauschale', 2450, '6202', '1540'),
('4576', '905.030.2.4', 'AT / ABT im 1. Arbeitsmarkt', '4576', 'Monatspauschale', 1700, '6202', '1540'),
('4551', '905.030.5.1', 'Coaching Beratung', '4551', 'Pro Stunde', 155, '6202', '1540'),
('4566', '905.041.2.2', 'Aufbautraining 1. Arbeitsmarkt', '4566', 'Monatspauschale', 1700, '6202', '1540'),
('4567', '905.042.2.2', 'Arbeitstraining 1. Arbeitsmarkt', '4567', 'Monatspauschale', 1700, '6202', '1540'),
('4550', '905.043.2.1', 'Arbeit zur Zeitüberbrückung', '4550', 'Monatspauschale', 1700, '6202', '1540'),
('4573', '905.069.1.1', 'Stellenvermittlung ÜII', '4573', 'Fallpauschale', 3500, '6202', '1540'),
('4556', '905.071.1.2', 'Suche Einsatzplatz Arbeitsversuch', '4556', 'Fallpauschale', 2400, '6202', '1540'),
('4577', '905.071.1.6', 'Arbeitsvermittlung Pauschale 1', '4577', 'Fallpauschale', 4930, '6202', '1540'),
('4578', '905.071.1.8', 'Nachbegleitung Pauschale 2', '4578', 'Fallpauschale', 3500, '6202', '1540'),
('4552', '905.071.5.1', 'Coaching Vermittlung', '4552', 'Pro Stunde', 155, '6202', '1540'),
('4571', '905.072.1.4', 'Vermittlungspauschale Festanstellung', '4571', 'Fallpauschale', 3500, '6202', '1540'),
('4579', '905.050.5.1', 'Berufsberatung', '4579', 'Pro Stunde', 165, '6202', '1540'),
('4580', '905.051.5.1', 'Schnuppercoaching', '4580', 'Pro Stunde', 155, '6202', '1540'),
-- Berufsintegration Gemeinde
('4801', '1.001', 'Tagesstruktur', '4801', 'Monatspauschale', 1170, '6050', '1590/2590/3590'),
('4802', '1.002', 'Abklärung im Berufsumfeld', '4802', 'Monatspauschale', 3060, '6050', '1590/2590/3590'),
('4803', '1.003', 'Praktisches Training intern', '4803', 'Monatspauschale', 2160, '6050', '1590/2590/3590'),
('4804', '1.004', 'Praktisches Training extern', '4804', 'Pro Stunde', 180, '6050', '1590/2590/3590'),
('4805', '1.005', 'Vorbereitung Ausbildung', '4805', 'Monatspauschale', 3430, '6050', '1590/2590/3590'),
('4806', '1.006', 'Berufliche Ausbildung intern (Gemeinde)', '4806', 'Monatspauschale', 3430, '6050', '1590/2590/3590'),
('4807', '1.007', 'Berufliche Ausbildung extern (Gemeinde)', '4807', 'Monatspauschale', 1510, '6050', '1590/2590/3590'),
('4808', '1.008', 'Workshop 8-9 Lektionen/Mt.', '4808', 'Monatspauschale', 430, '6050', '1590/2590/3590'),
('4809', '1.009', 'ECDL-Prüfungen', '4809', 'Nach Aufwand', 0, '6050', '1590/2590/3590'),
('4810', '1.010', 'Job Coaching / SE / Sed', '4810', 'Pro Stunde', 180, '6050', '1590/2590/3590'),
('4811', '1.011', 'Abschlussbericht', '4811', 'Pro Bericht', 280, '6050', '1590/2590/3591');
