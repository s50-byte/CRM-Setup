-- Programm- und Phasendokumente sind echte Dateien.
--
-- programm_dokument hielt bisher nur einen Dateinamen, hochgeladen wurde nie
-- etwas. Mit der Dateiablage (add-dateien.sql) bekommt die Zeile die Datei
-- dazu. dateiname bleibt als ANZEIGENAME bestehen und ist bewusst frei
-- waehlbar - der Originalname der Datei steht in datei.dateiname.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE programm_dokument
    ADD COLUMN IF NOT EXISTS datei_id UUID REFERENCES datei(datei_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programm_dokument_datei
    ON programm_dokument (datei_id);

SELECT count(*) AS programm_dokumente FROM programm_dokument;

COMMIT;
