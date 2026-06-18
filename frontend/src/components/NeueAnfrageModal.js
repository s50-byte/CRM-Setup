import { useState } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const KANAELE = ['Telefon', 'E-Mail', 'Direkt', 'Empfehlung'];

const LEER = { nachname: '', vorname: '', kanal: 'Telefon', notiz: '' };

export default function NeueAnfrageModal({ open, onClose, onSaved }) {
    const [form, setForm] = useState(LEER);
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function speichern() {
        if (!form.nachname.trim() || !form.vorname.trim()) {
            setFehler('Vorname und Nachname sind Pflichtfelder');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            const klientRes = await client.post('/klienten', {
                nachname: form.nachname.trim(),
                vorname: form.vorname.trim(),
            });
            const klient_id = klientRes.data.klient_id;

            await client.post('/dossiers', {
                klient_id,
                kanal: form.kanal,
            });

            if (form.notiz.trim()) {
                await client.post('/journal', {
                    klient_id,
                    kategorie: 'Sonstiges',
                    datum: new Date().toISOString().slice(0, 10),
                    text: form.notiz.trim(),
                });
            }

            onSaved();
            onClose();
            setForm(LEER);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Neue Anfrage erfassen">
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}
            <div style={rowStyle}>
                <FormField label="Vorname *">
                    <input style={inputStyle} value={form.vorname} onChange={e => set('vorname', e.target.value)} placeholder="Vorname" autoFocus />
                </FormField>
                <FormField label="Nachname *">
                    <input style={inputStyle} value={form.nachname} onChange={e => set('nachname', e.target.value)} placeholder="Nachname" />
                </FormField>
            </div>
            <FormField label="Eingangskanal *">
                <select style={inputStyle} value={form.kanal} onChange={e => set('kanal', e.target.value)}>
                    {KANAELE.map(k => <option key={k}>{k}</option>)}
                </select>
            </FormField>
            <FormField label="Notiz / Erstinformation">
                <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
                    value={form.notiz}
                    onChange={e => set('notiz', e.target.value)}
                    placeholder="Kurze Situationsbeschreibung…"
                />
            </FormField>
            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Anfrage erfassen'}
                </button>
            </div>
        </Modal>
    );
}
