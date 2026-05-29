import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const PRIORITAETEN = ['Hoch', 'Mittel', 'Niedrig'];

export default function NeueAufgabeModal({ open, onClose, onSaved, klientId, phaseId }) {
    const [form, setForm] = useState({
        klient_id: klientId || '', text: '', prioritaet: 'Mittel', faellig_am: '', phase_id: phaseId || ''
    });
    const [klienten, setKlienten] = useState([]);
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (open && !klientId) {
            client.get('/klienten').then(r => setKlienten(r.data)).catch(console.error);
        }
        if (klientId) setForm(prev => ({ ...prev, klient_id: klientId }));
        if (phaseId) setForm(prev => ({ ...prev, phase_id: phaseId }));
    }, [open, klientId, phaseId]);

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function speichern() {
        const effectiveKlientId = klientId || form.klient_id;
        const effectivePhaseId = phaseId || form.phase_id || null;
        console.log('[NeueAufgabeModal] form vor POST:', form, '| effective klient_id:', effectiveKlientId);
        if (!effectiveKlientId || !form.text) {
            setFehler('Klient und Aufgabe sind Pflichtfelder');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            await client.post('/tasks', {
                klient_id: effectiveKlientId,
                text: form.text,
                prioritaet: form.prioritaet,
                faellig_am: form.faellig_am || null,
                phase_id: effectivePhaseId,
            });
            onSaved();
            onClose();
            setForm({ klient_id: klientId || '', text: '', prioritaet: 'Mittel', faellig_am: '', phase_id: phaseId || '' });
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Neue Aufgabe">
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
            <FormField label="Aufgabe *">
                <input style={inputStyle} value={form.text} onChange={e => set('text', e.target.value)} placeholder="Was muss erledigt werden?" />
            </FormField>
            <div style={rowStyle}>
                <FormField label="Priorität">
                    <select style={inputStyle} value={form.prioritaet} onChange={e => set('prioritaet', e.target.value)}>
                        {PRIORITAETEN.map(p => <option key={p}>{p}</option>)}
                    </select>
                </FormField>
                <FormField label="Fällig am">
                    <input type="date" style={inputStyle} value={form.faellig_am} onChange={e => set('faellig_am', e.target.value)} />
                </FormField>
            </div>
            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Aufgabe erfassen'}
                </button>
            </div>
        </Modal>
    );
}