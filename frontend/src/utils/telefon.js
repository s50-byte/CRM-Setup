// Telefonnummern werden in der Schweiz erfasst – die Vorwahl +41 soll beim
// Tippen nicht jedes Mal von Hand geschrieben werden (Feedback 10.08.2026).
//
// Verhalten:
//   - Beim Hineinklicken in ein leeres Feld erscheint "+41 ".
//   - Wird das Feld mit nichts als der Vorwahl verlassen, wird es wieder geleert
//     (damit keine Scheinwerte wie "+41" in der Datenbank landen).
//   - Eine national getippte Nummer (0791234567) wird zu +41 79 123 45 67.

export const LANDESVORWAHL = '+41';

export function telefonFokus(wert, setzen) {
    if (!wert || !wert.trim()) setzen(LANDESVORWAHL + ' ');
}

export function telefonBlur(wert, setzen) {
    const roh = (wert || '').trim();
    if (roh === LANDESVORWAHL || roh === LANDESVORWAHL + ' ') { setzen(''); return; }
    setzen(telefonNormalisieren(roh));
}

export function telefonNormalisieren(wert) {
    const roh = (wert || '').trim();
    if (!roh) return '';

    // 0041… und 041… (nur bei genug Stellen) auf +41 bringen
    let ziffern = roh.replace(/[^\d+]/g, '');
    if (ziffern.startsWith('0041')) ziffern = '+41' + ziffern.slice(4);
    else if (ziffern.startsWith('0') && ziffern.length === 10) ziffern = '+41' + ziffern.slice(1);

    if (!ziffern.startsWith('+41')) return roh;

    const rest = ziffern.slice(3);
    if (rest.length !== 9) return roh; // unerwartete Länge unveraendert lassen
    return `${LANDESVORWAHL} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
}
