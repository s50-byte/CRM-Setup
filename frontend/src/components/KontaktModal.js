import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const BEZIEHUNGEN = [
    'Elternteil', 'Gesetzlicher Vertreter', 'Partner/in',
    'Lehrperson', 'Therapeut', 'Arzt', 'Sonstiges',
];

const LEER = {
    nachname: '', vorname: '', typ: 'Sonstiges', funktion: '',
    adresse: '', plz: '', ort: '',
    telefon: '', email: '', bemerkung: '',
    organisation_id: '',
};

export default function KontaktModal({ open, onClose, onSaved, kontakt }) {
    const bearbeiten = !!kontakt;
    const [istOrgKontakt, setIstOrgKontakt] = useState(false);
    const [form, setForm] = useState(LEER);
    const [fehler, setFehler] = useState('');
    const [speichern, setSpeichern] = useState(false);
    const [organisationen, setOrganisationen] = useState([]);
    const [gewaehlteOrg, setGewaehlteOrg] = useState(null);

    useEffect(() => {
        if (!open) return;
        setFehler('');
        client.get('/externe/organisationen').then(r => setOrganisationen(r.data)).catch(console.error);

        if (kontakt) {
            const hatOrg = !!kontakt.organisation_id;
            setIstOrgKontakt(hatOrg);
            setForm({
                nachname:       kontakt.nachname        || '',
                vorname:        kontakt.vorname         || '',
                typ:            kontakt.typ             || 'Sonstiges',
                funktion:       kontakt.funktion        || '',
                adresse:        kontakt.adresse         || '',
                plz:            kontakt.plz             || '',
                ort:            kontakt.ort             || '',
                telefon:        kontakt.telefon         || '',
                email:          kontakt.email           || '',
                bemerkung:      kontakt.bemerkung       || '',
                organisation_id:kontakt.organisation_id || '',
            });
        } else {
            setIstOrgKontakt(false);
            setForm({ ...LEER });
        }
    }, [open, kontakt]);

    useEffect(() => {
        if (!form.organisation_id || organisationen.length === 0) { setGewaehlteOrg(null); return; }
        const org = organisationen.find(o => String(o.person_id) === String(form.organisation_id));
        setGewaehlteOrg(org || null);
    }, [form.organisation_id, organisationen]);

    function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

    async function handleSpeichern() {
        if (!form.nachname.trim() || !form.vorname.trim()) {
            setFehler('Nachname und Vorname sind erforderlich');
            return;
        }
        if (istOrgKontakt && !form.organisation_id) {
            setFehler('Bitte eine Organisation auswählen');
            return;
        }
        setFehler('');
        setSpeichern(true);
        try {
            const body = {
                ...form,
                ist_organisation: false,
                organisation_id: form.organisation_id || null,
                typ: istOrgKontakt ? 'Sonstiges' : form.typ,
            };
            if (bearbeiten) {
                await client.put(`/externe/${kontakt.person_id}`, body);
            } else {
                await client.post('/externe', body);
            }
            onSaved();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setSpeichern(false);
        }
    }

    const orgAdresse = gewaehlteOrg
        ? [gewaehlteOrg.adresse, [gewaehlteOrg.plz, gewaehlteOrg.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        : null;

    return (
        <Modal open={open} onClose={onClose} title={bearbeiten ? 'Kontakt bearbeiten' : 'Neuer Kontakt'} width={560}>
            {/* Toggle Privatperson / Org-Kontakt */}
            <div style={{ display: 'flex', marginBottom: 16, border: '1px solid rgba(0,0,0,.1)', borderRadius: 7, overflow: 'hidden' }}>
                {[['Privatperson', false], ['Kontakt einer Organisation', true]].map(([label, val]) => (
                    <button
                        key={label}
                        onClick={() => !bearbeiten && setIstOrgKontakt(val)}
                        style={{
                            flex: 1, padding: '8px 12px', fontSize: 12.5,
                            cursor: bearbeiten ? 'default' : 'pointer',
                            border: 'none',
                            background: istOrgKontakt === val ? '#2563EB' : '#F5F4F0',
                            color: istOrgKontakt === val ? '#fff' : '#6B6860',
                            fontFamily: 'inherit', fontWeight: istOrgKontakt === val ? 600 : 400,
                        }}
                    >{label}</button>
                ))}
            </div>

            {fehler && (
                <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '9px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>
                    {fehler}
                </div>
            )}

            <div style={rowStyle}>
                <FormField label="Nachname *">
                    <input style={inputStyle} value={form.nachname} onChange={e => set('nachname', e.target.value)} placeholder="Muster" autoFocus />
                </FormField>
                <FormField label="Vorname *">
                    <input style={inputStyle} value={form.vorname} onChange={e => set('vorname', e.target.value)} placeholder="Max" />
                </FormField>
            </div>

            {!istOrgKontakt ? (
                <>
                    <FormField label="Beziehung zum Klienten">
                        <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                            {BEZIEHUNGEN.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Adresse">
                        <input style={inputStyle} value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Musterstrasse 1" />
                    </FormField>
                    <div style={rowStyle}>
                        <FormField label="PLZ">
                            <input style={inputStyle} value={form.plz} onChange={e => set('plz', e.target.value)} placeholder="9000" />
                        </FormField>
                        <FormField label="Ort">
                            <input style={inputStyle} value={form.ort} onChange={e => set('ort', e.target.value)} placeholder="St. Gallen" />
                        </FormField>
                    </div>
                    <div style={rowStyle}>
                        <FormField label="Telefon">
                            <input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+41 79 123 45 67" />
                        </FormField>
                        <FormField label="E-Mail">
                            <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="max.muster@beispiel.ch" />
                        </FormField>
                    </div>
                </>
            ) : (
                <>
                    <FormField label="Organisation *">
                        <select style={inputStyle} value={form.organisation_id} onChange={e => set('organisation_id', e.target.value)}>
                            <option value="">— Organisation wählen —</option>
                            {organisationen.map(o => (
                                <option key={o.person_id} value={o.person_id}>
                                    {o.firma || o.nachname}
                                </option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Funktion">
                        <input style={inputStyle} value={form.funktion} onChange={e => set('funktion', e.target.value)} placeholder="z.B. Sachbearbeiterin" />
                    </FormField>
                    <div style={rowStyle}>
                        <FormField label="Telefon direkt">
                            <input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+41 71 123 45 67" />
                        </FormField>
                        <FormField label="E-Mail direkt">
                            <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@organisation.ch" />
                        </FormField>
                    </div>
                    {gewaehlteOrg && (
                        <div style={{ background: '#F5F4F0', borderRadius: 6, padding: '8px 12px', marginBottom: 10, border: '1px solid rgba(0,0,0,.07)' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 3 }}>
                                Adresse der Organisation
                            </span>
                            <span style={{ fontSize: 12, color: '#6B6860' }}>{orgAdresse || '—'}</span>
                        </div>
                    )}
                </>
            )}

            <FormField label="Notiz">
                <textarea
                    value={form.bemerkung}
                    onChange={e => set('bemerkung', e.target.value)}
                    rows={3}
                    placeholder="Interne Notizen…"
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
            </FormField>

            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button
                    style={{ ...btnPrimary, opacity: speichern ? .6 : 1, cursor: speichern ? 'default' : 'pointer' }}
                    onClick={handleSpeichern}
                    disabled={speichern}
                >
                    {speichern ? 'Speichern…' : 'Speichern'}
                </button>
            </div>
        </Modal>
    );
}
