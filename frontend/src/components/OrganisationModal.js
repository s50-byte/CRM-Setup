import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const TYPEN = [
    'IV-Stelle', 'RAV', 'Sozialdienst', 'Arbeitgeber / Partnerfirma',
    'Krankenversicherung', 'Betreutes Wohnen', 'Schule', 'Ausgleichskasse', 'Sonstiges',
];

const LEER = {
    firma: '', typ: 'Sonstiges',
    adresse: '', plz: '', ort: '',
    telefon: '', fax: '', email: '', bemerkung: '',
};

export default function OrganisationModal({ open, onClose, onSaved, organisation }) {
    const bearbeiten = !!organisation;
    const [form, setForm] = useState(LEER);
    const [fehler, setFehler] = useState('');
    const [speichern, setSpeichern] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFehler('');
        setForm(organisation ? {
            firma:    organisation.firma    || '',
            typ:      organisation.typ      || 'Sonstiges',
            adresse:  organisation.adresse  || '',
            plz:      organisation.plz      || '',
            ort:      organisation.ort      || '',
            telefon:  organisation.telefon  || '',
            fax:      organisation.fax      || '',
            email:    organisation.email    || '',
            bemerkung:organisation.bemerkung|| '',
        } : { ...LEER });
    }, [open, organisation]);

    function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

    async function handleSpeichern() {
        if (!form.firma.trim()) { setFehler('Name der Organisation ist erforderlich'); return; }
        setFehler('');
        setSpeichern(true);
        try {
            const body = {
                ...form,
                ist_organisation: true,
                nachname: form.firma,
                vorname: '',
            };
            if (bearbeiten) {
                await client.put(`/externe/${organisation.person_id}`, body);
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

    return (
        <Modal open={open} onClose={onClose} title={bearbeiten ? 'Organisation bearbeiten' : 'Neue Organisation'} width={560}>
            {fehler && (
                <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '9px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>
                    {fehler}
                </div>
            )}

            <FormField label="Name der Organisation *">
                <input
                    style={inputStyle}
                    value={form.firma}
                    onChange={e => set('firma', e.target.value)}
                    placeholder="z.B. IV-Stelle Zürich"
                    autoFocus
                />
            </FormField>

            <FormField label="Typ *">
                <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                    {TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </FormField>

            <FormField label="Adresse (Strasse + Nr.)">
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
                    <input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+41 71 123 45 67" />
                </FormField>
                <FormField label="Fax">
                    <input style={inputStyle} value={form.fax} onChange={e => set('fax', e.target.value)} placeholder="+41 71 123 45 68" />
                </FormField>
            </div>

            <FormField label="E-Mail">
                <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@organisation.ch" />
            </FormField>

            <FormField label="Bemerkung">
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
