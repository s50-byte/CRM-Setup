-- Etappe B: Dateiablage
--
-- Eine Tabelle fuer alle hochgeladenen Dateien. Die besitzende Zeile bekommt
-- eine datei_id als echten Fremdschluessel - kein polymorpher Verweis.
--
-- 'ablage' sagt, WO die Datei liegt, 'schluessel' WIE sie dort heisst. Fuer den
-- Piloten ist das die lokale Platte auf crm-app; produktiv soll SharePoint
-- folgen. Beides kann waehrend der Umstellung nebeneinander bestehen, weil jede
-- Zeile ihre eigene Ablage nennt.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

CREATE TABLE IF NOT EXISTS datei (
    datei_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ablage          VARCHAR(20)  NOT NULL DEFAULT 'lokal',
    schluessel      TEXT         NOT NULL,
    dateiname       VARCHAR(255) NOT NULL,
    mime_typ        VARCHAR(120) NOT NULL,
    groesse_bytes   BIGINT       NOT NULL,
    hochgeladen_von UUID REFERENCES benutzer(user_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datei_created ON datei (created_at DESC);

-- Erster Nutzer: das SVA-Produkteblatt am Tarif. Der bisherige Link bleibt
-- vorerst stehen, damit nichts verloren geht.
ALTER TABLE programm
    ADD COLUMN IF NOT EXISTS produkteblatt_datei_id UUID REFERENCES datei(datei_id) ON DELETE SET NULL;

SELECT
  (SELECT count(*) FROM datei) AS dateien,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name='programm' AND column_name='produkteblatt_datei_id') AS spalte_da;

COMMIT;
