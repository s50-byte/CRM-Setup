import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

export default function StandortWechselModal({ open, onClose, onSaved, dossierId, dossier }) {
    const [standorte, setStandorte] = useState([]);
    const [form, setForm] = useState({ standort_id: '', neuer_user_id: '', alter_user_id: '', bemerkung: '' });
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (open) {
            client.get('/standorte').then(r => setStandorte(r.data)).catch(console.error);
            setForm({ standort_id: '', neuer_user_id: '', alter_user_id: '', bemerkung: '' });
            setFehler('');
        }
    }, [open]);

    function set(field, value) {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'standort_id') next.neuer_user_id = '';
            return next;
        });
    }

    const neuerStandort = standorte.find(s => s.standort_id === form.standort_id);
    const benutzerAmStandort = neuerStandort?.benutzer || [];
    const zugewiesen = dossier?.zugewiesen || [];

    async function speichern() {
        if (!form.standort_id) {
            setFehler('Bitte neuen Standort auswählen');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            await client.put(`/dossiers/${dossierId}/standort`, {
                standort_id: form.standort_id,
                neuer_user_id: form.neuer_user_id || null,
                alter_user_id: form.alter_user_id || null,
                bemerkung: form.bemerkung || null,
            });
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Standortwechsel');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Standort wechseln">
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}

            {dossier?.standort_name && (
                <div style={{ fontSize: 12, color: '#6B6860', marginBottom: 14, padding: '8px 10px', background: '#F5F4F0', borderRadius: 6 }}>
                    Aktueller Standort: <strong>{dossier.standort_name}</strong>
                </div>
            )}

            <FormField label="Neuer Standort *">
                <select style={inputStyle} value={form.standort_id} onChange={e => set('standort_id', e.target.value)}>
                    <option value="">— Standort auswählen —</option>
                    {standorte.filter(s => s.standort_id !== dossier?.standort_id).map(s => (
                        <option key={s.standort_id} value={s.standort_id}>{s.name}</option>
                    ))}
                </select>
            </FormField>

            {benutzerAmStandort.length > 0 && (
                <FormField label="Neue Klientenführung">
                    <select style={inputStyle} value={form.neuer_user_id} onChange={e => set('neuer_user_id', e.target.value)}>
                        <option value="">— Kein Wechsel —</option>
                        {benutzerAmStandort.map(u => (
                            <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                        ))}
                    </select>
                </FormField>
            )}

            {zugewiesen.length > 0 && (
                <FormField label="Alte Klientenführung deaktivieren">
                    <select style={inputStyle} value={form.alter_user_id} onChange={e => set('alter_user_id', e.target.value)}>
                        <option value="">— Niemand deaktivieren —</option>
                        {zugewiesen.map(u => (
                            <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.rolle_im_fall})</option>
                        ))}
                    </select>
                </FormField>
            )}

            <FormField label="Bemerkung">
                <textarea
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical', lineHeight: 1.5 }}
                    value={form.bemerkung}
                    onChange={e => set('bemerkung', e.target.value)}
                    placeholder="Optional…"
                />
            </FormField>

            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Wechseln…' : 'Standort wechseln'}
                </button>
            </div>
        </Modal>
    );
}
