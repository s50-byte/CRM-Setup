-- Migration: Feature 2a — Vorlagen ↔ Leistungen n:m
-- Tabelle: vorlage_leistung

CREATE TABLE vorlage_leistung (
    vorlage_id  UUID NOT NULL REFERENCES dokument_vorlage(vorlage_id) ON DELETE CASCADE,
    leistung_id UUID NOT NULL REFERENCES leistung(leistung_id) ON DELETE CASCADE,
    PRIMARY KEY (vorlage_id, leistung_id)
);
