-- Ein paar neue Klienten fuer einen frischen Datenstand.
--
-- Bewusst ohne Programm und ohne Phase: das Programmmodell wird gerade umgebaut,
-- Programme entstehen kuenftig aus einer Verfuegung heraus. Die Faelle stehen
-- darum im Intake bzw. in der Abklaerung und warten auf ihre Verfuegung.
--
-- Idempotent: laeuft nur, wenn der jeweilige Klient noch nicht existiert.

BEGIN;

WITH neue AS (
    SELECT * FROM (VALUES
        ('Brunner',   'Lea',     DATE '2004-03-12', '756.4821.9033.17', 'Seestrasse 44',    '8802', 'Kilchberg',   '+41 79 412 08 55', 'lea.brunner@example.ch',   'Frau', 'ZH', 'IV-Stelle Zürich',      'Telefon'::kanal_typ),
        ('Kovac',     'Marko',   DATE '1998-11-02', '756.1190.4472.85', 'Industriestr. 7',  '8400', 'Winterthur',  '+41 78 220 41 09', 'm.kovac@example.ch',       'Herr', 'WI', 'IV-Stelle Zürich',      'E-Mail'::kanal_typ),
        ('Sidler',    'Nadja',   DATE '2002-07-25', '756.9034.1188.42', 'Dorfstrasse 19',   '8805', 'Richterswil', '+41 76 883 27 14', 'nadja.sidler@example.ch',  'Frau', 'RI', 'RAV Horgen',            'Empfehlung'::kanal_typ),
        ('Amrein',    'Tobias',  DATE '2001-01-30', '756.2277.6501.93', 'Bergweg 3',        '8942', 'Oberrieden',  '+41 79 655 19 72', 't.amrein@example.ch',      'Herr', 'ZH', 'IV-Stelle Zürich',      'Direkt'::kanal_typ),
        ('Da Silva',  'Ines',    DATE '2005-09-08', '756.7712.3396.28', 'Rosenweg 11',      '8400', 'Winterthur',  '+41 78 104 66 31', 'ines.dasilva@example.ch',  'Frau', 'WI', 'Sozialdienst Winterthur','Online-Formular'::kanal_typ),
        ('Weber',     'Jonas',   DATE '1996-05-17', '756.5508.2214.60', 'Kirchgasse 2',     '8001', 'Zürich',      '+41 79 337 90 24', 'jonas.weber@example.ch',   'Herr', 'ZH', 'IV-Stelle Zürich',      'Telefon'::kanal_typ)
    ) AS t(nachname, vorname, geburtsdatum, ahv_nummer, adresse, plz, ort, telefon, email, anrede, standort_kuerzel, auftraggeber, kanal)
    WHERE NOT EXISTS (
        SELECT 1 FROM klient k WHERE k.nachname = t.nachname AND k.vorname = t.vorname
    )
),
eingefuegt AS (
    INSERT INTO klient (nachname, vorname, geburtsdatum, ahv_nummer, adresse, plz, ort, telefon, email, anrede)
    SELECT nachname, vorname, geburtsdatum, ahv_nummer, adresse, plz, ort, telefon, email, anrede
    FROM neue
    RETURNING klient_id, nachname, vorname
)
INSERT INTO dossier (klient_id, auftraggeber, eingang_datum, pipeline_status, standort_id, kanal, intake_abgeschlossen, status)
SELECT e.klient_id,
       n.auftraggeber,
       CURRENT_DATE - (row_number() OVER (ORDER BY e.nachname) * 4)::int,
       'vorabklaerung'::pipeline_status,
       (SELECT standort_id FROM standort WHERE kuerzel = n.standort_kuerzel),
       n.kanal,
       FALSE,
       'aktiv'
FROM eingefuegt e
JOIN neue n ON n.nachname = e.nachname AND n.vorname = e.vorname;

-- Klientenfuehrung reihum auf die aktiven Fachpersonen verteilen
WITH ohne_fuehrung AS (
    SELECT k.klient_id, row_number() OVER (ORDER BY k.nachname) AS nr
    FROM klient k
    WHERE (k.nachname, k.vorname) IN (
            ('Brunner','Lea'), ('Kovac','Marko'), ('Sidler','Nadja'),
            ('Amrein','Tobias'), ('Da Silva','Ines'), ('Weber','Jonas'))
      AND NOT EXISTS (
        SELECT 1 FROM klient_user ku
        WHERE ku.klient_id = k.klient_id AND ku.rolle_im_fall = 'Klientenführung' AND ku.aktiv
    )
),
fuehrende AS (
    SELECT user_id, row_number() OVER (ORDER BY full_name) AS nr, count(*) OVER () AS anz
    FROM benutzer WHERE aktiv = TRUE
)
INSERT INTO klient_user (klient_id, user_id, rolle_im_fall, stellvertretung, aktiv)
SELECT o.klient_id, f.user_id, 'Klientenführung', FALSE, TRUE
FROM ohne_fuehrung o
JOIN fuehrende f ON f.nr = ((o.nr - 1) % f.anz) + 1
ON CONFLICT (klient_id, user_id) DO NOTHING;

SELECT k.nachname, k.vorname, s.kuerzel AS standort, d.pipeline_status, b.full_name AS klientenfuehrung
FROM klient k
JOIN dossier d USING (klient_id)
LEFT JOIN standort s ON s.standort_id = d.standort_id
LEFT JOIN klient_user ku ON ku.klient_id = k.klient_id AND ku.rolle_im_fall = 'Klientenführung' AND ku.aktiv
LEFT JOIN benutzer b ON b.user_id = ku.user_id
ORDER BY k.nachname;

COMMIT;
