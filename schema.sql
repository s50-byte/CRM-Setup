-- ============================================================
-- IV-CRM Datenbankschema
-- PostgreSQL 16
-- ============================================================

-- Verbindung zur Datenbank
\connect iv_crm

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE rolle_typ AS ENUM (
    'Casemanagement', 'Job Coach', 'Abklärung',
    'Fachperson', 'Beratung', 'Teamleitung', 'Administration'
);

CREATE TYPE benutzer_rolle AS ENUM (
    'admin', 'mitarbeitende', 'teamleitung', 'management'
);

CREATE TYPE pipeline_status AS ENUM (
    'Erstkontakt', 'In Abklärung', 'Erstgespräch',
    'Schnupper', 'Programmstart'
);

CREATE TYPE kanal_typ AS ENUM (
    'Telefon', 'E-Mail', 'Online-Formular', 'Direkt'
);

CREATE TYPE journal_kategorie AS ENUM (
    'Standortgespräch', 'Job Coaching', 'Beobachtung',
    'Zielfortschritt', 'Abwesenheit',
    'Kommunikation Auftraggeber', 'Externe Person', 'Sonstiges'
);

CREATE TYPE zeitachse_typ AS ENUM (
    'Anfrage', 'Telefonat', 'E-Mail', 'Übergabe',
    'Phasenwechsel', 'Kommentar', 'System'
);

CREATE TYPE dokument_typ AS ENUM (
    'IV-Verfügung', 'Lebenslauf', 'Arztbericht',
    'Anmeldeformular', 'Leistungsvereinbarung',
    'Abschlussbericht', 'Erstgesprächsprotokoll', 'Sonstiges'
);

CREATE TYPE termin_typ AS ENUM (
    'Erstgespräch', 'Schnuppereinsatz', 'Standortgespräch',
    'Programmstart', 'Abschlussgespräch'
);

CREATE TYPE termin_status AS ENUM (
    'Ausstehend', 'Bestätigt', 'Geplant', 'Abgesagt'
);

CREATE TYPE kriterium_typ AS ENUM (
    'doc', 'person', 'date'
);

CREATE TYPE task_prioritaet AS ENUM (
    'Hoch', 'Mittel', 'Niedrig'
);

CREATE TYPE task_typ AS ENUM (
    'phase', 'individuell'
);

CREATE TYPE externe_typ AS ENUM (
    'IV-Stelle', 'RAV', 'Sozialdienst', 'Arbeitgeber',
    'Arzt / Therapeut', 'Gesetzl. Vertreter', 'Sonstiges'
);

CREATE TYPE praesenz_status AS ENUM (
    'anwesend', 'krank', 'unentschuldigt', 'verspaetet',
    'schule', 'ferien', 'feiertag', 'unfall'
);

CREATE TYPE zeitbasis AS ENUM (
    'Stundenbasis', 'Halbtagesbasis', 'Ganztagesbasis'
);

CREATE TYPE prog_verlauf_status AS ENUM (
    'Geplant', 'Laufend', 'Abgeschlossen', 'Abgebrochen'
);

CREATE TYPE benchmark_parameter AS ENUM (
    'breakeven', 'plan', 'auslastung_ziel', 'konversionsrate'
);

CREATE TYPE engpass_typ AS ENUM (
    'kapazitaet', 'auslastung', 'forecast'
);

CREATE TYPE engpass_schwere AS ENUM (
    'niedrig', 'mittel', 'hoch', 'kritisch'
);

CREATE TYPE funnel_stufe AS ENUM (
    'Erstkontakt', 'Eingeladen', 'Erstgespräch',
    'Schnupper', 'Programmstart'
);

CREATE TYPE funnel_resultat AS ENUM (
    'weiter', 'abgebrochen', 'abgelehnt'
);

CREATE TYPE reporting_typ AS ENUM (
    'funnel', 'phase', 'kanal'
);

-- ============================================================
-- OPERATIVER BEREICH
-- ============================================================

-- USER
CREATE TABLE benutzer (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    pensum_pct      INT NOT NULL DEFAULT 100 CHECK (pensum_pct BETWEEN 0 AND 100),
    avatar_initials VARCHAR(3),
    system_rolle    benutzer_rolle NOT NULL DEFAULT 'mitarbeitende',
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USER_ROLLE (Aufgabenbereiche pro Benutzer)
CREATE TABLE benutzer_rolle (
    rolle_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    rolle_name  rolle_typ NOT NULL,
    pensum_pct  INT NOT NULL DEFAULT 0 CHECK (pensum_pct BETWEEN 0 AND 100),
    max_klienten INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USER_PERM (Welche Programme darf der User betreuen)
CREATE TABLE benutzer_berechtigung (
    perm_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    programm_id UUID NOT NULL, -- FK zu programm, wird später gesetzt
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, programm_id)
);

-- ============================================================
-- PROGRAMM-LOGIK
-- ============================================================

-- PROGRAMM
CREATE TABLE programm (
    programm_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    farbe_hex       VARCHAR(7) NOT NULL DEFAULT '#2563EB',
    tarif_pro_tag   DECIMAL(10,2) NOT NULL,
    avg_dauer_tage  INT NOT NULL DEFAULT 30,
    aufwand_h_monat DECIMAL(5,2) NOT NULL DEFAULT 10,
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK jetzt setzen
ALTER TABLE benutzer_berechtigung
    ADD CONSTRAINT fk_perm_programm
    FOREIGN KEY (programm_id) REFERENCES programm(programm_id) ON DELETE CASCADE;

-- PHASE
CREATE TABLE phase (
    phase_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programm_id     UUID NOT NULL REFERENCES programm(programm_id) ON DELETE CASCADE,
    label           VARCHAR(100) NOT NULL,
    reihenfolge     INT NOT NULL,
    avg_dauer_tage  INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (programm_id, reihenfolge)
);

-- KRITERIUM (Muss-Kriterien pro Phase)
CREATE TABLE kriterium (
    kriterium_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id        UUID NOT NULL REFERENCES phase(phase_id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    typ             kriterium_typ NOT NULL DEFAULT 'doc',
    detail_text     TEXT,
    pflicht         BOOLEAN NOT NULL DEFAULT TRUE,
    reihenfolge     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PHASE_TASK_VORLAGE
CREATE TABLE phase_task_vorlage (
    vorlage_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id        UUID NOT NULL REFERENCES phase(phase_id) ON DELETE CASCADE,
    task_text       TEXT NOT NULL,
    standard        BOOLEAN NOT NULL DEFAULT TRUE,
    reihenfolge     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KLIENTEN
-- ============================================================

-- KLIENT (Stammdaten)
CREATE TABLE klient (
    klient_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nachname            VARCHAR(100) NOT NULL,
    vorname             VARCHAR(100) NOT NULL,
    geburtsdatum        DATE,
    ahv_nummer          VARCHAR(20) UNIQUE,
    adresse             TEXT,
    plz                 VARCHAR(10),
    ort                 VARCHAR(100),
    telefon             VARCHAR(30),
    email               VARCHAR(150),
    -- Notfallkontakt
    notfall_name        VARCHAR(100),
    notfall_beziehung   VARCHAR(50),
    notfall_telefon     VARCHAR(30),
    -- Gesetzlicher Vertreter
    vertreter_name      VARCHAR(100),
    vertreter_funktion  VARCHAR(100),
    vertreter_telefon   VARCHAR(30),
    -- Metadaten
    aktiv               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LEISTUNGSVEREINBARUNG
CREATE TABLE leistungsvereinbarung (
    lv_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    pensum_pct      INT NOT NULL CHECK (pensum_pct BETWEEN 10 AND 100),
    tage_mo         BOOLEAN NOT NULL DEFAULT TRUE,
    tage_di         BOOLEAN NOT NULL DEFAULT TRUE,
    tage_mi         BOOLEAN NOT NULL DEFAULT TRUE,
    tage_do         BOOLEAN NOT NULL DEFAULT TRUE,
    tage_fr         BOOLEAN NOT NULL DEFAULT TRUE,
    zeit_von        TIME NOT NULL DEFAULT '08:00',
    zeit_bis        TIME NOT NULL DEFAULT '17:00',
    zeitbasis       zeitbasis NOT NULL DEFAULT 'Ganztagesbasis',
    bemerkung       TEXT,
    gueltig_ab      DATE NOT NULL DEFAULT CURRENT_DATE,
    gueltig_bis     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOSSIER (Eine Akte pro Klient)
CREATE TABLE dossier (
    dossier_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id           UUID NOT NULL UNIQUE REFERENCES klient(klient_id) ON DELETE CASCADE,
    auftraggeber        VARCHAR(100) NOT NULL,
    kanal               kanal_typ,
    eingang_datum       DATE NOT NULL DEFAULT CURRENT_DATE,
    pipeline_status     pipeline_status NOT NULL DEFAULT 'Erstkontakt',
    -- Aktuelles Programm (denormalisiert für Performance)
    akt_programm_id     UUID REFERENCES programm(programm_id),
    akt_phase_id        UUID REFERENCES phase(phase_id),
    abbruch_grund       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROGRAMM_VERLAUF (Mehrere Programme pro Klient)
CREATE TABLE programm_verlauf (
    verlauf_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id      UUID NOT NULL REFERENCES dossier(dossier_id) ON DELETE CASCADE,
    programm_id     UUID NOT NULL REFERENCES programm(programm_id),
    phase_id        UUID REFERENCES phase(phase_id),
    start_datum     DATE,
    end_datum       DATE,
    status          prog_verlauf_status NOT NULL DEFAULT 'Geplant',
    abbruch_grund   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KLIENT_USER (Zuweisung Klient ↔ Benutzer)
CREATE TABLE klient_user (
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    rolle_im_fall   VARCHAR(50) NOT NULL DEFAULT 'Casemanager/in',
    stellvertretung BOOLEAN NOT NULL DEFAULT FALSE,
    zugewiesen_am   DATE NOT NULL DEFAULT CURRENT_DATE,
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (klient_id, user_id)
);

-- KRITERIUM_STATUS (Erfüllungsstatus pro Klient)
CREATE TABLE kriterium_status (
    kriterium_id    UUID NOT NULL REFERENCES kriterium(kriterium_id) ON DELETE CASCADE,
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    erfuellt        BOOLEAN NOT NULL DEFAULT FALSE,
    erfuellt_am     DATE,
    erfuellt_von    UUID REFERENCES benutzer(user_id),
    PRIMARY KEY (kriterium_id, klient_id)
);

-- ZEITACHSE_EINTRAG
CREATE TABLE zeitachse_eintrag (
    eintrag_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    user_id         UUID REFERENCES benutzer(user_id),
    typ             zeitachse_typ NOT NULL DEFAULT 'Kommentar',
    titel           VARCHAR(200),
    text            TEXT,
    datum           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_generated  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JOURNAL_EINTRAG
CREATE TABLE journal_eintrag (
    eintrag_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES benutzer(user_id),
    kategorie       journal_kategorie NOT NULL DEFAULT 'Sonstiges',
    datum           DATE NOT NULL DEFAULT CURRENT_DATE,
    text            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TASK
CREATE TABLE task (
    task_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    user_id         UUID REFERENCES benutzer(user_id),
    phase_id        UUID REFERENCES phase(phase_id),
    text            TEXT NOT NULL,
    prioritaet      task_prioritaet NOT NULL DEFAULT 'Mittel',
    typ             task_typ NOT NULL DEFAULT 'individuell',
    faellig_am      DATE,
    erledigt        BOOLEAN NOT NULL DEFAULT FALSE,
    erledigt_am     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOKUMENT
CREATE TABLE dokument (
    dokument_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    user_id         UUID REFERENCES benutzer(user_id),
    typ             dokument_typ NOT NULL DEFAULT 'Sonstiges',
    dateiname       VARCHAR(255) NOT NULL,
    dateipfad       TEXT NOT NULL,
    groesse_kb      INT,
    hochgeladen_am  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TERMIN
CREATE TABLE termin (
    termin_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    typ             termin_typ NOT NULL,
    datum           DATE NOT NULL,
    zeit            TIME,
    status          termin_status NOT NULL DEFAULT 'Ausstehend',
    notiz           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TERMIN_USER (N:M Termin ↔ Benutzer)
CREATE TABLE termin_user (
    termin_id       UUID NOT NULL REFERENCES termin(termin_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    PRIMARY KEY (termin_id, user_id)
);

-- ============================================================
-- EXTERNE PERSONEN
-- ============================================================

CREATE TABLE externe_person (
    person_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nachname        VARCHAR(100) NOT NULL,
    vorname         VARCHAR(100) NOT NULL,
    funktion        VARCHAR(100),
    typ             externe_typ NOT NULL DEFAULT 'Sonstiges',
    firma           VARCHAR(150),
    telefon         VARCHAR(30),
    email           VARCHAR(150),
    adresse         TEXT,
    bemerkung       TEXT,
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXTERNE_PERSON_DOSSIER (Zuweisung externe Person ↔ Dossier)
CREATE TABLE externe_person_dossier (
    person_id       UUID NOT NULL REFERENCES externe_person(person_id) ON DELETE CASCADE,
    dossier_id      UUID NOT NULL REFERENCES dossier(dossier_id) ON DELETE CASCADE,
    rolle           VARCHAR(100) NOT NULL DEFAULT 'Sonstiges',
    PRIMARY KEY (person_id, dossier_id)
);

-- ============================================================
-- PRÄSENZKONTROLLE
-- ============================================================

CREATE TABLE praesenz_eintrag (
    eintrag_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    datum           DATE NOT NULL,
    status          praesenz_status NOT NULL DEFAULT 'anwesend',
    ankunftszeit    TIME,
    bemerkung       TEXT,
    erfasst_von     UUID REFERENCES benutzer(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (klient_id, datum)
);

-- FERIENPLANUNG
CREATE TABLE ferienplanung (
    ferien_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID NOT NULL REFERENCES klient(klient_id) ON DELETE CASCADE,
    von             DATE NOT NULL,
    bis             DATE NOT NULL,
    abgesprochen_mit UUID REFERENCES benutzer(user_id),
    bemerkung       TEXT,
    genehmigt       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (bis >= von)
);

-- ============================================================
-- MANAGEMENT-BEREICH
-- ============================================================

-- TEAM
CREATE TABLE team (
    team_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    farbe_hex       VARCHAR(7) NOT NULL DEFAULT '#2563EB',
    icon            VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TEAM_MITGLIED
CREATE TABLE team_mitglied (
    team_id             UUID NOT NULL REFERENCES team(team_id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES benutzer(user_id) ON DELETE CASCADE,
    rolle_id            UUID REFERENCES benutzer_rolle(rolle_id),
    pensum_pct_in_team  INT NOT NULL DEFAULT 0,
    max_klienten_in_team INT NOT NULL DEFAULT 0,
    PRIMARY KEY (team_id, user_id)
);

-- AUSLASTUNG_SNAPSHOT
CREATE TABLE auslastung_snapshot (
    snapshot_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id             UUID REFERENCES team(team_id),
    programm_id         UUID REFERENCES programm(programm_id),
    monat               DATE NOT NULL,
    klienten_ist        INT NOT NULL DEFAULT 0,
    kapazitaet_total    INT NOT NULL DEFAULT 0,
    auslastung_pct      DECIMAL(5,2),
    umsatz_ist          DECIMAL(12,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, programm_id, monat)
);

-- BENCHMARK_ZIEL
CREATE TABLE benchmark_ziel (
    ziel_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID REFERENCES team(team_id),
    programm_id     UUID REFERENCES programm(programm_id),
    parameter       benchmark_parameter NOT NULL,
    zielwert        DECIMAL(10,2) NOT NULL,
    einheit         VARCHAR(30),
    gueltig_ab      DATE NOT NULL DEFAULT CURRENT_DATE,
    gueltig_bis     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KAPAZITAETS_ENGPASS
CREATE TABLE kapazitaets_engpass (
    engpass_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID REFERENCES team(team_id),
    benchmark_id    UUID REFERENCES benchmark_ziel(ziel_id),
    monat           DATE NOT NULL,
    typ             engpass_typ NOT NULL,
    schweregrad     engpass_schwere NOT NULL DEFAULT 'mittel',
    beschreibung    TEXT,
    auto_generated  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FUNNEL_EREIGNIS
CREATE TABLE funnel_ereignis (
    ereignis_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id       UUID REFERENCES klient(klient_id) ON DELETE SET NULL,
    stufe           funnel_stufe NOT NULL,
    datum           DATE NOT NULL DEFAULT CURRENT_DATE,
    resultat        funnel_resultat NOT NULL DEFAULT 'weiter',
    abbruch_grund   TEXT,
    kanal           kanal_typ,
    programm_id     UUID REFERENCES programm(programm_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PHASEN_STATISTIK
CREATE TABLE phasen_statistik (
    stat_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id            UUID NOT NULL REFERENCES phase(phase_id),
    monat               DATE NOT NULL,
    avg_verweildauer_tage DECIMAL(6,2),
    klienten_in_phase   INT NOT NULL DEFAULT 0,
    abgeschlossen       INT NOT NULL DEFAULT 0,
    abgebrochen         INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (phase_id, monat)
);

-- STRATEGIE_KENNZAHL
CREATE TABLE strategie_kennzahl (
    kz_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programm_id         UUID NOT NULL REFERENCES programm(programm_id),
    monat               DATE NOT NULL,
    ertrag_pro_monat    DECIMAL(12,2),
    aufwand_h_ist       DECIMAL(8,2),
    chf_pro_h           DECIMAL(8,2),
    effizienz_index     DECIMAL(5,2),
    freie_plaetze       INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (programm_id, monat)
);

-- REPORTING_AGGREGAT
CREATE TABLE reporting_aggregat (
    report_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    typ                 reporting_typ NOT NULL,
    zeitraum_von        DATE NOT NULL,
    zeitraum_bis        DATE NOT NULL,
    kanal               VARCHAR(50),
    programm_id         UUID REFERENCES programm(programm_id),
    anfragen            INT NOT NULL DEFAULT 0,
    starts              INT NOT NULL DEFAULT 0,
    abbrueche           INT NOT NULL DEFAULT 0,
    konversionsrate     DECIMAL(5,2),
    umsatz_gesamt       DECIMAL(12,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KANAL_STATISTIK
CREATE TABLE kanal_statistik (
    ks_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kanal               kanal_typ NOT NULL,
    auftraggeber        VARCHAR(100),
    monat               DATE NOT NULL,
    anfragen            INT NOT NULL DEFAULT 0,
    starts              INT NOT NULL DEFAULT 0,
    konversionsrate     DECIMAL(5,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kanal, auftraggeber, monat)
);

-- ============================================================
-- INDIZES
-- ============================================================

-- Klient
CREATE INDEX idx_klient_nachname ON klient(nachname);
CREATE INDEX idx_klient_ahv ON klient(ahv_nummer);

-- Dossier
CREATE INDEX idx_dossier_klient ON dossier(klient_id);
CREATE INDEX idx_dossier_status ON dossier(pipeline_status);
CREATE INDEX idx_dossier_programm ON dossier(akt_programm_id);

-- Programm Verlauf
CREATE INDEX idx_verlauf_dossier ON programm_verlauf(dossier_id);
CREATE INDEX idx_verlauf_programm ON programm_verlauf(programm_id);
CREATE INDEX idx_verlauf_status ON programm_verlauf(status);

-- Journal
CREATE INDEX idx_journal_klient ON journal_eintrag(klient_id);
CREATE INDEX idx_journal_datum ON journal_eintrag(datum);
CREATE INDEX idx_journal_kategorie ON journal_eintrag(kategorie);

-- Zeitachse
CREATE INDEX idx_zeitachse_klient ON zeitachse_eintrag(klient_id);
CREATE INDEX idx_zeitachse_datum ON zeitachse_eintrag(datum);

-- Tasks
CREATE INDEX idx_task_klient ON task(klient_id);
CREATE INDEX idx_task_user ON task(user_id);
CREATE INDEX idx_task_faellig ON task(faellig_am) WHERE erledigt = FALSE;

-- Präsenz
CREATE INDEX idx_praesenz_klient ON praesenz_eintrag(klient_id);
CREATE INDEX idx_praesenz_datum ON praesenz_eintrag(datum);

-- Termin
CREATE INDEX idx_termin_klient ON termin(klient_id);
CREATE INDEX idx_termin_datum ON termin(datum);

-- Funnel
CREATE INDEX idx_funnel_klient ON funnel_ereignis(klient_id);
CREATE INDEX idx_funnel_datum ON funnel_ereignis(datum);

-- Auslastung
CREATE INDEX idx_auslastung_monat ON auslastung_snapshot(monat);
CREATE INDEX idx_auslastung_team ON auslastung_snapshot(team_id);

-- ============================================================
-- GRUNDDATEN (Stammdaten für Programmes)
-- ============================================================

INSERT INTO programm (programm_id, name, farbe_hex, tarif_pro_tag, avg_dauer_tage, aufwand_h_monat) VALUES
    ('11111111-1111-1111-1111-111111111111', 'IV-Massnahme',       '#2563EB', 180.00, 90, 10),
    ('22222222-2222-2222-2222-222222222222', 'Ausbildung',          '#16A34A', 120.00, 60,  8),
    ('33333333-3333-3333-3333-333333333333', 'Beratung',            '#7C3AED',  90.00, 30,  6),
    ('44444444-4444-4444-4444-444444444444', 'Abklärung',           '#EA580C', 150.00, 10,  7),
    ('55555555-5555-5555-5555-555555555555', 'Gez. Vorbereitung',   '#D97706', 110.00, 20,  9);

-- Phasen IV-Massnahme
INSERT INTO phase (programm_id, label, reihenfolge) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Erstkontakt',   1),
    ('11111111-1111-1111-1111-111111111111', 'Abklärung',     2),
    ('11111111-1111-1111-1111-111111111111', 'Verfügung',     3),
    ('11111111-1111-1111-1111-111111111111', 'Programmstart', 4),
    ('11111111-1111-1111-1111-111111111111', 'Laufend',       5),
    ('11111111-1111-1111-1111-111111111111', 'Abschluss',     6);

-- Phasen Ausbildung
INSERT INTO phase (programm_id, label, reihenfolge) VALUES
    ('22222222-2222-2222-2222-222222222222', 'Erstkontakt',   1),
    ('22222222-2222-2222-2222-222222222222', 'Eignungscheck', 2),
    ('22222222-2222-2222-2222-222222222222', 'Anmeldung',     3),
    ('22222222-2222-2222-2222-222222222222', 'Kursstart',     4),
    ('22222222-2222-2222-2222-222222222222', 'Laufend',       5),
    ('22222222-2222-2222-2222-222222222222', 'Abschluss',     6);

-- Phasen Beratung
INSERT INTO phase (programm_id, label, reihenfolge) VALUES
    ('33333333-3333-3333-3333-333333333333', 'Erstkontakt',        1),
    ('33333333-3333-3333-3333-333333333333', 'Erstgespräch',       2),
    ('33333333-3333-3333-3333-333333333333', 'Beratung laufend',   3),
    ('33333333-3333-3333-3333-333333333333', 'Abschluss',          4);

-- Phasen Abklärung
INSERT INTO phase (programm_id, label, reihenfolge) VALUES
    ('44444444-4444-4444-4444-444444444444', 'Auftrag erhalten',   1),
    ('44444444-4444-4444-4444-444444444444', 'Abklärung läuft',    2),
    ('44444444-4444-4444-4444-444444444444', 'Bericht',            3),
    ('44444444-4444-4444-4444-444444444444', 'Abgeschlossen',      4);

-- Phasen Gez. Vorbereitung
INSERT INTO phase (programm_id, label, reihenfolge) VALUES
    ('55555555-5555-5555-5555-555555555555', 'Erstkontakt',          1),
    ('55555555-5555-5555-5555-555555555555', 'Standortbestimmung',   2),
    ('55555555-5555-5555-5555-555555555555', 'Vorbereitungsphase',   3),
    ('55555555-5555-5555-5555-555555555555', 'Abschluss',            4);

-- Teams
INSERT INTO team (name, farbe_hex, icon) VALUES
    ('Casemanagement', '#2563EB', 'ti-user-check'),
    ('Job Coaching',   '#16A34A', 'ti-briefcase'),
    ('Fachpersonen',   '#7C3AED', 'ti-stethoscope'),
    ('Abklärung',      '#EA580C', 'ti-clipboard-list');

-- ============================================================
-- ABSCHLUSS
-- ============================================================

-- Berechtigungen für crm_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO crm_user;

-- Zukünftige Tabellen auch berechtigen
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON TABLES TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON SEQUENCES TO crm_user;

\echo ''
\echo '======================================'
\echo ' ✓ IV-CRM Schema erfolgreich erstellt'
\echo ' ✓ 27 Tabellen angelegt'
\echo ' ✓ Grunddaten eingespielt'
\echo '======================================'
