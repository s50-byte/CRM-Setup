import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

const TH = ({ children, right }) => (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', background: '#F5F4F0' }}>
        {children}
    </th>
);

function fmtDatum(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString('de-CH') + ' ' + dt.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function Feedback() {
    const [feedbacks, setFeedbacks] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filterBenutzer, setFilterBenutzer] = useState('Alle');
    const [filterScreen, setFilterScreen] = useState('Alle');

    const laden_daten = useCallback(async () => {
        setLaden(true);
        try {
            const r = await client.get('/feedback');
            setFeedbacks(r.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLaden(false);
        }
    }, []);

    useEffect(() => { laden_daten(); }, [laden_daten]);

    const benutzerListe = [...new Set(feedbacks.map(f => f.full_name).filter(Boolean))].sort();
    const screenListe = [...new Set(feedbacks.map(f => f.screen).filter(Boolean))].sort();

    const gefiltert = feedbacks.filter(f => {
        const benutzer_ok = filterBenutzer === 'Alle' || f.full_name === filterBenutzer;
        const screen_ok = filterScreen === 'Alle' || f.screen === filterScreen;
        return benutzer_ok && screen_ok;
    });

    function exportCsv() {
        const header = ['Datum', 'Benutzer', 'E-Mail', 'Screen', 'Notiz'];
        const zeilen = gefiltert.map(f => [
            fmtDatum(f.created_at), f.full_name || '', f.email || '', f.screen || '', f.notiz,
        ]);
        const csv = [header, ...zeilen].map(row => row.map(csvEscape).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedback_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const selectStyle = {
        fontSize: 12.5, padding: '4px 8px', border: '1px solid rgba(0,0,0,.12)',
        borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#1A1917', cursor: 'pointer'
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>Feedback</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                        {gefiltert.length} von {feedbacks.length} Feedback-Einträgen
                    </div>
                </div>
                <button onClick={exportCsv} disabled={gefiltert.length === 0} style={{
                    padding: '7px 16px', fontSize: 13, fontWeight: 500,
                    cursor: gefiltert.length === 0 ? 'default' : 'pointer',
                    border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                    fontFamily: 'inherit', opacity: gefiltert.length === 0 ? .6 : 1,
                }}>⤓ CSV exportieren</button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Benutzer</label>
                    <select value={filterBenutzer} onChange={e => setFilterBenutzer(e.target.value)} style={selectStyle}>
                        <option value="Alle">Alle</option>
                        {benutzerListe.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Screen</label>
                    <select value={filterScreen} onChange={e => setFilterScreen(e.target.value)} style={selectStyle}>
                        <option value="Alle">Alle</option>
                        {screenListe.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {laden ? (
                <div style={{ color: '#6B6860', fontSize: 13, padding: '2rem' }}>Laden…</div>
            ) : (
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                                <TH>Datum/Zeit</TH>
                                <TH>Benutzer</TH>
                                <TH>Screen</TH>
                                <TH>Notiz</TH>
                            </tr>
                        </thead>
                        <tbody>
                            {gefiltert.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#A09D97', fontSize: 12 }}>
                                        Keine Feedback-Einträge gefunden
                                    </td>
                                </tr>
                            )}
                            {gefiltert.map(f => (
                                <tr key={f.feedback_id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#6B6860' }}>{fmtDatum(f.created_at)}</td>
                                    <td style={{ padding: '9px 12px' }}>
                                        <div style={{ fontWeight: 500, color: '#1A1917' }}>{f.full_name || '—'}</div>
                                        {f.email && <div style={{ fontSize: 11, color: '#6B6860' }}>{f.email}</div>}
                                    </td>
                                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11.5, color: '#1D4ED8' }}>{f.screen || '—'}</td>
                                    <td style={{ padding: '9px 12px', color: '#1A1917', maxWidth: 420 }}>{f.notiz}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
