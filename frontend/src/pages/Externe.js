import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import OrganisationModal from '../components/OrganisationModal';
import KontaktModal from '../components/KontaktModal';

const TYP_STYLE = {
    'IV-Stelle':                 { bg: '#EEF3FE', color: '#1D4ED8' },
    'RAV':                       { bg: '#ECFDF5', color: '#15803D' },
    'Sozialdienst':              { bg: '#F5F3FF', color: '#5B21B6' },
    'Arbeitgeber / Partnerfirma':{ bg: '#FFF7ED', color: '#9A3412' },
    'Arbeitgeber':               { bg: '#FFF7ED', color: '#9A3412' },
    'Krankenversicherung':       { bg: '#F0FDF4', color: '#166534' },
    'Betreutes Wohnen':          { bg: '#FDF4FF', color: '#7E22CE' },
    'Schule':                    { bg: '#FFFBEB', color: '#B45309' },
    'Ausgleichskasse':           { bg: '#FEF2F2', color: '#B91C1C' },
    'Elternteil':                { bg: '#FDF4FF', color: '#7E22CE' },
    'Gesetzlicher Vertreter':    { bg: '#FEF2F2', color: '#B91C1C' },
    'Gesetzl. Vertreter':        { bg: '#FEF2F2', color: '#B91C1C' },
    'Partner/in':                { bg: '#F0FDF4', color: '#166534' },
    'Lehrperson':                { bg: '#FFFBEB', color: '#B45309' },
    'Therapeut':                 { bg: '#E0F2FE', color: '#0369A1' },
    'Arzt':                      { bg: '#EEF3FE', color: '#1D4ED8' },
    'Arzt / Therapeut':          { bg: '#FFFBEB', color: '#B45309' },
    'Sonstiges':                 { bg: '#F5F4F0', color: '#6B6860' },
};

const ORG_TYPEN = [
    'IV-Stelle', 'RAV', 'Sozialdienst', 'Arbeitgeber / Partnerfirma',
    'Krankenversicherung', 'Betreutes Wohnen', 'Schule', 'Ausgleichskasse',
];

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
    const navigate = useNavigate();
    const [organisationen, setOrganisationen] = useState([]);
    const [personen, setPersonen] = useState([]);
    const [laden, setLaden] = useState(true);
    const [suche, setSuche] = useState('');
    const [filterTyp, setFilterTyp] = useState('');
    const [sortField, setSortField] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const [aufgeklappt, setAufgeklappt] = useState(new Set());

    const [orgModal, setOrgModal] = useState(false);
    const [editOrg, setEditOrg] = useState(null);
    const [kontaktModal, setKontaktModal] = useState(false);
    const [editKontakt, setEditKontakt] = useState(null);

    function ladeListe() {
        setLaden(true);
        client.get('/externe')
            .then(r => {
                setOrganisationen(r.data.organisationen || []);
                setPersonen(r.data.personen || []);
            })
            .catch(console.error)
            .finally(() => setLaden(false));
    }

    useEffect(() => { ladeListe(); }, []);

    function oeffneNeuOrg()            { setEditOrg(null);     setOrgModal(true); }
    function oeffneNeuKontakt()        { setEditKontakt(null); setKontaktModal(true); }
    function oeffneOrgBearbeiten(org)  { setEditOrg(org);      setOrgModal(true); }
    function oeffneKontaktBearbeiten(p){ setEditKontakt(p);    setKontaktModal(true); }
    function handleGespeichert()       { setOrgModal(false); setKontaktModal(false); ladeListe(); }

    function toggleOrg(id) {
        setAufgeklappt(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const handleSort = field => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const si = f => !f ? '' : sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

    const gefilterteOrgs = organisationen.filter(o => {
        const text = `${o.nachname || ''} ${o.vorname || ''} ${o.firma || ''}`.toLowerCase();
        const typMatch = !filterTyp || o.typ === filterTyp;
        return (!suche || text.includes(suche.toLowerCase())) && typMatch;
    });

    const gefiltertePersonen = sortData(
        personen.filter(p => {
            const text = `${p.vorname || ''} ${p.nachname || ''} ${p.firma || ''}`.toLowerCase();
            return (!suche || text.includes(suche.toLowerCase()));
        }),
        sortField, sortDir
    );

    const COLS = [
        { label: 'Name',     field: 'nachname' },
        { label: 'Funktion', field: 'funktion' },
        { label: 'Beziehung',field: 'typ' },
        { label: 'Telefon',  field: 'telefon' },
        { label: 'E-Mail',   field: 'email' },
        { label: 'Klienten', field: 'anzahl_klienten' },
        { label: '',         field: null },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Externe Kontakte</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Organisationen, zuweisende Stellen, Arbeitgeber, Privatpersonen</div>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={oeffneNeuOrg} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', color: '#1A1917', fontFamily: 'inherit'
                    }}>+ Neue Organisation</button>
                    <button onClick={oeffneNeuKontakt} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>+ Neuer Kontakt</button>
                </div>
            </div>

            {/* Filter */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1.1rem',
                background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10,
                padding: '.5rem .875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter</span>
                <input
                    type="text" value={suche} onChange={e => setSuche(e.target.value)}
                    placeholder="Name, Organisation…"
                    style={{ fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28, width: 180, outline: 'none' }}
                />
                <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} style={{
                    fontSize: 12, padding: '4px 9px', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', height: 28
                }}>
                    <option value="">Alle Org-Typen</option>
                    {ORG_TYPEN.map(t => <option key={t}>{t}</option>)}
                </select>
                {(suche || filterTyp) && (
                    <button onClick={() => { setSuche(''); setFilterTyp(''); }} style={{
                        height: 28, padding: '0 9px', fontSize: 12, cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: 'transparent', color: '#6B6860', fontFamily: 'inherit'
                    }}>× Reset</button>
                )}
            </div>

            <div>
            {laden ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 13 }}>Laden…</div>
            ) : (
                <>
                    {/* Organisationen */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>
                            Organisationen ({gefilterteOrgs.length})
                        </div>
                        {gefilterteOrgs.length === 0 ? (
                            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', fontSize: 12.5, color: '#A09D97', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                                Keine Organisationen gefunden
                            </div>
                        ) : (
                            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                                {gefilterteOrgs.map((org, idx) => {
                                    const expanded = aufgeklappt.has(org.person_id);
                                    const s = TYP_STYLE[org.typ] || TYP_STYLE['Sonstiges'];
                                    const mitglieder = org.mitglieder || [];
                                    return (
                                        <div key={org.person_id} style={{ borderBottom: idx < gefilterteOrgs.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', background: expanded ? '#F9F8F6' : '#fff', userSelect: 'none' }}
                                                onClick={() => toggleOrg(org.person_id)}
                                                onMouseOver={e => { if (!expanded) e.currentTarget.style.background = '#F5F4F0'; }}
                                                onMouseOut={e => { e.currentTarget.style.background = expanded ? '#F9F8F6' : '#fff'; }}
                                            >
                                                <span style={{ fontSize: 11, color: '#A09D97', width: 14, flexShrink: 0, fontFamily: 'monospace' }}>{expanded ? '▼' : '▶'}</span>
                                                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1917' }}>
                                                    {org.firma || org.nachname}
                                                    {org.ort ? <span style={{ fontWeight: 400, color: '#6B6860', marginLeft: 7, fontSize: 12 }}>{org.plz ? `${org.plz} ` : ''}{org.ort}</span> : ''}
                                                </span>
                                                <span style={{
                                                    fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                    background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
                                                    fontFamily: 'monospace', flexShrink: 0
                                                }}>{org.typ}</span>
                                                <span style={{ fontSize: 11, color: '#A09D97', fontFamily: 'monospace', flexShrink: 0, marginLeft: 4 }}>
                                                    {mitglieder.length} Kontakt{mitglieder.length !== 1 ? 'e' : ''} · {org.anzahl_klienten || 0} Kl.
                                                </span>
                                                <button
                                                    onClick={e => { e.stopPropagation(); navigate(`/externe/${org.person_id}`); }}
                                                    style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#2563EB', flexShrink: 0 }}
                                                >Detail →</button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); oeffneOrgBearbeiten(org); }}
                                                    style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#1A1917', flexShrink: 0 }}
                                                >Bearbeiten</button>
                                            </div>
                                            {expanded && (
                                                <div style={{ background: '#F9F8F6', borderTop: '1px solid rgba(0,0,0,.05)', padding: '4px 12px 8px 38px' }}>
                                                    {mitglieder.length === 0 ? (
                                                        <div style={{ fontSize: 12, color: '#A09D97', padding: '6px 0' }}>Keine Kontakte erfasst</div>
                                                    ) : mitglieder.map(m => (
                                                        <div
                                                            key={m.person_id}
                                                            onClick={() => navigate(`/externe/${m.person_id}`)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', borderRadius: 5, cursor: 'pointer', marginBottom: 1 }}
                                                            onMouseOver={e => e.currentTarget.style.background = '#EDE9E2'}
                                                            onMouseOut={e => e.currentTarget.style.background = ''}
                                                        >
                                                            <span style={{ fontSize: 12.5, fontWeight: 500, color: '#2563EB', minWidth: 140 }}>{m.nachname}, {m.vorname}</span>
                                                            {m.funktion && <span style={{ fontSize: 11, color: '#6B6860' }}>{m.funktion}</span>}
                                                            {m.telefon && <span style={{ fontSize: 11, color: '#A09D97', marginLeft: 'auto' }}>{m.telefon}</span>}
                                                            {m.email && <span style={{ fontSize: 11, color: '#6B6860' }}>{m.email}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Privatpersonen / Einzelkontakte */}
                    <div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>
                            Einzelkontakte ({gefiltertePersonen.length})
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
                                    {gefiltertePersonen.length === 0 ? (
                                        <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#6B6860', fontSize: 12.5 }}>Keine Einzelkontakte gefunden</td></tr>
                                    ) : gefiltertePersonen.map((p, i) => {
                                        const s = TYP_STYLE[p.typ] || TYP_STYLE['Sonstiges'];
                                        return (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                                onMouseOut={e => e.currentTarget.style.background = ''}>
                                                <td
                                                    onClick={() => navigate(`/externe/${p.person_id}`)}
                                                    style={{ padding: '8px 12px', fontWeight: 500, color: '#2563EB', cursor: 'pointer' }}
                                                >{p.vorname} {p.nachname}</td>
                                                <td style={{ padding: '8px 12px', fontSize: 11.5 }}>{p.funktion || '—'}</td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <span style={{
                                                        fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                                        background: s.bg, color: s.color,
                                                        border: `1px solid ${s.color}33`, fontFamily: 'monospace'
                                                    }}>{p.typ || '—'}</span>
                                                </td>
                                                <td style={{ padding: '8px 12px', fontSize: 11.5 }}>{p.telefon || '—'}</td>
                                                <td style={{ padding: '8px 12px', color: '#2563EB', fontSize: 11.5 }}>{p.email || '—'}</td>
                                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.anzahl_klienten || 0}</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => oeffneKontaktBearbeiten(p)}
                                                        style={{
                                                            fontSize: 11.5, padding: '3px 10px', cursor: 'pointer',
                                                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                                            background: '#fff', color: '#1A1917', fontFamily: 'inherit'
                                                        }}>Bearbeiten</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            </div>

            <OrganisationModal
                open={orgModal}
                onClose={() => setOrgModal(false)}
                onSaved={handleGespeichert}
                organisation={editOrg}
            />
            <KontaktModal
                open={kontaktModal}
                onClose={() => setKontaktModal(false)}
                onSaved={handleGespeichert}
                kontakt={editKontakt}
            />
        </div>
    );
}
