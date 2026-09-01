// ============================================================
// Phasen auf dem Zeitstrahl verschieben
// ============================================================
// Ein Strang ist lueckenlos und ueberlappungsfrei: die Phasen liegen
// unmittelbar hintereinander und fuellen den Programmzeitraum genau aus.
// Verschoben wird darum immer eine GRENZE zwischen zwei Phasen - die eine
// waechst um genau das, was die andere verliert.
//
// Regeln (Entscheid 31.08./01.09.2026):
//   - keine Luecken, keine Ueberlappungen
//   - das Enddatum des Programms ist eine harte Grenze
//   - keine Phase kuerzer als ein Tag
//   - ein phasengebundener Termin ist ein Anschlag: die Phase weicht ihm aus,
//     nicht umgekehrt. Start hoechstens bis einen Tag davor, Ende hoechstens
//     bis einen Tag danach.

const TAG = 86400000;

const tag = d => new Date(d + 'T00:00:00Z');
const alsText = d => d.toISOString().slice(0, 10);
const plus = (d, n) => alsText(new Date(tag(d).getTime() + n * TAG));

// Anschlaege einer Phase aus ihren gebundenen Terminen.
// Liefert { fruehestesEnde, spaetesterStart } oder null, wenn keine Termine.
function anschlaege(termine) {
    if (!termine || !termine.length) return null;
    const daten = termine.map(t => t.datum.slice(0, 10)).sort();
    return {
        spaetesterStart: plus(daten[0], -1),        // Start <= erster Termin - 1
        fruehestesEnde: plus(daten[daten.length - 1], 1), // Ende >= letzter Termin + 1
    };
}

// Verschiebt die Grenze zwischen phasen[i] und phasen[i+1] auf `datum`:
// phasen[i] endet am Vortag, phasen[i+1] beginnt an diesem Tag.
// Wirft mit sprechender Meldung, wenn eine Regel dagegensteht.
function grenzeSetzen(phasen, i, datum, termineJePhase = {}) {
    const links = phasen[i], rechts = phasen[i + 1];
    if (!links || !rechts) throw new Error('Diese Grenze gibt es nicht.');

    const neuesEndeLinks = plus(datum, -1);

    if (tag(neuesEndeLinks) < tag(links.start_datum)) {
        throw new Error(`„${links.phase_label}" braucht mindestens einen Tag.`);
    }
    if (tag(datum) > tag(rechts.end_datum)) {
        throw new Error(`„${rechts.phase_label}" braucht mindestens einen Tag.`);
    }

    const aLinks = anschlaege(termineJePhase[links.instanz_id]);
    if (aLinks && tag(neuesEndeLinks) < tag(aLinks.fruehestesEnde)) {
        throw new Error(
            `In „${links.phase_label}" liegt ein Termin. Die Phase kann höchstens bis zum ` +
            `${aLinks.fruehestesEnde} verkürzt werden.`
        );
    }
    const aRechts = anschlaege(termineJePhase[rechts.instanz_id]);
    if (aRechts && tag(datum) > tag(aRechts.spaetesterStart)) {
        throw new Error(
            `In „${rechts.phase_label}" liegt ein Termin. Die Phase kann höchstens ab dem ` +
            `${aRechts.spaetesterStart} beginnen.`
        );
    }

    return phasen.map((p, k) => {
        if (k === i) return { ...p, end_datum: neuesEndeLinks };
        if (k === i + 1) return { ...p, start_datum: datum };
        return p;
    });
}

// Setzt Start und/oder Ende einer Phase. Intern sind das ein oder zwei
// Grenzverschiebungen - so gilt fuer beide Wege (Zeitstrahl und Phasenmaske)
// dieselbe Logik.
function zeitraumSetzen(phasen, instanz_id, { start_datum, end_datum }, termineJePhase = {}, programm = {}) {
    const i = phasen.findIndex(p => p.instanz_id === instanz_id);
    if (i < 0) throw new Error('Phase gehört nicht zu diesem Strang.');
    let aktuell = phasen;

    if (start_datum && start_datum !== aktuell[i].start_datum.slice(0, 10)) {
        if (i === 0) {
            throw new Error(
                'Die erste Phase beginnt mit dem Programm. Ändere dafür den Zeitraum der Verfügung.'
            );
        }
        aktuell = grenzeSetzen(aktuell, i - 1, start_datum, termineJePhase);
    }
    if (end_datum && end_datum !== aktuell[i].end_datum.slice(0, 10)) {
        if (i === aktuell.length - 1) {
            throw new Error(
                'Die letzte Phase endet mit dem Programm. Ändere dafür den Zeitraum der Verfügung.'
            );
        }
        aktuell = grenzeSetzen(aktuell, i, plus(end_datum, 1), termineJePhase);
    }
    return aktuell;
}

module.exports = { grenzeSetzen, zeitraumSetzen, anschlaege };
