import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

const FARBEN = {
    'IV-Massnahme': '#2563EB', 'Erstmalige berufliche Ausbildung': '#16A34A',
    'Beratung & Coaching': '#7C3AED', 'Erstmalige berufliche Abklärung': '#EA580C',
    'Gezielte Vorbereitung': '#D97706'
};

const INPUT_STYLE = {
    fontSize: 12.5, padding: '4px 8px', border: '1px solid rgba(0,0,0,.13)',
    borderRadius: 5, background: '#fff', fontFamily: 'inherit',
    width: '100%', outline: 'none', boxSizing: 'border-box'
};

const CARD = {
    background: '#fff', border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
};

function FRow({ label, name, type, form, onChange }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: '#6B6860' }}>{label}</span>
            <input
                name={name}
                type={type || 'text'}
                value={type === 'date'
                    ? (form[name] ? form[name].slice(0, 10) : '')
                    : (form[name] || '')}
                onChange={onChange}
                style={INPUT_STYLE}
            />
        </div>
    );
}

function SaveBar({ laden, gespeichert, onSpeichern }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: '1rem' }}>
            {gespeichert && <span style={{ fontSize: 12.5, color: '#16A34A' }}>Gespeichert ✓</span>}
            <button onClick={onSpeichern} disabled={laden} style={{
                padding: '7px 18px', fontSize: 13, fontWeight: 500,
                cursor: laden ? 'default' : 'pointer', border: 'none', borderRadius: 6,
                background: laden ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit'
            }}>Speichern</button>
        </div>
    );
}

export default function KlientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [klient, setKlient] = useState(null);
    const [laden, setLaden] = useState(true);
    const [aktTab, setAktTab] = useState('stamm');
    const [form, setForm] = useState({});
    const [speichern, setSpeichern] = useState(false);
    const [gespeichert, setGespeichert] = useState(false);

    useEffect(() => {
        client.get(`/klienten/${id}`)
            .then(r => { setKlient(r.data); setForm(r.data); })
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [id]);

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSpeichern = async () => {
        setSpeichern(true);
        try {
            const r = await client.put(`/klienten/${id}`, form);
            setKlient(prev => ({ ...prev, ...r.data }));
            setForm(prev => ({ ...prev, ...r.data }));
            setGespeichert(true);
            setTimeout(() => setGespeichert(false), 2500);
        } catch (err) {
            console.error(err);
        } finally {
            setSpeichern(false);
        }
    };

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!klient) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Klient nicht gefunden</div>;

    const initials = (klient.nachname?.[0] || '') + (klient.vorname?.[0] || '');
    const tage = ['Mo','Di','Mi','Do','Fr'].filter((_,i) => [klient.tage_mo,klient.tage_di,klient.tage_mi,klient.tage_do,klient.tage_fr][i]);

    return (
        <div>
            <button onClick={() => navigate('/klienten')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: '#6B6860', cursor: 'pointer', background: 'none', border: 'none',
                marginBottom: '.875rem', fontFamily: 'inherit', padding: 0
            }}>← Alle Klienten</button>

            {/* Header */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', marginBottom: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12, background: '#EEF3FE',
                        color: '#1D4ED8', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0
                    }}>{initials}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>
                            {klient.nachname}, {klient.vorname}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                            geb. {klient.geburtsdatum ? new Date(klient.geburtsdatum).toLocaleDateString('de-CH') : '—'}
                            {klient.ahv_nummer && ` · AHV ${klient.ahv_nummer}`}
                        </div>
                    </div>
                    <button
                        onClick={() => klient.dossier_id && navigate(`/dossiers/${klient.dossier_id}`)}
                        disabled={!klient.dossier_id}
                        style={{
                            padding: '7px 14px', fontSize: 13, fontWeight: 500,
                            cursor: klient.dossier_id ? 'pointer' : 'default',
                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                            background: '#fff', fontFamily: 'inherit', color: '#6B6860',
                            opacity: klient.dossier_id ? 1 : 0.4
                        }}>Zum Dossier →</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.09)', marginTop: '1rem' }}>
                    {[
                        { key: 'stamm', label: 'Stammdaten' },
                        { key: 'kontakt', label: 'Kontakt & Notfall' },
                        { key: 'lv', label: 'Leistungsvereinbarung' },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setAktTab(tab.key)} style={{
                            padding: '.5rem 1rem', fontSize: 12, fontWeight: aktTab === tab.key ? 600 : 400,
                            cursor: 'pointer', border: 'none', background: 'transparent',
                            color: aktTab === tab.key ? '#2563EB' : '#6B6860',
                            borderBottom: aktTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                            fontFamily: 'inherit'
                        }}>{tab.label}</button>
                    ))}
                </div>
            </div>

            {/* Stammdaten */}
            {aktTab === 'stamm' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={CARD}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Persönliche Daten</div>
                            <FRow label="Nachname"    name="nachname"    form={form} onChange={handleChange} />
                            <FRow label="Vorname"     name="vorname"     form={form} onChange={handleChange} />
                            <FRow label="Geburtsdatum" name="geburtsdatum" type="date" form={form} onChange={handleChange} />
                            <FRow label="AHV-Nummer"  name="ahv_nummer"  form={form} onChange={handleChange} />
                            <FRow label="Adresse"     name="adresse"     form={form} onChange={handleChange} />
                            <FRow label="PLZ"         name="plz"         form={form} onChange={handleChange} />
                            <FRow label="Ort"         name="ort"         form={form} onChange={handleChange} />
                        </div>
                        <div style={CARD}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Kontaktdaten</div>
                            <FRow label="Telefon" name="telefon" form={form} onChange={handleChange} />
                            <FRow label="E-Mail"  name="email"   form={form} onChange={handleChange} />
                            {klient.auftraggeber && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>Zuweisende Stelle</div>
                                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{klient.auftraggeber}</div>
                                    {klient.programm_name && (
                                        <span style={{
                                            display: 'inline-block', marginTop: 5, fontSize: 11, padding: '2px 7px',
                                            borderRadius: 20, background: (FARBEN[klient.programm_name] || '#888') + '22',
                                            color: FARBEN[klient.programm_name] || '#888',
                                            border: `1px solid ${FARBEN[klient.programm_name] || '#888'}33`
                                        }}>{klient.programm_name}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <SaveBar laden={speichern} gespeichert={gespeichert} onSpeichern={handleSpeichern} />
                </div>
            )}

            {/* Kontakt & Notfall */}
            {aktTab === 'kontakt' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={CARD}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Notfallkontakt</div>
                            <FRow label="Name"      name="notfall_name"      form={form} onChange={handleChange} />
                            <FRow label="Beziehung" name="notfall_beziehung" form={form} onChange={handleChange} />
                            <FRow label="Telefon"   name="notfall_telefon"   form={form} onChange={handleChange} />
                        </div>
                        <div style={CARD}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Gesetzlicher Vertreter</div>
                            <FRow label="Name"     name="vertreter_name"     form={form} onChange={handleChange} />
                            <FRow label="Funktion" name="vertreter_funktion" form={form} onChange={handleChange} />
                            <FRow label="Telefon"  name="vertreter_telefon"  form={form} onChange={handleChange} />
                        </div>
                    </div>
                    <SaveBar laden={speichern} gespeichert={gespeichert} onSpeichern={handleSpeichern} />
                </div>
            )}

            {/* Leistungsvereinbarung */}
            {aktTab === 'lv' && (
                <div style={CARD}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.875rem' }}>Leistungsvereinbarung & Präsenzzeiten</div>
                    {klient.pensum_pct ? (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ background: '#F5F4F0', borderRadius: 8, padding: '12px 16px', flex: 1, minWidth: 120 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Pensum</div>
                                <div style={{ fontSize: 22, fontWeight: 600, color: '#2563EB' }}>{klient.pensum_pct}%</div>
                            </div>
                            <div style={{ background: '#F5F4F0', borderRadius: 8, padding: '12px 16px', flex: 1, minWidth: 120 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Präsenztage</div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>{tage.join(', ') || '—'}</div>
                            </div>
                            <div style={{ background: '#F5F4F0', borderRadius: 8, padding: '12px 16px', flex: 1, minWidth: 120 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Zeiten</div>
                                <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'monospace' }}>
                                    {klient.zeit_von?.slice(0,5)} – {klient.zeit_bis?.slice(0,5)}
                                </div>
                                <div style={{ fontSize: 11, color: '#6B6860', marginTop: 2 }}>{klient.zeitbasis}</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: '#6B6860' }}>Keine Leistungsvereinbarung hinterlegt</div>
                    )}
                    {klient.lv_bemerkung && (
                        <div style={{ marginTop: 12, padding: '9px 12px', background: '#F5F4F0', borderRadius: 6, fontSize: 12, color: '#6B6860', borderLeft: '3px solid rgba(0,0,0,.09)' }}>
                            {klient.lv_bemerkung}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
