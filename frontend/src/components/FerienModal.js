import { useState, useEffect } from 'react';
import client from '../api/client';

const INPUT = {
    fontSize: 13, padding: '7px 11px', border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none',
    width: '100%', boxSizing: 'border-box',
};

export default function FerienModal({ open, onClose, onSaved, klientId }) {
    const heute = new Date().toISOString().slice(0, 10);
    const [klienten, setKlienten] = useState([]);
    const [form, setForm] = useState({ klient_id: '', von: heute, bis: heute, bemerkung: '' });
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFehler('');
        const startKlient = klientId ? String(klientId) : '';
        setForm({ klient_id: startKlient, von: heute, bis: heute, bemerkung: '' });
        if (!klientId) {
            client.get('/klienten').then(r => setKlienten(r.data)).catch(console.error);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, klientId]);

    if (!open) return null;

    const setF = (field, val) => setForm(f => ({ ...f, [field]: val }));

    const speichern = async () => {
        const kid = klientId || form.klient_id;
        if (!kid) { setFehler('Klient auswählen'); return; }
        if (!form.von || !form.bis) { setFehler('Von und Bis ausfüllen'); return; }
        if (form.bis < form.von) { setFehler('Bis muss nach Von liegen'); return; }
        setLaden(true);
        setFehler('');
        try {
            await client.post('/praesenz/ferien', {
                klient_id: kid,
                von: form.von,
                bis: form.bis,
                bemerkung: form.bemerkung || null,
            });
            onSaved?.();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Ferien erfassen</div>
                    <button onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', color: '#6B6860' }}>✕</button>
                </div>

                {!klientId && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Klient</label>
                        <select value={form.klient_id} onChange={e => setF('klient_id', e.target.value)} style={INPUT}>
                            <option value="">— Klient wählen —</option>
                            {klienten.map(k => (
                                <option key={k.klient_id} value={String(k.klient_id)}>{k.nachname} {k.vorname}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Von</label>
                        <input type="date" value={form.von} onChange={e => setF('von', e.target.value)} style={INPUT} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Bis</label>
                        <input type="date" value={form.bis} onChange={e => setF('bis', e.target.value)} style={INPUT} />
                    </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Bemerkung (optional)</label>
                    <textarea
                        rows={3}
                        value={form.bemerkung}
                        onChange={e => setF('bemerkung', e.target.value)}
                        placeholder="z.B. Sommerferien, abgesprochen mit…"
                        style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }}
                    />
                </div>

                {fehler && <div style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 10 }}>{fehler}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={onClose} style={{
                        padding: '7px 16px', fontSize: 13, cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                    }}>Abbrechen</button>
                    <button onClick={speichern} disabled={laden} style={{
                        padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: laden ? 'default' : 'pointer',
                        border: 'none', borderRadius: 6,
                        background: laden ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>{laden ? 'Speichern…' : 'Speichern'}</button>
                </div>
            </div>
        </div>
    );
}
