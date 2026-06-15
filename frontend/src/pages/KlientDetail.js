import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import FerienModal from '../components/FerienModal';

const FARBEN = {
    'Erstmalige berufliche Abklärung': '#EA580C',
    'Gezielte Vorbereitung':           '#D97706',
    'Erstmalige berufliche Ausbildung':'#16A34A',
    'IM für Jugendliche':              '#DC2626',
    'Aufbautraining':                  '#0D9488',
    'Arbeitstraining':                 '#0891B2',
    'Beratung & Coaching':             '#7C3AED',
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
    const [anredeModus, setAnredeModus] = useState('');
    const [speichern, setSpeichern] = useState(false);
    const [gespeichert, setGespeichert] = useState(false);
    const [lvForm, setLvForm] = useState({});
    const [lvSpeichern, setLvSpeichern] = useState(false);
    const [lvGespeichert, setLvGespeichert] = useState(false);

    const [ferien, setFerien] = useState([]);
    const [ferienLaden, setFerienLaden] = useState(false);
    const [ferienModal, setFerienModal] = useState(false);

    function initLvForm(data) {
        setLvForm({
            pensum_pct:  data.pensum_pct  ?? 100,
            tage_mo:     data.tage_mo     ?? true,
            tage_di:     data.tage_di     ?? true,
            tage_mi:     data.tage_mi     ?? true,
            tage_do:     data.tage_do     ?? true,
            tage_fr:     data.tage_fr     ?? true,
            zeit_von:    data.zeit_von    ? data.zeit_von.slice(0,5) : '08:00',
            zeit_bis:    data.zeit_bis    ? data.zeit_bis.slice(0,5) : '17:00',
            zeitbasis:   data.zeitbasis   || 'Ganztagesbasis',
            lv_bemerkung:data.lv_bemerkung|| '',
            gueltig_ab:  data.gueltig_ab  ? data.gueltig_ab.slice(0,10) : new Date().toISOString().slice(0,10),
            gueltig_bis: data.gueltig_bis ? data.gueltig_bis.slice(0,10) : '',
        });
    }

    useEffect(() => {
        client.get(`/klienten/${id}`)
            .then(r => {
                setKlient(r.data); setForm(r.data); initLvForm(r.data);
                setAnredeModus(['Herr', 'Frau'].includes(r.data.anrede) ? r.data.anrede : (r.data.anrede ? 'Andere' : ''));
            })
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

    const handleLvSpeichern = async () => {
        setLvSpeichern(true);
        try {
            const payload = {
                pensum_pct:  Number(lvForm.pensum_pct),
                tage_mo:     lvForm.tage_mo,
                tage_di:     lvForm.tage_di,
                tage_mi:     lvForm.tage_mi,
                tage_do:     lvForm.tage_do,
                tage_fr:     lvForm.tage_fr,
                zeit_von:    lvForm.zeit_von,
                zeit_bis:    lvForm.zeit_bis,
                zeitbasis:   lvForm.zeitbasis,
                bemerkung:   lvForm.lv_bemerkung || null,
                gueltig_ab:  lvForm.gueltig_ab,
                gueltig_bis: lvForm.gueltig_bis || null,
            };
            const r = klient.lv_id
                ? await client.put(`/klienten/${id}/lv`, payload)
                : await client.post(`/klienten/${id}/lv`, payload);
            const updated = { ...r.data, lv_bemerkung: r.data.bemerkung };
            setKlient(prev => ({ ...prev, ...updated }));
            initLvForm({ ...updated, lv_bemerkung: r.data.bemerkung });
            setLvGespeichert(true);
            setTimeout(() => setLvGespeichert(false), 2500);
        } catch (err) {
            console.error(err);
        } finally {
            setLvSpeichern(false);
        }
    };

    function ladeFerien() {
        setFerienLaden(true);
        client.get(`/praesenz/ferien/${id}`)
            .then(r => setFerien(r.data))
            .catch(console.error)
            .finally(() => setFerienLaden(false));
    }

    async function loescheFerien(ferien_id) {
        try {
            await client.delete(`/praesenz/ferien/${ferien_id}`);
            setFerien(prev => prev.filter(f => f.ferien_id !== ferien_id));
        } catch (err) { console.error(err); }
    }

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
                        { key: 'ferien', label: 'Ferien' },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => {
                            setAktTab(tab.key);
                            if (tab.key === 'ferien' && ferien.length === 0) ladeFerien();
                        }} style={{
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
                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Anrede</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <select
                                        value={anredeModus}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setAnredeModus(val);
                                            if (val === 'Andere') {
                                                setForm(f => ({ ...f, anrede: !['', 'Herr', 'Frau'].includes(f.anrede) ? f.anrede : '' }));
                                            } else {
                                                setForm(f => ({ ...f, anrede: val }));
                                            }
                                        }}
                                        style={{ ...INPUT_STYLE, flex: anredeModus === 'Andere' ? '0 0 110px' : 1 }}
                                    >
                                        <option value="">—</option>
                                        <option value="Herr">Herr</option>
                                        <option value="Frau">Frau</option>
                                        <option value="Andere">Andere</option>
                                    </select>
                                    {anredeModus === 'Andere' && (
                                        <input
                                            type="text"
                                            value={form.anrede || ''}
                                            onChange={e => setForm(f => ({ ...f, anrede: e.target.value }))}
                                            placeholder="Anrede"
                                            style={INPUT_STYLE}
                                        />
                                    )}
                                </div>
                            </div>
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
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Pensum & Zeiten */}
                        <div style={CARD}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Pensum & Zeiten</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Pensum %</span>
                                <input
                                    type="number" min={10} max={100}
                                    value={lvForm.pensum_pct}
                                    onChange={e => setLvForm(f => ({ ...f, pensum_pct: e.target.value }))}
                                    style={INPUT_STYLE}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Präsenztage</span>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {[['tage_mo','Mo'],['tage_di','Di'],['tage_mi','Mi'],['tage_do','Do'],['tage_fr','Fr']].map(([key, label]) => (
                                        <label key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 11, color: '#6B6860' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!lvForm[key]}
                                                onChange={e => setLvForm(f => ({ ...f, [key]: e.target.checked }))}
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Zeit von</span>
                                <input type="time" value={lvForm.zeit_von} onChange={e => setLvForm(f => ({ ...f, zeit_von: e.target.value }))} style={INPUT_STYLE} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Zeit bis</span>
                                <input type="time" value={lvForm.zeit_bis} onChange={e => setLvForm(f => ({ ...f, zeit_bis: e.target.value }))} style={INPUT_STYLE} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Zeitbasis</span>
                                <select value={lvForm.zeitbasis} onChange={e => setLvForm(f => ({ ...f, zeitbasis: e.target.value }))} style={INPUT_STYLE}>
                                    <option>Stundenbasis</option>
                                    <option>Halbtagesbasis</option>
                                    <option>Ganztagesbasis</option>
                                </select>
                            </div>
                        </div>

                        {/* Gültigkeit & Bemerkung */}
                        <div style={CARD}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>Gültigkeit & Bemerkung</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Gültig ab</span>
                                <input type="date" value={lvForm.gueltig_ab} onChange={e => setLvForm(f => ({ ...f, gueltig_ab: e.target.value }))} style={INPUT_STYLE} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)', alignItems: 'center', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860' }}>Gültig bis</span>
                                <input type="date" value={lvForm.gueltig_bis} onChange={e => setLvForm(f => ({ ...f, gueltig_bis: e.target.value }))} style={INPUT_STYLE} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', padding: '8px 0', alignItems: 'start', fontSize: 12.5 }}>
                                <span style={{ color: '#6B6860', paddingTop: 4 }}>Bemerkung</span>
                                <textarea
                                    rows={5}
                                    value={lvForm.lv_bemerkung}
                                    onChange={e => setLvForm(f => ({ ...f, lv_bemerkung: e.target.value }))}
                                    style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.5 }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: '1rem' }}>
                        {lvGespeichert && <span style={{ fontSize: 12.5, color: '#16A34A' }}>Gespeichert ✓</span>}
                        <button onClick={handleLvSpeichern} disabled={lvSpeichern} style={{
                            padding: '7px 18px', fontSize: 13, fontWeight: 500,
                            cursor: lvSpeichern ? 'default' : 'pointer', border: 'none', borderRadius: 6,
                            background: lvSpeichern ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>Speichern</button>
                    </div>
                </div>
            )}

            {/* Ferien */}
            {aktTab === 'ferien' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.75rem' }}>
                        <button onClick={() => setFerienModal(true)} style={{
                            padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>+ Ferien erfassen</button>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
                        {ferienLaden ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Laden…</div>
                        ) : ferien.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 12 }}>Keine Ferieneinträge</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                <thead>
                                    <tr style={{ background: '#F5F4F0', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                                        {['Von', 'Bis', 'Dauer', 'Bemerkung', 'Abgesprochen mit', 'Status', ''].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ferien.map((f, i) => {
                                        const von = new Date(f.von);
                                        const bis = new Date(f.bis);
                                        const tage = Math.round((bis - von) / (1000*60*60*24)) + 1;
                                        return (
                                            <tr key={f.ferien_id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{von.toLocaleDateString('de-CH')}</td>
                                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{bis.toLocaleDateString('de-CH')}</td>
                                                <td style={{ padding: '8px 12px', color: '#6B6860' }}>{tage} Tag{tage !== 1 ? 'e' : ''}</td>
                                                <td style={{ padding: '8px 12px', color: '#6B6860', maxWidth: 200 }}>{f.bemerkung || '—'}</td>
                                                <td style={{ padding: '8px 12px', color: '#6B6860' }}>{f.abgesprochen_mit_name || '—'}</td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <span style={{
                                                        fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 500,
                                                        background: f.genehmigt ? '#DCFCE7' : '#FEF3C7',
                                                        color: f.genehmigt ? '#15803D' : '#B45309',
                                                    }}>{f.genehmigt ? 'Genehmigt' : 'Ausstehend'}</span>
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                    <button onClick={() => loescheFerien(f.ferien_id)} style={{
                                                        fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                                                        border: '1px solid rgba(220,38,38,.2)', borderRadius: 5,
                                                        background: '#FEF2F2', color: '#B91C1C', fontFamily: 'inherit'
                                                    }}>Löschen</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <FerienModal
                        open={ferienModal}
                        onClose={() => setFerienModal(false)}
                        klientId={klient.klient_id}
                        onSaved={() => { setFerienModal(false); ladeFerien(); }}
                    />
                </div>
            )}
        </div>
    );
}
