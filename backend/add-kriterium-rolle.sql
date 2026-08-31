-- Verantwortlichkeit je Kriterium ist eine ROLLE, keine Person.
--
-- Beispiel: "Notfallblatt ausfuellen | pflicht | Klientenfuehrung".
-- Welche konkrete Person das ist, ergibt sich am Fall aus klient_user – am
-- Kriterium im Tarifkatalog steht nur, welche Fallrolle zustaendig ist.
--
-- verantwortlich_user_id wurde am 31.08.2026 eingefuehrt und traegt nur
-- Testwerte; die Spalte faellt ersatzlos weg.

\set ON_ERROR_STOP on
SET lock_timeout = '15s';

BEGIN;

ALTER TABLE kriterium
    ADD COLUMN IF NOT EXISTS verantwortlich_rolle VARCHAR(50);

DROP INDEX IF EXISTS idx_kriterium_verantwortlich;

ALTER TABLE kriterium
    DROP COLUMN IF EXISTS verantwortlich_user_id;

CREATE INDEX IF NOT EXISTS idx_kriterium_rolle
    ON kriterium (verantwortlich_rolle);

SELECT text, pflicht, typ, verantwortlich_rolle FROM kriterium ORDER BY text;

COMMIT;
