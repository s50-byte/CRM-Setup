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

    const laden_ = useCallback(async () => {
        try {
            const r = await client.get(`/zeitstrahl/${dossierId}`);
            setDaten(r.data);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Zeitstrahl konnte nicht geladen werden');
        } finally { setLaden(false); }
    }, [dossierId]);

    useEffect(() => { laden_(); }, [laden_]);

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
    const gesamt = von && bis ? tage(von, bis) : 0;
    const zeitraumGueltig = Number.isFinite(gesamt) && gesamt >= 1;

    // Liegt heute ausserhalb des Zeitraums, wird die Linie an den Rand geklemmt
    // statt weggelassen: bei einem Programm, das erst beginnt, steht sie links,
    // bei einem abgelaufenen rechts. So bleibt ablesbar, wo man steht.
    const heute = (() => {
        if (!zeitraumGueltig) return null;
        const h = new Date(); h.setHours(0, 0, 0, 0);
        const a = anteil(h, von, gesamt);
        return {
            anteil: Math.min(1, Math.max(0, a)),
            davor: a < 0,
            danach: a > 1,
        };
    })();

    if (!prog) return null;

    return (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', borderRadius: 10, padding: '.875rem 1.25rem', marginBottom: '.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.7rem' }}>
                <div style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Zeitstrahl
                </div>
                {von && bis && (
                    <span style={{ fontSize: 11, color: '#A09D97', fontFamily: 'monospace' }}>
                        {kurz(von)} – {kurz(bis)} · {gesamt} Tage
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
                            position: 'absolute', top: 0, bottom: 18,
                            left: `${heute.anteil * 100}%`,
                            width: 2, marginLeft: -1, zIndex: 3, pointerEvents: 'none',
                            background: heute.davor || heute.danach ? '#DC262655' : '#DC2626',
                        }}>
                            <div style={{
                                position: 'absolute', top: -6,
                                left: heute.anteil > .5 ? 'auto' : -14,
                                right: heute.anteil > .5 ? -14 : 'auto',
                                fontSize: 9, fontWeight: 700, color: '#DC2626',
                                letterSpacing: '.04em', whiteSpace: 'nowrap',
                            }}>
                                {heute.davor ? 'HEUTE ◂' : heute.danach ? '▸ HEUTE' : 'HEUTE'}
                            </div>
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
                                        {s.phasen.map(p => {
                                            const links = anteil(p.start_datum, von, gesamt);
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

                    {/* Datumsachse */}
                    <div style={{ position: 'relative', height: 18, marginTop: 6, borderTop: '1px solid rgba(0,0,0,.09)' }}>
                        {achsenMarken(von, bis).map((m, i) => (
                            <div key={i} style={{
                                position: 'absolute', top: 0,
                                left: `${anteil(m.datum, von, gesamt) * 100}%`,
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
