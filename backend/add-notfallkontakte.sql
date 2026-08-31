-- Mehrere Notfallkontakte je Klient (Feedback 23.06.2026)
-- Die bisherigen Spalten klient.notfall_* bleiben bestehen und werden hierher
-- uebernommen; die Anwendung liest ab sofort nur noch aus dieser Tabelle.

CREATE TABLE IF NOT EXISTS klient_notfallkontakt (
    kontakt_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id    UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    beziehung    VARCHAR(100),
    telefon      VARCHAR(50),
    reihenfolge  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notfallkontakt_klient
    ON klient_notfallkontakt (klient_id, reihenfolge);

-- Bestehende Einzelkontakte uebernehmen (nur einmal; bei erneutem Lauf passiert nichts)
INSERT INTO klient_notfallkontakt (klient_id, name, beziehung, telefon, reihenfolge)
SELECT k.klient_id, k.notfall_name, k.notfall_beziehung, k.notfall_telefon, 0
FROM klient k
WHERE COALESCE(TRIM(k.notfall_name), '') <> ''
  AND NOT EXISTS (
      SELECT 1 FROM klient_notfallkontakt n WHERE n.klient_id = k.klient_id
  );
