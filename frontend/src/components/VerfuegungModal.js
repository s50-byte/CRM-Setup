import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

const VART_MAPPING = {
    'Monatspauschale': 'monatspauschale',
    'Fallpauschale': 'fallpauschale',
    'Pro Stunde': 'stundenpauschale',
    'Pro Bericht': 'fallpauschale',
    'Nach Aufwand': 'fallpauschale',
};

function FieldLabel({ children, required }) {
    return (
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
            {children}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
        </label>
    );
}

function positionSoll(p, leistungen, dauerMonate) {
    const l = leistungen.find(l => l.leistung_id === p.leistung_id);
    const tarif = parseFloat(l?.tarif) || 0;
    const betrag = parseFloat(p.betrag) || 0;
    const soll_h = parseFloat(p.soll_stunden) || 0;
    switch (p.verrechnungsart) {
        case 'monatspauschale': {
            const hM = tarif > 0 ? betrag / tarif : 0;
            return { h: Math.round(hM * dauerMonate * 10) / 10, chf: Math.round(betrag * dauerMonate * 100) / 100 };
        }
        case 'fallpauschale': {
            const hT = tarif > 0 ? betrag / tarif : 0;
            return { h: Math.round(hT * 10) / 10, chf: Math.round(betrag * 100) / 100 };
        }
        case 'stundenpauschale':
            return { h: soll_h, chf: Math.round(soll_h * tarif * 100) / 100 };
        default: return null;
    }
}

export default function VerfuegungModal({ open, onClose, dossierId, dossier, verfuegung, onSaved }) {
    const [aktTab, setAktTab] = useState('verfuegung');
    const [nummer, setNummer] = useState('');
    const [datum, setDatum] = useState('');
    const [status, setStatus] = useState('aktiv');
    const [bemerkung, setBemerkung] = useState('');
    const [positionen, setPositionen] = useState([]);
    const [leistungen, setLeistungen] = useState([]);
    const [programme, setProgramme] = useState([]);
    const [programmId, setProgrammId] = useState('');
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

    const zeigtProgrammWahl = !dossier?.akt_programm_id;

    const dauerMonate = (() => {
        if (!dossier?.programm_verlauf) return 1;
        const laufend = dossier.programm_verlauf.find(v => v.status === 'Laufend');
        if (!laufend?.start_datum || !laufend?.geplantes_enddatum) return 1;
        const s = new Date(laufend.start_datum), e = new Date(laufend.geplantes_enddatum);
        return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
    })();

    useEffect(() => {
        if (!open) return;
        client.get('/leistungen').then(r => setLeistungen(r.data)).catch(console.error);
        if (zeigtProgrammWahl) {
            client.get('/programme').then(r => setProgramme(r.data)).catch(console.error);
        }
        setNummer(verfuegung?.nummer || '');
        setDatum(verfuegung?.datum ? verfuegung.datum.slice(0, 10) : '');
        setStatus(verfuegung?.status || 'aktiv');
        setBemerkung(verfuegung?.bemerkung || '');
        setProgrammId('');
        setFehler('');
        setAktTab('verfuegung');
        setPositionen(
            (verfuegung?.positionen || []).map((p, i) => ({
                _key: i,
                position_id: p.position_id,
                leistung_id: p.leistung_id || '',
                soll_stunden: p.soll_stunden ?? 0,
                verrechnungsart: p.verrechnungsart || '',
                betrag: p.betrag != null ? String(p.betrag) : '',
            }))
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, verfuegung]);

    function addPosition() {
        setPositionen(prev => [...prev, { _key: Date.now(), position_id: null, leistung_id: '', soll_stunden: 0, verrechnungsart: '', betrag: '' }]);
    }

    function removePosition(key) {
        setPositionen(prev => prev.filter(p => p._key !== key));
    }

    function updatePosition(key, field, value) {
        setPositionen(prev => prev.map(p => p._key === key ? { ...p, [field]: value } : p));
    }

    function handleLeistungChange(key, leistung_id) {
        const l = leistungen.find(l => l.leistung_id === leistung_id);
        const vart = l?.entschaedigungsart ? (VART_MAPPING[l.entschaedigungsart] || '') : '';
        const tarif = parseFloat(l?.tarif) || 0;
        setPositionen(prev => prev.map(p => {
            if (p._key !== key) return p;
            return {
                ...p,
                leistung_id,
                verrechnungsart: vart,
                betrag: (vart === 'monatspauschale' || vart === 'fallpauschale') && tarif > 0 ? String(tarif) : p.betrag,
            };
        }));
    }

    async function handleSubmit() {
        if (!nummer.trim()) {
            setFehler('Nummer ist erforderlich.');
            setAktTab('verfuegung');
            return;
        }
        if (zeigtProgrammWahl && !programmId) {
            setFehler('Programm ist erforderlich, um den Start zu erfassen.');
            setAktTab('verfuegung');
            return;
        }
        setLaden(true);
        setFehler('');
        try {
            const payload = {
                dossier_id: dossierId,
                nummer: nummer.trim(),
                datum: datum || null,
                bemerkung: bemerkung.trim() || null,
                status,
                ...(zeigtProgrammWahl ? { programm_id: programmId } : {}),
            };
            let verfuegungId;
            if (verfuegung) {
                await client.put(`/verfuegungen/${verfuegung.verfuegung_id}`, payload);
                verfuegungId = verfuegung.verfuegung_id;
                for (const p of (verfuegung.positionen || [])) {
                    if (p.position_id) {
                        await client.delete(`/verfuegungen/${verfuegungId}/positionen/${p.position_id}`);
                    }
                }
            } else {
                const r = await client.post('/verfuegungen', payload);
                verfuegungId = r.data.verfuegung_id;
            }
            for (let i = 0; i < positionen.length; i++) {
                const p = positionen[i];
                if (p.leistung_id) {
                    await client.post(`/verfuegungen/${verfuegungId}/positionen`, {
                        leistung_id: p.leistung_id,
                        soll_stunden: p.verrechnungsart === 'stundenpauschale' ? parseFloat(p.soll_stunden) || 0 : 0,
                        reihenfolge: i,
                        verrechnungsart: p.verrechnungsart || null,
                        betrag: (p.verrechnungsart === 'monatspauschale' || p.verrechnungsart === 'fallpauschale')
                            ? (parseFloat(p.betrag) || null)
                            : null,
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

    const gesamtSoll = positionen.reduce((acc, p) => {
        const s = positionSoll(p, leistungen, dauerMonate);
        if (!s) return acc;
        return { h: acc.h + s.h, chf: acc.chf + s.chf };
    }, { h: 0, chf: 0 });

    return (
        <Modal open={open} onClose={onClose} title={verfuegung ? 'Verfügung bearbeiten' : 'Neue Verfügung'} width={560}>
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
                    {zeigtProgrammWahl && (
                        <div>
                            <FieldLabel required>Programm</FieldLabel>
                            <select value={programmId} onChange={e => setProgrammId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="">— Programm wählen —</option>
                                {programme.map(p => (
                                    <option key={p.programm_id} value={p.programm_id}>{p.name}</option>
                                ))}
                            </select>
                            <div style={{ fontSize: 11, color: '#6B6860', marginTop: 4 }}>
                                Dossier hat noch kein Programm — Auswahl startet es.
                            </div>
                        </div>
                    )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {positionen.length === 0 && (
                        <div style={{ fontSize: 12.5, color: '#9CA3AF', textAlign: 'center', padding: '1rem 0' }}>
                            Noch keine Positionen — "+" klicken zum Hinzufügen
                        </div>
                    )}
                    {positionen.map(pos => {
                        const l = leistungen.find(l => l.leistung_id === pos.leistung_id);
                        const zeigt_betrag = pos.verrechnungsart === 'monatspauschale' || pos.verrechnungsart === 'fallpauschale';
                        const zeigt_stunden = pos.verrechnungsart === 'stundenpauschale';
                        const soll = positionSoll(pos, leistungen, dauerMonate);
                        return (
                            <div key={pos._key} style={{ background: '#F9F8F6', border: '1px solid rgba(0,0,0,.09)', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: 8, alignItems: 'start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {/* Leistung */}
                                        <select
                                            value={pos.leistung_id}
                                            onChange={e => handleLeistungChange(pos._key, e.target.value)}
                                            style={{ fontSize: 13, padding: '6px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1A1917' }}
                                        >
                                            <option value="">— Leistung wählen —</option>
                                            {leistungen.map(l => (
                                                <option key={l.leistung_id} value={l.leistung_id}>
                                                    {l.tarifnr} · {l.bezeichnung}
                                                </option>
                                            ))}
                                        </select>
                                        {/* Verrechnungsart + Betrag/Stunden */}
                                        <div style={{ display: 'grid', gridTemplateColumns: zeigt_betrag || zeigt_stunden ? '1fr 1fr' : '1fr', gap: 8 }}>
                                            <select
                                                value={pos.verrechnungsart}
                                                onChange={e => updatePosition(pos._key, 'verrechnungsart', e.target.value)}
                                                style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', color: pos.verrechnungsart ? '#1A1917' : '#9CA3AF' }}
                                            >
                                                <option value="">— Verrechnungsart —</option>
                                                <option value="monatspauschale">Monatspauschale</option>
                                                <option value="fallpauschale">Fallpauschale</option>
                                                <option value="stundenpauschale">Stundenpauschale</option>
                                            </select>
                                            {zeigt_betrag && (
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type="number" min="0" step="0.01"
                                                        value={pos.betrag}
                                                        onChange={e => updatePosition(pos._key, 'betrag', e.target.value)}
                                                        placeholder="Betrag CHF"
                                                        style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'right' }}
                                                    />
                                                </div>
                                            )}
                                            {zeigt_stunden && (
                                                <input
                                                    type="number" min="0" step="0.5"
                                                    value={pos.soll_stunden}
                                                    onChange={e => updatePosition(pos._key, 'soll_stunden', e.target.value)}
                                                    placeholder="SOLL-Stunden"
                                                    style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                                                />
                                            )}
                                        </div>
                                        {/* SOLL-Vorschau */}
                                        {soll && (
                                            <div style={{ fontSize: 11, color: '#374151', background: '#EEF3FE', border: '1px solid rgba(37,99,235,.1)', borderRadius: 5, padding: '3px 8px', display: 'inline-flex', gap: 10 }}>
                                                <span>SOLL: <strong>{soll.h}h</strong></span>
                                                {soll.chf > 0 && <span>CHF <strong>{soll.chf.toFixed(2)}</strong></span>}
                                                {pos.verrechnungsart === 'monatspauschale' && l?.tarif && <span style={{ color: '#6B6860' }}>({dauerMonate} Mt.)</span>}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removePosition(pos._key)}
                                        style={{ width: 32, height: 32, border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    >×</button>
                                </div>
                            </div>
                        );
                    })}
                    <button
                        onClick={addPosition}
                        style={{ padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', border: '1px dashed rgba(0,0,0,.2)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', color: '#6B6860', marginTop: 2 }}
                    >+ Position hinzufügen</button>

                    {/* Gesamt-SOLL */}
                    {positionen.length > 0 && (gesamtSoll.h > 0 || gesamtSoll.chf > 0) && (
                        <div style={{ borderTop: '1px solid rgba(0,0,0,.09)', paddingTop: 10, display: 'flex', gap: 16, fontSize: 12.5, color: '#374151' }}>
                            <span style={{ fontWeight: 600 }}>Gesamt-SOLL:</span>
                            <span>{Math.round(gesamtSoll.h * 10) / 10}h</span>
                            {gesamtSoll.chf > 0 && <span>CHF {gesamtSoll.chf.toFixed(2)}</span>}
                        </div>
                    )}
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
