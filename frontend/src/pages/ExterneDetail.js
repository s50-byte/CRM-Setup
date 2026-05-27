import { useState, useEffect } from 'react';
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

    function laden_() {
        setLaden(true);
        client.get(`/externe/${id}`)
            .then(r => setPerson(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }

    useEffect(() => { laden_(); }, [id]);

    function handleGespeichert() { setModal(false); laden_(); }

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!person) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Person nicht gefunden</div>;

    const typStyle = TYP_STYLE[person.typ] || TYP_STYLE['Sonstiges'];
    const initials = (person.vorname?.[0] || '') + (person.nachname?.[0] || '');

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
                        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>
                            {person.nachname}, {person.vorname}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                background: typStyle.bg, color: typStyle.color,
                                border: `1px solid ${typStyle.color}33`, fontFamily: 'monospace'
                            }}>{person.typ}</span>
                            {person.funktion && <span style={{ fontSize: 12, color: '#6B6860' }}>{person.funktion}</span>}
                            {person.firma && <span style={{ fontSize: 12, color: '#6B6860' }}>· {person.firma}</span>}
                        </div>
                    </div>
                    <button onClick={() => setModal(true)} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                    }}>Bearbeiten</button>
                </div>
            </div>

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

            <ExternePersonModal
                open={modal}
                onClose={() => setModal(false)}
                onSaved={handleGespeichert}
                person={person}
            />
        </div>
    );
}
