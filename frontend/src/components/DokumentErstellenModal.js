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

export default function DokumentErstellenModal({ open, onClose, dossierId, klientId, leistungId, onSaved }) {
    const [vorlagen, setVorlagen] = useState([]);
    const [gewaehlteVorlage, setGewaehlteVorlage] = useState(null);
    const [titel, setTitel] = useState('');
    const [inhalt, setInhalt] = useState('');
    const [vorschauLaden, setVorschauLaden] = useState(false);
    const [speichern, setSpeichern] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (!open) return;
        setGewaehlteVorlage(null);
        setTitel('');
        setInhalt('');
        setFehler('');
        async function ladeVorlagen() {
            if (leistungId) {
                const r = await client.get(`/vorlagen?leistung_id=${leistungId}`);
                if (r.data.length > 0) { setVorlagen(r.data); return; }
            }
            const r = await client.get('/vorlagen');
            setVorlagen(r.data);
        }
        ladeVorlagen().catch(console.error);
    }, [open, leistungId]);

    async function waehleVorlage(vorlage_id) {
        const v = vorlagen.find(x => x.vorlage_id === vorlage_id);
        if (!v) {
            setGewaehlteVorlage(null);
            setTitel('');
            setInhalt('');
            return;
        }
        setGewaehlteVorlage(v);
        setTitel(v.name);
        setInhalt('');
        setFehler('');
        setVorschauLaden(true);
        let text = '';
        try {
            console.log('[DokumentErstellen] POST vorschau — vorlage_id:', vorlage_id, '| klientId:', klientId);
            const r = await client.post(`/vorlagen/${vorlage_id}/vorschau`, {
                klient_id: klientId || undefined,
            });
            text = r.data?.vorschau || '';
            console.log('[DokumentErstellen] vorschau geladen, Länge:', text.length, '| Anfang:', text.slice(0, 60));
        } catch (err) {
            console.error('[DokumentErstellen] Vorschau fehlgeschlagen:', err);
            try {
                const r2 = await client.get(`/vorlagen/${vorlage_id}`);
                text = r2.data?.inhalt || '';
                console.log('[DokumentErstellen] Fallback GET inhalt, Länge:', text.length);
            } catch {
                setFehler('Vorlage konnte nicht geladen werden');
            }
        }
        setInhalt(text);
        setVorschauLaden(false);
    }

    async function handleSpeichern() {
        if (!titel.trim() || !inhalt.trim()) { setFehler('Titel und Inhalt erforderlich'); return; }
        setSpeichern(true);
        setFehler('');
        try {
            await client.post(`/dossiers/${dossierId}/dokumente`, {
                vorlage_id: gewaehlteVorlage?.vorlage_id || null,
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

    if (!open) return null;

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 12, padding: '1.5rem',
                width: 600, maxWidth: '94vw', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', gap: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,.18)', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Dokument erstellen</div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#A09D97' }}>✕</button>
                </div>

                {fehler && (
                    <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#B91C1C' }}>{fehler}</div>
                )}

                <div>
                    <label style={S.label}>Vorlage auswählen</label>
                    <select style={S.input} value={gewaehlteVorlage?.vorlage_id || ''} onChange={e => waehleVorlage(e.target.value)} disabled={vorschauLaden}>
                        <option value="">— Ohne Vorlage —</option>
                        {vorlagen.map(v => <option key={v.vorlage_id} value={v.vorlage_id}>{v.name}</option>)}
                    </select>
                    {vorlagen.length === 0 && leistungId && (
                        <div style={{ fontSize: 11, color: '#A09D97', marginTop: 4 }}>Keine Vorlagen für diese Massnahme hinterlegt</div>
                    )}
                </div>

                <div>
                    <label style={S.label}>Titel *</label>
                    <input style={S.input} value={titel} onChange={e => setTitel(e.target.value)} placeholder="Dokumenttitel" />
                </div>

                <div>
                    <label style={S.label}>Inhalt *</label>
                    {vorschauLaden
                        ? <div style={{ padding: '12px', fontSize: 12, color: '#6B6860', background: '#F5F4F0', borderRadius: 6 }}>Vorlage wird geladen…</div>
                        : <textarea value={inhalt} onChange={e => setInhalt(e.target.value)} placeholder="Dokumentinhalt…" rows={14} style={{ ...S.input, resize: 'vertical', lineHeight: 1.65, fontSize: 12.5, fontFamily: 'inherit' }} />
                    }
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={S.btn(false)}>Abbrechen</button>
                    <button onClick={handleSpeichern} disabled={speichern || !titel.trim() || !inhalt.trim() || vorschauLaden} style={{ ...S.btn(true), opacity: (!titel.trim() || !inhalt.trim() || vorschauLaden) ? .5 : 1 }}>
                        {speichern ? 'Speichert…' : 'Dokument speichern'}
                    </button>
                </div>
            </div>
        </div>
    );
}
