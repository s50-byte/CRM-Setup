import { useState, useEffect } from 'react';
import client from '../api/client';

export default function Programme() {
    const [programme, setProgramme] = useState([]);
    const [laden, setLaden] = useState(true);

    useEffect(() => {
        client.get('/programme')
            .then(r => setProgramme(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Programme</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Phasen, Muss-Kriterien, Tarife und Aufwand</div>
                </div>
                <button style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neues Programm</button>
            </div>

            {laden ? (
                <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>
            ) : programme.map((p, i) => (
                <div key={i} style={{
                    background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 10, padding: '1rem', marginBottom: '.875rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,.07)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: '.75rem' }}>
                        <div style={{ width: 11, height: 11, borderRadius: 3, background: p.farbe_hex, flexShrink: 0 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.name}</div>
                        <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                            background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                            fontFamily: 'monospace'
                        }}>CHF {p.tarif_pro_tag}/Tag</span>
                        <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                            background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                            fontFamily: 'monospace'
                        }}>Ø {p.avg_dauer_tage}d</span>
                        <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                            background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                            fontFamily: 'monospace'
                        }}>{p.aufwand_h_monat}h/Mt.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(p.phasen || []).map((ph, j) => (
                            <div key={j} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                borderRadius: 6, padding: '4px 9px', fontSize: 11.5
                            }}>
                                <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    background: p.farbe_hex + '22', color: p.farbe_hex,
                                    border: `1.5px solid ${p.farbe_hex}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 700, fontFamily: 'monospace'
                                }}>{j + 1}</div>
                                <span>{ph.label}</span>
                                <span style={{ fontSize: 10, color: '#A09D97' }}>
                                    {ph.kriterien?.length || 0}K
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}