import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import NeuerKlientModal from '../components/NeuerKlientModal';
import NeueAnfrageModal from '../components/NeueAnfrageModal';

const SEL = { fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28 };

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

export default function Klienten({ meine }) {
    const navigate = useNavigate();
    const [klienten, setKlienten] = useState([]);
    const [laden, setLaden] = useState(true);
    const [suche, setSuche] = useState('');
    const [filterProgramm, setFilterProgramm] = useState('');
    const [filterStandort, setFilterStandort] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const [klientModal, setKlientModal] = useState(false);
    const [anfrageModal, setAnfrageModal] = useState(false);

    useEffect(() => {
        client.get(meine ? '/klienten/meine' : '/klienten')
            .then(r => setKlienten(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [meine]);

    const handleSort = field => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const si = f => !f ? '' : sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    const programme = [...new Set(klienten.map(k => k.programm_name).filter(Boolean))].sort();
    const standorte = [...new Set(klienten.map(k => k.standort_kuerzel).filter(Boolean))].sort();

    const gefiltert = sortData(
        klienten.filter(k => {
            const name = `${k.nachname} ${k.vorname}`.toLowerCase();
            return (
                (!suche || name.includes(suche.toLowerCase())) &&
                (!filterProgramm || k.programm_name === filterProgramm) &&
                (!filterStandort || k.standort_kuerzel === filterStandort)
            );
        }),
        sortField, sortDir
    );

    const COLS = [
        { label: 'Nachname',    field: 'nachname' },
        { label: 'Vorname',     field: 'vorname' },
        { label: 'Geburtsdatum',field: 'geburtsdatum' },
        { label: 'Telefon',     field: 'telefon' },
        { label: 'E-Mail',      field: 'email' },
        { label: 'Auftraggeber',field: 'auftraggeber' },
        { label: 'Programm',    field: 'programm_name' },
        { label: 'AHV-Nr.',     field: 'ahv_nummer' },
    ];

    const hasFilter = suche || filterProgramm || filterStandort;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>{meine ? 'Meine Klienten' : 'Klienten'}</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Stammdaten aller Klientinnen und Klienten</div>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={() => setAnfrageModal(true)} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                    }}>+ Neue Anfrage</button>
                    <button onClick={() => setKlientModal(true)} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>+ Neuer Klient</button>
                </div>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                marginBottom: '1.1rem', background: '#fff',
                border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <input
                    type="text" value={suche} onChange={e => setSuche(e.target.value)}
                    placeholder="Name suchen…"
                    style={{ ...SEL, width: 160, outline: 'none' }}
                />
                <select value={filterProgramm} onChange={e => setFilterProgramm(e.target.value)} style={SEL}>
                    <option value="">Alle Programme</option>
                    {programme.map(p => <option key={p}>{p}</option>)}
                </select>
                <select value={filterStandort} onChange={e => setFilterStandort(e.target.value)} style={SEL}>
                    <option value="">Alle Standorte</option>
                    {standorte.map(s => <option key={s}>{s}</option>)}
                </select>
                {hasFilter && (
                    <button onClick={() => { setSuche(''); setFilterProgramm(''); setFilterStandort(''); }} style={{
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
                            {COLS.map(c => (
                                <th key={c.label} onClick={() => handleSort(c.field)} style={{
                                    textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600,
                                    color: sortField === c.field ? '#2563EB' : '#6B6860',
                                    textTransform: 'uppercase', letterSpacing: '.06em',
                                    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none'
                                }}>{c.label}{si(c.field)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {laden ? (
                            <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Laden…</td></tr>
                        ) : gefiltert.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Keine Klienten gefunden</td></tr>
                        ) : gefiltert.map((k, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}
                                onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                onMouseOut={e => e.currentTarget.style.background = ''}>
                                <td style={{ padding: '8px 12px', fontWeight: 500, color: '#2563EB', cursor: 'pointer' }}
                                    onClick={() => k.dossier_id && navigate(`/dossiers/${k.dossier_id}`)}>{k.nachname}</td>
                                <td style={{ padding: '8px 12px' }}>{k.vorname}</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>
                                    {k.geburtsdatum ? new Date(k.geburtsdatum).toLocaleDateString('de-CH') : '—'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>{k.telefon || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#2563EB' }}>{k.email || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>{k.auftraggeber || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                    {k.programm_name ? (
                                        <span style={{
                                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                            background: k.farbe_hex + '22', color: k.farbe_hex,
                                            border: `1px solid ${k.farbe_hex}33`, fontWeight: 500
                                        }}>{k.programm_name}</span>
                                    ) : '—'}
                                </td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{k.ahv_nummer || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <NeuerKlientModal
                open={klientModal}
                onClose={() => setKlientModal(false)}
                onSaved={() => {
                    setKlientModal(false);
                    client.get(meine ? '/klienten/meine' : '/klienten').then(r => setKlienten(r.data));
                }}
            />
            <NeueAnfrageModal
                open={anfrageModal}
                onClose={() => setAnfrageModal(false)}
                onSaved={() => {
                    setAnfrageModal(false);
                    client.get(meine ? '/klienten/meine' : '/klienten').then(r => setKlienten(r.data));
                }}
            />
        </div>
    );
}
