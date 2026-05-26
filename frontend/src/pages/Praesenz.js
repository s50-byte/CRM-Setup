import { useState, useEffect } from 'react';
import client from '../api/client';

const STATUS_OPTS = [
    { value: 'anwesend',      label: 'Anwesend',       bg: '#ECFDF5', color: '#15803D' },
    { value: 'krank',         label: 'Krankheit',       bg: '#FEF2F2', color: '#B91C1C' },
    { value: 'unentschuldigt',label: 'Unentschuldigt',  bg: '#FEF2F2', color: '#B91C1C' },
    { value: 'verspaetet',    label: 'Verspätet',       bg: '#FFFBEB', color: '#B45309' },
    { value: 'schule',        label: 'Schule',          bg: '#EEF3FE', color: '#1D4ED8' },
    { value: 'ferien',        label: 'Ferien',          bg: '#F5F3FF', color: '#5B21B6' },
    { value: 'feiertag',      label: 'Feiertag',        bg: '#F5F4F0', color: '#6B6860' },
    { value: 'unfall',        label: 'Unfall',          bg: '#FEF2F2', color: '#B91C1C' },
];

function statusStyle(s) {
    return STATUS_OPTS.find(o => o.value === s) || { bg: '#F5F4F0', color: '#6B6860', label: '—' };
}

export default function Praesenz() {
    const heute = new Date().toISOString().slice(0, 10);
    const [datum, setDatum] = useState(heute);
    const [eintraege, setEintraege] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filterProg, setFilterProg] = useState('');

    useEffect(() => {
        setLaden(true);
        client.get(`/praesenz/${datum}`)
            .then(r => setEintraege(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [datum]);

    async function setStatus(klient_id, status) {
        try {
            await client.post('/praesenz', { klient_id, datum, status });
            setEintraege(prev => prev.map(e =>
                e.klient_id === klient_id ? { ...e, status } : e
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
                alert(`Meldungen gesendet:\n${m.map(x => `${x.nachname} ${x.vorname} (${x.status})`).join('\n')}`);
            }
        } catch (err) {
            console.error(err);
        }
    }

    const gefiltert = eintraege.filter(e => !filterProg || e.programm_name === filterProg);
    const anwesend = eintraege.filter(e => e.status === 'anwesend').length;
    const abwesend = eintraege.filter(e => e.status && e.status !== 'anwesend' && e.status !== 'verspaetet').length;
    const verspaetet = eintraege.filter(e => e.status === 'verspaetet').length;
    const offen = eintraege.filter(e => !e.status).length;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Präsenzkontrolle</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                        {new Date(datum).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                        style={{
                            fontSize: 13, padding: '6px 10px', border: '1px solid rgba(0,0,0,.09)',
                            borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit'
                        }}
                    />
                    <button onClick={abschliessen} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>Abschliessen & Meldungen senden</button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1rem' }}>
                {[
                    { label: 'Anwesend',  wert: anwesend,   farbe: '#16A34A' },
                    { label: 'Abwesend',  wert: abwesend,   farbe: '#DC2626' },
                    { label: 'Verspätet', wert: verspaetet, farbe: '#D97706' },
                    { label: 'Offen',     wert: offen,      farbe: '#2563EB' },
                ].map((k, i) => (
                    <div key={i} style={{
                        background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                        borderRadius: 10, padding: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
                    }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 21, fontWeight: 600, color: k.farbe }}>{k.wert}</div>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <select value={filterProg} onChange={e => setFilterProg(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Programme</option>
                    <option>IV-Massnahme</option>
                    <option>Erstmalige berufliche Ausbildung</option>
                    <option>Beratung & Coaching</option>
                    <option>Erstmalige berufliche Abklärung</option>
                    <option>Gezielte Vorbereitung</option>
                </select>
            </div>

            {/* Klassenbuch */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr' }}>
                    <div style={{ background: '#F5F4F0', borderRight: '1px solid rgba(0,0,0,.09)', borderBottom: '1px solid rgba(0,0,0,.09)', padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Klient/in
                    </div>
                    <div style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)', padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Status · Programm · Zuständige Person
                    </div>
                </div>

                {laden ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Laden…</div>
                ) : gefiltert.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Keine Klienten</div>
                ) : gefiltert.map((e, i) => {
                    const s = statusStyle(e.status);
                    return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '210px 1fr' }}>
                            <div style={{
                                borderRight: '1px solid rgba(0,0,0,.09)',
                                borderBottom: '1px solid rgba(0,0,0,.05)',
                                padding: '8px 12px', background: '#fff',
                                display: 'flex', alignItems: 'center', gap: 7
                            }}>
                                <div style={{
                                    width: 22, height: 22, borderRadius: 5,
                                    background: '#EEF3FE', color: '#1D4ED8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 8, fontWeight: 600, flexShrink: 0
                                }}>
                                    {(e.nachname?.[0] || '') + (e.vorname?.[0] || '')}
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>{e.nachname} {e.vorname}</div>
                                    <div style={{ fontSize: 10, color: '#6B6860' }}>{e.programm_name}</div>
                                </div>
                            </div>
                            <div style={{
                                borderBottom: '1px solid rgba(0,0,0,.05)',
                                padding: '6px 8px', background: '#fff',
                                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'
                            }}>
                                <button onClick={() => setStatus(e.klient_id, 'anwesend')} style={{
                                    fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 12,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    background: e.status === 'anwesend' ? '#ECFDF5' : '#F5F4F0',
                                    color: e.status === 'anwesend' ? '#15803D' : '#6B6860',
                                    border: e.status === 'anwesend' ? '1px solid rgba(22,163,74,.2)' : '1px solid rgba(0,0,0,.09)'
                                }}>✓ Anwesend</button>

                                {STATUS_OPTS.filter(o => o.value !== 'anwesend').map(o => (
                                    <button key={o.value} onClick={() => setStatus(e.klient_id, o.value)} style={{
                                        fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 12,
                                        cursor: 'pointer', fontFamily: 'inherit',
                                        background: e.status === o.value ? o.bg : '#F5F4F0',
                                        color: e.status === o.value ? o.color : '#6B6860',
                                        border: e.status === o.value ? `1px solid ${o.color}33` : '1px solid rgba(0,0,0,.09)'
                                    }}>{o.label}</button>
                                ))}

                                <span style={{ fontSize: 10.5, color: '#A09D97', marginLeft: 'auto' }}>
                                    {(e.zugewiesen || []).map(u => u.full_name).join(', ')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}