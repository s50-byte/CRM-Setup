import { useState } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const PROGRAMME = ['IV-Massnahme', 'Ausbildung', 'Beratung', 'Abklärung', 'Gez. Vorbereitung'];
const KANAELE = ['Telefon', 'E-Mail', 'Online-Formular', 'Direkt'];

export default function NeueAnfrageModal({ open, onClose, onSaved }) {
    const [form, setForm] = useState({
        nachname: '', vorname: '', programm: 'IV-Massnahme',
        auftraggeber: '', kanal: 'Telefon',
        start: '', ende: '', notiz: ''
    });
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function speichern() {
        if (!form.nachname || !form.vorname || !form.auftraggeber) {
            setFehler('Nachname, Vorname und Auftraggeber sind Pflichtfelder');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            // Klient erstellen
            const klientRes = await client.post('/klienten', {
                nachname: form.nachname,
                vorname: form.vorname,
            });
            const klient_id = klientRes.data.klient_id;

            // Programm-ID holen
            const programmeRes = await client.get('/programme');
            const prog = programmeRes.data.find(p => p.name === form.programm);

            // Dossier erstellen
            await client.post('/dossiers', {
                klient_id,
                auftraggeber: form.auftraggeber,
                kanal: form.kanal,
                programm_id: prog?.programm_id || null,
            });

            onSaved();
            onClose();
            setForm({ nachname: '', vorname: '', programm: 'IV-Massnahme', auftraggeber: '', kanal: 'Telefon', start: '', ende: '', notiz: '' });
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
                    <input style={inputStyle} value={form.vorname} onChange={e => set('vorname', e.target.value)} placeholder="Vorname" />
                </FormField>
                <FormField label="Nachname *">
                    <input style={inputStyle} value={form.nachname} onChange={e => set('nachname', e.target.value)} placeholder="Nachname" />
                </FormField>
            </div>
            <FormField label="Programmtyp">
                <select style={inputStyle} value={form.programm} onChange={e => set('programm', e.target.value)}>
                    {PROGRAMME.map(p => <option key={p}>{p}</option>)}
                </select>
            </FormField>
            <FormField label="Auftraggeber *">
                <input style={inputStyle} value={form.auftraggeber} onChange={e => set('auftraggeber', e.target.value)} placeholder="z.B. IV-Stelle ZH" />
            </FormField>
            <FormField label="Eingangskanal">
                <select style={inputStyle} value={form.kanal} onChange={e => set('kanal', e.target.value)}>
                    {KANAELE.map(k => <option key={k}>{k}</option>)}
                </select>
            </FormField>
            <div style={rowStyle}>
                <FormField label="Start (geplant)">
                    <input type="date" style={inputStyle} value={form.start} onChange={e => set('start', e.target.value)} />
                </FormField>
                <FormField label="Ende (geplant)">
                    <input type="date" style={inputStyle} value={form.ende} onChange={e => set('ende', e.target.value)} />
                </FormField>
            </div>
            <FormField label="Erstnotiz">
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }}
                    value={form.notiz} onChange={e => set('notiz', e.target.value)}
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