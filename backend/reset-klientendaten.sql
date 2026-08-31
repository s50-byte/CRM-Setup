-- Sauberer Datenstand: alle Klientendaten weg, Konfiguration bleibt stehen.
--
-- Bewusst NICHT angetastet (im Gegensatz zu reset-testdaten.js):
--   benutzer, benutzer_standort, standort, externe_person,
--   leistung/programm/phase/kriterium, dokument_vorlage, feedback
--
-- DELETE FROM klient kaskadiert auf dossier, klient_user, journal_eintrag,
-- zeitachse_eintrag, termin (+termin_user), praesenz_eintrag (+historie),
-- task, leistungsvereinbarung, klient_notfallkontakt, ferienplanung,
-- kriterium_status, dokument, phase_dokument sowie ueber dossier auf
-- programm_verlauf (+vereinbarungsziel), verfuegung (+positionen),
-- dossier_dokument, dossier_phase und externe_person_dossier.

BEGIN;

SELECT count(*) AS klienten_vorher FROM klient;

-- Dashboard-Meldungen zu Klienten verlieren ihren Bezug. Feedback-Meldungen
-- bleiben, die haengen an Benutzern und tragen den Backlog.
DELETE FROM dashboard_meldung
 WHERE NOT (aenderungen::text LIKE '%feedback_eingang%'
         OR aenderungen::text LIKE '%feedback_antwort%');

DELETE FROM klient;

-- Verwaiste Verlaufsdaten, die nicht am Klienten haengen
DELETE FROM funnel_ereignis;

SELECT
  (SELECT count(*) FROM klient)            AS klient,
  (SELECT count(*) FROM dossier)           AS dossier,
  (SELECT count(*) FROM verfuegung)        AS verfuegung,
  (SELECT count(*) FROM programm_verlauf)  AS programm_verlauf,
  (SELECT count(*) FROM journal_eintrag)   AS journal,
  (SELECT count(*) FROM praesenz_eintrag)  AS praesenz,
  (SELECT count(*) FROM feedback)          AS feedback_bleibt,
  (SELECT count(*) FROM standort)          AS standorte_bleiben,
  (SELECT count(*) FROM externe_person)    AS externe_bleiben,
  (SELECT count(*) FROM phase)             AS phasen_bleiben;

COMMIT;
