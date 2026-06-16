import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

function FieldLabel({ children, required }) {
    return (
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
            {children}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
        </label>
    );
}

export default function VerfuegungModal({ open, onClose, dossierId, verfuegung, onSaved }) {
    const [aktTab, setAktTab] = useState('verfuegung');
    const [nummer, setNummer] = useState('');
    const [datum, setDatum] = useState('');
    const [status, setStatus] = useState('aktiv');
    const [bemerkung, setBemerkung] = useState('');
    const [positionen, setPositionen] = useState([]);
    const [leistungen, setLeistungen] = useState([]);
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

    useEffect(() => {
        if (!open) return;
        client.get('/leistungen').then(r => setLeistungen(r.data)).catch(console.error);
        setNummer(verfuegung?.nummer || '');
        setDatum(verfuegung?.datum ? verfuegung.datum.slice(0, 10) : '');
        setStatus(verfuegung?.status || 'aktiv');
        setBemerkung(verfuegung?.bemerkung || '');
        setFehler('');
        setAktTab('verfuegung');
        setPositionen(
            (verfuegung?.positionen || []).map((p, i) => ({
                _key: i,
                position_id: p.position_id,
                leistung_id: p.leistung_id,
                soll_stunden: p.soll_stunden,
            }))
        );
    }, [open, verfuegung]);

    function addPosition() {
        setPositionen(prev => [...prev, { _key: Date.now(), position_id: null, leistung_id: '', soll_stunden: 0 }]);
    }

    function removePosition(key) {
        setPositionen(prev => prev.filter(p => p._key !== key));
    }

    function updatePosition(key, field, value) {
        setPositionen(prev => prev.map(p => p._key === key ? { ...p, [field]: value } : p));
    }

    async function handleSubmit() {
        if (!nummer.trim()) {
            setFehler('Nummer ist erforderlich.');
            setAktTab('verfuegung');
            return;
        }
        setLaden(true);
        setFehler('');
        try {
            let verfuegungId;
            if (verfuegung) {
                await client.put(`/verfuegungen/${verfuegung.verfuegung_id}`, {
                    dossier_id: dossierId,
                    nummer: nummer.trim(),
                    datum: datum || null,
                    bemerkung: bemerkung.trim() || null,
                    status,
                });
                verfuegungId = verfuegung.verfuegung_id;
                // Delete all original positions, then re-create current ones
                for (const p of (verfuegung.positionen || [])) {
                    if (p.position_id) {
                        await client.delete(`/verfuegungen/${verfuegungId}/positionen/${p.position_id}`);
                    }
                }
            } else {
                const r = await client.post('/verfuegungen', {
                    dossier_id: dossierId,
                    nummer: nummer.trim(),
                    datum: datum || null,
                    bemerkung: bemerkung.trim() || null,
                    status,
                });
                verfuegungId = r.data.verfuegung_id;
            }
            for (let i = 0; i < positionen.length; i++) {
                const p = positionen[i];
                if (p.leistung_id) {
                    await client.post(`/verfuegungen/${verfuegungId}/positionen`, {
                        leistung_id: p.leistung_id,
                        soll_stunden: parseFloat(p.soll_stunden) || 0,
                        reihenfolge: i,
                    });
                }
            }
            onSaved();
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
        <Modal open={open} onClose={onClose} title={verfuegung ? 'Verfügung bearbeiten' : 'Neue Verfügung'} width={520}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.09)', marginBottom: 16, marginTop: -4 }}>
                {[
                    { key: 'verfuegung', label: 'Verfügung' },
                    { key: 'positionen', label: `Positionen${positionen.length > 0 ? ` (${positionen.length})` : ''}` },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setAktTab(tab.key)} style={{
                        padding: '8px 16px', fontSize: 12.5, fontWeight: aktTab === tab.key ? 600 : 400,
                        cursor: 'pointer', border: 'none', background: 'transparent',
                        color: aktTab === tab.key ? '#2563EB' : '#6B6860',
                        borderBottom: aktTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                        fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.04em',
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: Verfügung */}
            {aktTab === 'verfuegung' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <FieldLabel required>Nummer</FieldLabel>
                        <input
                            type="text" value={nummer} onChange={e => setNummer(e.target.value)}
                            placeholder="z.B. VFG-2026-001" style={inputStyle}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <FieldLabel>Datum</FieldLabel>
                            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <FieldLabel>Status</FieldLabel>
                            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="aktiv">Aktiv</option>
                                <option value="abgeschlossen">Abgeschlossen</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Bemerkung</FieldLabel>
                        <textarea
                            value={bemerkung} onChange={e => setBemerkung(e.target.value)}
                            placeholder="Optionale Bemerkung…" rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                        />
                    </div>
                </div>
            )}

            {/* Tab: Positionen */}
            {aktTab === 'positionen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {positionen.length === 0 && (
                        <div style={{ fontSize: 12.5, color: '#9CA3AF', textAlign: 'center', padding: '1rem 0' }}>
                            Noch keine Positionen — "+" klicken zum Hinzufügen
                        </div>
                    )}
                    {positionen.map(pos => (
                        <div key={pos._key} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, alignItems: 'center' }}>
                            <select
                                value={pos.leistung_id}
                                onChange={e => updatePosition(pos._key, 'leistung_id', e.target.value)}
                                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1A1917' }}
                            >
                                <option value="">— Leistung —</option>
                                {leistungen.map(l => (
                                    <option key={l.leistung_id} value={l.leistung_id}>
                                        {l.tarifnr} · {l.bezeichnung}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number" min="0" step="0.5"
                                value={pos.soll_stunden}
                                onChange={e => updatePosition(pos._key, 'soll_stunden', e.target.value)}
                                placeholder="SOLL"
                                style={{ fontSize: 13, padding: '6px 8px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                            />
                            <button
                                onClick={() => removePosition(pos._key)}
                                style={{ width: 32, height: 32, border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >×</button>
                        </div>
                    ))}
                    <button
                        onClick={addPosition}
                        style={{ padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', border: '1px dashed rgba(0,0,0,.2)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', color: '#6B6860', marginTop: 4 }}
                    >+ Position hinzufügen</button>
                </div>
            )}

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
