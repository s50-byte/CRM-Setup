require('dotenv').config();
const db = require('./src/db');

const SQL = `
CREATE TABLE IF NOT EXISTS dossier_dokument (
    dok_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id    UUID NOT NULL REFERENCES dossier(dossier_id) ON DELETE CASCADE,
    vorlage_id    UUID REFERENCES dokument_vorlage(vorlage_id) ON DELETE SET NULL,
    titel         VARCHAR(200) NOT NULL,
    inhalt        TEXT NOT NULL,
    erstellt_von  UUID REFERENCES benutzer(user_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

db.query(SQL)
    .then(() => { console.log('dossier_dokument: OK'); process.exit(0); })
    .catch(e => { console.error('Migration fehlgeschlagen:', e.message); process.exit(1); });
