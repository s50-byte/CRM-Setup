import { useState, useEffect } from 'react';
import client from '../api/client';

const ABTEILUNGEN = ['BI IT', 'Admin 1', 'Admin 2', 'Admin 3', 'Logistik', 'Telefonservice', 'Wäscheservice', 'Restwert'];

const STATUS_OPTS = [
    { value: 'anwesend',       label: 'Anwesend',       bg: '#ECFDF5', color: '#15803D' },
    { value: 'krank',          label: 'Krank',           bg: '#FEF2F2', color: '#B91C1C' },
    { value: 'unentschuldigt', label: 'Unentschuldigt',  bg: '#FEF2F2', color: '#B91C1C' },
    { value: 'verspaetet',     label: 'Verspätet',       bg: '#FFFBEB', color: '#B45309' },
    { value: 'schule',         label: 'Schule',          bg: '#EEF3FE', color: '#1D4ED8' },
    { value: 'ferien',         label: 'Ferien',          bg: '#F5F3FF', color: '#5B21B6' },
    { value: 'feiertag',       label: 'Feiertag',        bg: '#F5F4F0', color: '#6B6860' },
    { value: 'unfall',         label: 'Unfall',          bg: '#FEF2F2', color: '#B91C1C' },
];

const LABEL_FARBEN = {
    'LE': { bg: '#EEF3FE', color: '#1D4ED8' },
    'TN': { bg: '#FFFBEB', color: '#B45309' },
    'MA': { bg: '#ECFDF5', color: '#15803D' },
};

function statusOpt(s) {
    return STATUS_OPTS.find(o => o.value === s) || { bg: '#F5F4F0', color: '#6B6860', label: '—' };
}

function fmtDatum(d) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('de-CH');
}

function fmtZeit(ts) {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

const CARD = { background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)' };
const INPUT_S = { fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', cursor: 'pointer' };
const TH_STYLE = { padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em' };

function tabBtn(aktiv) {
    return {
        padding: '7px 18px', fontSize: 13, fontWeight: aktiv ? 600 : 400,
        border: 'none', borderBottom: aktiv ? '2px solid #2563EB' : '2px solid transparent',
        background: 'none', cursor: 'pointer', color: aktiv ? '#2563EB' : '#6B6860',
        fontFamily: 'inherit', marginBottom: -1,
    };
}

export default function Praesenz() {
    const heute = new Date().toISOString().slice(0, 10);
    const [datum, setDatum] = useState(heute);
    const [eintraege, setEintraege] = useState([]);
    const [laden, setLaden] = useState(true);
    const [abteilung, setAbteilung] = useState('');
    const [ferienKlienten, setFerienKlienten] = useState(new Set());
    const [kommentare, setKommentare] = useState({});
    const [aktTab, setAktTab] = useState('tag');

    // Verlauf
    const [vFilter, setVFilter] = useState({ datum_von: '', datum_bis: heute, status: '', abteilung: '' });
    const [verlaufData, setVerlaufData] = useState([]);
    const [verlaufGeladen, setVerlaufGeladen] = useState(false);
    const [verlaufLaden, setVerlaufLaden] = useState(false);

    // Abteilung-Einstellung beim Start NICHT laden — Standard ist immer "Alle"

    // Präsenz + Ferien laden wenn Datum wechselt
    useEffect(() => {
        setLaden(true);
        Promise.all([
            client.get(`/praesenz/${datum}`),
            client.get(`/praesenz/ferien?datum=${datum}`),
        ]).then(([pRes, fRes]) => {
            setEintraege(pRes.data);
            setFerienKlienten(new Set(fRes.data));
            const km = {};
            pRes.data.forEach(e => { km[e.klient_id] = e.kommentar || ''; });
            setKommentare(km);
        }).catch(console.error)
          .finally(() => setLaden(false));
    }, [datum]);

    function handleAbteilungChange(val) {
        setAbteilung(val);
        client.put('/benutzer/einstellung/praesenz_abteilung', { wert: val || null }).catch(console.error);
    }

    async function setStatus(klient_id, status) {
        const kommentar = kommentare[klient_id] || null;
        try {
            await client.post('/praesenz', { klient_id, datum, status, kommentar });
            setEintraege(prev => prev.map(e =>
                e.klient_id === klient_id ? { ...e, status } : e
            ));
        } catch (err) {
            console.error(err);
        }
    }

    async function saveKommentar(klient_id) {
        const eintrag = eintraege.find(e => e.klient_id === klient_id);
        if (!eintrag?.status) return;
        const neu = kommentare[klient_id] || null;
        const alt = eintrag.kommentar || null;
        if (neu === alt) return;
        try {
            await client.post('/praesenz', { klient_id, datum, status: eintrag.status, kommentar: neu });
            setEintraege(prev => prev.map(e =>
                e.klient_id === klient_id ? { ...e, kommentar: neu } : e
            ));
        } catch (err) {
            console.error(err);
        }
    }

    async function abschliessen() {
        try {
            const res = await client.post('/praesenz/abschliessen', { datum });
            const m = res.data.meldungen;
            if (m.length === 0) {
                alert('Präsenzkontrolle abgeschlossen. Keine Meldungen nötig.');
            } else {
                alert(`Meldungen:\n${m.map(x => `${x.nachname} ${x.vorname} (${x.status})`).join('\n')}`);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function ladeVerlauf() {
        setVerlaufLaden(true);
        try {
            const params = new URLSearchParams();
            if (vFilter.datum_von) params.set('datum_von', vFilter.datum_von);
            if (vFilter.datum_bis) params.set('datum_bis', vFilter.datum_bis);
            if (vFilter.status) params.set('status', vFilter.status);
            if (vFilter.abteilung) params.set('abteilung', vFilter.abteilung);
            const r = await client.get(`/praesenz/historie?${params}`);
            setVerlaufData(r.data);
            setVerlaufGeladen(true);
        } catch (err) {
            console.error(err);
        } finally {
            setVerlaufLaden(false);
        }
    }

    function drucken() {
        const rows = verlaufData.map(e =>
            `<tr>
                <td>${fmtDatum(e.datum)}</td>
                <td>${e.nachname} ${e.vorname}</td>
                <td>${statusOpt(e.status).label}</td>
                <td>${e.abteilung || '—'}</td>
                <td>${e.programm_name || '—'}</td>
                <td>${e.kommentar || '—'}</td>
            </tr>`
        ).join('');
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>Präsenz-Verlauf</title>
            <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
            h2{font-size:14px;margin-bottom:4px}p{font-size:10px;color:#888;margin-bottom:12px}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
            th{background:#f0f0f0;font-weight:600;font-size:10px}</style>
            </head><body>
            <h2>Präsenz-Verlauf</h2>
            <p>Exportiert am ${new Date().toLocaleDateString('de-CH')}</p>
            <table><thead><tr>
                <th>Datum</th><th>Klient</th><th>Status</th><th>Abteilung</th><th>Programm</th><th>Kommentar</th>
            </tr></thead><tbody>${rows}</tbody></table>
            </body></html>`);
        win.document.close();
        win.print();
    }

    // Klient anzeigen wenn: kein Filter aktiv ODER Dossier hat keine Abteilung ODER Abteilung passt
    const gefiltert = eintraege.filter(e => !abteilung || !e.abteilung || e.abteilung === abteilung);
    const anwesend  = gefiltert.filter(e => e.status === 'anwesend').length;
    const abwesend  = gefiltert.filter(e => e.status && e.status !== 'anwesend' && e.status !== 'verspaetet').length;
    const verspaetet = gefiltert.filter(e => e.status === 'verspaetet').length;
    const offen     = gefiltert.filter(e => !e.status).length;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Präsenzkontrolle</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                        {new Date(datum + 'T12:00:00').toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <select value={abteilung} onChange={e => handleAbteilungChange(e.target.value)} style={INPUT_S}>
                        <option value="">Alle Abteilungen</option>
                        {ABTEILUNGEN.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={INPUT_S} />
                    <button onClick={abschliessen} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                        fontFamily: 'inherit'
                    }}>Abschliessen</button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                    { label: 'Anwesend',  wert: anwesend,    farbe: '#16A34A' },
                    { label: 'Abwesend',  wert: abwesend,    farbe: '#DC2626' },
                    { label: 'Verspätet', wert: verspaetet,  farbe: '#D97706' },
                    { label: 'Offen',     wert: offen,       farbe: '#2563EB' },
                ].map((k, i) => (
                    <div key={i} style={{ ...CARD, padding: '.875rem' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 21, fontWeight: 600, color: k.farbe }}>{k.wert}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid rgba(0,0,0,.09)', marginBottom: '1rem' }}>
                <button style={tabBtn(aktTab === 'tag')} onClick={() => setAktTab('tag')}>Heutiger Tag</button>
                <button style={tabBtn(aktTab === 'verlauf')} onClick={() => {
                    setAktTab('verlauf');
                    if (!verlaufGeladen) ladeVerlauf();
                }}>Verlauf</button>
            </div>

            {/* === Tab: Heutiger Tag === */}
            {aktTab === 'tag' && (
                <div style={{ ...CARD, overflow: 'hidden' }}>
                    {/* Tabellenkopf */}
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                        <div style={{ ...TH_STYLE, borderRight: '1px solid rgba(0,0,0,.09)' }}>Klient/in</div>
                        <div style={TH_STYLE}>Status · Kommentar</div>
                    </div>

                    {laden ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Laden…</div>
                    ) : gefiltert.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Keine Klienten</div>
                    ) : gefiltert.map(e => {
                        const hatFerien = ferienKlienten.has(e.klient_id);
                        const labelFarbe = e.klient_label ? (LABEL_FARBEN[e.klient_label] || { bg: '#F5F4F0', color: '#6B6860' }) : null;
                        const zeitstempel = fmtZeit(e.updated_at);
                        return (
                            <div key={e.klient_id} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', background: hatFerien ? '#F0FDF4' : '#fff' }}>
                                {/* Linke Spalte: Name + Badges */}
                                <div style={{
                                    borderRight: '1px solid rgba(0,0,0,.09)',
                                    borderBottom: '1px solid rgba(0,0,0,.05)',
                                    padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8
                                }}>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: 6,
                                        background: '#EEF3FE', color: '#1D4ED8',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9, fontWeight: 600, flexShrink: 0, marginTop: 1
                                    }}>
                                        {(e.nachname?.[0] || '') + (e.vorname?.[0] || '')}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.nachname} {e.vorname}</div>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                                            {e.programm_name && (
                                                <span style={{
                                                    fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 500,
                                                    background: e.farbe_hex ? e.farbe_hex + '22' : '#EEF3FE',
                                                    color: e.farbe_hex || '#1D4ED8',
                                                    border: `1px solid ${e.farbe_hex ? e.farbe_hex + '44' : 'rgba(29,78,216,.15)'}`,
                                                    maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>{e.programm_name}</span>
                                            )}
                                            {e.klient_label && labelFarbe && (
                                                <span style={{
                                                    fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                                                    background: labelFarbe.bg, color: labelFarbe.color,
                                                }}>{e.klient_label}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Rechte Spalte: Status-Buttons + Kommentar */}
                                <div style={{
                                    borderBottom: '1px solid rgba(0,0,0,.05)',
                                    padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 5
                                }}>
                                    {/* Status-Buttons + Ferien-Indikator */}
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {STATUS_OPTS.map(o => (
                                            <button key={o.value} onClick={() => setStatus(e.klient_id, o.value)} style={{
                                                fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 12,
                                                cursor: 'pointer', fontFamily: 'inherit',
                                                background: e.status === o.value ? o.bg : '#F5F4F0',
                                                color: e.status === o.value ? o.color : '#6B6860',
                                                border: e.status === o.value ? `1px solid ${o.color}33` : '1px solid rgba(0,0,0,.09)'
                                            }}>
                                                {e.status === o.value && o.value === 'anwesend' ? '✓ ' : ''}{o.label}
                                            </button>
                                        ))}
                                        {hatFerien && (
                                            <span style={{
                                                fontSize: 10.5, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                                                background: '#DCFCE7', color: '#15803D',
                                                border: '1px solid rgba(22,163,74,.2)'
                                            }}>Ferien geplant</span>
                                        )}
                                    </div>

                                    {/* Kommentar + Zeitstempel */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <input
                                            type="text"
                                            value={kommentare[e.klient_id] ?? ''}
                                            onChange={ev => setKommentare(prev => ({ ...prev, [e.klient_id]: ev.target.value }))}
                                            onBlur={() => saveKommentar(e.klient_id)}
                                            placeholder={e.status ? 'Kommentar…' : 'Status zuerst setzen'}
                                            disabled={!e.status}
                                            style={{
                                                fontSize: 11, padding: '2px 7px', borderRadius: 4, width: 200,
                                                border: '1px solid rgba(0,0,0,.09)', background: e.status ? '#F5F4F0' : '#FAFAFA',
                                                fontFamily: 'inherit', color: '#1A1917', outline: 'none'
                                            }}
                                        />
                                        {zeitstempel && (
                                            <span style={{ fontSize: 10, color: '#A09D97' }}>zuletzt {zeitstempel}</span>
                                        )}
                                        {(e.zugewiesen || []).length > 0 && (
                                            <span style={{ fontSize: 10.5, color: '#A09D97', marginLeft: 'auto' }}>
                                                {e.zugewiesen.map(u => u.full_name).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* === Tab: Verlauf === */}
            {aktTab === 'verlauf' && (
                <div>
                    {/* Filter-Leiste */}
                    <div style={{ ...CARD, padding: '.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.05em' }}>Filter</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <label style={{ fontSize: 11.5, color: '#6B6860' }}>Von</label>
                            <input type="date" value={vFilter.datum_von} onChange={e => setVFilter(p => ({ ...p, datum_von: e.target.value }))} style={INPUT_S} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <label style={{ fontSize: 11.5, color: '#6B6860' }}>Bis</label>
                            <input type="date" value={vFilter.datum_bis} onChange={e => setVFilter(p => ({ ...p, datum_bis: e.target.value }))} style={INPUT_S} />
                        </div>
                        <select value={vFilter.status} onChange={e => setVFilter(p => ({ ...p, status: e.target.value }))} style={INPUT_S}>
                            <option value="">Alle Status</option>
                            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select value={vFilter.abteilung} onChange={e => setVFilter(p => ({ ...p, abteilung: e.target.value }))} style={INPUT_S}>
                            <option value="">Alle Abteilungen</option>
                            {ABTEILUNGEN.map(a => <option key={a}>{a}</option>)}
                        </select>
                        <button onClick={ladeVerlauf} style={{
                            padding: '5px 14px', fontSize: 12.5, fontWeight: 500, border: 'none',
                            borderRadius: 6, background: '#2563EB', color: '#fff', cursor: 'pointer', fontFamily: 'inherit'
                        }}>{verlaufLaden ? 'Laden…' : 'Laden'}</button>
                        {verlaufGeladen && verlaufData.length > 0 && (
                            <button onClick={drucken} style={{
                                padding: '5px 12px', fontSize: 12.5, border: '1px solid rgba(0,0,0,.09)',
                                borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#1A1917'
                            }}>Drucken / Export</button>
                        )}
                        {verlaufGeladen && (
                            <span style={{ fontSize: 11.5, color: '#A09D97', marginLeft: 'auto' }}>
                                {verlaufData.length} Einträge
                            </span>
                        )}
                    </div>

                    {/* Tabelle */}
                    {!verlaufGeladen ? (
                        <div style={{ ...CARD, padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>
                            Filter wählen und auf «Laden» klicken
                        </div>
                    ) : verlaufLaden ? (
                        <div style={{ ...CARD, padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Laden…</div>
                    ) : verlaufData.length === 0 ? (
                        <div style={{ ...CARD, padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Keine Einträge</div>
                    ) : (
                        <div style={{ ...CARD, overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#F5F4F0' }}>
                                        {['Datum', 'Klient', 'Status', 'Abteilung', 'Programm', 'Kommentar'].map(h => (
                                            <th key={h} style={{ ...TH_STYLE, borderBottom: '1px solid rgba(0,0,0,.09)', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {verlaufData.map((e, i) => {
                                        const s = statusOpt(e.status);
                                        return (
                                            <tr key={e.eintrag_id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{fmtDatum(e.datum)}</td>
                                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>{e.nachname} {e.vorname}</td>
                                                <td style={{ padding: '7px 12px' }}>
                                                    <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, background: s.bg, color: s.color, fontWeight: 500 }}>{s.label}</span>
                                                </td>
                                                <td style={{ padding: '7px 12px', color: '#6B6860' }}>{e.abteilung || '—'}</td>
                                                <td style={{ padding: '7px 12px', color: '#6B6860', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.programm_name || '—'}</td>
                                                <td style={{ padding: '7px 12px', color: '#6B6860', maxWidth: 200 }}>{e.kommentar || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
