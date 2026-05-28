import { useState, useEffect } from 'react';
import client from '../../api/client';

const CHF = v => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(v);

function AuslastungBar({ pct }) {
    const color = pct === null ? '#A09D97' : pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626';
    const display = pct === null ? '—' : `${pct}%`;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(pct || 0, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color, width: 32, textAlign: 'right', fontFamily: 'monospace' }}>{display}</span>
        </div>
    );
}

export default function ManagementDashboard() {
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

    const avgAuslastung = (() => {
        const mit = (data.auslastung.pro_person || []).filter(p => p.auslastung_pct !== null);
        if (!mit.length) return null;
        return Math.round(mit.reduce((s, p) => s + p.auslastung_pct, 0) / mit.length);
    })();
    const avgColor = avgAuslastung === null ? '#6B6860' : avgAuslastung >= 80 ? '#16A34A' : avgAuslastung >= 60 ? '#D97706' : '#DC2626';

    const maxProgrammCount = Math.max(...(data.klienten.pro_programm || []).map(p => parseInt(p.count)), 1);

    const topPersonen = [...(data.auslastung.pro_person || [])]
        .filter(p => p.max_klienten > 0)
        .sort((a, b) => (b.auslastung_pct || 0) - (a.auslastung_pct || 0))
        .slice(0, 8);

    return (
        <div>
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>Management Dashboard</div>
                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                    {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
            </div>

            {/* KPI Zeile */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                    { label: 'Aktive Klienten', wert: data.klienten.total, farbe: '#1A1917', suffix: '' },
                    { label: 'YTD Umsatz', wert: CHF(data.finanzen.umsatz_ytd), farbe: '#2563EB', raw: true },
                    { label: 'Forecast Jahresende', wert: CHF(data.finanzen.umsatz_forecast_jahresende), farbe: '#7C3AED', raw: true },
                    { label: 'Ø Auslastung', wert: avgAuslastung !== null ? `${avgAuslastung}%` : '—', farbe: avgColor, raw: true },
                ].map((k, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 21, fontWeight: 600, color: k.farbe, fontFamily: k.raw ? 'monospace' : 'inherit' }}>{k.wert}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Klienten pro Programm */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.875rem' }}>Klienten pro Programm</div>
                    {(data.klienten.pro_programm || []).map((p, i) => (
                        <div key={i} style={{ marginBottom: 9 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                                <span style={{ fontWeight: 500 }}>{p.programm_name || '—'}</span>
                                <span style={{ fontFamily: 'monospace', color: '#6B6860' }}>{p.count}</span>
                            </div>
                            <div style={{ height: 7, background: '#F5F4F0', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${(parseInt(p.count) / maxProgrammCount) * 100}%`, height: '100%', background: p.farbe_hex || '#2563EB', borderRadius: 4, transition: 'width .3s' }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Klienten pro Standort */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.875rem' }}>Klienten pro Standort</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(data.klienten.pro_standort || []).map((s, i) => (
                            <div key={i} style={{ background: '#EEF3FE', border: '1px solid rgba(37,99,235,.12)', borderRadius: 8, padding: '10px 14px', minWidth: 80 }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>{s.count}</div>
                                <div style={{ fontSize: 11, color: '#1D4ED8', marginTop: 2 }}>{s.kuerzel || s.standort_name || '—'}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Pipeline-Status</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(data.klienten.pipeline_counts || []).map((s, i) => (
                                <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>
                                    {s.pipeline_status} <strong>{s.count}</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Auslastung */}
            {topPersonen.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Auslastung Mitarbeitende
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                            <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                                {['Person', 'Standort', 'Klienten', 'Max', 'Auslastung'].map((h, i) => (
                                    <th key={i} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {topPersonen.map((p, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#EEF3FE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                                                {p.avatar_initials || p.full_name?.[0]}
                                            </div>
                                            {p.full_name}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 12px', color: '#6B6860', fontSize: 12 }}>{p.standort_kuerzel || '—'}</td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.aktive_klienten}</td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#6B6860' }}>{p.max_klienten}</td>
                                    <td style={{ padding: '8px 12px', minWidth: 160 }}><AuslastungBar pct={p.auslastung_pct} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
