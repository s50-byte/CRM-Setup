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
    const [nummer, setNummer] = useState('');
    const [gueltigVon, setGueltigVon] = useState('');
    const [gueltigBis, setGueltigBis] = useState('');
    const [datei, setDatei] = useState(null);          // neu gewaehlt, noch nicht hochgeladen
    const [dateiId, setDateiId] = useState(null);      // bereits hinterlegt
    const [dateiName, setDateiName] = useState('');
    const [programmId, setProgrammId] = useState('');  // bestaetigter Vorschlag
    const [datum, setDatum] = useState('');
    const [status, setStatus] = useState('aktiv');
    const [bemerkung, setBemerkung] = useState('');
    const [positionen, setPositionen] = useState([]);
    const [leistungen, setLeistungen] = useState([]);
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);

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
        setNummer(verfuegung?.nummer || '');
        setDatum(verfuegung?.datum ? verfuegung.datum.slice(0, 10) : '');
        setGueltigVon(verfuegung?.gueltig_von ? verfuegung.gueltig_von.slice(0, 10) : '');
        setGueltigBis(verfuegung?.gueltig_bis ? verfuegung.gueltig_bis.slice(0, 10) : '');
        setDatei(null);
        setDateiId(verfuegung?.datei_id || null);
        setDateiName(verfuegung?.datei_name || '');
        setProgrammId('');
        setStatus(verfuegung?.status || 'aktiv');
        setBemerkung(verfuegung?.bemerkung || '');
        setFehler('');
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

    // Vorschlag aus den Positionen: jede Leistung gehoert zu hoechstens einem
    // Programm. Bestaetigt wird er unten per Klick, aendern bleibt moeglich.
    const vorschlaege = [...new Map(
        positionen
            .map(pos => leistungen.find(l => l.leistung_id === pos.leistung_id))
            .filter(l => l && l.programm_id)
            .map(l => [l.programm_id, { programm_id: l.programm_id, name: l.programm_name || l.bezeichnung }])
    ).values()];

    const hatProgramm = !!dossier?.akt_programm_id;

    async function handleSubmit() {
        if (!nummer.trim()) {
            setFehler('Bezeichnung ist erforderlich.');
            return;
        }
        setLaden(true);
        setFehler('');
        try {
            // Erst die Datei in die Ablage, dann die Verfuegung mit dem Verweis.
            let datei_id = dateiId;
            if (datei) {
                const fd = new FormData();
                fd.append('datei', datei);
                const r = await client.post('/dateien', fd);
                datei_id = r.data.datei_id;
            }

            const payload = {
                dossier_id: dossierId,
                nummer: nummer.trim(),
                datum: datum || null,
                gueltig_von: gueltigVon || null,
                gueltig_bis: gueltigBis || null,
                datei_id: datei_id || null,
                bemerkung: bemerkung.trim() || null,
                status,
                // Nur was ausdruecklich bestaetigt wurde – nie automatisch.
                programm_id: programmId || null,
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
            {(
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <FieldLabel required>Verfügungsnummer</FieldLabel>
                        <input
                            type="text" value={nummer} onChange={e => setNummer(e.target.value)}
                            placeholder="z.B. 756.1234.5678.90 / 2026-04" style={inputStyle}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <FieldLabel>Gültig von</FieldLabel>
                            <input type="date" value={gueltigVon} onChange={e => setGueltigVon(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <FieldLabel>Gültig bis</FieldLabel>
                            <input type="date" value={gueltigBis} onChange={e => setGueltigBis(e.target.value)} style={inputStyle} />
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Verfügungsdokument</FieldLabel>
                        {dateiId && !datei ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ flex: 1, fontSize: 12.5 }}>📄 {dateiName || 'hinterlegt'}</span>
                                <button
                                    onClick={() => { setDateiId(null); setDateiName(''); }}
                                    style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: '1px solid rgba(220,38,38,.25)', borderRadius: 5, background: '#FEF2F2', color: '#B91C1C', fontFamily: 'inherit' }}
                                >Entfernen</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                                    onChange={e => setDatei(e.target.files?.[0] || null)}
                                    style={{ ...inputStyle, padding: '6px 8px' }}
                                />
                                <div style={{ fontSize: 10.5, color: '#A09D97', marginTop: 4 }}>
                                    PDF, JPG, PNG, DOCX, XLSX · max. 20 MB
                                </div>
                            </>
                        )}
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

            {(
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
                                                    {l.tarifnr} · {l.nummer}
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
                                                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                                                    <span style={{ padding: '5px 7px', fontSize: 12, color: '#6B6860', background: '#F5F4F0', borderRight: '1px solid rgba(0,0,0,.09)', flexShrink: 0 }}>CHF</span>
                                                    <input
                                                        type="number" min="0" step="0.01"
                                                        value={pos.betrag}
                                                        onChange={e => updatePosition(pos._key, 'betrag', e.target.value)}
                                                        placeholder="0.00"
                                                        style={{ fontSize: 12.5, padding: '5px 8px', border: 'none', background: 'transparent', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'right' }}
                                                    />
                                                </div>
                                            )}
                                            {zeigt_stunden && (
                                                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                                                    <input
                                                        type="number" min="0" step="0.5"
                                                        value={pos.soll_stunden}
                                                        onChange={e => updatePosition(pos._key, 'soll_stunden', e.target.value)}
                                                        placeholder="0"
                                                        style={{ fontSize: 12.5, padding: '5px 8px', border: 'none', background: 'transparent', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'right' }}
                                                    />
                                                    <span style={{ padding: '5px 7px', fontSize: 12, color: '#6B6860', background: '#F5F4F0', borderLeft: '1px solid rgba(0,0,0,.09)', flexShrink: 0 }}>h</span>
                                                </div>
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

            {/* Programmvorschlag aus den Positionen — bestaetigen oder aendern */}
            {!hatProgramm && vorschlaege.length > 0 && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: '#F8FAFF', border: '1px solid rgba(37,99,235,.18)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                        Programm starten
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                        Aus den Tarifen vorgeschlagen. Ohne Auswahl wird kein Programm gestartet.
                    </div>
                    <select
                        value={programmId}
                        onChange={e => setProgrammId(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                        <option value="">— kein Programm starten —</option>
                        {vorschlaege.map(v => (
                            <option key={v.programm_id} value={v.programm_id}>{v.name}</option>
                        ))}
                    </select>
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
