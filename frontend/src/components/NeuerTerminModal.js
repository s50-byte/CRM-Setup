import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const TYPEN = ['Erstgespräch', 'Schnuppereinsatz', 'Standortgespräch', 'Programmstart', 'Abschlussgespräch'];

export default function NeuerTerminModal({ open, onClose, onSaved, klientId }) {
    const [form, setForm] = useState({
        klient_id: klientId || '', typ: 'Erstgespräch', datum: '', zeit: '', notiz: ''
    });
    const [klienten, setKlienten] = useState([]);
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (open && !klientId) {
            client.get('/klienten').then(r => setKlienten(r.data)).catch(console.error);
        }
        if (klientId) setForm(prev => ({ ...prev, klient_id: klientId }));
    }, [open, klientId]);

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function speichern() {
        if (!form.klient_id || !form.datum) {
            setFehler('Klient und Datum sind Pflichtfelder');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            await client.post('/termine', {
                klient_id: form.klient_id,
                typ: form.typ,
                datum: form.datum,
                zeit: form.zeit || null,
                notiz: form.notiz || null,
            });
            onSaved();
            onClose();
            setForm({ klient_id: klientId || '', typ: 'Erstgespräch', datum: '', zeit: '', notiz: '' });
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Neuer Termin">
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}
            {!klientId && (
                <FormField label="Klient/in *">
                    <select style={inputStyle} value={form.klient_id} onChange={e => set('klient_id', e.target.value)}>
                        <option value="">— Klient auswählen —</option>
                        {klienten.map(k => (
                            <option key={k.klient_id} value={k.klient_id}>{k.nachname} {k.vorname}</option>
                        ))}
                    </select>
                </FormField>
            )}
            <FormField label="Typ">
                <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                    {TYPEN.map(t => <option key={t}>{t}</option>)}
                </select>
            </FormField>
            <div style={rowStyle}>
                <FormField label="Datum *">
                    <input type="date" style={inputStyle} value={form.datum} onChange={e => set('datum', e.target.value)} />
                </FormField>
                <FormField label="Zeit">
                    <input type="time" style={inputStyle} value={form.zeit} onChange={e => set('zeit', e.target.value)} />
                </FormField>
            </div>
            <FormField label="Notiz">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', lineHeight: 1.5 }}
                    value={form.notiz} onChange={e => set('notiz', e.target.value)}
                    placeholder="Optional…"
                />
            </FormField>
            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Termin erfassen'}
                </button>
            </div>
        </Modal>
    );
}