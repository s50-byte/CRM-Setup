-- Migration: Neue Typen für externe_person_typ ENUM
-- Manuell einspielen: psql -U crm_user -d iv_crm -f backend/add-externe-typen.sql

-- Neue Typen für Personen hinzufügen
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Elternteil';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Gesetzlicher Vertreter';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Partner/in';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Lehrperson';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Therapeut';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Arzt';

-- Neue Typen für Organisationen hinzufügen
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Krankenversicherung';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Betreutes Wohnen';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Schule';
ALTER TYPE externe_person_typ ADD VALUE IF NOT EXISTS 'Ausgleichskasse';
