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
    const gesamt = von && bis ? tage(von, bis) : 0;

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

            {straenge.length === 0 ? (
                <div style={{ fontSize: 12, color: '#A09D97' }}>
                    Noch keine Phasen verteilt.{bearbeitbar ? ' Über „Erzeugen" aus der Verfügung anlegen.' : ''}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {straenge.map((s, si) => {
                        const farbe = STRANG_FARBEN[si % STRANG_FARBEN.length];
                        return (
                            <div key={s.leistung_id}>
                                <div style={{ fontSize: 11, color: '#6B6860', marginBottom: 4 }}>
                                    <span style={{ fontFamily: 'monospace', color: farbe, fontWeight: 600 }}>{s.tarifnr}</span>
                                    {' · '}{s.bezeichnung}
                                </div>
                                <div style={{ display: 'flex', gap: 2, height: 42 }}>
                                    {s.phasen.map(p => {
                                        const anteil = gesamt > 0 ? tage(p.start_datum, p.end_datum) / gesamt : 0;
                                        return (
                                            <div
                                                key={p.instanz_id}
                                                onClick={onPhaseKlick ? () => onPhaseKlick(p.phase_id) : undefined}
                                                title={`${p.phase_label}: ${kurz(p.start_datum)} – ${kurz(p.end_datum)} (${tage(p.start_datum, p.end_datum)} Tage)`}
                                                style={{
                                                    flex: `${Math.max(anteil, 0.04)} 0 0`,
                                                    background: farbe + '18',
                                                    borderLeft: `3px solid ${farbe}`,
                                                    borderRadius: 4,
                                                    padding: '5px 8px',
                                                    overflow: 'hidden',
                                                    cursor: onPhaseKlick ? 'pointer' : 'default',
                                                    minWidth: 0,
                                                }}
                                            >
                                                <div style={{ fontSize: 11.5, fontWeight: 500, color: '#1A1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {p.phase_label}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#6B6860', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    {kurz(p.start_datum)}–{kurz(p.end_datum)}
                                                </div>
                                                {Number(p.kriterien_pflicht) > 0 && (
                                                    <div style={{ fontSize: 9.5, color: farbe }}>
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
            )}
        </div>
    );
}
