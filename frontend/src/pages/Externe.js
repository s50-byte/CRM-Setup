import { useState, useEffect } from 'react';
import client from '../api/client';

const TYP_STYLE = {
    'IV-Stelle':        { bg: '#EEF3FE', color: '#1D4ED8' },
    'RAV':              { bg: '#ECFDF5', color: '#15803D' },
    'Sozialdienst':     { bg: '#F5F3FF', color: '#5B21B6' },
    'Arbeitgeber':      { bg: '#FFF7ED', color: '#9A3412' },
    'Arzt / Therapeut': { bg: '#FFFBEB', color: '#B45309' },
    'Gesetzl. Vertreter':{ bg: '#FEF2F2', color: '#B91C1C' },
    'Sonstiges':        { bg: '#F5F4F0', color: '#6B6860' },
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

export default function Externe() {
    const [personen, setPersonen] = useState([]);
    const [laden, setLaden] = useState(true);
    const [suche, setSuche] = useState('');
    const [filterTyp, setFilterTyp] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortDir, setSortDir] = useState('asc');

    useEffect(() => {
        client.get('/externe')
            .then(r => setPersonen(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const handleSort = field => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const si = f => !f ? '' : sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    const gefiltert = sortData(
        personen.filter(p => {
            const match = `${p.vorname} ${p.nachname} ${p.firma || ''}`.toLowerCase().includes(suche.toLowerCase());
            const typ = !filterTyp || p.typ === filterTyp;
            return match && typ;
        }),
        sortField, sortDir
    );

    const COLS = [
        { label: 'Name',     field: 'nachname' },
        { label: 'Funktion', field: 'funktion' },
        { label: 'Firma',    field: 'firma' },
        { label: 'Typ',      field: 'typ' },
        { label: 'Telefon',  field: 'telefon' },
        { label: 'E-Mail',   field: 'email' },
        { label: 'Klienten', field: 'anzahl_klienten' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Externe Personen & Firmen</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Zuweisende Stellen, Arbeitgeber, gesetzliche Vertreter, Ärzte</div>
                </div>
                <button style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neuer Kontakt</button>
            </div>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1.1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <input
                    type="text" value={suche} onChange={e => setSuche(e.target.value)}
                    placeholder="Name, Firma…"
                    style={{
                        fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                        borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit',
                        height: 28, width: 160, outline: 'none'
                    }}
                />
                <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Typen</option>
                    {Object.keys(TYP_STYLE).map(t => <option key={t}>{t}</option>)}
                </select>
                {(suche || filterTyp) && (
                    <button onClick={() => { setSuche(''); setFilterTyp(''); }} style={{
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
                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Laden…</td></tr>
                        ) : gefiltert.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6B6860' }}>Keine Einträge</td></tr>
                        ) : gefiltert.map((p, i) => {
                            const s = TYP_STYLE[p.typ] || TYP_STYLE['Sonstiges'];
                            return (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer' }}
                                    onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                    onMouseOut={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#2563EB' }}>{p.vorname} {p.nachname}</td>
                                    <td style={{ padding: '8px 12px', fontSize: 11.5 }}>{p.funktion || '—'}</td>
                                    <td style={{ padding: '8px 12px', fontSize: 11.5 }}>{p.firma || '—'}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <span style={{
                                            fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                            background: s.bg, color: s.color,
                                            border: `1px solid ${s.color}33`, fontFamily: 'monospace'
                                        }}>{p.typ}</span>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: 11.5 }}>{p.telefon || '—'}</td>
                                    <td style={{ padding: '8px 12px', color: '#2563EB', fontSize: 11.5 }}>{p.email || '—'}</td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.anzahl_klienten || 0}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
