import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const FARBEN = {
    'IV-Massnahme': '#2563EB', 'Ausbildung': '#16A34A', 'Beratung': '#7C3AED',
    'Abklärung': '#EA580C', 'Gez. Vorbereitung': '#D97706'
};

const PHASE_STYLE = {
    'Erstkontakt':   { bg: '#EEF3FE', color: '#1D4ED8' },
    'In Abklärung':  { bg: '#FFFBEB', color: '#B45309' },
    'Erstgespräch':  { bg: '#F5F3FF', color: '#5B21B6' },
    'Schnupper':     { bg: '#FFF7ED', color: '#9A3412' },
    'Programmstart': { bg: '#ECFDF5', color: '#15803D' },
};

export default function Dossiers() {
    const [dossiers, setDossiers] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filterTyp, setFilterTyp] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [suche, setSuche] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        client.get('/dossiers')
            .then(r => setDossiers(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const gefiltert = dossiers.filter(d => {
        const name = `${d.nachname} ${d.vorname}`.toLowerCase();
        return (
            (!suche || name.includes(suche.toLowerCase())) &&
            (!filterTyp || d.programm_name === filterTyp) &&
            (!filterPhase || d.pipeline_status === filterPhase)
        );
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Falldossiers</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Alle Klientinnen und Klienten — eine Akte pro Klient</div>
                </div>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1.1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <input type="text" value={suche} onChange={e => setSuche(e.target.value)}
                    placeholder="Name suchen…"
                    style={{
                        fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                        borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit',
                        height: 28, width: 140, outline: 'none'
                    }}
                />
                <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Typen</option>
                    {Object.keys(FARBEN).map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Phasen</option>
                    {Object.keys(PHASE_STYLE).map(p => <option key={p}>{p}</option>)}
                </select>
                {(suche || filterTyp || filterPhase) && (
                    <button onClick={() => { setSuche(''); setFilterTyp(''); setFilterPhase(''); }} style={{
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
                            {['Name', 'Programm', 'Phase', 'Verlauf', 'Start', 'Ende', 'CM / JC', 'Tasks', ''].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {laden ? (
                            <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Laden…</td></tr>
                        ) : gefiltert.length === 0 ? (
                            <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Keine Dossiers</td></tr>
                        ) : gefiltert.map((d, i) => {
                            const farbe = FARBEN[d.programm_name] || '#888';
                            const ps = PHASE_STYLE[d.pipeline_status] || { bg: '#F5F4F0', color: '#6B6860' };
                            const verlauf = d.programm_verlauf || [];
                            return (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}
                                    onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                    onMouseOut={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{d.nachname} {d.vorname}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {d.programm_name ? (
                                            <span style={{
                                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                background: farbe + '22', color: farbe,
                                                border: `1px solid ${farbe}33`, fontWeight: 500
                                            }}>{d.programm_name}</span>
                                        ) : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span style={{
                                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                            background: ps.bg, color: ps.color,
                                            border: `1px solid ${ps.color}33`, fontFamily: 'monospace'
                                        }}>{d.phase_label || d.pipeline_status}</span>
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {verlauf.length > 1 ? (
                                            <span style={{
                                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                background: '#EEF3FE', color: '#1D4ED8',
                                                border: '1px solid rgba(37,99,235,.15)', fontFamily: 'monospace'
                                            }}>{verlauf.length} Programme</span>
                                        ) : '1 Programm'}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>
                                        {d.eingang_datum ? new Date(d.eingang_datum).toLocaleDateString('de-CH') : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>—</td>
                                    <td style={{ padding: '8px 12px', fontSize: 11.5 }}>
                                        {(d.zugewiesen || []).map(u => u.full_name).join(', ') || '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {d.offene_tasks > 0 ? (
                                            <span style={{
                                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                background: '#FFFBEB', color: '#B45309',
                                                border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace'
                                            }}>{d.offene_tasks}</span>
                                        ) : (
                                            <span style={{
                                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                background: '#ECFDF5', color: '#15803D',
                                                border: '1px solid rgba(22,163,74,.15)', fontFamily: 'monospace'
                                            }}>0</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <button onClick={() => navigate(`/dossiers/${d.dossier_id}`)} style={{
                                            padding: '3px 9px', fontSize: 11.5, cursor: 'pointer',
                                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                            background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                                        }}>Öffnen →</button>
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