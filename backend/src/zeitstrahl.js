// ============================================================
// Zeitstrahl — Phaseninstanzen aus Verfuegung und Tarifen
// ============================================================
// Aus Start und Ende der Verfuegung sowie den verfuegten Tarifen entsteht je
// Tarif ein Phasenstrang. Es gibt keinen Haupttarif: die Straenge laufen
// nebeneinander, jeder ueber die volle Programmdauer.
//
// Der Tarifkatalog kennt bewusst keine Solldauer je Phase, darum wird
// gleichmaessig verteilt. Von Hand verschoben wird spaeter (E2).

// Verteilt `tage` Tage auf `anzahl` Phasen. Der Rest wird auf die vorderen
// Phasen verteilt, damit keine Phase leer bleibt und die Summe exakt aufgeht.
function tageVerteilen(tage, anzahl) {
    const basis = Math.floor(tage / anzahl);
    const rest = tage % anzahl;
    return Array.from({ length: anzahl }, (_, i) => basis + (i < rest ? 1 : 0));
}

function tagePlus(datum, n) {
    const d = new Date(datum);
    d.setDate(d.getDate() + n);
    return d;
}

function alsDatum(d) {
    return d.toISOString().slice(0, 10);
}

// Liefert die Phaseninstanzen eines Strangs. Wirft, wenn der Zeitraum nicht
// reicht – jede Phase braucht mindestens einen Tag.
function strangBauen(von, bis, phasen) {
    const start = new Date(von);
    const ende = new Date(bis);
    const tage = Math.round((ende - start) / 86400000) + 1;
    if (tage < phasen.length) {
        throw new Error(
            `Der Zeitraum umfasst ${tage} Tage, der Tarif hat aber ${phasen.length} Phasen. ` +
            'Jede Phase braucht mindestens einen Tag.'
        );
    }
    const laengen = tageVerteilen(tage, phasen.length);
    let zeiger = 0;
    return phasen.map((ph, i) => {
        const s = tagePlus(start, zeiger);
        zeiger += laengen[i];
        const e = tagePlus(start, zeiger - 1);
        return {
            phase_id: ph.phase_id,
            label: ph.label,
            reihenfolge: i,
            start_datum: alsDatum(s),
            end_datum: alsDatum(e),
        };
    });
}

module.exports = { strangBauen, tageVerteilen };
