import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

const ENTSCHAEDIGUNGSARTEN = ['Monatspauschale', 'Fallpauschale', 'Pro Stunde', 'Pro Bericht', 'Nach Aufwand'];

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

function NumberInput({ value, onChange, placeholder }) {
    return (
        <input
            type="number"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            step="0.01"
            min="0"
            style={{
                width: '100%', fontSize: 13, padding: '7px 10px',
                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                background: '#fff', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', color: '#1A1917'
            }}
        />
    );
}

function SelectInput({ value, onChange, options, placeholder }) {
    return (
        <select
            value={value}
            onChange={onChange}
            style={{
                width: '100%', fontSize: 13, padding: '7px 10px',
                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                background: '#fff', fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', color: value ? '#1A1917' : '#9CA3AF', cursor: 'pointer'
            }}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    );
}

const LEER = {
    produkt_nr: '', tarifziffer: '', bezeichnung: '',
    entschaedigungsart: '', tarif: '', kostenart: '', kostenstelle: '',
};

export default function LeistungModal({ open, onClose, leistung, onSaved }) {
    const [form, setForm] = useState(LEER);
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

    useEffect(() => {
        if (open) {
            setForm({
                produkt_nr:        leistung?.produkt_nr        || '',
                tarifziffer:       leistung?.tarifziffer       || '',
                bezeichnung:       leistung?.bezeichnung       || '',
                entschaedigungsart:leistung?.entschaedigungsart|| '',
                tarif:             leistung?.tarif != null ? leistung.tarif : '',
                kostenart:         leistung?.kostenart         || '',
                kostenstelle:      leistung?.kostenstelle      || '',
            });
            setFehler('');
        }
    }, [open, leistung]);

    function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

    async function handleSubmit() {
        if (!form.produkt_nr.trim() || !form.bezeichnung.trim()) {
            setFehler('Produkt-Nr. und Bezeichnung sind erforderlich.');
            return;
        }
        setLaden(true);
        setFehler('');
        try {
            const payload = {
                produkt_nr:         form.produkt_nr.trim(),
                tarifziffer:        form.tarifziffer.trim() || null,
                bezeichnung:        form.bezeichnung.trim(),
                entschaedigungsart: form.entschaedigungsart || null,
                tarif:              form.tarif !== '' ? parseFloat(form.tarif) : null,
                kostenart:          form.kostenart.trim() || null,
                kostenstelle:       form.kostenstelle.trim() || null,
            };
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

    const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

    return (
        <Modal open={open} onClose={onClose} title={leistung ? 'Leistung bearbeiten' : 'Neue Leistung'} width={500}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                <div style={row}>
                    <div>
                        <FieldLabel required>Produkt-Nr.</FieldLabel>
                        <TextInput value={form.produkt_nr} onChange={e => set('produkt_nr', e.target.value)} placeholder="z.B. 4500" />
                    </div>
                    <div>
                        <FieldLabel>Tarifziffer</FieldLabel>
                        <TextInput value={form.tarifziffer} onChange={e => set('tarifziffer', e.target.value)} placeholder="z.B. 905.052.2.1" />
                    </div>
                </div>

                <div>
                    <FieldLabel required>ABEA-Bezeichnung</FieldLabel>
                    <TextInput value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)} placeholder="z.B. Berufliche Abklärung" />
                </div>

                <div style={row}>
                    <div>
                        <FieldLabel>Entschädigungsart</FieldLabel>
                        <SelectInput
                            value={form.entschaedigungsart}
                            onChange={e => set('entschaedigungsart', e.target.value)}
                            options={ENTSCHAEDIGUNGSARTEN}
                            placeholder="— wählen —"
                        />
                    </div>
                    <div>
                        <FieldLabel>Tarif CHF</FieldLabel>
                        <NumberInput value={form.tarif} onChange={e => set('tarif', e.target.value)} placeholder="z.B. 5300.00" />
                    </div>
                </div>

                <div style={row}>
                    <div>
                        <FieldLabel>Kostenart</FieldLabel>
                        <TextInput value={form.kostenart} onChange={e => set('kostenart', e.target.value)} placeholder="z.B. 6200" />
                    </div>
                    <div>
                        <FieldLabel>Kostenstelle</FieldLabel>
                        <TextInput value={form.kostenstelle} onChange={e => set('kostenstelle', e.target.value)} placeholder="z.B. 1511/2511/3511" />
                    </div>
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
