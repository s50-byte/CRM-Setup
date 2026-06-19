import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import NeuerTerminModal from '../components/NeuerTerminModal';

const STATUS_STYLE = {
    'Ausstehend': { bg: '#FFFBEB', color: '#B45309', border: 'rgba(217,119,6,.15)' },
    'Bestätigt':  { bg: '#ECFDF5', color: '#15803D', border: 'rgba(22,163,74,.15)' },
    'Geplant':    { bg: '#EEF3FE', color: '#1D4ED8', border: 'rgba(37,99,235,.15)' },
    'Abgesagt':   { bg: '#FEF2F2', color: '#B91C1C', border: 'rgba(220,38,38,.15)' },
};

function sortData(arr, field, dir) {
    if (!field) return arr;
    return [...arr].sort((a, b) => {
        const va = a[field] ?? '';
        const vb = b[field] ?? '';
        const cmp = typeof va === 'number' && typeof vb === 'number'
            ? va - vb : String(va).localeCompare(String(vb), 'de');
        return dir === 'asc' ? cmp : -cmp;
    });
}

export default function Termine() {
    const navigate = useNavigate();
    const [termine, setTermine] = useState([]);
    const [laden, setLaden] = useState(true);
    const [terminModal, setTerminModal] = useState(false);
    const [detailTermin, setDetailTermin] = useState(null);
    const [filter, setFilter] = useState('');
    const [sortField, setSortField] = useState('datum');
    const [sortDir, setSortDir] = useState('asc');

    useEffect(() => {
        client.get('/termine')
            .then(r => setTermine(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const handleSort = field => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const si = f => !f ? '' : sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    async function absagenTermin(termin_id) {
        try {
            const r = await client.put(`/termine/${termin_id}/absagen`);
            setDetailTermin(r.data);
            client.get('/termine').then(res => setTermine(res.data));
        } catch (err) { console.error(err); }
    }

    const gefiltert = sortData(
        termine.filter(t => !filter || t.typ === filter),
        sortField, sortDir
    );

    const COLS = [
        { label: 'Datum',    field: 'datum' },
        { label: 'Zeit',     field: 'zeit' },
        { label: 'Typ',      field: 'typ' },
        { label: 'Klient/in',field: 'nachname' },
        { label: 'Teilnehmende Personen', field: null },
        { label: 'Status',   field: 'status' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Termine</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Erstgespräche, Schnuppereinsätze, Standortgespräche</div>
                </div>
                <button onClick={() => setTerminModal(true)} style={{
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
                            {COLS.map((c, i) => (
                                <th key={i} onClick={() => c.field && handleSort(c.field)} style={{
                                    textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600,
                                    color: (c.field && sortField === c.field) ? '#2563EB' : '#6B6860',
                                    textTransform: 'uppercase', letterSpacing: '.06em',
                                    whiteSpace: 'nowrap', cursor: c.field ? 'pointer' : 'default', userSelect: 'none'
                                }}>{c.label}{si(c.field)}</th>
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
                                <tr key={i}
                                    onClick={() => setDetailTermin(t)}
                                    style={{ borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}
                                    onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                    onMouseOut={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>
                                        {new Date(t.datum).toLocaleDateString('de-CH')}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>{t.zeit ? t.zeit.slice(0, 5) : 'Ganztag'}</td>
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
            {detailTermin && (
                <div onClick={() => setDetailTermin(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#fff', borderRadius: 12, padding: '1.5rem',
                        width: 480, maxWidth: '90vw',
                        boxShadow: '0 8px 32px rgba(0,0,0,.18)',
                        maxHeight: '85vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1917' }}>{detailTermin.typ}</div>
                                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 3, fontFamily: 'monospace' }}>
                                    {new Date(detailTermin.datum).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    {detailTermin.zeit ? ` · ${detailTermin.zeit.slice(0, 5)} Uhr` : ''}
                                </div>
                            </div>
                            {detailTermin.status && (() => {
                                const s = STATUS_STYLE[detailTermin.status] || STATUS_STYLE['Ausstehend'];
                                return (
                                    <span style={{
                                        fontSize: 11, padding: '3px 9px', borderRadius: 20,
                                        background: s.bg, color: s.color,
                                        border: `1px solid ${s.border}`, fontFamily: 'monospace'
                                    }}>{detailTermin.status}</span>
                                );
                            })()}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Klient/in</div>
                                <button
                                    onClick={() => { setDetailTermin(null); navigate(`/klienten/${detailTermin.klient_id}`); }}
                                    style={{
                                        fontSize: 13, fontWeight: 500, color: '#2563EB', cursor: 'pointer',
                                        border: 'none', background: 'none', padding: 0, fontFamily: 'inherit',
                                        textDecoration: 'underline', textDecorationColor: 'rgba(37,99,235,.3)'
                                    }}
                                >
                                    {detailTermin.vorname} {detailTermin.nachname}
                                </button>
                            </div>

                            {detailTermin.personen && detailTermin.personen.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Teilnehmende Personen</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {detailTermin.personen.map((p, i) => (
                                            <span key={i} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                fontSize: 12, padding: '3px 9px 3px 5px',
                                                borderRadius: 20, background: '#F5F4F0',
                                                border: '1px solid rgba(0,0,0,.09)'
                                            }}>
                                                <div style={{
                                                    width: 18, height: 18, borderRadius: 5,
                                                    background: '#E5E7EB', color: '#374151',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 8, fontWeight: 700
                                                }}>{p.avatar_initials || p.full_name?.[0] || '?'}</div>
                                                {p.full_name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {detailTermin.notiz && (
                                <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Notiz</div>
                                    <div style={{
                                        fontSize: 13, padding: '10px 12px',
                                        background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                        borderRadius: 7, color: '#1A1917', lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap'
                                    }}>{detailTermin.notiz}</div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(0,0,0,.07)' }}>
                            {detailTermin.status !== 'Abgesagt' && (
                                <button onClick={() => absagenTermin(detailTermin.termin_id)} style={{
                                    padding: '7px 18px', fontSize: 13, cursor: 'pointer',
                                    border: '1px solid rgba(220,38,38,.2)', borderRadius: 6,
                                    background: '#FEF2F2', fontFamily: 'inherit', color: '#B91C1C', fontWeight: 500,
                                    marginRight: 'auto'
                                }}>Absagen</button>
                            )}
                            <button onClick={() => setDetailTermin(null)} style={{
                                padding: '7px 18px', fontSize: 13, cursor: 'pointer',
                                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                                background: '#fff', fontFamily: 'inherit', color: '#1A1917', fontWeight: 500
                            }}>Schliessen</button>
                        </div>
                    </div>
                </div>
            )}

            <NeuerTerminModal
                open={terminModal}
                onClose={() => setTerminModal(false)}
                onSaved={() => {
                    setTerminModal(false);
                    client.get('/termine').then(r => setTermine(r.data));
                }}
            />
        </div>
    );
}
