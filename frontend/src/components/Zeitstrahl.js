import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

// Zeitstrahl: je verfuegtem Tarif ein Phasenstrang, ueber die Dauer der
// Verfuegung. Die Balken sind proportional zur Phasendauer.
//
// Verschieben von Hand kommt in einem naechsten Schritt; hier wird erzeugt
// und dargestellt.

const TAG = 86400000;

function tage(von, bis) {
    return Math.round((new Date(bis) - new Date(von)) / TAG) + 1;
}

function kurz(d) {
    return new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
}

const STRANG_FARBEN = ['#2563EB', '#15803D', '#B45309', '#7C3AED', '#BE123C'];

// Anteil eines Datums an der Gesamtdauer, 0..1
function anteil(datum, von, gesamt) {
    return Math.round((new Date(datum) - new Date(von)) / TAG) / gesamt;
}

// Beschriftung der Achse: Monatsanfaenge im Zeitraum. Bei kurzen Zeitraeumen
// zusaetzlich der Beginn, damit die Achse nicht leer bleibt.
function achsenMarken(von, bis) {
    const marken = [];
    const start = new Date(von), ende = new Date(bis);
    const z = new Date(start.getFullYear(), start.getMonth(), 1);
    if (z < start) z.setMonth(z.getMonth() + 1);
    while (z <= ende) {
        marken.push({ datum: new Date(z), label: z.toLocaleDateString('de-CH', { month: 'short' }) });
        z.setMonth(z.getMonth() + 1);
    }
    if (!marken.length || anteil(marken[0].datum, von, tage(von, bis)) > 0.15) {
        marken.unshift({ datum: start, label: kurz(start) });
    }
    return marken;
}

function istHeute(p) {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    return new Date(p.start_datum) <= h && h <= new Date(p.end_datum);
}

export default function Zeitstrahl({ dossierId, bearbeitbar, onPhaseKlick }) {
    const [daten, setDaten] = useState(null);
    const [laden, setLaden] = useState(true);
    const [busy, setBusy] = useState(false);
    const [fehler, setFehler] = useState('');
    const [zieht, setZieht] = useState(null);

    const laden_ = useCallback(async () => {
        try {
            const r = await client.get(`/zeitstrahl/${dossierId}`);
            setDaten(r.data);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Zeitstrahl konnte nicht geladen werden');
        } finally { setLaden(false); }
    }, [dossierId]);

    useEffect(() => { laden_(); }, [laden_]);

    // Ziehen endet, wo auch immer die Maus losgelassen wird.
    useEffect(() => {
        if (!zieht) return;
        function los(e) {
            const datum = datumAusX(zieht.container, e.clientX);
            setZieht(null);
            grenzeSetzen({ instanz_id: zieht.instanz_id }, datum);
        }
        window.addEventListener('mouseup', los);
        return () => window.removeEventListener('mouseup', los);
    });

    // Die Grenze zwischen zwei Phasen ziehen: die linke endet am Vortag, die
    // rechte beginnt am gezogenen Tag. Regeln prueft das Backend.
    async function grenzeSetzen(rechtePhase, datum) {
        setFehler('');
        try {
            await client.put(`/zeitstrahl/phase/${rechtePhase.instanz_id}`, { start_datum: datum });
            await laden_();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Verschieben nicht möglich');
        }
    }

    // Pixelposition -> Datum auf der Achse.
    function datumAusX(container, klientX) {
        const r = container.getBoundingClientRect();
        const anteilX = Math.min(1, Math.max(0, (klientX - r.left) / r.width));
        const versatz = Math.round(anteilX * gesamt);
        return new Date(achsenVon.getTime() + versatz * TAG).toISOString().slice(0, 10);
    }

    async function erzeugen() {
        setBusy(true);
        setFehler('');
        try {
            const r = await client.post(`/zeitstrahl/${dossierId}/erzeugen`);
            if (r.data.ohne_phasenmodell?.length) {
                setFehler('Ohne Phasenmodell übersprungen: ' + r.data.ohne_phasenmodell.join(', '));
            }
            await laden_();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Zeitstrahl konnte nicht erzeugt werden');
        } finally { setBusy(false); }
    }

    if (laden) return null;

    const prog = daten?.programm;
    const von = prog?.gueltig_von || prog?.start_datum;
    const bis = prog?.gueltig_bis || prog?.geplantes_enddatum;
    const straenge = daten?.straenge || [];
    // Ohne vollstaendigen Zeitraum laesst sich nichts massstabsgetreu zeichnen –
    // ein fehlendes Enddatum ergaebe NaN und damit ein zerrissenes Layout.
    const programmTage = von && bis ? tage(von, bis) : 0;
    const zeitraumGueltig = Number.isFinite(programmTage) && programmTage >= 1;

    // Die Achse spannt ueber das Programm UND den heutigen Tag. Liegt heute
    // ausserhalb, waechst die Achse dorthin, statt die Linie an den Rand zu
    // klemmen: nur so ist der Abstand zwischen heute und Programmstart im
    // selben Massstab ablesbar wie die Phasen untereinander.
    const heuteDatum = (() => { const h = new Date(); h.setHours(0, 0, 0, 0); return h; })();
    const termine = daten?.termine || [];

    // Ein Termin nach dem Programmende zieht die Achse mit: letzter Termin plus
    // sieben Tage ist dann der rechte Abschluss, damit er nicht am Rand klebt.
    const letzterTermin = termine.reduce((max, t) => {
        const d = new Date(t.datum);
        return !max || d > max ? d : max;
    }, null);

    const achsenVon = zeitraumGueltig
        ? new Date(Math.min(heuteDatum, new Date(von),
            ...termine.map(t => new Date(t.datum)))) : null;
    const achsenBis = zeitraumGueltig
        ? new Date(Math.max(heuteDatum, new Date(bis),
            ...(letzterTermin && letzterTermin > new Date(bis)
                ? [new Date(letzterTermin.getTime() + 7 * TAG)] : []))) : null;
    const gesamt = zeitraumGueltig ? tage(achsenVon, achsenBis) : 0;

    // Heute liegt durch die mitwachsende Achse immer im Bild – am echten Ort.
    const heute = zeitraumGueltig ? {
        anteil: anteil(heuteDatum, achsenVon, gesamt),
        davor: heuteDatum < new Date(von),
        danach: heuteDatum > new Date(bis),
    } : null;

    // Frei erfasste gegen phasengebundene trennen; letztere dem Strang ihrer
    // Phase zuordnen, damit sie im richtigen Balken erscheinen.
    const phaseZuStrang = {};
    straenge.forEach(s => s.phasen.forEach(p => { phaseZuStrang[p.instanz_id] = s.leistung_id; }));
    const freieTermine = termine.filter(t => !t.programm_phase_id);
    const phasenTermine = {};
    termine.filter(t => t.programm_phase_id).forEach(t => {
        const strang = phaseZuStrang[t.programm_phase_id];
        if (!strang) return;
        (phasenTermine[strang] = phasenTermine[strang] || []).push(t);
    });

    if (!prog) return null;

    return (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 10, padding: '.875rem 1.25rem', marginBottom: '.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.7rem' }}>
                <div style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Zeitstrahl
                </div>
                {von && bis && (
                    <span style={{ fontSize: 11, color: '#A09D97', fontFamily: 'monospace' }}>
                        {kurz(von)} – {kurz(achsenBis)} · {gesamt} Tage
                    </span>
                )}
                {bearbeitbar && (
                    <button
                        onClick={erzeugen}
                        disabled={busy}
                        style={{ fontSize: 11.5, padding: '3px 10px', cursor: busy ? 'default' : 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 5, background: '#fff', color: '#2563EB', fontFamily: 'inherit', fontWeight: 500 }}
                    >{busy ? 'Erzeuge…' : straenge.length ? 'Neu erzeugen' : 'Erzeugen'}</button>
                )}
            </div>

            {fehler && (
                <div style={{ background: '#FFFBEB', border: '1px solid rgba(217,119,6,.25)', borderRadius: 6, padding: '7px 10px', fontSize: 11.5, color: '#92400E', marginBottom: 10 }}>
                    {fehler}
                </div>
            )}

            {!zeitraumGueltig ? (
                <div style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid rgba(217,119,6,.25)', borderRadius: 6, padding: '8px 11px' }}>
                    Die aktive Verfügung hat keinen vollständigen Gültigkeitszeitraum
                    {von ? ` (ab ${kurz(von)}, Ende fehlt)` : ''}. Ohne Von und Bis lässt sich
                    der Zeitstrahl nicht massstabsgetreu darstellen.
                </div>
            ) : straenge.length === 0 ? (
                <div style={{ fontSize: 12, color: '#A09D97' }}>
                    Noch keine Phasen verteilt.{bearbeitbar ? ' Über „Erzeugen" aus der Verfügung anlegen.' : ''}
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    {/* Heute-Linie über alle Stränge – daran ist ablesbar, welcher
                        Tarif gerade in welcher Phase steht. */}
                    {heute && (
                        <div style={{
                            position: 'absolute', top: 0, bottom: 4,
                            left: `${heute.anteil * 100}%`,
                            width: 2, marginLeft: -1, zIndex: 3, pointerEvents: 'none',
                            background: heute.davor || heute.danach ? '#DC262655' : '#DC2626',
                        }}>
                            {/* Beschriftung unterhalb der Achse */}
                            <div style={{
                                position: 'absolute', bottom: -13,
                                left: heute.anteil > .5 ? 'auto' : -3,
                                right: heute.anteil > .5 ? -3 : 'auto',
                                fontSize: 9, fontWeight: 700, color: '#DC2626',
                                letterSpacing: '.04em', whiteSpace: 'nowrap',
                            }}>HEUTE</div>
                        </div>
                    )}

                    {/* Frei erfasste Termine ueber den Straengen – sie gehoeren zu
                        keiner Phase und schraenken die Planung nicht ein. */}
                    {freieTermine.length > 0 && (
                        <div style={{ position: 'relative', height: 20, marginBottom: 2 }}>
                            {freieTermine.map(t => (
                                <div
                                    key={t.termin_id}
                                    title={`${t.typ} · ${kurz(t.datum)}${t.zeit ? ' ' + t.zeit.slice(0, 5) : ''}`}
                                    style={{
                                        position: 'absolute', bottom: 0,
                                        left: `${anteil(t.datum, achsenVon, gesamt) * 100}%`,
                                        transform: 'translateX(-50%)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        zIndex: 2,
                                    }}
                                >
                                    <span style={{ fontSize: 11, lineHeight: 1 }}>📅</span>
                                    <span style={{ width: 1, height: 6, background: '#A09D97' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                        {straenge.map((s, si) => {
                            const farbe = STRANG_FARBEN[si % STRANG_FARBEN.length];
                            return (
                                <div key={s.leistung_id}>
                                    <div style={{ fontSize: 11, color: '#6B6860', marginBottom: 4 }}>
                                        <span style={{ fontFamily: 'monospace', color: farbe, fontWeight: 600 }}>{s.tarifnr}</span>
                                        {' · '}{s.bezeichnung}
                                    </div>
                                    <div style={{ position: 'relative', height: 46 }}>
                                        {/* Phasengebundene Termine liegen in ihrer Phase */}
                                        {(phasenTermine[s.leistung_id] || []).map(t => (
                                            <div
                                                key={t.termin_id}
                                                title={`${t.typ} · ${kurz(t.datum)}${t.zeit ? ' ' + t.zeit.slice(0, 5) : ''}`}
                                                style={{
                                                    position: 'absolute', top: 2, zIndex: 2,
                                                    left: `${anteil(t.datum, achsenVon, gesamt) * 100}%`,
                                                    transform: 'translateX(-50%)',
                                                    fontSize: 10, lineHeight: 1,
                                                }}
                                            >📌</div>
                                        ))}
                                        {/* Griffe auf den Grenzen; die erste Phase
                                            beginnt und die letzte endet mit dem Programm. */}
                                        {bearbeitbar && s.phasen.slice(1).map(p => (
                                            <div
                                                key={'g' + p.instanz_id}
                                                onMouseDown={e => {
                                                    e.stopPropagation();
                                                    setZieht({ instanz_id: p.instanz_id, container: e.currentTarget.parentElement });
                                                }}
                                                title="Grenze verschieben"
                                                style={{
                                                    position: 'absolute', top: 0, bottom: 0, zIndex: 4,
                                                    left: `${anteil(p.start_datum, achsenVon, gesamt) * 100}%`,
                                                    width: 9, marginLeft: -4.5, cursor: 'col-resize',
                                                    background: zieht?.instanz_id === p.instanz_id ? 'rgba(37,99,235,.25)' : 'transparent',
                                                    borderRadius: 3,
                                                }}
                                            />
                                        ))}
                                        {s.phasen.map(p => {
                                            const links = anteil(p.start_datum, achsenVon, gesamt);
                                            const breite = tage(p.start_datum, p.end_datum) / gesamt;
                                            const jetzt = istHeute(p);
                                            return (
                                                <div
                                                    key={p.instanz_id}
                                                    onClick={onPhaseKlick ? () => onPhaseKlick(p.phase_id) : undefined}
                                                    title={`${p.phase_label}: ${kurz(p.start_datum)} – ${kurz(p.end_datum)} (${tage(p.start_datum, p.end_datum)} Tage)`}
                                                    style={{
                                                        position: 'absolute', top: 0, bottom: 0,
                                                        left: `${links * 100}%`,
                                                        width: `calc(${breite * 100}% - 2px)`,
                                                        background: jetzt ? farbe + '2E' : farbe + '14',
                                                        borderLeft: `3px solid ${farbe}`,
                                                        outline: jetzt ? `1px solid ${farbe}` : 'none',
                                                        borderRadius: 4,
                                                        padding: '5px 8px',
                                                        overflow: 'hidden',
                                                        cursor: onPhaseKlick ? 'pointer' : 'default',
                                                        boxSizing: 'border-box',
                                                    }}
                                                >
                                                    <div style={{ fontSize: 11.5, fontWeight: jetzt ? 600 : 500, color: '#1A1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {p.phase_label}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#6B6860', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                        {kurz(p.start_datum)}–{kurz(p.end_datum)}
                                                    </div>
                                                    {Number(p.kriterien_pflicht) > 0 && (
                                                        <div style={{ fontSize: 9.5, color: farbe, whiteSpace: 'nowrap' }}>
                                                            {p.kriterien_pflicht} Pflicht
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Grenzen des Programms, wenn die Achse weiter reicht */}
                    {(heute?.davor || heute?.danach) && (
                        <div style={{
                            position: 'absolute', top: 0, bottom: 30,
                            left: `${anteil(von, achsenVon, gesamt) * 100}%`,
                            width: `${(programmTage / gesamt) * 100}%`,
                            border: '1px dashed rgba(0,0,0,.16)', borderRadius: 4,
                            pointerEvents: 'none', zIndex: 0,
                        }} />
                    )}

                    {/* Datumsachse */}
                    <div style={{ position: 'relative', height: 30, marginTop: 6, borderTop: '1px solid rgba(0,0,0,.09)' }}>
                        {achsenMarken(achsenVon, achsenBis).map((m, i) => (
                            <div key={i} style={{
                                position: 'absolute', top: 0,
                                left: `${anteil(m.datum, achsenVon, gesamt) * 100}%`,
                                fontSize: 9.5, color: '#A09D97', fontFamily: 'monospace',
                                paddingLeft: 3, borderLeft: '1px solid rgba(0,0,0,.12)', height: 12,
                                whiteSpace: 'nowrap',
                            }}>{m.label}</div>
                        ))}
                        <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 9.5, color: '#A09D97', fontFamily: 'monospace' }}>
                            {kurz(bis)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
