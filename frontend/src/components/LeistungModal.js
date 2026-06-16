import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

const EINHEITEN = ['Stunden', 'Minuten', 'Tage', 'Pauschal'];

function FieldLabel({ children, required }) {
    return (
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
            {children}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
        </label>
    );
}

function TextInput({ value, onChange, placeholder }) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={{
                width: '100%', fontSize: 13, padding: '7px 10px',
                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                background: '#fff', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', color: '#1A1917'
            }}
        />
    );
}

function Select({ value, onChange, options }) {
    return (
        <select
            value={value}
            onChange={onChange}
            style={{
                width: '100%', fontSize: 13, padding: '7px 10px',
                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                background: '#fff', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', color: '#1A1917', cursor: 'pointer'
            }}
        >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    );
}

export default function LeistungModal({ open, onClose, leistung, onSaved }) {
    const [tarifnr, setTarifnr] = useState('');
    const [bezeichnung, setBezeichnung] = useState('');
    const [einheit, setEinheit] = useState('Stunden');
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

    useEffect(() => {
        if (open) {
            setTarifnr(leistung?.tarifnr || '');
            setBezeichnung(leistung?.bezeichnung || '');
            setEinheit(leistung?.einheit || 'Stunden');
            setFehler('');
        }
    }, [open, leistung]);

    async function handleSubmit() {
        if (!tarifnr.trim() || !bezeichnung.trim()) {
            setFehler('Tarifnr. und Bezeichnung sind erforderlich.');
            return;
        }
        setLaden(true);
        setFehler('');
        try {
            const payload = { tarifnr: tarifnr.trim(), bezeichnung: bezeichnung.trim(), einheit };
            if (leistung) {
                await client.put(`/leistungen/${leistung.leistung_id}`, payload);
            } else {
                await client.post('/leistungen', payload);
            }
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern.');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={leistung ? 'Leistung bearbeiten' : 'Neue Leistung'} width={420}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <FieldLabel required>Tarifnr.</FieldLabel>
                    <TextInput value={tarifnr} onChange={e => setTarifnr(e.target.value)} placeholder="z.B. 1001" />
                </div>
                <div>
                    <FieldLabel required>Bezeichnung</FieldLabel>
                    <TextInput value={bezeichnung} onChange={e => setBezeichnung(e.target.value)} placeholder="z.B. Klientenführung" />
                </div>
                <div>
                    <FieldLabel>Einheit</FieldLabel>
                    <Select value={einheit} onChange={e => setEinheit(e.target.value)} options={EINHEITEN} />
                </div>

                {fehler && (
                    <div style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid rgba(185,28,28,.15)', borderRadius: 6, padding: '7px 10px' }}>
                        {fehler}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                    <button onClick={onClose} style={{ padding: '7px 16px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>
                        Abbrechen
                    </button>
                    <button onClick={handleSubmit} disabled={laden} style={{ padding: '7px 16px', fontSize: 13, cursor: laden ? 'default' : 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500, opacity: laden ? .6 : 1 }}>
                        {laden ? 'Speichern…' : 'Speichern'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
