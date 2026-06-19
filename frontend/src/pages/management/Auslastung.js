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

const ROLLEN_FILTER = ['Alle', 'Klientenführung', 'Job Coach', 'Fachperson'];

function freiFarbe(frei) {
    return frei < 0 ? '#B91C1C' : frei === 0 ? '#D97706' : '#15803D';
}

function freiBg(frei) {
    return frei < 0 ? '#FEF2F2' : frei === 0 ? '#FFFBEB' : '#ECFDF5';
}

export default function Auslastung() {
    const [data, setData] = useState(null);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState(null);
    const [aktiveTab, setAktiveTab] = useState('person');
    const [filterRolle, setFilterRolle] = useState('Alle');
    const [filterStandort, setFilterStandort] = useState('Alle');
    const [lehrplaetze, setLehrplaetze] = useState([]);
    const [lehrplaetzeLaden, setLehrplaetzeLaden] = useState(true);
    const [lehrplaetzeFehler, setLehrplaetzeFehler] = useState(null);
    const [gruppierung, setGruppierung] = useState('beruf');

    useEffect(() => {
        client.get('/management/dashboard')
            .then(r => setData(r.data))
            .catch(e => setFehler(e.response?.data?.error || 'Fehler beim Laden'))
            .finally(() => setLaden(false));
        client.get('/management/lehrplaetze')
            .then(r => setLehrplaetze(r.data))
            .catch(e => setLehrplaetzeFehler(e.response?.data?.error || 'Fehler beim Laden'))
            .finally(() => setLehrplaetzeLaden(false));
    }, []);

    if (laden) return <div style={{ color: '#6B6860', fontSize: 13, padding: '2rem' }}>Laden…</div>;
    if (fehler) return <div style={{ color: '#B91C1C', fontSize: 13, padding: '2rem' }}>⚠ {fehler}</div>;

    const personen = data.auslastung.pro_person || [];
    const standorte = data.auslastung.pro_standort || [];
    const proRolle = data.auslastung.pro_rolle || [];

    // Alle Standorte aus den Daten extrahieren
    const alleStandorte = ['Alle', ...Array.from(new Set(
        proRolle.filter(r => r.standort_kuerzel).map(r => r.standort_kuerzel)
    )).sort()];

    // Gefilterte Rollendaten
    const gefilterteRollen = proRolle.filter(r => {
        const rolleOk = filterRolle === 'Alle' || r.rolle_name === filterRolle;
        const standortOk = filterStandort === 'Alle'
            ? r.standort_kuerzel === null  // ohne Filter: nur Gesamtzeilen
            : r.standort_kuerzel === filterStandort;
        return rolleOk && standortOk;
    });

    // Wenn ein Standort gewählt ist, zeige auch die Gesamtzeilen (null) zum Vergleich
    const tabellenDaten = filterStandort === 'Alle'
        ? proRolle.filter(r => {
            return r.standort_kuerzel === null && (filterRolle === 'Alle' || r.rolle_name === filterRolle);
        })
        : proRolle.filter(r => {
            const rolleOk = filterRolle === 'Alle' || r.rolle_name === filterRolle;
            return rolleOk && (r.standort_kuerzel === filterStandort || r.standort_kuerzel === null);
        }).sort((a, b) => {
            if (a.rolle_name !== b.rolle_name) return a.rolle_name.localeCompare(b.rolle_name);
            if (a.standort_kuerzel === null) return 1;
            if (b.standort_kuerzel === null) return -1;
            return 0;
        });

    // Nach-Person: Gruppieren nach standort_kuerzel
    const grouped = {};
    personen.forEach(p => {
        const key = p.standort_kuerzel || '—';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
    });

    const tabStyle = (aktiv) => ({
        padding: '6px 16px',
        fontSize: 12.5,
        fontWeight: aktiv ? 600 : 400,
        color: aktiv ? '#2563EB' : '#6B6860',
        background: aktiv ? '#EEF3FE' : 'transparent',
        border: '1px solid',
        borderColor: aktiv ? 'rgba(37,99,235,.2)' : 'rgba(0,0,0,.09)',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
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

            {/* Tab-Switcher */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
                <button style={tabStyle(aktiveTab === 'person')} onClick={() => setAktiveTab('person')}>
                    Nach Person
                </button>
                <button style={tabStyle(aktiveTab === 'rolle')} onClick={() => setAktiveTab('rolle')}>
                    Nach Rolle
                </button>
                <button style={tabStyle(aktiveTab === 'lehrplaetze')} onClick={() => setAktiveTab('lehrplaetze')}>
                    Lehrplätze
                </button>
            </div>

            {/* Tab: Nach Person */}
            {aktiveTab === 'person' && (
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
                                    <tr key={`hdr-${standort}`} style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.07)', borderTop: '1px solid rgba(0,0,0,.07)' }}>
                                        <td colSpan={5} style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                            Standort {standort}
                                        </td>
                                    </tr>,
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
            )}

            {/* Tab: Nach Rolle */}
            {aktiveTab === 'rolle' && (
                <div>
                    {/* Filter-Zeile */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Rolle</label>
                            <select
                                value={filterRolle}
                                onChange={e => setFilterRolle(e.target.value)}
                                style={{ fontSize: 12.5, padding: '4px 8px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#1A1917', cursor: 'pointer' }}
                            >
                                {ROLLEN_FILTER.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Standort</label>
                            <select
                                value={filterStandort}
                                onChange={e => setFilterStandort(e.target.value)}
                                style={{ fontSize: 12.5, padding: '4px 8px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#1A1917', cursor: 'pointer' }}
                            >
                                {alleStandorte.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {(filterRolle !== 'Alle' || filterStandort !== 'Alle') && (
                            <button
                                onClick={() => { setFilterRolle('Alle'); setFilterStandort('Alle'); }}
                                style={{ fontSize: 11.5, padding: '4px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', color: '#6B6860', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                Zurücksetzen
                            </button>
                        )}
                    </div>

                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                                <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                                    <TH>Rolle</TH>
                                    <TH>Standort</TH>
                                    <TH right>Personen</TH>
                                    <TH right>Aktive Klienten</TH>
                                    <TH right>Kapazität</TH>
                                    <TH>Auslastung</TH>
                                </tr>
                            </thead>
                            <tbody>
                                {tabellenDaten.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#A09D97', fontSize: 12 }}>
                                            Keine Einträge für diese Filterung
                                        </td>
                                    </tr>
                                )}
                                {tabellenDaten.map((r, i) => {
                                    const istGesamt = r.standort_kuerzel === null;
                                    return (
                                        <tr key={i} style={{
                                            borderBottom: '1px solid rgba(0,0,0,.05)',
                                            background: istGesamt ? '#FAFAF9' : 'transparent',
                                        }}>
                                            <td style={{ padding: '9px 12px', fontWeight: istGesamt ? 700 : 500 }}>
                                                {r.rolle_name}
                                            </td>
                                            <td style={{ padding: '9px 12px' }}>
                                                {istGesamt ? (
                                                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#F5F3FF', color: '#5B21B6', border: '1px solid rgba(124,58,237,.12)', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        Gesamt
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(37,99,235,.12)', fontFamily: 'monospace' }}>
                                                        {r.standort_kuerzel}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: istGesamt ? 700 : 400 }}>
                                                {r.anzahl_personen}
                                            </td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: istGesamt ? 700 : 600 }}>
                                                {r.aktive_klienten_total}
                                            </td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860', fontWeight: istGesamt ? 600 : 400 }}>
                                                {r.kapazitaet_total}
                                            </td>
                                            <td style={{ padding: '9px 12px', minWidth: 180 }}>
                                                <AuslastungBar pct={r.auslastung_pct} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab: Lehrplätze */}
            {aktiveTab === 'lehrplaetze' && (() => {
                if (lehrplaetzeLaden) return <div style={{ color: '#6B6860', fontSize: 13, padding: '1rem 0' }}>Laden…</div>;
                if (lehrplaetzeFehler) return <div style={{ color: '#B91C1C', fontSize: 13, padding: '1rem 0' }}>⚠ {lehrplaetzeFehler}</div>;

                const gruppen = {};
                lehrplaetze.forEach(r => {
                    const key = gruppierung === 'beruf' ? r.beruf : (r.standort_kuerzel || r.standort_name);
                    if (!gruppen[key]) gruppen[key] = [];
                    gruppen[key].push(r);
                });

                return (
                    <div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
                            <span style={{ fontSize: 11.5, color: '#6B6860', alignSelf: 'center', marginRight: 4 }}>Gruppieren nach</span>
                            <button style={tabStyle(gruppierung === 'beruf')} onClick={() => setGruppierung('beruf')}>Beruf</button>
                            <button style={tabStyle(gruppierung === 'standort')} onClick={() => setGruppierung('standort')}>Standort</button>
                        </div>

                        {lehrplaetze.length === 0 ? (
                            <div style={{ color: '#A09D97', fontSize: 12.5, padding: '1rem 0' }}>Keine aktiven Lehrberufe erfasst.</div>
                        ) : (
                            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                    <thead>
                                        <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                                            <TH>Beruf</TH>
                                            <TH>Standort</TH>
                                            <TH right>Bewilligt</TH>
                                            <TH right>Total</TH>
                                            <TH right>Belegt intern</TH>
                                            <TH right>Extern</TH>
                                            <TH right>Reserviert</TH>
                                            <TH right>Frei aktuell</TH>
                                            <TH right>Frei werdend</TH>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(gruppen).map(([key, zeilen]) => (
                                            [
                                                <tr key={`hdr-${key}`} style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.07)', borderTop: '1px solid rgba(0,0,0,.07)' }}>
                                                    <td colSpan={9} style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                                        {gruppierung === 'beruf' ? key : `Standort ${key}`}
                                                    </td>
                                                </tr>,
                                                ...zeilen.map((r, i) => (
                                                    <tr key={`${key}-${i}`} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>{r.beruf}</td>
                                                        <td style={{ padding: '9px 12px' }}>{r.standort_kuerzel || r.standort_name}</td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.bewilligte_plaetze}</td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860' }}>{r.total_plaetze}</td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.belegt_intern}</td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.belegt_extern}</td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860' }}>{r.reserviert}</td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                                                            <span style={{
                                                                fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                                                color: freiFarbe(r.frei_aktuell), background: freiBg(r.frei_aktuell),
                                                            }}>{r.frei_aktuell}</span>
                                                        </td>
                                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860' }}>{r.frei_werdend}</td>
                                                    </tr>
                                                )),
                                            ]
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
