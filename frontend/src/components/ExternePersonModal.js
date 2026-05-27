import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const TYPEN = ['IV-Stelle', 'RAV', 'Sozialdienst', 'Arbeitgeber', 'Arzt / Therapeut', 'Gesetzl. Vertreter', 'Sonstiges'];

const LEER = { nachname: '', vorname: '', funktion: '', typ: 'Sonstiges', firma: '', telefon: '', email: '', adresse: '', bemerkung: '' };

export default function ExternePersonModal({ open, onClose, onSaved, person }) {
    const bearbeiten = !!person;
    const [form, setForm] = useState(LEER);
    const [fehler, setFehler] = useState('');
    const [speichern, setSpeichern] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFehler('');
        setForm(person
            ? { nachname: person.nachname || '', vorname: person.vorname || '', funktion: person.funktion || '', typ: person.typ || 'Sonstiges', firma: person.firma || '', telefon: person.telefon || '', email: person.email || '', adresse: person.adresse || '', bemerkung: person.bemerkung || '' }
            : LEER
        );
    }, [open, person]);

    function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

    async function handleSpeichern() {
        if (!form.nachname.trim() || !form.vorname.trim()) {
            setFehler('Nachname und Vorname sind erforderlich');
            return;
        }
        setFehler('');
        setSpeichern(true);
        try {
            if (bearbeiten) {
                await client.put(`/externe/${person.person_id}`, form);
            } else {
                await client.post('/externe', form);
            }
            onSaved();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setSpeichern(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={bearbeiten ? 'Externe Person bearbeiten' : 'Neue externe Person'} width={600}>
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

            <div style={rowStyle}>
                <FormField label="Funktion">
                    <input style={inputStyle} value={form.funktion} onChange={e => set('funktion', e.target.value)} placeholder="z.B. Sachbearbeiterin" />
                </FormField>
                <FormField label="Typ">
                    <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                        {TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </FormField>
            </div>

            <FormField label="Firma / Organisation">
                <input style={inputStyle} value={form.firma} onChange={e => set('firma', e.target.value)} placeholder="z.B. IV-Stelle Kanton Zürich" />
            </FormField>

            <div style={rowStyle}>
                <FormField label="Telefon">
                    <input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+41 44 123 45 67" />
                </FormField>
                <FormField label="E-Mail">
                    <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="max.muster@beispiel.ch" />
                </FormField>
            </div>

            <FormField label="Adresse">
                <input style={inputStyle} value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Strasse Nr., PLZ Ort" />
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
                <button style={{ ...btnPrimary, opacity: speichern ? .6 : 1, cursor: speichern ? 'default' : 'pointer' }} onClick={handleSpeichern} disabled={speichern}>
                    {speichern ? 'Speichern…' : 'Speichern'}
                </button>
            </div>
        </Modal>
    );
}
