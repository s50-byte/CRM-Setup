import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import NeueAnfrageModal from '../components/NeueAnfrageModal';

const FARBEN = {
    'Erstmalige berufliche Abklärung': '#EA580C',
    'Gezielte Vorbereitung':           '#D97706',
    'Erstmalige berufliche Ausbildung':'#16A34A',
    'IM für Jugendliche':              '#DC2626',
    'Aufbautraining':                  '#0D9488',
    'Arbeitstraining':                 '#0891B2',
    'Beratung & Coaching':             '#7C3AED',
};

const PHASE_STYLE = {
    'Erstkontakt':   { bg: '#EEF3FE', color: '#1D4ED8' },
    'In Abklärung':  { bg: '#FFFBEB', color: '#B45309' },
    'Erstgespräch':  { bg: '#F5F3FF', color: '#5B21B6' },
    'Schnupper':     { bg: '#FFF7ED', color: '#9A3412' },
    'Programmstart': { bg: '#ECFDF5', color: '#15803D' },
};

const SEL = { fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28 };

const COLS = [
    { label: 'Name',                 field: 'nachname' },
    { label: 'Standort',             field: 'standort_kuerzel' },
    { label: 'Programm',             field: 'programm_name' },
    { label: 'Phase',                field: 'pipeline_status' },
    { label: 'Laufzeit',             field: null },
    { label: 'Zugewiesene Personen', field: null },
    { label: '',                     field: null },
    { label: '',                     field: null },
];

function berechneTageVerbleibend(start_datum, avg_dauer_tage) {
    if (!start_datum || !avg_dauer_tage) return null;
    const ende = new Date(start_datum);
    ende.setDate(ende.getDate() + avg_dauer_tage);
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    return Math.floor((ende - heute) / (1000 * 60 * 60 * 24));
}

function berechneEnddatum(start_datum, avg_dauer_tage) {
    if (!start_datum || !avg_dauer_tage) return null;
    const ende = new Date(start_datum);
    ende.setDate(ende.getDate() + avg_dauer_tage);
    return ende;
}

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

function DossierTabelle({ rows, sortField, sortDir, onSort, navigate, filterAktiv }) {
    const si = f => !f ? '' : sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    return (
        <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
                <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                    {COLS.map((c, i) => (
                        <th key={i} onClick={() => c.field && onSort(c.field)} style={{
                            textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600,
                            color: (c.field && sortField === c.field) ? '#2563EB' : '#6B6860',
                            textTransform: 'uppercase', letterSpacing: '.06em',
                            whiteSpace: 'nowrap', cursor: c.field ? 'pointer' : 'default', userSelect: 'none'
                        }}>{c.label}{si(c.field)}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>
                        {filterAktiv ? 'Keine Treffer für die gewählten Filter' : 'Keine Dossiers'}
                    </td></tr>
                ) : rows.map((d, i) => {
                    const farbe = FARBEN[d.programm_name] || '#888';
                    const ps = PHASE_STYLE[d.pipeline_status] || { bg: '#F5F4F0', color: '#6B6860' };
                    const tage = berechneTageVerbleibend(d.laufend_start_datum, d.avg_dauer_tage);
                    const warnBg = tage !== null && tage < 14 ? '#FEF2F2' : tage !== null && tage < 28 ? '#FFFBEB' : '';
                    const istInaktiv = d.status === 'inaktiv';
                    return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer', background: warnBg }}
                            onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                            onMouseOut={e => e.currentTarget.style.background = warnBg}>
                            <td onClick={() => navigate(`/dossiers/${d.dossier_id}`)} style={{ padding: '8px 12px', fontWeight: 500, color: '#2563EB', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <span style={{
                                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                    background: istInaktiv ? '#9CA3AF' : '#16A34A', marginRight: 7, verticalAlign: 'middle'
                                }} title={istInaktiv ? 'Inaktiv' : 'Aktiv'} />
                                {d.nachname} {d.vorname}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 11.5, color: '#6B6860' }}>
                                {d.standort_kuerzel || '—'}
                            </td>
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
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                                {(() => {
                                    const fmt = d => new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                    const enddatum = berechneEnddatum(d.laufend_start_datum, d.avg_dauer_tage);
                                    if (!d.laufend_start_datum && !enddatum) return '—';
                                    const start = d.laufend_start_datum ? fmt(d.laufend_start_datum) : '?';
                                    const ende = enddatum ? fmt(enddatum) : '?';
                                    const color = tage !== null && tage < 14 ? '#B91C1C' : tage !== null && tage < 28 ? '#B45309' : undefined;
                                    return <span style={color ? { color, fontWeight: 600 } : {}}>{start} – {ende}</span>;
                                })()}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 11.5 }}>
                                {(d.zugewiesen || []).map(u => u.full_name).join(', ') || '—'}
                            </td>
                            <td style={{ padding: '8px 12px', width: 28, textAlign: 'center' }}>
                                {tage !== null && tage < 28 && (
                                    <span title={`${tage} Tage verbleibend`} style={{ fontSize: 14, cursor: 'default', color: tage < 14 ? '#B91C1C' : '#B45309' }}>⚠</span>
                                )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                                <button onClick={() => navigate(`/dossiers/${d.dossier_id}`)} style={{
                                    padding: '3px 10px', fontSize: 11.5, cursor: 'pointer',
                                    border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                    background: '#F5F4F0', fontFamily: 'inherit', color: '#1A1917',
                                    whiteSpace: 'nowrap'
                                }}>Öffnen</button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export default function Dossiers() {
    const [dossiers, setDossiers] = useState([]);
    const [laden, setLaden] = useState(true);
    const [filterKlient, setFilterKlient] = useState('');
    const [filterTyp, setFilterTyp] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [filterDatumVon, setFilterDatumVon] = useState('');
    const [filterDatumBis, setFilterDatumBis] = useState('');
    const [filterPerson, setFilterPerson] = useState('');
    const [filterStandort, setFilterStandort] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const [sortFieldInaktiv, setSortFieldInaktiv] = useState('');
    const [sortDirInaktiv, setSortDirInaktiv] = useState('asc');
    const [inaktiveOffen, setInaktiveOffen] = useState(false);
    const [anfrageModal, setAnfrageModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        client.get('/dossiers')
            .then(r => setDossiers(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const handleSort = field => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const handleSortInaktiv = field => {
        if (sortFieldInaktiv === field) setSortDirInaktiv(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortFieldInaktiv(field); setSortDirInaktiv('asc'); }
    };

    // Distinct-Listen aus geladenen Dossiers
    const klientenListe = [...new Map(
        dossiers.map(d => [d.klient_id, { klient_id: d.klient_id, name: `${d.nachname} ${d.vorname}` }])
    ).values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const phaseListe = [...new Set(dossiers.map(d => d.pipeline_status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const standorte = [...new Set(dossiers.map(d => d.standort_kuerzel).filter(Boolean))].sort();
    const personenListe = [...new Map(
        dossiers.flatMap(d => d.zugewiesen || []).map(u => [u.user_id, u])
    ).values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'de'));

    const filterAktiv = !!(filterKlient || filterTyp || filterPhase || filterDatumVon || filterDatumBis || filterPerson || filterStandort);

    function resetFilter() {
        setFilterKlient(''); setFilterTyp(''); setFilterPhase('');
        setFilterDatumVon(''); setFilterDatumBis('');
        setFilterPerson(''); setFilterStandort('');
    }

    const gefiltert = dossiers.filter(d => {
        if (filterKlient && d.klient_id !== filterKlient) return false;
        if (filterTyp && d.programm_name !== filterTyp) return false;
        if (filterPhase && d.pipeline_status !== filterPhase) return false;
        if (filterDatumVon && (!d.laufend_start_datum || d.laufend_start_datum < filterDatumVon)) return false;
        if (filterDatumBis) {
            const enddatum = berechneEnddatum(d.laufend_start_datum, d.avg_dauer_tage);
            if (!enddatum || enddatum.toISOString().slice(0, 10) > filterDatumBis) return false;
        }
        if (filterPerson && !(d.zugewiesen || []).some(u => u.user_id === filterPerson)) return false;
        if (filterStandort && d.standort_kuerzel !== filterStandort) return false;
        return true;
    });

    const aktive = sortData(gefiltert.filter(d => d.status !== 'inaktiv'), sortField, sortDir);
    const inaktive = sortData(gefiltert.filter(d => d.status === 'inaktiv'), sortFieldInaktiv, sortDirInaktiv);

    if (laden) {
        return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Klientendossiers</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Alle Klientinnen und Klienten — eine Akte pro Klient</div>
                </div>
                <button onClick={() => setAnfrageModal(true)} style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neue Anfrage</button>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: '1.1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>Filter</span>

                <select value={filterKlient} onChange={e => setFilterKlient(e.target.value)} style={{ ...SEL, maxWidth: 170 }}>
                    <option value="">Alle Klienten</option>
                    {klientenListe.map(k => <option key={k.klient_id} value={k.klient_id}>{k.name}</option>)}
                </select>

                <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} style={SEL}>
                    <option value="">Alle Programme</option>
                    {Object.keys(FARBEN).map(t => <option key={t}>{t}</option>)}
                </select>

                <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} style={SEL}>
                    <option value="">Alle Phasen</option>
                    {phaseListe.map(p => <option key={p}>{p}</option>)}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#A09D97', flexShrink: 0 }}>Von</span>
                    <input type="date" value={filterDatumVon} onChange={e => setFilterDatumVon(e.target.value)}
                        style={{ ...SEL, width: 130 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#A09D97', flexShrink: 0 }}>Bis</span>
                    <input type="date" value={filterDatumBis} onChange={e => setFilterDatumBis(e.target.value)}
                        style={{ ...SEL, width: 130 }} />
                </div>

                <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)} style={{ ...SEL, maxWidth: 160 }}>
                    <option value="">Alle Personen</option>
                    {personenListe.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                </select>

                <select value={filterStandort} onChange={e => setFilterStandort(e.target.value)} style={SEL}>
                    <option value="">Alle Standorte</option>
                    {standorte.map(s => <option key={s}>{s}</option>)}
                </select>

                {filterAktiv && (
                    <button onClick={resetFilter} style={{
                        height: 28, padding: '0 10px', fontSize: 12, cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: 'transparent', color: '#6B6860', fontFamily: 'inherit', flexShrink: 0
                    }}>× Zurücksetzen</button>
                )}
            </div>

            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <DossierTabelle rows={aktive} sortField={sortField} sortDir={sortDir} onSort={handleSort} navigate={navigate} filterAktiv={filterAktiv} />
            </div>

            <div style={{ marginTop: '1.25rem' }}>
                <button onClick={() => setInaktiveOffen(o => !o)} style={{
                    width: '100%', textAlign: 'left', fontSize: 12, fontWeight: 600,
                    color: '#6B6860', cursor: 'pointer', border: 'none', background: 'transparent',
                    fontFamily: 'inherit', padding: '4px 0'
                }}>{inaktiveOffen ? '▾' : '▸'} Inaktive Dossiers ({inaktive.length})</button>
                {inaktiveOffen && (
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', marginTop: 8 }}>
                        <DossierTabelle rows={inaktive} sortField={sortFieldInaktiv} sortDir={sortDirInaktiv} onSort={handleSortInaktiv} navigate={navigate} filterAktiv={filterAktiv} />
                    </div>
                )}
            </div>

            <NeueAnfrageModal
                open={anfrageModal}
                onClose={() => setAnfrageModal(false)}
                onSaved={() => {
                    setAnfrageModal(false);
                    client.get('/dossiers').then(r => setDossiers(r.data));
                }}
            />
        </div>
    );
}
