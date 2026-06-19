import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import Modal from '../components/Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from '../components/FormField';
import { useAuth } from '../context/AuthContext';

function LehrberufeAbschnitt({ standortId }) {
    const [berufe, setBerufe] = useState([]);
    const [laden, setLaden] = useState(true);
    const [speichernBeruf, setSpeichernBeruf] = useState(null);

    const ladeBerufe = useCallback(() => {
        client.get(`/standorte/${standortId}/lehrberufe`)
            .then(r => setBerufe(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [standortId]);

    useEffect(() => { ladeBerufe(); }, [ladeBerufe]);

    async function speichern(beruf, felder) {
        setSpeichernBeruf(beruf);
        const aktuell = berufe.find(b => b.beruf === beruf);
        try {
            const r = await client.put(`/standorte/${standortId}/lehrberufe/${encodeURIComponent(beruf)}`, {
                aktiv: aktuell.aktiv, bewilligte_plaetze: aktuell.bewilligte_plaetze, total_plaetze: aktuell.total_plaetze,
                ...felder,
            });
            setBerufe(prev => prev.map(b => b.beruf === beruf ? r.data : b));
        } catch (err) {
            console.error(err);
        } finally {
            setSpeichernBeruf(null);
        }
    }

    function setFeld(beruf, feld, value) {
        setBerufe(prev => prev.map(b => b.beruf === beruf ? { ...b, [feld]: value } : b));
    }

    if (laden) return null;

    return (
        <div style={{ marginTop: '.75rem', paddingTop: '.75rem', borderTop: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>Lehrberufe</div>
            {berufe.map(b => (
                <div key={b.beruf} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                    <div
                        onClick={() => speichern(b.beruf, { aktiv: !b.aktiv })}
                        style={{
                            width: 30, height: 17, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0,
                            background: b.aktiv ? '#2563EB' : '#D1D5DB', transition: 'background .15s',
                        }}
                    >
                        <div style={{
                            position: 'absolute', top: 2, left: b.aktiv ? 15 : 2,
                            width: 13, height: 13, borderRadius: '50%', background: '#fff',
                            boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s',
                        }} />
                    </div>
                    <span style={{ fontSize: 12, flex: 1, color: b.aktiv ? '#1A1917' : '#A09D97', minWidth: 0 }}>{b.beruf}</span>
                    <input
                        type="number" min="0" value={b.bewilligte_plaetze}
                        onChange={e => setFeld(b.beruf, 'bewilligte_plaetze', parseInt(e.target.value) || 0)}
                        onBlur={() => speichern(b.beruf, { bewilligte_plaetze: b.bewilligte_plaetze })}
                        title="Bewilligte Plätze"
                        style={{ width: 44, fontSize: 11.5, padding: '3px 5px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 4, fontFamily: 'inherit', textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 10.5, color: '#A09D97' }}>/</span>
                    <input
                        type="number" min="0" value={b.total_plaetze}
                        onChange={e => setFeld(b.beruf, 'total_plaetze', parseInt(e.target.value) || 0)}
                        onBlur={() => speichern(b.beruf, { total_plaetze: b.total_plaetze })}
                        title="Total Plätze (geplant)"
                        style={{ width: 44, fontSize: 11.5, padding: '3px 5px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 4, fontFamily: 'inherit', textAlign: 'right' }}
                    />
                    {speichernBeruf === b.beruf && <span style={{ fontSize: 10, color: '#A09D97' }}>…</span>}
                </div>
            ))}
        </div>
    );
}

export default function Standorte() {
    const { managementModus } = useAuth();
    const [standorte, setStandorte] = useState([]);
    const [laden, setLaden] = useState(true);
    const [modal, setModal] = useState(false);
    const [bearbeitenId, setBearbeitenId] = useState(null);
    const [form, setForm] = useState({ name: '', kuerzel: '', adresse: '', plz: '', ort: '', telefon: '', email: '', aktiv: true });
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        laden && client.get('/standorte')
            .then(r => setStandorte(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [laden]);

    function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

    function neuerStandortOeffnen() {
        setBearbeitenId(null);
        setForm({ name: '', kuerzel: '', adresse: '', plz: '', ort: '', telefon: '', email: '', aktiv: true });
        setFehler('');
        setModal(true);
    }

    function bearbeitenOeffnen(s) {
        setBearbeitenId(s.standort_id);
        setForm({
            name: s.name || '', kuerzel: s.kuerzel || '', adresse: s.adresse || '',
            plz: s.plz || '', ort: s.ort || '', telefon: s.telefon || '', email: s.email || '',
            aktiv: s.aktiv !== false,
        });
        setFehler('');
        setModal(true);
    }

    async function speichern() {
        if (!form.name || !form.kuerzel) { setFehler('Name und Kürzel erforderlich'); return; }
        setFehler('');
        try {
            if (bearbeitenId) {
                await client.put(`/standorte/${bearbeitenId}`, form);
            } else {
                await client.post('/standorte', form);
            }
            setModal(false);
            setBearbeitenId(null);
            setLaden(true);
            setForm({ name: '', kuerzel: '', adresse: '', plz: '', ort: '', telefon: '', email: '', aktiv: true });
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Standorte</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Standorte und Filialen verwalten</div>
                </div>
                {managementModus && (
                    <button onClick={neuerStandortOeffnen} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>+ Neuer Standort</button>
                )}
            </div>

            {!managementModus && (
                <div style={{
                    background: '#FFFBEB', border: '1px solid rgba(217,119,6,.2)',
                    borderRadius: 8, padding: '10px 14px', fontSize: 12.5,
                    color: '#92400E', marginBottom: '1rem'
                }}>
                    Standorte verwalten ist nur im Management-Bereich verfügbar.
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {laden ? (
                    <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>
                ) : standorte.map((s, i) => (
                    <div key={i} style={{
                        background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                        borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.75rem' }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: '#EEF3FE', color: '#1D4ED8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 600, fontFamily: 'monospace'
                            }}>{s.kuerzel}</div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: '#6B6860' }}>{s.ort || '—'}</div>
                            </div>
                            <span style={{
                                marginLeft: 'auto', fontSize: 11, padding: '2px 7px',
                                borderRadius: 20, fontFamily: 'monospace',
                                background: s.aktiv ? '#ECFDF5' : '#FEF2F2',
                                color: s.aktiv ? '#15803D' : '#B91C1C',
                                border: `1px solid ${s.aktiv ? 'rgba(22,163,74,.15)' : 'rgba(220,38,38,.15)'}`
                            }}>{s.aktiv ? 'Aktiv' : 'Inaktiv'}</span>
                            {managementModus && (
                                <button onClick={() => bearbeitenOeffnen(s)} style={{
                                    padding: '3px 10px', fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
                                    cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 5,
                                    background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                                }}>Bearbeiten</button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 4, fontSize: 12 }}>
                            {s.adresse && <><span style={{ color: '#6B6860' }}>Adresse</span><span>{s.adresse}</span></>}
                            {s.plz && s.ort && <><span style={{ color: '#6B6860' }}>PLZ / Ort</span><span>{s.plz} {s.ort}</span></>}
                            {s.telefon && <><span style={{ color: '#6B6860' }}>Telefon</span><span>{s.telefon}</span></>}
                            {s.email && <><span style={{ color: '#6B6860' }}>E-Mail</span><span style={{ color: '#2563EB' }}>{s.email}</span></>}
                        </div>
                        {(s.benutzer || []).length > 0 && (
                            <div style={{ marginTop: '.75rem', paddingTop: '.75rem', borderTop: '1px solid rgba(0,0,0,.06)' }}>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>Zugewiesen</div>
                                {(s.benutzer || []).slice(0, 4).map(u => (
                                    <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                                            background: '#EEF3FE', color: '#1D4ED8',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9.5, fontWeight: 600
                                        }}>{u.avatar_initials || u.full_name?.split(' ').map(n => n[0]).join('').slice(0, 3)}</div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</div>
                                            {(u.rollen || []).length > 0 && (
                                                <div style={{ fontSize: 10.5, color: '#6B6860', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {u.rollen.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(s.benutzer || []).length > 4 && (
                                    <div style={{ fontSize: 11, color: '#6B6860', paddingLeft: 34, marginTop: 2 }}>
                                        + {s.benutzer.length - 4} weitere
                                    </div>
                                )}
                            </div>
                        )}
                        {managementModus && <LehrberufeAbschnitt standortId={s.standort_id} />}
                    </div>
                ))}
            </div>

            <Modal open={modal} onClose={() => { setModal(false); setBearbeitenId(null); }} title={bearbeitenId ? 'Standort bearbeiten' : 'Neuer Standort'}>
                {fehler && <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '9px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>{fehler}</div>}
                <div style={rowStyle}>
                    <FormField label="Name *"><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Zürich Hauptsitz" /></FormField>
                    <FormField label="Kürzel *"><input style={inputStyle} value={form.kuerzel} onChange={e => set('kuerzel', e.target.value.toUpperCase())} placeholder="z.B. ZH" maxLength={10} /></FormField>
                </div>
                <FormField label="Adresse"><input style={inputStyle} value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Strasse Nr." /></FormField>
                <div style={rowStyle}>
                    <FormField label="PLZ"><input style={inputStyle} value={form.plz} onChange={e => set('plz', e.target.value)} placeholder="8000" /></FormField>
                    <FormField label="Ort"><input style={inputStyle} value={form.ort} onChange={e => set('ort', e.target.value)} placeholder="Zürich" /></FormField>
                </div>
                <div style={rowStyle}>
                    <FormField label="Telefon"><input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} /></FormField>
                    <FormField label="E-Mail"><input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} /></FormField>
                </div>
                {bearbeitenId && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#1A1917', marginTop: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.aktiv !== false} onChange={e => set('aktiv', e.target.checked)} />
                        Standort aktiv
                    </label>
                )}
                <div style={btnRow}>
                    <button style={btnSecondary} onClick={() => { setModal(false); setBearbeitenId(null); }}>Abbrechen</button>
                    <button style={btnPrimary} onClick={speichern}>Speichern</button>
                </div>
            </Modal>
        </div>
    );
}