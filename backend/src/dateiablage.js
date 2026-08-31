// ============================================================
// Dateiablage
// ============================================================
// Die einzige Stelle im Code, die weiss, WO Dateien liegen. Routen kennen nur
// speichern/lesen/loeschen und nie einen Pfad.
//
// Produktiv sollen die Dateien spaeter auf SharePoint liegen. Der Umstieg ist
// dann eine zweite Implementierung dieser drei Funktionen – nicht ein Eingriff
// an jeder Fundstelle. Jede Zeile in `datei` nennt ihre eigene `ablage`, darum
// koennen lokale und SharePoint-Dateien waehrend der Umstellung koexistieren.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Konfigurierbar, damit die Daten auf eine eigene Platte umziehen koennen,
// ohne dass Code angefasst wird.
const WURZEL = process.env.DATEI_ABLAGE_PFAD || '/var/lib/iv-crm/dateien';

const MAX_BYTES = 20 * 1024 * 1024;

// Nur was hier steht, wird angenommen und ausgeliefert. Kein HTML, kein SVG –
// beides wuerde im Browser ausgefuehrt.
const ERLAUBTE_TYPEN = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

function istErlaubt(mime) {
    return Object.prototype.hasOwnProperty.call(ERLAUBTE_TYPEN, mime);
}

// Der Schluessel enthaelt nie den Originalnamen: das erspart Namenskollisionen
// und schliesst Pfad-Tricks aus. Der echte Name steht in der Datenbank.
function schluesselBauen(mime) {
    const jahr = new Date().getFullYear();
    const name = crypto.randomUUID() + '.' + (ERLAUBTE_TYPEN[mime] || 'bin');
    return `${jahr}/${name}`;
}

function vollerPfad(schluessel) {
    const ziel = path.resolve(WURZEL, schluessel);
    // Doppelter Boden: ein Schluessel darf die Wurzel nie verlassen.
    if (ziel !== path.resolve(WURZEL) && !ziel.startsWith(path.resolve(WURZEL) + path.sep)) {
        throw new Error('Ungültiger Ablageschlüssel');
    }
    return ziel;
}

async function speichern(buffer, mime_typ) {
    if (!istErlaubt(mime_typ)) throw new Error('Dateityp nicht erlaubt: ' + mime_typ);
    if (buffer.length > MAX_BYTES) throw new Error('Datei zu gross');

    const schluessel = schluesselBauen(mime_typ);
    const ziel = vollerPfad(schluessel);
    await fsp.mkdir(path.dirname(ziel), { recursive: true });
    await fsp.writeFile(ziel, buffer, { mode: 0o640 });
    return { ablage: 'lokal', schluessel };
}

function lesen(ablage, schluessel) {
    if (ablage !== 'lokal') throw new Error('Unbekannte Ablage: ' + ablage);
    return fs.createReadStream(vollerPfad(schluessel));
}

async function existiert(ablage, schluessel) {
    if (ablage !== 'lokal') return false;
    try { await fsp.access(vollerPfad(schluessel)); return true; }
    catch { return false; }
}

async function loeschen(ablage, schluessel) {
    if (ablage !== 'lokal') throw new Error('Unbekannte Ablage: ' + ablage);
    try { await fsp.unlink(vollerPfad(schluessel)); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
}

// Beim Start pruefen, ob die Wurzel beschreibbar ist – lieber jetzt eine klare
// Meldung im Log als spaeter ein Fehler beim ersten Upload.
async function pruefen() {
    try {
        await fsp.mkdir(WURZEL, { recursive: true });
        await fsp.access(WURZEL, fs.constants.W_OK);
        console.log('✓ Dateiablage bereit:', WURZEL);
        return true;
    } catch (err) {
        console.error('❌ Dateiablage nicht beschreibbar:', WURZEL, '—', err.message);
        return false;
    }
}

module.exports = {
    speichern, lesen, loeschen, existiert, pruefen,
    istErlaubt, ERLAUBTE_TYPEN, MAX_BYTES, WURZEL,
};
