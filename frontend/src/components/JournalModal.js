import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

const KATEGORIEN = [
    'Standortgespräch', 'Job Coaching', 'Beobachtung', 'Zielfortschritt',
    'Absenz', 'Kommunikation zuweisende Stelle', 'Externe Person', 'Sonstiges',
];

function fmtOption(min) {
    if (min === 0) return '— Keine Dauer —';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
}

const DAUER_OPTIONEN = Array.from({ length: 97 }, (_, i) => i * 5);

function FieldLabel({ children, required }) {
    return (
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
            {children}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
        </label>
    );
}

export default function JournalModal({ open, onClose, klientId, dossierId, onSaved }) {
    const [kat, setKat] = useState('Standortgespräch');
    const [datum, setDatum] = useState('');
    const [leistungId, setLeistungId] = useState('');
    const [dauerMin, setDauerMin] = useState(0);
    const [verrechenbar, setVerrechenbar] = useState(false);
    const [text, setText] = useState('');
    const [leistungen, setLeistungen] = useState([]);
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

    useEffect(() => {
        if (!open) return;
        setKat('Standortgespräch');
        setDatum(new Date().toISOString().slice(0, 10));
        setLeistungId('');
        setDauerMin(0);
        setVerrechenbar(false);
        setText('');
        setFehler('');

        const ladeLeistungenFallback = () =>
            client.get('/leistungen').then(r => setLeistungen(r.data)).catch(console.error);

        if (dossierId) {
            client.get(`/verfuegungen/${dossierId}`)
                .then(r => {
                    const aktiv = r.data.find(v => v.status === 'aktiv');
                    if (aktiv && aktiv.positionen && aktiv.positionen.length > 0) {
                        setLeistungen(aktiv.positionen.map(p => ({
                            leistung_id: p.leistung_id,
                            tarifnr: p.leistung_tarifnr,
                            bezeichnung: p.leistung_bezeichnung,
                        })));
                    } else {
                        ladeLeistungenFallback();
                    }
                })
                .catch(ladeLeistungenFallback);
        } else {
            ladeLeistungenFallback();
        }
    }, [open, dossierId]);

    function handleLeistungChange(id) {
        setLeistungId(id);
        setVerrechenbar(!!id);
    }

    async function handleSubmit() {
        if (!text.trim()) {
            setFehler('Text ist erforderlich.');
            return;
        }
        setLaden(true);
        setFehler('');
        try {
            const r = await client.post('/journal', {
                klient_id: klientId,
                kategorie: kat,
                datum,
                text: text.trim(),
                dauer_minuten: dauerMin || 0,
                verrechenbar,
                leistung_id: leistungId || null,
            });
            onSaved(r.data);
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern.');
        } finally {
            setLaden(false);
        }
    }

    const inputStyle = {
        width: '100%', fontSize: 13, padding: '7px 10px',
        border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
        background: '#fff', fontFamily: 'inherit', outline: 'none',
        boxSizing: 'border-box', color: '#1A1917',
    };

    return (
        <Modal open={open} onClose={onClose} title="Neuer Journal-Eintrag" width={520}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                    <div>
                        <FieldLabel>Kategorie</FieldLabel>
                        <select value={kat} onChange={e => setKat(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                            {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div>
                        <FieldLabel>Datum</FieldLabel>
                        <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputStyle} />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                    <div>
                        <FieldLabel>Tarifnr. / Leistung</FieldLabel>
                        <select value={leistungId} onChange={e => handleLeistungChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                            <option value="">— Keine Leistung —</option>
                            {leistungen.map(l => (
                                <option key={l.leistung_id} value={l.leistung_id}>
                                    {l.tarifnr} · {l.bezeichnung}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <FieldLabel>Dauer</FieldLabel>
                        <select value={dauerMin} onChange={e => setDauerMin(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer' }}>
                            {DAUER_OPTIONEN.map(m => (
                                <option key={m} value={m}>{fmtOption(m)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                        type="checkbox"
                        id="jm-verrechenbar"
                        checked={verrechenbar}
                        onChange={e => setVerrechenbar(e.target.checked)}
                        style={{ width: 14, height: 14, cursor: 'pointer' }}
                    />
                    <label htmlFor="jm-verrechenbar" style={{ fontSize: 12.5, color: '#1A1917', cursor: 'pointer' }}>Verrechenbar</label>
                </div>
                <div>
                    <FieldLabel required>Text / Notiz</FieldLabel>
                    <textarea
                        value={text} onChange={e => setText(e.target.value)}
                        placeholder="Notiz erfassen…" rows={4}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                    />
                </div>
            </div>

            {fehler && (
                <div style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid rgba(185,28,28,.15)', borderRadius: 6, padding: '7px 10px', marginTop: 12 }}>
                    {fehler}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.07)', marginTop: 16 }}>
                <button onClick={onClose} style={{ padding: '7px 16px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>
                    Abbrechen
                </button>
                <button onClick={handleSubmit} disabled={laden} style={{ padding: '7px 16px', fontSize: 13, cursor: laden ? 'default' : 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500, opacity: laden ? .6 : 1 }}>
                    {laden ? 'Speichern…' : 'Speichern'}
                </button>
            </div>
        </Modal>
    );
}
