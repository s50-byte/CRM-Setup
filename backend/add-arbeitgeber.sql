ALTER TABLE dossier ADD COLUMN IF NOT EXISTS arbeitgeber_id UUID REFERENCES externe_person(person_id);
