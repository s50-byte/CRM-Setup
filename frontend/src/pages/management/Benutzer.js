import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import BenutzerModal from '../../components/BenutzerModal';

const ROLLEN_FARBEN = {
    'Klientenführung': { bg: '#EEF3FE', color: '#1D4ED8' },
    'Job Coach':       { bg: '#F0FDF4', color: '#15803D' },
    'Fachperson':      { bg: '#F5F3FF', color: '#5B21B6' },
    'Teamleitung':     { bg: '#FFF7ED', color: '#C2410C' },
    'Management':      { bg: '#FDF4FF', color: '#7E22CE' },
};

const SYSTEM_ROLLEN_FARBEN = {
    'mitarbeitende': { bg: '#F5F4F0', color: '#6B6860' },
    'teamleitung':   { bg: '#FFF7ED', color: '#C2410C' },
    'management':    { bg: '#FDF4FF', color: '#7E22CE' },
    'kader':         { bg: '#EFF6FF', color: '#1E40AF' },
    'admin':         { bg: '#FEF2F2', color: '#B91C1C' },
};

const TH = ({ children, right }) => (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', background: '#F5F4F0' }}>
        {children}
    </th>
);

function RolleBadge({ name }) {
    const farbe = ROLLEN_FARBEN[name] || { bg: '#F5F4F0', color: '#6B6860' };
    return (
        <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 10, background: farbe.bg, color: farbe.color, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {name}
        </span>
    );
}

function SystemRolleBadge({ rolle }) {
    const farbe = SYSTEM_ROLLEN_FARBEN[rolle] || { bg: '#F5F4F0', color: '#6B6860' };
    return (
        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: farbe.bg, color: farbe.color, fontFamily: 'monospace' }}>
            {rolle}
        </span>
    );
}

function StandortBadge({ kuerzel }) {
    return (
        <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 6, background: '#EEF3FE', color: '#1D4ED8', fontFamily: 'monospace', fontWeight: 600 }}>
            {kuerzel}
        </span>
    );
}

export default function Benutzer() {
    const [benutzer, setBenutzer] = useState([]);
    const [laden, setLaden] = useState(true);
    const [alleStandorte, setAlleStandorte] = useState([]);
    const [filterStandort, setFilterStandort] = useState('Alle');
    const [filterRolle, setFilterRolle] = useState('Alle');
    const [filterAktiv, setFilterAktiv] = useState('aktiv');
    const [modal, setModal] = useState({ open: false, benutzer: null });

    const laden_daten = useCallback(async () => {
        setLaden(true);
        try {
            const [b, st] = await Promise.all([
                client.get('/benutzer?aktiv=alle'),
                client.get('/standorte'),
            ]);
            setBenutzer(b.data);
            setAlleStandorte(st.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLaden(false);
        }
    }, []);

    useEffect(() => { laden_daten(); }, [laden_daten]);

    const alleRollen = ['Alle', 'Klientenführung', 'Job Coach', 'Fachperson', 'Teamleitung', 'Management'];

    const gefiltert = benutzer.filter(b => {
        const aktiv_ok = filterAktiv === 'alle' ? true : (filterAktiv === 'aktiv' ? b.aktiv : !b.aktiv);
        const standort_ok = filterStandort === 'Alle' || (b.standorte || []).some(s => s.kuerzel === filterStandort);
        const rolle_ok = filterRolle === 'Alle' || (b.rollen || []).some(r => r.rolle_name === filterRolle);
        return aktiv_ok && standort_ok && rolle_ok;
    });

    const selectStyle = {
        fontSize: 12.5, padding: '4px 8px', border: '1px solid rgba(0,0,0,.12)',
        borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#1A1917', cursor: 'pointer'
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>Benutzerverwaltung</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                        {gefiltert.length} von {benutzer.length} Benutzer
                    </div>
                </div>
                <button
                    onClick={() => setModal({ open: true, benutzer: null })}
                    style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit' }}
                >
                    + Neuer Benutzer
                </button>
            </div>

            {/* Filter-Zeile */}
            <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Standort</label>
                    <select value={filterStandort} onChange={e => setFilterStandort(e.target.value)} style={selectStyle}>
                        <option value="Alle">Alle</option>
                        {alleStandorte.map(s => <option key={s.standort_id} value={s.kuerzel}>{s.kuerzel} – {s.name}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Rolle</label>
                    <select value={filterRolle} onChange={e => setFilterRolle(e.target.value)} style={selectStyle}>
                        {alleRollen.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 500, color: '#6B6860' }}>Status</label>
                    <select value={filterAktiv} onChange={e => setFilterAktiv(e.target.value)} style={selectStyle}>
                        <option value="aktiv">Aktiv</option>
                        <option value="alle">Alle</option>
                        <option value="inaktiv">Inaktiv</option>
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
                                <TH>Person</TH>
                                <TH>System-Rolle</TH>
                                <TH>Standorte</TH>
                                <TH>Rollen</TH>
                                <TH right>Pensum</TH>
                                <TH>Status</TH>
                                <TH></TH>
                            </tr>
                        </thead>
                        <tbody>
                            {gefiltert.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#A09D97', fontSize: 12 }}>
                                        Keine Benutzer gefunden
                                    </td>
                                </tr>
                            )}
                            {gefiltert.map((b, i) => (
                                <tr key={b.user_id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', background: !b.aktiv ? '#FAFAF9' : 'transparent', opacity: b.aktiv ? 1 : 0.65 }}>
                                    <td style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 8, background: b.aktiv ? '#EEF3FE' : '#F5F4F0', color: b.aktiv ? '#1D4ED8' : '#A09D97', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                                                {b.avatar_initials || b.full_name?.[0]}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, color: '#1A1917' }}>{b.full_name}</div>
                                                <div style={{ fontSize: 11.5, color: '#6B6860', marginTop: 1 }}>{b.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                        <SystemRolleBadge rolle={b.system_rolle} />
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {(b.standorte || []).length === 0 && <span style={{ fontSize: 11, color: '#A09D97' }}>—</span>}
                                            {(b.standorte || []).map((s, si) => <StandortBadge key={si} kuerzel={s.kuerzel} />)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {(b.rollen || []).length === 0 && <span style={{ fontSize: 11, color: '#A09D97' }}>—</span>}
                                            {(b.rollen || []).map((r, ri) => <RolleBadge key={ri} name={r.rolle_name} />)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#6B6860' }}>{b.pensum_pct}%</td>
                                    <td style={{ padding: '9px 12px' }}>
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: b.aktiv ? '#F0FDF4' : '#F5F4F0', color: b.aktiv ? '#15803D' : '#A09D97', fontWeight: 500 }}>
                                            {b.aktiv ? 'Aktiv' : 'Inaktiv'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setModal({ open: true, benutzer: b })}
                                            style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', color: '#1A1917', fontFamily: 'inherit' }}
                                        >
                                            Bearbeiten
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <BenutzerModal
                open={modal.open}
                onClose={() => setModal({ open: false, benutzer: null })}
                onSaved={laden_daten}
                benutzer={modal.benutzer}
            />
        </div>
    );
}
