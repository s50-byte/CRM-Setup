-- Migration: Programme-Gruppen und Leistungs-Verknüpfung
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-programm-gruppen.sql

-- Spalten hinzufügen
ALTER TABLE programm ADD COLUMN IF NOT EXISTS gruppe VARCHAR(50);
ALTER TABLE programm ADD COLUMN IF NOT EXISTS leistung_id UUID REFERENCES leistung(leistung_id);

-- Referenzen neutralisieren (für sauberes Löschen)
UPDATE programm_verlauf SET programm_id = NULL WHERE programm_id IS NOT NULL;
UPDATE dossier SET akt_programm_id = NULL WHERE akt_programm_id IS NOT NULL;

-- Alte Programme und Phasen/Kriterien via CASCADE löschen
DELETE FROM phase_rolle;
DELETE FROM programm_rolle;
DELETE FROM kriterium;
DELETE FROM phase;
DELETE FROM programm;

-- 1000er Leistungen und Sammelposition löschen
DELETE FROM leistung WHERE tarifnr LIKE '1%';
DELETE FROM leistung WHERE tarifnr = '9999';

-- Gruppe BM: Berufliche Massnahmen
INSERT INTO programm (programm_id, name, farbe_hex, gruppe, leistung_id)
SELECT gen_random_uuid(), l.bezeichnung,
    CASE
        WHEN l.produkt_nr IN ('4500','4533','4620','4630','4640') THEN '#16A34A'
        WHEN l.produkt_nr = '4805' THEN '#0891B2'
    END,
    'BM', l.leistung_id
FROM leistung l WHERE l.produkt_nr IN ('4500','4533','4620','4630','4640','4805');

-- Gruppe IM: Integrationsmassnahmen
INSERT INTO programm (programm_id, name, farbe_hex, gruppe, leistung_id)
SELECT gen_random_uuid(), l.bezeichnung,
    '#EA580C',
    'IM', l.leistung_id
FROM leistung l WHERE l.produkt_nr IN ('4511','4539','4540','4550','4566','4567','4570','4576','4801','4802','4803','4804');

-- Gruppe BC: Beratung & Coaching
INSERT INTO programm (programm_id, name, farbe_hex, gruppe, leistung_id)
SELECT gen_random_uuid(), l.bezeichnung,
    '#7C3AED',
    'BC', l.leistung_id
FROM leistung l WHERE l.produkt_nr IN ('4551','4552','4556','4568','4571','4573','4574','4575','4577','4578','4579','4580','4808','4809','4810','4811');

-- Gruppe GM: Gemeinde
INSERT INTO programm (programm_id, name, farbe_hex, gruppe, leistung_id)
SELECT gen_random_uuid(), l.bezeichnung,
    '#D97706',
    'GM', l.leistung_id
FROM leistung l WHERE l.produkt_nr IN ('4806','4807');

-- Pro Programm eine Standard-Phase erstellen
INSERT INTO phase (phase_id, programm_id, label, reihenfolge)
SELECT gen_random_uuid(), p.programm_id, 'Phase 1', 1
FROM programm p;
