import { useState, useEffect } from 'react';
import client from '../api/client';

export default function Klienten({ meine }) {
    const [klienten, setKlienten] = useState([]);
    const [laden, setLaden] = useState(true);
    const [suche, setSuche] = useState('');

    useEffect(() => {
        client.get('/klienten')
            .then(r => setKlienten(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const gefiltert = klienten.filter(k =>
        `${k.nachname} ${k.vorname}`.toLowerCase().includes(suche.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>{meine ? 'Meine Klienten' : 'Klienten'}</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Stammdaten aller Klientinnen und Klienten</div>
                </div>
                <button style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neuer Klient</button>
            </div>

            {/* Filterbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                marginBottom: '1.1rem', background: '#fff',
                border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Suche</span>
                <input
                    type="text" value={suche} onChange={e => setSuche(e.target.value)}
                    placeholder="Name suchen…"
                    style={{
                        fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                        borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit',
                        height: 28, width: 180, outline: 'none'
                    }}
                />
            </div>

            {/* Tabelle */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                        <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                            {['Nachname', 'Vorname', 'Geburtsdatum', 'Telefon', 'E-Mail', 'Auftraggeber', 'Programm', 'AHV-Nr.'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {laden ? (
                            <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Laden…</td></tr>
                        ) : gefiltert.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Keine Klienten gefunden</td></tr>
                        ) : gefiltert.map((k, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}
                                onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                onMouseOut={e => e.currentTarget.style.background = ''}>
                                <td style={{ padding: '8px 12px', fontWeight: 500, color: '#2563EB' }}>{k.nachname}</td>
                                <td style={{ padding: '8px 12px' }}>{k.vorname}</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>
                                    {k.geburtsdatum ? new Date(k.geburtsdatum).toLocaleDateString('de-CH') : '—'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>{k.telefon || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#2563EB' }}>{k.email || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>{k.auftraggeber || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                    {k.programm_name ? (
                                        <span style={{
                                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                            background: k.farbe_hex + '22', color: k.farbe_hex,
                                            border: `1px solid ${k.farbe_hex}33`, fontWeight: 500
                                        }}>{k.programm_name}</span>
                                    ) : '—'}
                                </td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{k.ahv_nummer || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}