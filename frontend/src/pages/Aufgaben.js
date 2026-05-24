import { useState, useEffect } from 'react';
import client from '../api/client';

const PRIO_STYLE = {
    'Hoch':    { bg: '#FEF2F2', color: '#B91C1C', border: 'rgba(220,38,38,.15)' },
    'Mittel':  { bg: '#FFFBEB', color: '#B45309', border: 'rgba(217,119,6,.15)' },
    'Niedrig': { bg: '#F5F4F0', color: '#6B6860', border: 'rgba(0,0,0,.09)' },
};

export default function Aufgaben() {
    const [tasks, setTasks] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filterStatus, setFilterStatus] = useState('Offen');
    const [filterPrio, setFilterPrio] = useState('');

    useEffect(() => {
        client.get('/tasks')
            .then(r => setTasks(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    async function toggleErledigt(id) {
        try {
            const res = await client.put(`/tasks/${id}/erledigt`);
            setTasks(prev => prev.map(t => t.task_id === id ? res.data : t));
        } catch (err) {
            console.error(err);
        }
    }

    const gefiltert = tasks.filter(t => {
        if (filterStatus === 'Offen' && t.erledigt) return false;
        if (filterStatus === 'Erledigt' && !t.erledigt) return false;
        if (filterPrio && t.prioritaet !== filterPrio) return false;
        return true;
    });

    return (
        <div>
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 19, fontWeight: 600 }}>Aufgaben</div>
                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Alle offenen und erledigten Tasks</div>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1.1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle</option>
                    <option>Offen</option>
                    <option>Erledigt</option>
                </select>
                <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Prioritäten</option>
                    <option>Hoch</option>
                    <option>Mittel</option>
                    <option>Niedrig</option>
                </select>
            </div>

            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                        <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                            {['', 'Aufgabe', 'Klient/in', 'Phase', 'Fällig', 'Priorität', 'Status'].map((h, i) => (
                                <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {laden ? (
                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Laden…</td></tr>
                        ) : gefiltert.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Keine Aufgaben</td></tr>
                        ) : gefiltert.map((t, i) => {
                            const p = PRIO_STYLE[t.prioritaet] || PRIO_STYLE['Niedrig'];
                            return (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', opacity: t.erledigt ? .6 : 1 }}
                                    onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                    onMouseOut={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '8px 12px' }}>
                                        <div
                                            onClick={() => toggleErledigt(t.task_id)}
                                            style={{
                                                width: 15, height: 15, borderRadius: 4, cursor: 'pointer',
                                                border: t.erledigt ? 'none' : '1.5px solid rgba(0,0,0,.09)',
                                                background: t.erledigt ? '#16A34A' : '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontSize: 9
                                            }}
                                        >{t.erledigt ? '✓' : ''}</div>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontWeight: 500, textDecoration: t.erledigt ? 'line-through' : 'none', color: t.erledigt ? '#6B6860' : '#1A1917' }}>{t.text}</td>
                                    <td style={{ padding: '8px 12px' }}>{t.vorname} {t.nachname}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {t.phase_label && (
                                            <span style={{
                                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                                fontFamily: 'monospace'
                                            }}>{t.phase_label}</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>
                                        {t.faellig_am ? new Date(t.faellig_am).toLocaleDateString('de-CH') : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span style={{
                                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                            background: p.bg, color: p.color,
                                            border: `1px solid ${p.border}`, fontFamily: 'monospace'
                                        }}>{t.prioritaet}</span>
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {t.erledigt
                                            ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#ECFDF5', color: '#15803D', border: '1px solid rgba(22,163,74,.15)', fontFamily: 'monospace' }}>Erledigt</span>
                                            : <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#FFFBEB', color: '#B45309', border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace' }}>Offen</span>
                                        }
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