import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import LeistungModal from '../../components/LeistungModal';

const CARD = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10,
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};

const TH = ({ children, right }) => (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '7px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', background: '#F5F4F0' }}>
        {children}
    </th>
);

const TD = ({ children, right, muted }) => (
    <td style={{ padding: '9px 12px', fontSize: 13, color: muted ? '#9CA3AF' : '#1A1917', textAlign: right ? 'right' : 'left', borderBottom: '1px solid rgba(0,0,0,.05)', verticalAlign: 'middle' }}>
        {children}
    </td>
);

function AktivBadge({ aktiv }) {
    return (
        <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, background: aktiv ? '#F0FDF4' : '#F5F4F0', color: aktiv ? '#15803D' : '#9CA3AF', fontFamily: 'monospace' }}>
            {aktiv ? 'Aktiv' : 'Inaktiv'}
        </span>
    );
}

export default function Leistungen() {
    const [liste, setListe] = useState([]);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState('');
    const [zeigeAlle, setZeigeAlle] = useState(false);
    const [sortKey, setSortKey] = useState('tarifnr');
    const [sortAsc, setSortAsc] = useState(true);
    const [modalOffen, setModalOffen] = useState(false);
    const [gewaehlte, setGewaehlte] = useState(null);

    const laden_ = useCallback(async () => {
        setLaden(true);
        setFehler('');
        try {
            const r = await client.get(zeigeAlle ? '/leistungen/alle' : '/leistungen');
            setListe(r.data);
        } catch (err) {
            setFehler('Leistungen konnten nicht geladen werden.');
        } finally {
            setLaden(false);
        }
    }, [zeigeAlle]);

    useEffect(() => { laden_(); }, [laden_]);

    function handleSort(key) {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(true); }
    }

    function SortIcon({ k }) {
        if (sortKey !== k) return <span style={{ opacity: .3, marginLeft: 4 }}>↕</span>;
        return <span style={{ marginLeft: 4 }}>{sortAsc ? '↑' : '↓'}</span>;
    }

    async function deaktivieren(id) {
        if (!window.confirm('Leistung deaktivieren?')) return;
        try {
            await client.delete(`/leistungen/${id}`);
            laden_();
        } catch {
            alert('Fehler beim Deaktivieren.');
        }
    }

    const sortiert = [...liste].sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    function oeffneNeu() { setGewaehlte(null); setModalOffen(true); }
    function oeffneBearbeiten(l) { setGewaehlte(l); setModalOffen(true); }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Leistungskatalog</h1>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#6B6860' }}>Tarife und Leistungsarten</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={() => setZeigeAlle(a => !a)}
                        style={{ padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: zeigeAlle ? '#F5F4F0' : '#fff', fontFamily: 'inherit', color: '#6B6860' }}
                    >
                        {zeigeAlle ? 'Nur Aktive' : 'Alle anzeigen'}
                    </button>
                    <button
                        onClick={oeffneNeu}
                        style={{ padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}
                    >
                        + Neue Leistung
                    </button>
                </div>
            </div>

            <div style={CARD}>
                {laden && (
                    <div style={{ textAlign: 'center', color: '#6B6860', fontSize: 13, padding: '2rem 0' }}>Laden…</div>
                )}
                {fehler && (
                    <div style={{ color: '#B91C1C', fontSize: 13, padding: '1rem' }}>{fehler}</div>
                )}
                {!laden && !fehler && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <TH>
                                    <span onClick={() => handleSort('tarifnr')} style={{ cursor: 'pointer' }}>
                                        Tarifnr.<SortIcon k="tarifnr" />
                                    </span>
                                </TH>
                                <TH>
                                    <span onClick={() => handleSort('bezeichnung')} style={{ cursor: 'pointer' }}>
                                        Bezeichnung<SortIcon k="bezeichnung" />
                                    </span>
                                </TH>
                                <TH>Einheit</TH>
                                <TH>Status</TH>
                                <TH right>Aktionen</TH>
                            </tr>
                        </thead>
                        <tbody>
                            {sortiert.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF', fontSize: 13 }}>Keine Einträge</td></tr>
                            )}
                            {sortiert.map(l => (
                                <tr key={l.leistung_id} style={{ background: l.aktiv ? 'transparent' : 'rgba(0,0,0,.015)' }}>
                                    <TD muted={!l.aktiv}>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.tarifnr}</span>
                                    </TD>
                                    <TD muted={!l.aktiv}>{l.bezeichnung}</TD>
                                    <TD muted={!l.aktiv}>{l.einheit}</TD>
                                    <TD><AktivBadge aktiv={l.aktiv} /></TD>
                                    <TD right>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => oeffneBearbeiten(l)}
                                                style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#1A1917' }}
                                            >
                                                Bearbeiten
                                            </button>
                                            {l.aktiv && (
                                                <button
                                                    onClick={() => deaktivieren(l.leistung_id)}
                                                    style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: '1px solid rgba(185,28,28,.2)', borderRadius: 5, background: '#FEF2F2', fontFamily: 'inherit', color: '#B91C1C' }}
                                                >
                                                    Deaktivieren
                                                </button>
                                            )}
                                        </div>
                                    </TD>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <LeistungModal
                open={modalOffen}
                onClose={() => setModalOffen(false)}
                leistung={gewaehlte}
                onSaved={laden_}
            />
        </div>
    );
}
