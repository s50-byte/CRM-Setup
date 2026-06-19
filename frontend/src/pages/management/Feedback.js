import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

const STATUS_LABELS = {
    offen:         'Offen',
    implementiert: 'Implementiert ✓',
    out_of_scope:  'Out of Scope',
    backlog:       'Backlog',
};

const GRUPPEN = [
    {
        key: 'backlog',
        label: 'Backlog',
        match: s => !s || s === 'offen' || s === 'backlog',
        badgeBg: '#EEF3FE',
        badgeColor: '#1D4ED8',
    },
    {
        key: 'implementiert',
        label: 'Implementiert',
        match: s => s === 'implementiert',
        badgeBg: '#F0FDF4',
        badgeColor: '#15803D',
    },
    {
        key: 'out_of_scope',
        label: 'Out of Scope',
        match: s => s === 'out_of_scope',
        badgeBg: '#FFF7ED',
        badgeColor: '#C2410C',
    },
];

const TH = ({ children }) => (
    <th style={{ textAlign: 'left', padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', background: '#F5F4F0' }}>
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

const ANT_INIT = { open: false, feedback: null, status: 'implementiert', antwort: '', laden: false, fehler: '' };

const inputStyle = {
    width: '100%', fontSize: 13, padding: '7px 10px',
    border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
    background: '#fff', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', color: '#1A1917',
};

export default function Feedback() {
    const [feedbacks, setFeedbacks] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filterBenutzer, setFilterBenutzer] = useState('Alle');
    const [filterScreen, setFilterScreen] = useState('Alle');
    const [aufgeklappt, setAufgeklappt] = useState({ backlog: true, implementiert: true, out_of_scope: false });
    const [antModal, setAntModal] = useState(ANT_INIT);

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
        const header = ['Datum', 'Benutzer', 'E-Mail', 'Screen', 'Notiz', 'Status', 'Antwort'];
        const zeilen = gefiltert.map(f => [
            fmtDatum(f.created_at), f.full_name || '', f.email || '', f.screen || '',
            f.notiz, STATUS_LABELS[f.status || 'offen'] || '', f.antwort || '',
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

    async function handleAntwort() {
        if (!antModal.antwort.trim()) {
            setAntModal(m => ({ ...m, fehler: 'Antwort ist erforderlich.' }));
            return;
        }
        setAntModal(m => ({ ...m, laden: true, fehler: '' }));
        try {
            await client.put(`/feedback/${antModal.feedback.feedback_id}/antwort`, {
                status: antModal.status,
                antwort: antModal.antwort,
            });
            setAntModal(ANT_INIT);
            laden_daten();
        } catch (err) {
            setAntModal(m => ({ ...m, laden: false, fehler: err.response?.data?.error || 'Fehler beim Speichern.' }));
        }
    }

    const selectStyle = {
        fontSize: 12.5, padding: '4px 8px', border: '1px solid rgba(0,0,0,.12)',
        borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#1A1917', cursor: 'pointer',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {GRUPPEN.map(gruppe => {
                        const eintraege = gefiltert
                            .filter(f => gruppe.match(f.status))
                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                        const istOffen = aufgeklappt[gruppe.key];

                        return (
                            <div key={gruppe.key} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                                <div
                                    onClick={() => setAufgeklappt(prev => ({ ...prev, [gruppe.key]: !prev[gruppe.key] }))}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '.75rem 1rem',
                                        cursor: 'pointer', background: istOffen ? '#fff' : '#FAFAF9',
                                        borderBottom: istOffen ? '1px solid rgba(0,0,0,.08)' : 'none',
                                        userSelect: 'none',
                                    }}
                                >
                                    <span style={{ fontSize: 10, color: '#6B6860', fontFamily: 'monospace', lineHeight: 1 }}>
                                        {istOffen ? '▼' : '▶'}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1917' }}>{gruppe.label}</span>
                                    <span style={{
                                        fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                                        background: gruppe.badgeBg, color: gruppe.badgeColor,
                                        minWidth: 22, textAlign: 'center',
                                    }}>
                                        {eintraege.length}
                                    </span>
                                </div>

                                {istOffen && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(0,0,0,.07)' }}>
                                                <TH>Datum</TH>
                                                <TH>Benutzer</TH>
                                                <TH>Screen</TH>
                                                <TH>Feedback</TH>
                                                <TH>Antwort</TH>
                                                <TH />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {eintraege.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#A09D97', fontSize: 12 }}>
                                                        Keine Einträge in dieser Gruppe
                                                    </td>
                                                </tr>
                                            )}
                                            {eintraege.map(f => (
                                                <tr key={f.feedback_id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#6B6860' }}>{fmtDatum(f.created_at)}</td>
                                                    <td style={{ padding: '9px 12px' }}>
                                                        <div style={{ fontWeight: 500, color: '#1A1917' }}>{f.full_name || '—'}</div>
                                                        {f.email && <div style={{ fontSize: 11, color: '#6B6860' }}>{f.email}</div>}
                                                    </td>
                                                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11.5, color: '#1D4ED8' }}>{f.screen || '—'}</td>
                                                    <td style={{ padding: '9px 12px', color: '#1A1917', maxWidth: 280 }}>
                                                        <span title={f.notiz}>{f.notiz.length > 80 ? f.notiz.slice(0, 80) + '…' : f.notiz}</span>
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: '#6B6860', maxWidth: 220, fontSize: 12 }}>
                                                        {f.antwort
                                                            ? <span title={f.antwort}>{f.antwort.length > 60 ? f.antwort.slice(0, 60) + '…' : f.antwort}</span>
                                                            : <span style={{ color: '#A09D97' }}>—</span>
                                                        }
                                                    </td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <button
                                                            onClick={() => setAntModal({
                                                                open: true, feedback: f,
                                                                status: f.status && f.status !== 'offen' ? f.status : 'implementiert',
                                                                antwort: f.antwort || '',
                                                                laden: false, fehler: '',
                                                            })}
                                                            style={{
                                                                padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                                                                border: '1px solid rgba(0,0,0,.12)', borderRadius: 5,
                                                                background: (!f.status || f.status === 'offen') ? '#2563EB' : '#fff',
                                                                color: (!f.status || f.status === 'offen') ? '#fff' : '#1A1917',
                                                                fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            {(!f.status || f.status === 'offen') ? 'Beantworten' : 'Bearbeiten'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Antwort-Modal */}
            {antModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 480, boxShadow: '0 8px 32px rgba(0,0,0,.18)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Feedback beantworten</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
                                    Feedback von {antModal.feedback?.full_name}
                                </label>
                                <div style={{ fontSize: 12.5, padding: '8px 10px', background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, color: '#374151', lineHeight: 1.5 }}>
                                    {antModal.feedback?.notiz}
                                </div>
                                {antModal.feedback?.screen && (
                                    <div style={{ fontSize: 11, color: '#6B6860', marginTop: 3 }}>Screen: <span style={{ fontFamily: 'monospace', color: '#1D4ED8' }}>{antModal.feedback.screen}</span></div>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
                                    Status
                                </label>
                                <select
                                    value={antModal.status}
                                    onChange={e => setAntModal(m => ({ ...m, status: e.target.value }))}
                                    style={{ ...inputStyle, cursor: 'pointer' }}
                                >
                                    <option value="implementiert">Implementiert ✓</option>
                                    <option value="out_of_scope">Out of Scope</option>
                                    <option value="backlog">Backlog</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
                                    Antwort <span style={{ color: '#B91C1C' }}>*</span>
                                </label>
                                <textarea
                                    value={antModal.antwort}
                                    onChange={e => setAntModal(m => ({ ...m, antwort: e.target.value, fehler: '' }))}
                                    placeholder="Antwort an den Feedback-Ersteller…"
                                    rows={4}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>
                        </div>

                        {antModal.fehler && (
                            <div style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid rgba(185,28,28,.15)', borderRadius: 6, padding: '7px 10px', marginTop: 10 }}>
                                {antModal.fehler}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.07)' }}>
                            <button
                                onClick={() => setAntModal(ANT_INIT)}
                                style={{ padding: '7px 16px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleAntwort}
                                disabled={antModal.laden}
                                style={{ padding: '7px 16px', fontSize: 13, cursor: antModal.laden ? 'default' : 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500, opacity: antModal.laden ? .6 : 1 }}
                            >
                                {antModal.laden ? 'Speichern…' : 'Antwort speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
