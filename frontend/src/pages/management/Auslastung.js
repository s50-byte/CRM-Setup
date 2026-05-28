import { useState, useEffect } from 'react';
import client from '../../api/client';

function AuslastungBar({ pct }) {
    const color = pct === null ? '#A09D97' : pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 7, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(pct || 0, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color, width: 36, textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>
                {pct === null ? '—' : `${pct}%`}
            </span>
        </div>
    );
}

const TH = ({ children, right }) => (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
        {children}
    </th>
);

export default function Auslastung() {
    const [data, setData] = useState(null);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState(null);

    useEffect(() => {
        client.get('/management/dashboard')
            .then(r => setData(r.data))
            .catch(e => setFehler(e.response?.data?.error || 'Fehler beim Laden'))
            .finally(() => setLaden(false));
    }, []);

    if (laden) return <div style={{ color: '#6B6860', fontSize: 13, padding: '2rem' }}>Laden…</div>;
    if (fehler) return <div style={{ color: '#B91C1C', fontSize: 13, padding: '2rem' }}>⚠ {fehler}</div>;

    const personen = data.auslastung.pro_person || [];
    const standorte = data.auslastung.pro_standort || [];

    // Gruppieren nach standort_kuerzel
    const grouped = {};
    personen.forEach(p => {
        const key = p.standort_kuerzel || '—';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
    });

    return (
        <div>
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>Auslastung</div>
                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Kapazitätsübersicht aller Mitarbeitenden</div>
            </div>

            {/* Standort-Übersicht */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {standorte.map((s, i) => {
                    const color = s.auslastung_pct === null ? '#6B6860' : s.auslastung_pct >= 80 ? '#16A34A' : s.auslastung_pct >= 60 ? '#D97706' : '#DC2626';
                    return (
                        <div key={i} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '.875rem 1.125rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)', minWidth: 140 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.kuerzel || s.standort_name || '—'}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'monospace' }}>{s.auslastung_pct !== null ? `${s.auslastung_pct}%` : '—'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#6B6860', marginTop: 2 }}>{s.aktive_klienten} / {s.kapazitaet_total} Klienten</div>
                            <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(s.auslastung_pct || 0, 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabelle gruppiert nach Standort */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                        <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                            <TH>Person</TH>
                            <TH>Rollen</TH>
                            <TH right>Klienten</TH>
                            <TH right>Max</TH>
                            <TH>Auslastung</TH>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(grouped).map(([standort, gruppe]) => {
                            const sumAktiv = gruppe.reduce((s, p) => s + p.aktive_klienten, 0);
                            const sumMax = gruppe.reduce((s, p) => s + p.max_klienten, 0);
                            const sumPct = sumMax > 0 ? Math.round(sumAktiv / sumMax * 100) : null;
                            return [
                                // Standort-Header
                                <tr key={`hdr-${standort}`} style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.07)', borderTop: '1px solid rgba(0,0,0,.07)' }}>
                                    <td colSpan={5} style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                        Standort {standort}
                                    </td>
                                </tr>,
                                // Personen
                                ...gruppe.map((p, i) => (
                                    <tr key={`${standort}-${i}`} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                        <td style={{ padding: '9px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF3FE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                                                    {p.avatar_initials || p.full_name?.[0]}
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{p.full_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '9px 12px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {(p.rollen || []).map((r, ri) => (
                                                    <span key={ri} style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 10, background: '#F5F3FF', color: '#5B21B6', border: '1px solid rgba(124,58,237,.12)', fontFamily: 'monospace' }}>{r}</span>
                                                ))}
                                                {(!p.rollen || p.rollen.length === 0) && <span style={{ fontSize: 11, color: '#A09D97' }}>—</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{p.aktive_klienten}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860' }}>{p.max_klienten || '—'}</td>
                                        <td style={{ padding: '9px 12px', minWidth: 180 }}><AuslastungBar pct={p.auslastung_pct} /></td>
                                    </tr>
                                )),
                                // Summenzeile
                                <tr key={`sum-${standort}`} style={{ background: '#FAFAF9', borderBottom: '2px solid rgba(0,0,0,.09)' }}>
                                    <td colSpan={2} style={{ padding: '7px 12px', fontSize: 11.5, fontWeight: 600, color: '#1A1917' }}>Total Standort {standort}</td>
                                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{sumAktiv}</td>
                                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860', fontWeight: 600 }}>{sumMax}</td>
                                    <td style={{ padding: '7px 12px', minWidth: 180 }}><AuslastungBar pct={sumPct} /></td>
                                </tr>,
                            ];
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
