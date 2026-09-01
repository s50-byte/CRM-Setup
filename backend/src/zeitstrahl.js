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

// Legt die Straenge eines Programms neu an: je verfuegtem Tarif einer, ueber
// den ganzen Zeitraum. Bestehende Instanzen werden ersetzt - so verschwinden
// entfernte Tarife und ein geaenderter Zeitraum schlaegt durch.
//
// Erwartet einen Client innerhalb einer Transaktion.
async function straengeErzeugen(pgClient, { verlauf_id, verfuegung_id, von, bis }) {
    const tarife = await pgClient.query(
        `SELECT DISTINCT leistung_id FROM verfuegung_position WHERE verfuegung_id = $1`,
        [verfuegung_id]
    );

    await pgClient.query(`DELETE FROM programm_phase WHERE verlauf_id = $1`, [verlauf_id]);

    let angelegt = 0;
    const ohnePhasen = [];
    for (const { leistung_id } of tarife.rows) {
        const phasen = await pgClient.query(
            `SELECT phase_id, label FROM phase WHERE leistung_id = $1 ORDER BY reihenfolge`,
            [leistung_id]
        );
        if (!phasen.rows.length) {
            const l = await pgClient.query('SELECT bezeichnung FROM leistung WHERE leistung_id = $1', [leistung_id]);
            ohnePhasen.push(l.rows[0]?.bezeichnung || leistung_id);
            continue;
        }
        for (const p of strangBauen(von, bis, phasen.rows)) {
            await pgClient.query(
                `INSERT INTO programm_phase (verlauf_id, leistung_id, phase_id, reihenfolge, start_datum, end_datum)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [verlauf_id, leistung_id, p.phase_id, p.reihenfolge, p.start_datum, p.end_datum]
            );
            angelegt++;
        }
    }
    return { angelegt, straenge: tarife.rows.length - ohnePhasen.length, ohne_phasenmodell: ohnePhasen };
}

module.exports = { strangBauen, tageVerteilen, straengeErzeugen };
