-- Etappe C: Die Verfuegung traegt Zeitraum und Dokument.
--
-- Bisher gab es nur ein einzelnes `datum` - die verfuegte Dauer stand nirgends.
-- Aus Von/Bis leitet sich die Programmdauer ab, und daraus wiederum die
-- Verteilung der Phasen auf dem Zeitstrahl.
--
-- Die Verfuegung ist fachlich ein hochgeladenes Dokument; datei_id verweist auf
-- die Ablage (add-dateien.sql).

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE verfuegung
    ADD COLUMN IF NOT EXISTS gueltig_von DATE,
    ADD COLUMN IF NOT EXISTS gueltig_bis DATE,
    ADD COLUMN IF NOT EXISTS datei_id UUID REFERENCES datei(datei_id) ON DELETE SET NULL;

-- Bestehende Verfuegungen: das alte Einzeldatum als Beginn uebernehmen, damit
-- sie nicht voellig ohne Zeitraum dastehen. Das Ende bleibt offen und ist von
-- Hand nachzutragen.
UPDATE verfuegung
   SET gueltig_von = datum
 WHERE gueltig_von IS NULL AND datum IS NOT NULL;

-- Nur eine aktive Verfuegung je Dossier. Die Regel galt bisher nur der
-- Uebung nach; jetzt erzwingt sie die Datenbank.
CREATE UNIQUE INDEX IF NOT EXISTS idx_verfuegung_eine_aktive
    ON verfuegung (dossier_id)
    WHERE status = 'aktiv';

SELECT nummer, status, gueltig_von, gueltig_bis FROM verfuegung ORDER BY dossier_id, status;

COMMIT;
