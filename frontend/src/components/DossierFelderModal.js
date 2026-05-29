import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const ABTEILUNGEN = ['BI IT', 'Admin 1', 'Admin 2', 'Admin 3', 'Logistik', 'Telefonservice', 'Wäscheservice', 'Restwert'];

function toggleBtn(active) {
    return {
        flex: 1, padding: '8px 0', fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer', border: `1px solid ${active ? '#2563EB' : 'rgba(0,0,0,.09)'}`,
        borderRadius: 6, background: active ? '#EEF3FE' : '#F5F4F0',
        color: active ? '#1D4ED8' : '#6B6860', fontFamily: 'inherit',
    };
}

export default function DossierFelderModal({ open, onClose, dossierId, dossier, onSaved }) {
    const [modus, setModus] = useState('intern');
    const [arbeitgeber, setArbeitgeber] = useState([]);
    const [abteilung, setAbteilung] = useState('');
    const [arbeitgeberId, setArbeitgeberId] = useState('');
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (!open) return;
        client.get('/externe').then(r => {
            setArbeitgeber(r.data.filter(p => p.typ === 'Arbeitgeber'));
        }).catch(console.error);

        if (dossier?.arbeitgeber_id) {
            setModus('extern');
            setArbeitgeberId(dossier.arbeitgeber_id);
            setAbteilung('');
        } else {
            setModus('intern');
            setAbteilung(dossier?.abteilung || '');
            setArbeitgeberId('');
        }
        setFehler('');
    }, [open, dossier]);

    async function speichern() {
        setLaden(true);
        setFehler('');
        try {
            await client.put(`/dossiers/${dossierId}/felder`, {
                zuweisende_person_id: dossier?.zuweisende_person_id || null,
                abteilung: modus === 'intern' ? (abteilung || null) : null,
                arbeitgeber_id: modus === 'extern' ? (arbeitgeberId || null) : null,
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
        <Modal open={open} onClose={onClose} title="Arbeitsort ändern" width={440}>
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}

            {/* Toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <button style={toggleBtn(modus === 'intern')} onClick={() => setModus('intern')}>Intern</button>
                <button style={toggleBtn(modus === 'extern')} onClick={() => setModus('extern')}>Extern</button>
            </div>

            {modus === 'intern' && (
                <FormField label="Abteilung">
                    <select style={inputStyle} value={abteilung} onChange={e => setAbteilung(e.target.value)}>
                        <option value="">— Keine —</option>
                        {ABTEILUNGEN.map(a => <option key={a}>{a}</option>)}
                    </select>
                </FormField>
            )}

            {modus === 'extern' && (
                <FormField label="Arbeitgeber / Partnerfirma">
                    <select style={inputStyle} value={arbeitgeberId} onChange={e => setArbeitgeberId(e.target.value)}>
                        <option value="">— Keine —</option>
                        {arbeitgeber.map(p => (
                            <option key={p.person_id} value={p.person_id}>
                                {p.firma ? `${p.firma} (${p.vorname} ${p.nachname})` : `${p.vorname} ${p.nachname}`}
                            </option>
                        ))}
                    </select>
                    {arbeitgeber.length === 0 && (
                        <div style={{ fontSize: 11.5, color: '#A09D97', marginTop: 5 }}>
                            Keine externen Personen vom Typ "Arbeitgeber" vorhanden.
                        </div>
                    )}
                </FormField>
            )}

            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Speichern'}
                </button>
            </div>
        </Modal>
    );
}
