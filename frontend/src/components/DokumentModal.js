import { useState } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const TYPEN = [
    'IV-Verfügung', 'Lebenslauf', 'Arztbericht', 'Anmeldeformular',
    'Leistungsvereinbarung', 'Abschlussbericht', 'Erstgesprächsprotokoll', 'Sonstiges',
];

export default function DokumentModal({ open, onClose, onSaved, klientId, phaseId }) {
    const [form, setForm] = useState({ dateiname: '', typ: 'Sonstiges' });
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function handleFile(e) {
        const file = e.target.files?.[0];
        if (file && !form.dateiname) {
            setForm(prev => ({ ...prev, dateiname: file.name }));
        }
    }

    async function speichern() {
        if (!form.dateiname.trim()) {
            setFehler('Dateiname erforderlich');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            await client.post('/dokumente', {
                klient_id: klientId,
                phase_id: phaseId || null,
                dateiname: form.dateiname.trim(),
                typ: form.typ,
            });
            onSaved();
            onClose();
            setForm({ dateiname: '', typ: 'Sonstiges' });
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Dokument erfassen">
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}
            <FormField label="Datei wählen">
                <input type="file" style={{ ...inputStyle, padding: '6px 8px' }} onChange={handleFile} />
            </FormField>
            <FormField label="Dateiname *">
                <input
                    style={inputStyle}
                    value={form.dateiname}
                    onChange={e => set('dateiname', e.target.value)}
                    placeholder="z.B. IV-Verfügung_2026.pdf"
                />
            </FormField>
            <FormField label="Typ">
                <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                    {TYPEN.map(t => <option key={t}>{t}</option>)}
                </select>
            </FormField>
            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Dokument erfassen'}
                </button>
            </div>
        </Modal>
    );
}
