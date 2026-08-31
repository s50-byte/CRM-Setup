-- Link auf das SVA-Produkteblatt je Programm (Feedback 10.08.2026)
-- Es gibt keine Dateiablage im CRM (programm_dokument haelt nur Dateinamen),
-- darum wird das Produkteblatt als URL hinterlegt und verlinkt.

ALTER TABLE programm
    ADD COLUMN IF NOT EXISTS produkteblatt_url TEXT;
