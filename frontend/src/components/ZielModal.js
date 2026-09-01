import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField from './FormField';

// Ziel erfassen oder bearbeiten. Das Datum ist das ANGESTREBTE - bis wann das
// Ziel erreicht sein soll. Wann es tatsaechlich erreicht wurde, haelt
// erreicht_am und wird durch das Abhaken gesetzt.
export default function ZielModal({ open, onClose, onSpeichern, ziel }) {
    const [text, setText] = useState('');
    const [datum, setDatum] = useState('');
    const [busy, setBusy] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (!open) return;
        setText(ziel?.text || '');
        setDatum(ziel?.ziel_datum ? ziel.ziel_datum.slice(0, 10) : '');
        setFehler('');
    }, [open, ziel]);

    async function speichern() {
        if (!text.trim()) { setFehler('Bitte ein Ziel formulieren.'); return; }
        setBusy(true);
        setFehler('');
        try {
            await onSpeichern({ text: text.trim(), ziel_datum: datum || null });
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Ziel konnte nicht gespeichert werden');
        } finally { setBusy(false); }
    }

    const eingabe = {
        width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '7px 10px',
        border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, fontFamily: 'inherit', outline: 'none',
    };

    return (
        <Modal open={open} onClose={onClose} title={ziel ? 'Ziel bearbeiten' : 'Neues Ziel'} width={460}>
            <FormField label="Ziel *">
                <textarea
                    autoFocus
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={3}
                    placeholder="z.B. Bewerbungsdossier erstellt und drei Bewerbungen versendet"
                    style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }}
                />
            </FormField>

            <FormField label="Zieldatum">
                <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={eingabe} />
                <div style={{ fontSize: 10.5, color: '#A09D97', marginTop: 4 }}>
                    Bis wann soll das Ziel erreicht sein? Kann leer bleiben.
                </div>
            </FormField>

            {fehler && (
                <div style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid rgba(185,28,28,.15)', borderRadius: 6, padding: '7px 10px', marginTop: 10 }}>
                    {fehler}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={onClose} style={{ padding: '7px 16px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>
                    Abbrechen
                </button>
                <button onClick={speichern} disabled={busy} style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: busy ? 'default' : 'pointer', border: 'none', borderRadius: 6, background: busy ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit' }}>
                    {busy ? 'Speichern…' : 'Speichern'}
                </button>
            </div>
        </Modal>
    );
}
