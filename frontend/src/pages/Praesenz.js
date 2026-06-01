import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    { value: 'absenz',         label: 'Absenz',          bg: '#FFF7ED', color: '#C2410C' },
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
    return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('de-CH');
}

function fmtZeit(ts) {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function expandVerlaufTageweise(data, von, bis) {
    if (!von || !bis) return data;
    const vonDate = new Date(von + 'T12:00:00');
    const bisDate = new Date(bis + 'T12:00:00');
    if (isNaN(vonDate) || isNaN(bisDate) || vonDate > bisDate) return data;

    const klientenMap = new Map();
    const entryMap = new Map();
    data.forEach(e => {
        if (!klientenMap.has(e.klient_id)) {
            klientenMap.set(e.klient_id, {
                klient_id: e.klient_id, nachname: e.nachname, vorname: e.vorname,
                programm_name: e.programm_name, abteilung: e.abteilung,
            });
        }
        if (e.datum) {
            entryMap.set(`${e.klient_id}_${String(e.datum).slice(0, 10)}`, e);
        }
    });

    const klienten = [...klientenMap.values()].sort((a, b) =>
        (a.nachname || '').localeCompare(b.nachname || ''));
    const result = [];
    for (let d = new Date(bisDate); d >= vonDate; d.setDate(d.getDate() - 1)) {
        const datumStr = d.toISOString().slice(0, 10);
        for (const k of klienten) {
            result.push(
                entryMap.get(`${k.klient_id}_${datumStr}`) ||
                { ...k, datum: datumStr, status: null, eintrag_id: null, kommentar: null, historie: [] }
            );
        }
    }
    return result;
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
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const heute = new Date().toISOString().slice(0, 10);
    const [datum, setDatum] = useState(heute);
    const [eintraege, setEintraege] = useState([]);
    const [laden, setLaden] = useState(true);
    const [selAbteilung, setSelAbteilung] = useState('');
    const [selStandort, setSelStandort] = useState('');
    const [alleStandorte, setAlleStandorte] = useState([]);
    const [kommentare, setKommentare] = useState({});
    const [aktTab, setAktTab] = useState('tag');

    // Stand-Popup
    const [standPopup, setStandPopup] = useState(false);
    const [standMeldungen, setStandMeldungen] = useState([]);
    const [standLaden, setStandLaden] = useState(false);

    // Verlauf
    const [vDatum, setVDatum] = useState(heute);
    const [vFilter, setVFilter] = useState({ datum_von: '', datum_bis: heute, status: '', abteilung: '' });
    const [vKlientId, setVKlientId] = useState('');
    const [verlaufData, setVerlaufData] = useState([]);
    const [verlaufGeladen, setVerlaufGeladen] = useState(false);
    const [verlaufLaden, setVerlaufLaden] = useState(false);

    // Standorte + gespeicherte Filter laden
    useEffect(() => {
        Promise.all([
            client.get('/standorte'),
            client.get('/benutzer/einstellung/praesenz_filter'),
        ]).then(([stRes, filterRes]) => {
            setAlleStandorte(stRes.data);
            try {
                const f = filterRes.data.wert ? JSON.parse(filterRes.data.wert) : {};
                if (f.abteilung) setSelAbteilung(f.abteilung);
                if (f.standort) setSelStandort(f.standort);
            } catch(e) {}
        }).catch(console.error);
    }, []);

    // Präsenz laden wenn Datum wechselt
    useEffect(() => {
        setLaden(true);
        client.get(`/praesenz/${datum}`)
            .then(r => {
                setEintraege(r.data);
                const km = {};
                r.data.forEach(e => { km[e.klient_id] = e.kommentar || ''; });
                setKommentare(km);
            }).catch(console.error)
              .finally(() => setLaden(false));
    }, [datum]);

    function speichereFilter(abt, st) {
        client.put('/benutzer/einstellung/praesenz_filter', {
            wert: JSON.stringify({ abteilung: abt, standort: st })
        }).catch(console.error);
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

    async function zeigeMeldungenStand() {
        setStandPopup(true);
        setStandLaden(true);
        setStandMeldungen([]);
        try {
            const r = await client.get(`/meldungen/alle?datum=${datum}`);
            setStandMeldungen(r.data);
        } catch (err) {
            console.error(err);
        } finally {
            setStandLaden(false);
        }
    }

    async function ladeVerlauf(opts = {}) {
        setVerlaufLaden(true);
        try {
            const kid = 'klient_id' in opts ? opts.klient_id : vKlientId;
            const params = new URLSearchParams();
            if (kid) {
                const von = opts.datum_von ?? vFilter.datum_von;
                const bis = opts.datum_bis ?? vFilter.datum_bis;
                if (von) params.set('datum_von', von);
                if (bis) params.set('datum_bis', bis);
                params.set('klient_id', String(kid));
            } else {
                const d = opts.datum ?? vDatum;
                params.set('datum_von', d);
                params.set('datum_bis', d);
                const ab = opts.abteilung ?? vFilter.abteilung;
                if (ab) params.set('abteilung', ab);
            }
            const r = await client.get(`/praesenz/historie?${params}`);
            setVerlaufData(r.data);
            setVerlaufGeladen(true);
        } catch (err) {
            console.error(err);
        } finally {
            setVerlaufLaden(false);
        }
    }

    function navDatum(delta) {
        const d = new Date(vDatum + 'T12:00:00');
        d.setDate(d.getDate() + delta);
        const neu = d.toISOString().slice(0, 10);
        setVDatum(neu);
        ladeVerlauf({ datum: neu });
    }

    function handleKlientChange(kid) {
        setVKlientId(kid);
        if (kid) {
            const von7 = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();
            const newVon = vFilter.datum_von || von7;
            const newBis = vFilter.datum_bis || heute;
            setVFilter(p => ({ ...p, datum_von: newVon, datum_bis: newBis }));
            ladeVerlauf({ klient_id: kid, datum_von: newVon, datum_bis: newBis });
        } else {
            ladeVerlauf({ datum: vDatum, klient_id: '' });
        }
    }

    // URL-Params: klient_id + ansicht=verlauf + tage=N → direkt Verlauf laden
    useEffect(() => {
        const ansicht = searchParams.get('ansicht');
        const klientId = searchParams.get('klient_id');
        const tage = parseInt(searchParams.get('tage') || '0', 10);
        if (ansicht !== 'verlauf') return;
        setAktTab('verlauf');
        if (klientId) {
            const von = tage > 0 ? (() => {
                const d = new Date(); d.setDate(d.getDate() - tage);
                return d.toISOString().slice(0, 10);
            })() : '';
            setVKlientId(klientId);
            setVFilter(p => ({ ...p, datum_von: von, datum_bis: heute }));
            ladeVerlauf({ klient_id: klientId, datum_von: von, datum_bis: heute });
        } else {
            ladeVerlauf({ datum: heute });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function drucken() {
        const rows = verlaufAngezeigt.map(e =>
            `<tr>
                <td>${e.datum ? fmtDatum(e.datum) : '—'}</td>
                <td>${e.nachname} ${e.vorname}</td>
                <td>${e.status ? statusOpt(e.status).label : 'Anwesend'}</td>
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

    const gefiltert = eintraege.filter(k =>
        (!selAbteilung || k.abteilung === selAbteilung) &&
        (!selStandort || String(k.standort_id) === selStandort)
    );
    const gefiltertNormal = gefiltert.filter(k => !k.hat_ferien);
    const gefiltertFerien  = gefiltert.filter(k => k.hat_ferien);
    console.log('[debug] eintraege:', eintraege.length, '| gefiltert:', gefiltert.length, '| ferien:', gefiltertFerien.length, '| laden:', laden, '| selAbteilung:', selAbteilung, '| selStandort:', selStandort);
    console.log('[debug] ferienKlienten:', gefiltertFerien);
    console.log('[debug] ferien in eintraege (alle):', eintraege.filter(k => k.hat_ferien));

    const verlaufKlienten = [...new Map(verlaufData.map(e => [e.klient_id, e])).values()]
        .sort((a, b) => (a.nachname || '').localeCompare(b.nachname || ''));
    const expandVon = vKlientId ? vFilter.datum_von : vDatum;
    const expandBis = vKlientId ? vFilter.datum_bis : vDatum;
    const verlaufExpanded = expandVerlaufTageweise(verlaufData, expandVon, expandBis);
    const verlaufAngezeigt = verlaufExpanded.filter(e => {
        if (!vFilter.status) return true;
        if (vFilter.status === 'nicht_erfasst') return !e.status;
        return e.status === vFilter.status;
    });
    const anwesend  = gefiltertNormal.filter(e => e.status === 'anwesend').length;
    const abwesend  = gefiltertNormal.filter(e => e.status && e.status !== 'anwesend' && e.status !== 'verspaetet').length;
    const verspaetet = gefiltertNormal.filter(e => e.status === 'verspaetet').length;
    const offen     = gefiltertNormal.filter(e => !e.status).length;

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
                    <select value={selAbteilung} onChange={e => { setSelAbteilung(e.target.value); speichereFilter(e.target.value, selStandort); }} style={INPUT_S}>
                        <option value="">Alle Abteilungen</option>
                        {ABTEILUNGEN.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {alleStandorte.length > 0 && (
                        <select value={selStandort} onChange={e => { setSelStandort(e.target.value); speichereFilter(selAbteilung, e.target.value); }} style={INPUT_S}>
                            <option value="">Alle Standorte</option>
                            {alleStandorte.map(s => <option key={s.standort_id} value={String(s.standort_id)}>{s.name}</option>)}
                        </select>
                    )}
                    <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={INPUT_S} />
                    <button onClick={zeigeMeldungenStand} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                        fontFamily: 'inherit', whiteSpace: 'nowrap'
                    }}>Meldungen senden & Stand anzeigen</button>
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
                <div>
                    {/* Tabelle 1: Anwesend / Kontrolle */}
                    <div style={{ ...CARD, overflow: 'hidden', marginBottom: gefiltertFerien.length > 0 ? '1rem' : 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                            <div style={{ ...TH_STYLE, borderRight: '1px solid rgba(0,0,0,.09)' }}>Anwesend / Kontrolle</div>
                            <div style={TH_STYLE}>Status · Kommentar</div>
                        </div>
                        {laden ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Laden…</div>
                        ) : gefiltertNormal.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Keine Klienten</div>
                        ) : gefiltertNormal.map(e => {
                            const zeitstempel = fmtZeit(e.updated_at);
                            const selectVal = e.status || 'anwesend';
                            const selectOpt = statusOpt(selectVal);
                            return (
                                <div key={e.klient_id} style={{ display: 'grid', gridTemplateColumns: '220px 1fr' }}>
                                    <div style={{ borderRight: '1px solid rgba(0,0,0,.09)', borderBottom: '1px solid rgba(0,0,0,.05)', padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 6, background: '#EEF3FE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
                                            {(e.nachname?.[0] || '') + (e.vorname?.[0] || '')}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div onClick={() => e.dossier_id && navigate('/dossiers/' + e.dossier_id)} style={{ fontSize: 12.5, fontWeight: 600, cursor: e.dossier_id ? 'pointer' : 'default', color: e.dossier_id ? '#2563EB' : '#1A1917' }}>
                                                {e.nachname} {e.vorname}
                                            </div>
                                            {e.programm_name && (
                                                <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 500, background: e.farbe_hex ? e.farbe_hex + '22' : '#EEF3FE', color: e.farbe_hex || '#1D4ED8', border: `1px solid ${e.farbe_hex ? e.farbe_hex + '44' : 'rgba(29,78,216,.15)'}`, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.programm_name}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ borderBottom: '1px solid rgba(0,0,0,.05)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <select value={selectVal} onChange={ev => setStatus(e.klient_id, ev.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${e.status ? selectOpt.color + '44' : 'rgba(0,0,0,.09)'}`, background: e.status ? selectOpt.bg : '#F5F4F0', color: e.status ? selectOpt.color : '#6B6860', fontFamily: 'inherit', fontWeight: 500, outline: 'none', flexShrink: 0 }}>
                                            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        <input type="text" value={kommentare[e.klient_id] ?? ''} onChange={ev => setKommentare(prev => ({ ...prev, [e.klient_id]: ev.target.value }))} onBlur={() => saveKommentar(e.klient_id)} placeholder={e.status ? 'Kommentar…' : ''} disabled={!e.status} style={{ fontSize: 11, padding: '3px 7px', borderRadius: 4, flex: 1, maxWidth: 300, border: '1px solid rgba(0,0,0,.09)', background: e.status ? '#F5F4F0' : 'transparent', fontFamily: 'inherit', color: '#1A1917', outline: 'none' }} />
                                        {zeitstempel && <span style={{ fontSize: 10, color: '#A09D97', flexShrink: 0 }}>zuletzt {zeitstempel}</span>}
                                        {(e.zugewiesen || []).length > 0 && (
                                            <span style={{ fontSize: 10.5, color: '#A09D97', marginLeft: 'auto', flexShrink: 0 }}>
                                                {e.zugewiesen.map(u => u.full_name).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tabelle 2: Geplant abwesend */}
                    {!laden && gefiltertFerien.length > 0 && (
                        <div style={{ ...CARD, overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', background: '#DCFCE7', borderBottom: '1px solid rgba(22,163,74,.2)' }}>
                                <div style={{ ...TH_STYLE, color: '#15803D', borderRight: '1px solid rgba(22,163,74,.2)' }}>Geplant abwesend ({gefiltertFerien.length})</div>
                                <div style={{ ...TH_STYLE, color: '#15803D' }}>Programm · Ferien-Zeitraum</div>
                            </div>
                            {gefiltertFerien.map(e => (
                                <div key={e.klient_id} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', background: '#F0FDF4' }}>
                                    <div style={{ borderRight: '1px solid rgba(22,163,74,.15)', borderBottom: '1px solid rgba(22,163,74,.1)', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 6, background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
                                            {(e.nachname?.[0] || '') + (e.vorname?.[0] || '')}
                                        </div>
                                        <div onClick={() => e.dossier_id && navigate('/dossiers/' + e.dossier_id)} style={{ fontSize: 12.5, fontWeight: 600, cursor: e.dossier_id ? 'pointer' : 'default', color: e.dossier_id ? '#2563EB' : '#1A1917' }}>
                                            {e.nachname} {e.vorname}
                                        </div>
                                    </div>
                                    <div style={{ borderBottom: '1px solid rgba(22,163,74,.1)', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {e.programm_name && (
                                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 500, background: e.farbe_hex ? e.farbe_hex + '22' : '#EEF3FE', color: e.farbe_hex || '#1D4ED8', border: `1px solid ${e.farbe_hex ? e.farbe_hex + '44' : 'rgba(29,78,216,.15)'}`, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{e.programm_name}</span>
                                        )}
                                        {e.ferien_von && (
                                            <span style={{ fontSize: 12, color: '#15803D', fontWeight: 500 }}>
                                                {fmtDatum(e.ferien_von)} – {fmtDatum(e.ferien_bis)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* === Tab: Verlauf === */}
            {aktTab === 'verlauf' && (
                <div>
                    {/* Filter-Leiste */}
                    <div style={{ ...CARD, padding: '.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.05em' }}>Filter</span>
                        {vKlientId ? (
                            <>
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
                                    <option value="nicht_erfasst">Nicht erfasst</option>
                                </select>
                                {(() => {
                                    const k = verlaufKlienten.find(k => String(k.klient_id) === vKlientId);
                                    return k ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: '#EEF3FE', border: '1px solid rgba(37,99,235,.2)', fontSize: 12, color: '#1D4ED8', fontWeight: 500 }}>
                                            {k.nachname} {k.vorname}
                                            <button onClick={() => handleKlientChange('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1D4ED8', padding: 0, fontSize: 14, lineHeight: 1, marginLeft: 2 }}>×</button>
                                        </div>
                                    ) : null;
                                })()}
                                <button onClick={() => ladeVerlauf()} style={{
                                    padding: '5px 14px', fontSize: 12.5, fontWeight: 500, border: 'none',
                                    borderRadius: 6, background: '#2563EB', color: '#fff', cursor: 'pointer', fontFamily: 'inherit'
                                }}>{verlaufLaden ? 'Laden…' : 'Laden'}</button>
                            </>
                        ) : (
                            <>
                                <select value={vFilter.abteilung} onChange={e => setVFilter(p => ({ ...p, abteilung: e.target.value }))} style={INPUT_S}>
                                    <option value="">Alle Abteilungen</option>
                                    {ABTEILUNGEN.map(a => <option key={a}>{a}</option>)}
                                </select>
                                <select value={vFilter.status} onChange={e => setVFilter(p => ({ ...p, status: e.target.value }))} style={INPUT_S}>
                                    <option value="">Alle Status</option>
                                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    <option value="nicht_erfasst">Nicht erfasst</option>
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <button onClick={() => navDatum(-1)} style={{ ...INPUT_S, padding: '4px 10px', fontWeight: 600, fontSize: 14, lineHeight: 1 }}>←</button>
                                    <span style={{ fontSize: 12.5, fontWeight: 500, minWidth: 90, textAlign: 'center', padding: '0 4px' }}>
                                        {new Date(vDatum + 'T12:00:00').toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => navDatum(1)} style={{ ...INPUT_S, padding: '4px 10px', fontWeight: 600, fontSize: 14, lineHeight: 1 }}>→</button>
                                </div>
                                {verlaufGeladen && verlaufKlienten.length > 0 && (
                                    <select value={vKlientId} onChange={e => handleKlientChange(e.target.value)} style={INPUT_S}>
                                        <option value="">Alle Klienten</option>
                                        {verlaufKlienten.map(k => (
                                            <option key={k.klient_id} value={String(k.klient_id)}>{k.nachname} {k.vorname}</option>
                                        ))}
                                    </select>
                                )}
                            </>
                        )}
                        {verlaufGeladen && verlaufData.length > 0 && (
                            <button onClick={drucken} style={{
                                padding: '5px 12px', fontSize: 12.5, border: '1px solid rgba(0,0,0,.09)',
                                borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#1A1917'
                            }}>Drucken / Export</button>
                        )}
                        {verlaufGeladen && (
                            <span style={{ fontSize: 11.5, color: '#A09D97', marginLeft: 'auto' }}>
                                {verlaufAngezeigt.length} Einträge
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
                    ) : verlaufAngezeigt.length === 0 ? (
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
                                    {verlaufAngezeigt.map((e, i) => {
                                        const s = statusOpt(e.status);
                                        return (
                                            <tr key={e.eintrag_id || e.klient_id + '_' + i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{e.datum ? fmtDatum(e.datum) : '—'}</td>
                                                <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>{e.nachname} {e.vorname}</td>
                                                <td style={{ padding: '7px 12px' }}>
                                                    {e.status
                                                        ? <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, background: s.bg, color: s.color, fontWeight: 500 }}>{s.label}</span>
                                                        : <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, background: '#ECFDF5', color: '#15803D', fontWeight: 500 }}>Anwesend</span>
                                                    }
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
            {/* Stand-Popup */}
            {standPopup && (() => {
            const gruppen = {};
            standMeldungen.forEach(m => {
                const key = m.empfaenger_id || '_';
                if (!gruppen[key]) gruppen[key] = { name: m.empfaenger_name || 'Unbekannt', meldungen: [] };
                gruppen[key].meldungen.push(m);
            });

            return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 580, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 600 }}>Meldungen</div>
                                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>{fmtDatum(datum)}</div>
                            </div>
                            <button onClick={() => setStandPopup(false)} style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', color: '#6B6860' }}>✕</button>
                        </div>

                        {standLaden ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>
                        ) : Object.keys(gruppen).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B6860', fontSize: 13 }}>Keine Meldungen für diesen Tag</div>
                        ) : Object.values(gruppen).map((gruppe, gi) => (
                            <div key={gi} style={{ marginBottom: '1.25rem' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{gruppe.name}</div>
                                {gruppe.meldungen.map((m, mi) => (
                                    (m.aenderungen || []).map((a, ai) => {
                                        const sl = s => STATUS_OPTS.find(o => o.value === s)?.label || '—';
                                        const art = a.art || (a.alter_status === null ? 'ersterfassung' : a.alter_status === a.neuer_status ? 'kommentar' : 'status');
                                        return (
                                            <div key={`${mi}-${ai}`} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                                padding: '7px 10px', marginBottom: 4, borderRadius: 7,
                                                background: '#F5F4F0', gap: 10
                                            }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{a.name}</span>
                                                    <span style={{ fontSize: 12, color: '#6B6860' }}>
                                                        {art === 'ersterfassung' && <span> · <strong style={{ color: '#1A1917' }}>{sl(a.neuer_status)}</strong> erfasst</span>}
                                                        {art === 'status'        && <span> · {sl(a.alter_status)} → <strong style={{ color: '#1A1917' }}>{sl(a.neuer_status)}</strong></span>}
                                                        {art === 'kommentar'     && <span> · Status unverändert ({sl(a.neuer_status)})</span>}
                                                        {a.kommentar && <span> | {a.kommentar}</span>}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: 11, flexShrink: 0, padding: '2px 7px', borderRadius: 8, fontWeight: 500,
                                                    background: m.acknowledged ? '#DCFCE7' : '#FEF3C7',
                                                    color: m.acknowledged ? '#15803D' : '#B45309' }}>
                                                    {m.acknowledged ? '✓ gelesen' : 'ausstehend'}
                                                </span>
                                            </div>
                                        );
                                    })
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            );
        })()}
        </div>
    );
}
