import { useState } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

export default function NeuerKlientModal({ open, onClose, onSaved }) {
    const [form, setForm] = useState({
        nachname: '', vorname: '', geburtsdatum: '', ahv_nummer: '',
        adresse: '', plz: '', ort: '', telefon: '', email: '',
        notfall_name: '', notfall_beziehung: '', notfall_telefon: '',
        vertreter_name: '', vertreter_funktion: '', vertreter_telefon: ''
    });
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function speichern() {
        if (!form.nachname || !form.vorname) {
            setFehler('Nachname und Vorname sind Pflichtfelder');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            await client.post('/klienten', form);
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Neuer Klient — Stammdaten" width={680}>
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}

            <div style={rowStyle}>
                <FormField label="Nachname *">
                    <input style={inputStyle} value={form.nachname} onChange={e => set('nachname', e.target.value)} placeholder="Familienname" />
                </FormField>
                <FormField label="Vorname *">
                    <input style={inputStyle} value={form.vorname} onChange={e => set('vorname', e.target.value)} placeholder="Vorname" />
                </FormField>
            </div>
            <div style={rowStyle}>
                <FormField label="Geburtsdatum">
                    <input type="date" style={inputStyle} value={form.geburtsdatum} onChange={e => set('geburtsdatum', e.target.value)} />
                </FormField>
                <FormField label="AHV-Nummer">
                    <input style={inputStyle} value={form.ahv_nummer} onChange={e => set('ahv_nummer', e.target.value)} placeholder="756.XXXX.XXXX.XX" />
                </FormField>
            </div>
            <FormField label="Adresse">
                <input style={inputStyle} value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Strasse Nr." />
            </FormField>
            <div style={rowStyle}>
                <FormField label="PLZ">
                    <input style={inputStyle} value={form.plz} onChange={e => set('plz', e.target.value)} placeholder="8000" />
                </FormField>
                <FormField label="Ort">
                    <input style={inputStyle} value={form.ort} onChange={e => set('ort', e.target.value)} placeholder="Zürich" />
                </FormField>
            </div>
            <div style={rowStyle}>
                <FormField label="Telefon">
                    <input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+41 79 XXX XX XX" />
                </FormField>
                <FormField label="E-Mail">
                    <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="vorname@mail.ch" />
                </FormField>
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '12px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Notfallkontakt</div>

            <div style={rowStyle}>
                <FormField label="Name">
                    <input style={inputStyle} value={form.notfall_name} onChange={e => set('notfall_name', e.target.value)} placeholder="Name" />
                </FormField>
                <FormField label="Beziehung">
                    <input style={inputStyle} value={form.notfall_beziehung} onChange={e => set('notfall_beziehung', e.target.value)} placeholder="z.B. Ehefrau" />
                </FormField>
            </div>
            <FormField label="Telefon Notfall">
                <input style={inputStyle} value={form.notfall_telefon} onChange={e => set('notfall_telefon', e.target.value)} placeholder="+41 79 XXX XX XX" />
            </FormField>

            <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '12px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Gesetzlicher Vertreter (optional)</div>

            <div style={rowStyle}>
                <FormField label="Name">
                    <input style={inputStyle} value={form.vertreter_name} onChange={e => set('vertreter_name', e.target.value)} placeholder="Name" />
                </FormField>
                <FormField label="Funktion">
                    <input style={inputStyle} value={form.vertreter_funktion} onChange={e => set('vertreter_funktion', e.target.value)} placeholder="z.B. Beistand" />
                </FormField>
            </div>
            <FormField label="Telefon Vertreter">
                <input style={inputStyle} value={form.vertreter_telefon} onChange={e => set('vertreter_telefon', e.target.value)} placeholder="+41 79 XXX XX XX" />
            </FormField>

            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Klient erfassen'}
                </button>
            </div>
        </Modal>
    );
}