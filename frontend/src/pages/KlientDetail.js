import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

const FARBEN = {
    'IV-Massnahme': '#2563EB', 'Erstmalige berufliche Ausbildung': '#16A34A',
    'Beratung & Coaching': '#7C3AED', 'Erstmalige berufliche Abklärung': '#EA580C',
    'Gezielte Vorbereitung': '#D97706'
};

export default function KlientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [klient, setKlient] = useState(null);
    const [laden, setLaden] = useState(true);
    const [aktTab, setAktTab] = useState('stamm');

    useEffect(() => {
        client.get(`/klienten/${id}`)
            .then(r => setKlient(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [id]);

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
            <div style={{
                background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                borderRadius: 10, padding: '1rem', marginBottom: '.875rem',
                boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
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
                    <button onClick={() => navigate(`/dossiers`)} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                    }}>Stammdaten →</button>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Persönliche Daten</div>
                        {[
                            { label: 'Nachname', value: klient.nachname },
                            { label: 'Vorname', value: klient.vorname },
                            { label: 'Geburtsdatum', value: klient.geburtsdatum ? new Date(klient.geburtsdatum).toLocaleDateString('de-CH') : '—' },
                            { label: 'AHV-Nummer', value: klient.ahv_nummer || '—' },
                            { label: 'Adresse', value: klient.adresse || '—' },
                            { label: 'PLZ / Ort', value: klient.plz && klient.ort ? `${klient.plz} ${klient.ort}` : '—' },
                        ].map((f, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>{f.label}</span>
                                <span style={{ fontWeight: 500 }}>{f.value}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Kontaktdaten</div>
                        {[
                            { label: 'Telefon', value: klient.telefon || '—' },
                            { label: 'E-Mail', value: klient.email || '—' },
                        ].map((f, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>{f.label}</span>
                                <span style={{ fontWeight: 500, color: f.label === 'E-Mail' ? '#2563EB' : '#1A1917' }}>{f.value}</span>
                            </div>
                        ))}
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
            )}

            {/* Kontakt & Notfall */}
            {aktTab === 'kontakt' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Notfallkontakt</div>
                        {klient.notfall_name ? (
                            <>
                                {[
                                    { label: 'Name', value: klient.notfall_name },
                                    { label: 'Beziehung', value: klient.notfall_beziehung || '—' },
                                    { label: 'Telefon', value: klient.notfall_telefon || '—' },
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12.5 }}>
                                        <span style={{ color: '#6B6860' }}>{f.label}</span>
                                        <span style={{ fontWeight: 500 }}>{f.value}</span>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Kein Notfallkontakt hinterlegt</div>
                        )}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Gesetzlicher Vertreter</div>
                        {klient.vertreter_name ? (
                            <>
                                {[
                                    { label: 'Name', value: klient.vertreter_name },
                                    { label: 'Funktion', value: klient.vertreter_funktion || '—' },
                                    { label: 'Telefon', value: klient.vertreter_telefon || '—' },
                                ].map((f, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12.5 }}>
                                        <span style={{ color: '#6B6860' }}>{f.label}</span>
                                        <span style={{ fontWeight: 500 }}>{f.value}</span>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Kein gesetzlicher Vertreter hinterlegt</div>
                        )}
                    </div>
                </div>
            )}

            {/* Leistungsvereinbarung */}
            {aktTab === 'lv' && (
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
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