import { useState, useEffect } from 'react';
import client from '../api/client';

const STATUS_STYLE = {
    'Ausstehend': { bg: '#FFFBEB', color: '#B45309', border: 'rgba(217,119,6,.15)' },
    'Bestätigt':  { bg: '#ECFDF5', color: '#15803D', border: 'rgba(22,163,74,.15)' },
    'Geplant':    { bg: '#EEF3FE', color: '#1D4ED8', border: 'rgba(37,99,235,.15)' },
    'Abgesagt':   { bg: '#FEF2F2', color: '#B91C1C', border: 'rgba(220,38,38,.15)' },
};

export default function Termine() {
    const [termine, setTermine] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        client.get('/termine')
            .then(r => setTermine(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const gefiltert = termine.filter(t =>
        !filter || t.typ === filter
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Termine</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Erstgespräche, Schnuppereinsätze, Standortgespräche</div>
                </div>
                <button style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neuer Termin</button>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1.1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <select value={filter} onChange={e => setFilter(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Typen</option>
                    <option>Erstgespräch</option>
                    <option>Schnuppereinsatz</option>
                    <option>Standortgespräch</option>
                    <option>Programmstart</option>
                    <option>Abschlussgespräch</option>
                </select>
                {filter && (
                    <button onClick={() => setFilter('')} style={{
                        height: 28, padding: '0 9px', fontSize: 12, cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: 'transparent', color: '#6B6860', fontFamily: 'inherit'
                    }}>× Reset</button>
                )}
            </div>

            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                        <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                            {['Datum', 'Zeit', 'Typ', 'Klient/in', 'Personen', 'Status'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {laden ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Laden…</td></tr>
                        ) : gefiltert.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Keine Termine</td></tr>
                        ) : gefiltert.map((t, i) => {
                            const s = STATUS_STYLE[t.status] || STATUS_STYLE['Ausstehend'];
                            return (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}
                                    onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                    onMouseOut={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>
                                        {new Date(t.datum).toLocaleDateString('de-CH')}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>{t.zeit || 'Ganztag'}</td>
                                    <td style={{ padding: '8px 12px' }}>{t.typ}</td>
                                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{t.vorname} {t.nachname}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {(t.personen || []).map((p, j) => (
                                            <span key={j} style={{
                                                display: 'inline-block', fontSize: 10.5, padding: '2px 7px',
                                                borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                                marginRight: 3
                                            }}>{p.full_name}</span>
                                        ))}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span style={{
                                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                            background: s.bg, color: s.color,
                                            border: `1px solid ${s.border}`, fontFamily: 'monospace'
                                        }}>{t.status}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}