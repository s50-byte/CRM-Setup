import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const ABTEILUNGEN = ['BI IT', 'Admin 1', 'Admin 2', 'Admin 3', 'Logistik', 'Telefonservice', 'Wäscheservice', 'Restwert'];

export default function DossierFelderModal({ open, onClose, dossierId, dossier, onSaved }) {
    const [externePersonen, setExternePersonen] = useState([]);
    const [zuweisendePersonId, setZuweisendePersonId] = useState('');
    const [abteilung, setAbteilung] = useState('');
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (!open) return;
        client.get('/externe').then(r => setExternePersonen(r.data)).catch(console.error);
        setZuweisendePersonId(dossier?.zuweisende_person_id || '');
        setAbteilung(dossier?.abteilung || '');
        setFehler('');
    }, [open, dossier]);

    async function speichern() {
        setLaden(true);
        setFehler('');
        try {
            await client.put(`/dossiers/${dossierId}/felder`, {
                zuweisende_person_id: zuweisendePersonId || null,
                abteilung: abteilung || null,
            });
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Dossier-Felder bearbeiten" width={480}>
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}
            <FormField label="Zuweisende Person">
                <select style={inputStyle} value={zuweisendePersonId} onChange={e => setZuweisendePersonId(e.target.value)}>
                    <option value="">— Keine —</option>
                    {externePersonen.map(p => (
                        <option key={p.person_id} value={p.person_id}>
                            {p.nachname} {p.vorname}{p.firma ? ` (${p.firma})` : ''}
                        </option>
                    ))}
                </select>
            </FormField>
            <FormField label="Abteilung (intern)">
                <select style={inputStyle} value={abteilung} onChange={e => setAbteilung(e.target.value)}>
                    <option value="">— Keine —</option>
                    {ABTEILUNGEN.map(a => <option key={a}>{a}</option>)}
                </select>
            </FormField>
            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Speichern'}
                </button>
            </div>
        </Modal>
    );
}
