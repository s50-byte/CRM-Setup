-- Etappe A1: Das Phasenmodell haengt am Tarif, nicht am Programm-Katalog.
--
-- Entschieden am 31.08.2026: Der Tarif (leistung) ist die Basis, das Programm
-- baut darauf. Die Phasen gehoeren damit an den Tarif.
--
-- programm.leistung_id ist heute strikt 1:1 (36 Programme, 36 Tarife, keine
-- Leistung an zwei Programmen), die Zuordnung ist also eindeutig.
--
-- phase.programm_id bleibt vorerst bestehen: der Programm-Katalog wird erst in
-- einem zweiten Schritt aufgeloest. Bis dahin werden beide Spalten gefuehrt.

ALTER TABLE phase
    ADD COLUMN IF NOT EXISTS leistung_id UUID REFERENCES leistung(leistung_id) ON DELETE CASCADE;

UPDATE phase ph
   SET leistung_id = p.leistung_id
  FROM programm p
 WHERE p.programm_id = ph.programm_id
   AND ph.leistung_id IS DISTINCT FROM p.leistung_id;

CREATE INDEX IF NOT EXISTS idx_phase_leistung
    ON phase (leistung_id, reihenfolge);

-- Kontrolle: muss 0 ergeben, sonst haengen Phasen an einem Programm ohne Tarif
SELECT count(*) AS phasen_ohne_tarif
  FROM phase
 WHERE leistung_id IS NULL;
