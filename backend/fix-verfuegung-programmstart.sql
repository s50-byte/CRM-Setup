-- Nachtrag: Dossiers, deren Programm nie gestartet wurde (Feedback 23.06.2026)
--
-- POST /verfuegungen kennt einen programm_id-Parameter, aber die Oberflaeche hat
-- ihn nie mitgeschickt – das Programm wurde darum beim Erfassen einer Verfuegung
-- nicht gestartet. Der Code leitet es jetzt aus der Leistung der Verfuegungs-
-- position ab; dieses Skript zieht die Faelle nach, die vorher entstanden sind.
--
-- Beruecksichtigt nur AKTIVE Verfuegungen mit Position. Abgeschlossene
-- Verfuegungen starten bewusst kein Programm.
-- Idempotent: laeuft nur auf Dossiers ohne akt_programm_id.

BEGIN;

CREATE TEMP TABLE nachtrag ON COMMIT DROP AS
SELECT DISTINCT ON (d.dossier_id)
       d.dossier_id,
       p.programm_id,
       COALESCE(v.datum, CURRENT_DATE) AS start_datum
FROM dossier d
JOIN verfuegung v          ON v.dossier_id = d.dossier_id AND v.status = 'aktiv'
JOIN verfuegung_position vp ON vp.verfuegung_id = v.verfuegung_id
JOIN programm p            ON p.leistung_id = vp.leistung_id
WHERE d.akt_programm_id IS NULL
ORDER BY d.dossier_id, v.datum DESC NULLS LAST, vp.reihenfolge;

UPDATE dossier d
   SET akt_programm_id = n.programm_id, updated_at = NOW()
  FROM nachtrag n
 WHERE n.dossier_id = d.dossier_id;

INSERT INTO programm_verlauf (dossier_id, programm_id, status, start_datum)
SELECT n.dossier_id, n.programm_id, 'Laufend', n.start_datum
FROM nachtrag n
WHERE NOT EXISTS (
    SELECT 1 FROM programm_verlauf pv
    WHERE pv.dossier_id = n.dossier_id AND pv.status = 'Laufend'
);

SELECT k.vorname || ' ' || k.nachname AS klient, p.name AS programm, n.start_datum
FROM nachtrag n
JOIN dossier d USING (dossier_id)
JOIN klient k USING (klient_id)
JOIN programm p ON p.programm_id = n.programm_id;

COMMIT;
