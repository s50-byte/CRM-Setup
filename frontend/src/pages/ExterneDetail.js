import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import ExternePersonModal from '../components/ExternePersonModal';

const TYP_STYLE = {
    'IV-Stelle':         { bg: '#EEF3FE', color: '#1D4ED8' },
    'RAV':               { bg: '#ECFDF5', color: '#15803D' },
    'Sozialdienst':      { bg: '#F5F3FF', color: '#5B21B6' },
    'Arbeitgeber':       { bg: '#FFF7ED', color: '#9A3412' },
    'Arzt / Therapeut':  { bg: '#FFFBEB', color: '#B45309' },
    'Gesetzl. Vertreter':{ bg: '#FEF2F2', color: '#B91C1C' },
    'Sonstiges':         { bg: '#F5F4F0', color: '#6B6860' },
};

const CARD = {
    background: '#fff', border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
};

const LABEL = {
    fontSize: 10.5, fontWeight: 600, color: '#6B6860',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem'
};

function InfoRow({ label, value, link }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12.5 }}>
            <span style={{ color: '#6B6860' }}>{label}</span>
            {link
                ? <a href={`mailto:${value}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{value}</a>
                : <span style={{ color: '#1A1917' }}>{value || '—'}</span>
            }
        </div>
    );
}

export default function ExterneDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [person, setPerson] = useState(null);
    const [laden, setLaden] = useState(true);
    const [modal, setModal] = useState(false);
    const [aktTab, setAktTab] = useState('uebersicht');

    const [stundenpreise, setStundenpreise] = useState([]);
    const [leistungen, setLeistungen] = useState([]);
    const [neueLeistungId, setNeueLeistungId] = useState('');
    const [neuerPreis, setNeuerPreis] = useState('');
    const [spBusy, setSpBusy] = useState(false);
    const [spFehler, setSpFehler] = useState('');

    const [orgName, setOrgName] = useState('');

    function ladeStundenpreise() {
        client.get(`/externe/${id}/stundenpreise`)
            .then(r => setStundenpreise(r.data))
            .catch(console.error);
    }

    const ladeData = useCallback(() => {
        setLaden(true);
        setOrgName('');
        setStundenpreise([]);
        client.get(`/externe/${id}`)
            .then(r => {
                setPerson(r.data);
                if (r.data.ist_organisation) {
                    client.get('/leistungen').then(lr => setLeistungen(lr.data)).catch(console.error);
                    client.get(`/externe/${id}/stundenpreise`).then(sr => setStundenpreise(sr.data)).catch(console.error);
                }
                if (r.data.organisation_id) {
                    client.get(`/externe/${r.data.organisation_id}`)
                        .then(or => setOrgName(or.data.nachname || ''))
                        .catch(console.error);
                }
            })
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [id]);

    useEffect(() => {
        setAktTab('uebersicht');
        ladeData();
    }, [ladeData]);

    function handleGespeichert() { setModal(false); ladeData(); }

    async function stundenpreisHinzufuegen() {
        if (!neueLeistungId || !neuerPreis) return;
        setSpBusy(true);
        setSpFehler('');
        try {
            await client.post(`/externe/${id}/stundenpreise`, {
                leistung_id: neueLeistungId,
                stundenpreis: parseFloat(neuerPreis),
            });
            setNeueLeistungId('');
            setNeuerPreis('');
            ladeStundenpreise();
        } catch (err) {
            setSpFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setSpBusy(false);
        }
    }

    async function stundenpreisLoeschen(leistung_id) {
        setSpBusy(true);
        try {
            await client.delete(`/externe/${id}/stundenpreise/${leistung_id}`);
            ladeStundenpreise();
        } catch (err) {
            console.error(err);
        } finally {
            setSpBusy(false);
        }
    }

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!person) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Person nicht gefunden</div>;

    const typStyle = TYP_STYLE[person.typ] || TYP_STYLE['Sonstiges'];
    const initials = (person.vorname?.[0] || '') + (person.nachname?.[0] || '');
    const istOrg = !!person.ist_organisation;

    const tabs = istOrg ? [
        { key: 'uebersicht', label: 'Übersicht' },
        { key: 'stundenpreise', label: `Stundenpreise${stundenpreise.length > 0 ? ` (${stundenpreise.length})` : ''}` },
    ] : null;

    return (
        <div>
            <button onClick={() => navigate('/externe')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: '#6B6860', cursor: 'pointer', background: 'none', border: 'none',
                marginBottom: '.875rem', fontFamily: 'inherit', padding: 0
            }}>← Alle Kontakte</button>

            {/* Header */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', marginBottom: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12, background: typStyle.bg,
                        color: typStyle.color, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0
                    }}>{initials}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>
                                {istOrg
                                    ? (person.firma || person.nachname)
                                    : `${person.nachname}, ${person.vorname}`}
                            </div>
                            {istOrg && (
                                <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: '#F5F3FF', color: '#5B21B6', border: '1px solid rgba(124,58,237,.15)', fontFamily: 'monospace' }}>Organisation</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                background: typStyle.bg, color: typStyle.color,
                                border: `1px solid ${typStyle.color}33`, fontFamily: 'monospace'
                            }}>{person.typ}</span>
                            {person.funktion && <span style={{ fontSize: 12, color: '#6B6860' }}>{person.funktion}</span>}
                            {person.firma && <span style={{ fontSize: 12, color: '#6B6860' }}>· {person.firma}</span>}
                            {person.organisation_id && orgName && (
                                <span
                                    onClick={() => navigate(`/externe/${person.organisation_id}`)}
                                    style={{ fontSize: 11.5, color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                    Mitglied von: {orgName} →
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setModal(true)} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                    }}>Bearbeiten</button>
                </div>
            </div>

            {/* Tabs (only for orgs) */}
            {tabs && (
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.09)', marginBottom: '.875rem', background: '#fff', borderRadius: '10px 10px 0 0', border: '1px solid rgba(0,0,0,.09)', padding: '0 1rem' }}>
                    {tabs.map(tab => (
                        <button key={tab.key} onClick={() => setAktTab(tab.key)} style={{
                            padding: '10px 16px', fontSize: 12.5, fontWeight: aktTab === tab.key ? 600 : 400,
                            cursor: 'pointer', border: 'none', background: 'transparent',
                            color: aktTab === tab.key ? '#2563EB' : '#6B6860',
                            borderBottom: aktTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                            fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.04em',
                            marginBottom: -1,
                        }}>{tab.label}</button>
                    ))}
                </div>
            )}

            {/* Tab: Übersicht */}
            {aktTab === 'uebersicht' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Kontaktdaten */}
                    <div style={CARD}>
                        <div style={LABEL}>Kontaktdaten</div>
                        <InfoRow label="Telefon"  value={person.telefon} />
                        <InfoRow label="E-Mail"   value={person.email} link={!!person.email} />
                        <InfoRow label="Adresse"  value={person.adresse} />
                        <InfoRow label="Firma"    value={person.firma} />
                        <InfoRow label="Funktion" value={person.funktion} />
                        {person.bemerkung && (
                            <div style={{ marginTop: 10, padding: '9px 12px', background: '#F5F4F0', borderRadius: 6, fontSize: 12, color: '#6B6860', borderLeft: '3px solid rgba(0,0,0,.09)', lineHeight: 1.5 }}>
                                {person.bemerkung}
                            </div>
                        )}
                    </div>

                    {/* Verknüpfte Klienten */}
                    <div style={CARD}>
                        <div style={LABEL}>
                            Verknüpfte Klienten
                            <span style={{ fontWeight: 400, color: '#A09D97', marginLeft: 6 }}>({(person.klienten || []).length})</span>
                        </div>
                        {(person.klienten || []).length === 0 ? (
                            <div style={{ fontSize: 12, color: '#A09D97' }}>Keine Klienten verknüpft</div>
                        ) : (person.klienten || []).map((k, i) => (
                            <div
                                key={i}
                                onClick={() => navigate(`/dossiers/${k.dossier_id}`)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.05)',
                                    cursor: 'pointer'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#F5F4F0'}
                                onMouseOut={e => e.currentTarget.style.background = ''}
                            >
                                <div style={{
                                    width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                                    background: k.farbe_hex ? k.farbe_hex + '22' : '#EEF3FE',
                                    color: k.farbe_hex || '#1D4ED8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, fontWeight: 600
                                }}>
                                    {(k.vorname?.[0] || '') + (k.nachname?.[0] || '')}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1A1917' }}>
                                        {k.nachname}, {k.vorname}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6B6860', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {k.programm_name && (
                                            <span style={{
                                                padding: '1px 6px', borderRadius: 20,
                                                background: k.farbe_hex ? k.farbe_hex + '22' : '#EEF3FE',
                                                color: k.farbe_hex || '#1D4ED8',
                                                border: `1px solid ${k.farbe_hex || '#1D4ED8'}33`
                                            }}>{k.programm_name}</span>
                                        )}
                                        {k.rolle && <span style={{ color: '#A09D97' }}>{k.rolle}</span>}
                                    </div>
                                </div>
                                <span style={{ fontSize: 11, color: '#A09D97', flexShrink: 0 }}>→</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Stundenpreise (nur für Organisationen) */}
            {aktTab === 'stundenpreise' && (
                <div style={CARD}>
                    <div style={LABEL}>Stundenpreise pro Leistung</div>

                    {spFehler && (
                        <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>
                            {spFehler}
                        </div>
                    )}

                    {stundenpreise.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 16 }}>Noch keine Stundenpreise erfasst</div>
                    ) : (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 40px', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,.09)', marginBottom: 4 }}>
                                {['Tarifnr.', 'Leistung', 'CHF/Std.', ''].map((h, i) => (
                                    <span key={i} style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
                                ))}
                            </div>
                            {stundenpreise.map(sp => (
                                <div key={sp.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 40px', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B6860' }}>{sp.tarifnr}</span>
                                    <span style={{ fontSize: 13, color: '#1A1917' }}>{sp.bezeichnung}</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, textAlign: 'right', color: '#1A1917' }}>
                                        {parseFloat(sp.stundenpreis).toFixed(2)}
                                    </span>
                                    <button
                                        onClick={() => stundenpreisLoeschen(sp.leistung_id)}
                                        disabled={spBusy}
                                        style={{ width: 32, height: 32, border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, background: '#FEF2F2', color: '#B91C1C', cursor: spBusy ? 'default' : 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ borderTop: stundenpreise.length > 0 ? '1px solid rgba(0,0,0,.07)' : 'none', paddingTop: stundenpreise.length > 0 ? 14 : 0 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 9 }}>
                            Stundenpreis hinzufügen / aktualisieren
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 10, alignItems: 'center' }}>
                            <select
                                value={neueLeistungId}
                                onChange={e => setNeueLeistungId(e.target.value)}
                                style={{ fontSize: 13, padding: '7px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            >
                                <option value="">— Leistung wählen —</option>
                                {leistungen.map(l => (
                                    <option key={l.leistung_id} value={l.leistung_id}>
                                        {l.tarifnr} · {l.bezeichnung}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number" min="0" step="0.01"
                                value={neuerPreis}
                                onChange={e => setNeuerPreis(e.target.value)}
                                placeholder="CHF / Stunde"
                                style={{ fontSize: 13, padding: '7px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
                            />
                            <button
                                onClick={stundenpreisHinzufuegen}
                                disabled={spBusy || !neueLeistungId || !neuerPreis}
                                style={{
                                    padding: '7px 18px', fontSize: 13, cursor: (!neueLeistungId || !neuerPreis || spBusy) ? 'default' : 'pointer',
                                    border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                                    fontFamily: 'inherit', fontWeight: 500,
                                    opacity: (!neueLeistungId || !neuerPreis || spBusy) ? .5 : 1, whiteSpace: 'nowrap'
                                }}
                            >Speichern</button>
                        </div>
                    </div>
                </div>
            )}

            <ExternePersonModal
                open={modal}
                onClose={() => setModal(false)}
                onSaved={handleGespeichert}
                person={person}
            />
        </div>
    );
}
