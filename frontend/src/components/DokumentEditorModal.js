import { useState, useEffect } from 'react';
import client from '../api/client';

const S = {
    label: { fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 4, display: 'block' },
    input: {
        fontSize: 13, padding: '6px 10px', borderRadius: 6,
        border: '1px solid rgba(0,0,0,.12)', background: '#fff',
        fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box',
    },
    btn: (primary) => ({
        padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        border: primary ? 'none' : '1px solid rgba(0,0,0,.12)', borderRadius: 6,
        background: primary ? '#2563EB' : '#fff', color: primary ? '#fff' : '#1A1917',
        fontFamily: 'inherit',
    }),
};

export default function DokumentEditorModal({ open, onClose, dokument, onSaved }) {
    const [titel, setTitel] = useState('');
    const [inhalt, setInhalt] = useState('');
    const [speichern, setSpeichern] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (!open || !dokument) return;
        setTitel(dokument.titel || '');
        setInhalt(dokument.inhalt || '');
        setFehler('');
    }, [open, dokument]);

    async function handleSpeichern() {
        if (!titel.trim() || !inhalt.trim()) { setFehler('Titel und Inhalt erforderlich'); return; }
        setSpeichern(true);
        setFehler('');
        try {
            await client.put(`/dokumente/${dokument.dok_id}`, {
                titel: titel.trim(),
                inhalt: inhalt.trim(),
            });
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setSpeichern(false);
        }
    }

    if (!open || !dokument) return null;

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 12, padding: '1.5rem',
                width: 640, maxWidth: '94vw', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', gap: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,.18)', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>Dokument bearbeiten</div>
                        {dokument.vorlage_name && (
                            <div style={{ fontSize: 11, color: '#A09D97', marginTop: 2 }}>Vorlage: {dokument.vorlage_name}</div>
                        )}
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#A09D97', flexShrink: 0 }}>✕</button>
                </div>

                {fehler && (
                    <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#B91C1C' }}>{fehler}</div>
                )}

                <div>
                    <label style={S.label}>Titel *</label>
                    <input style={S.input} value={titel} onChange={e => setTitel(e.target.value)} />
                </div>

                <div>
                    <label style={S.label}>Inhalt *</label>
                    <textarea value={inhalt} onChange={e => setInhalt(e.target.value)} rows={18} style={{ ...S.input, resize: 'vertical', lineHeight: 1.65, fontSize: 12.5, fontFamily: 'inherit' }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={S.btn(false)}>Abbrechen</button>
                    <button onClick={handleSpeichern} disabled={speichern || !titel.trim() || !inhalt.trim()} style={{ ...S.btn(true), opacity: (!titel.trim() || !inhalt.trim()) ? .5 : 1 }}>
                        {speichern ? 'Speichert…' : 'Speichern'}
                    </button>
                </div>
            </div>
        </div>
    );
}
