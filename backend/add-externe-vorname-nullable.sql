-- externe_person: vorname und nachname nullable machen
-- Organisationen haben keinen Vorname/Nachname (nur firma)
ALTER TABLE externe_person ALTER COLUMN vorname DROP NOT NULL;
ALTER TABLE externe_person ALTER COLUMN nachname DROP NOT NULL;
