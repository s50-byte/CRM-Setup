// ============================================================
// Schema-Merkmale zur Laufzeit pruefen
// ============================================================
// Migrationen werden von Hand auf crm-db eingespielt, Code wird per PM2-Restart
// deployed – beides passiert nicht gleichzeitig. Damit frisch deployter Code
// nicht auf eine noch nicht migrierte Datenbank knallt, fragen Routen hier nach,
// ob eine Spalte oder Tabelle schon existiert, und bauen ihr SQL entsprechend.
//
// Das Ergebnis wird gecacht. Nach dem Einspielen einer Migration braucht es
// darum einen PM2-Restart, damit die neuen Felder genutzt werden.
const db = require('./db');

const cache = new Map();

function merken(schluessel, abfrage) {
    if (!cache.has(schluessel)) {
        cache.set(schluessel, abfrage().catch(err => {
            console.error('[schema-flags]', schluessel, err.message);
            return false;
        }));
    }
    return cache.get(schluessel);
}

function hatTabelle(tabelle) {
    return merken(`t:${tabelle}`, async () => {
        const r = await db.query(`SELECT to_regclass($1) IS NOT NULL AS da`, [`public.${tabelle}`]);
        return r.rows[0].da === true;
    });
}

function hatSpalte(tabelle, spalte) {
    return merken(`c:${tabelle}.${spalte}`, async () => {
        const r = await db.query(
            `SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=$1 AND column_name=$2
             ) AS da`,
            [tabelle, spalte]
        );
        return r.rows[0].da === true;
    });
}

module.exports = { hatTabelle, hatSpalte };
