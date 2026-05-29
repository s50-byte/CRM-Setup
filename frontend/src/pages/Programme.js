import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import Modal from '../components/Modal';

const CARD = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};

export default function Programme() {
    const [programme, setProgramme] = useState([]);
    const [laden, setLaden] = useState(true);
    const [offen, setOffen] = useState({});
    const [phaseOffen, setPhaseOffen] = useState({});
    const [neuerKText, setNeuerKText] = useState({});
    const [neuerKPflicht, setNeuerKPflicht] = useState({});
    const [neuePhaseText, setNeuePhaseText] = useState({});
    const [neuePhaseFormOffen, setNeuePhaseFormOffen] = useState({});
    const [neuesProgrammOffen, setNeuesProgrammOffen] = useState(false);
    const [npForm, setNpForm] = useState({ name: '', farbe_hex: '#2563EB', tarif_pro_tag: '', avg_dauer_tage: 60, aufwand_h_monat: 10 });
    const [busy, setBusy] = useState(false);

    const ladeProgramme = useCallback(async () => {
        try {
            const r = await client.get('/programme');
            setProgramme(r.data);
        } catch (err) { console.error(err); }
        finally { setLaden(false); }
    }, []);

    useEffect(() => { ladeProgramme(); }, [ladeProgramme]);

    async function kriteriumHinzufuegen(phase_id) {
        const text = (neuerKText[phase_id] || '').trim();
        if (!text) return;
        setBusy(true);
        try {
            await client.post(`/programme/phasen/${phase_id}/kriterien`, {
                text,
                pflicht: neuerKPflicht[phase_id] || false,
            });
            setNeuerKText(p => ({ ...p, [phase_id]: '' }));
            setNeuerKPflicht(p => ({ ...p, [phase_id]: false }));
            await ladeProgramme();
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    async function kriteriumLoeschen(kriterium_id) {
        try {
            await client.delete(`/programme/kriterien/${kriterium_id}`);
            await ladeProgramme();
        } catch (err) { console.error(err); }
    }

    async function phaseHinzufuegen(programm_id) {
        const label = (neuePhaseText[programm_id] || '').trim();
        if (!label) return;
        setBusy(true);
        try {
            await client.post(`/programme/${programm_id}/phasen`, { label });
            setNeuePhaseText(p => ({ ...p, [programm_id]: '' }));
            setNeuePhaseFormOffen(p => ({ ...p, [programm_id]: false }));
            await ladeProgramme();
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    async function phaseLoeschen(phase_id) {
        if (!window.confirm('Phase und alle ihre Kriterien löschen?')) return;
        try {
            await client.delete(`/programme/phasen/${phase_id}`);
            await ladeProgramme();
        } catch (err) { console.error(err); }
    }

    async function programmErstellen() {
        if (!npForm.name || !npForm.tarif_pro_tag) return;
        setBusy(true);
        try {
            await client.post('/programme', npForm);
            setNeuesProgrammOffen(false);
            setNpForm({ name: '', farbe_hex: '#2563EB', tarif_pro_tag: '', avg_dauer_tage: 60, aufwand_h_monat: 10 });
            await ladeProgramme();
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    if (laden) return <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Programme</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Phasen, Muss-Kriterien, Tarife und Aufwand</div>
                </div>
                <button onClick={() => setNeuesProgrammOffen(true)} style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neues Programm</button>
            </div>

            {/* Programme */}
            {programme.map(p => {
                const istOffen = offen[p.programm_id];
                return (
                    <div key={p.programm_id} style={{ ...CARD, marginBottom: '.875rem', overflow: 'hidden' }}>
                        {/* Programm-Header */}
                        <div
                            onClick={() => setOffen(prev => ({ ...prev, [p.programm_id]: !istOffen }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem', cursor: 'pointer' }}
                        >
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: p.farbe_hex, flexShrink: 0 }} />
                            <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>CHF {p.tarif_pro_tag}/Tag</span>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>Ø {p.avg_dauer_tage}d</span>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>{p.aufwand_h_monat}h/Mt.</span>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(37,99,235,.15)', fontFamily: 'monospace' }}>
                                {(p.phasen || []).length} Phasen
                            </span>
                            <span style={{ fontSize: 13, color: '#A09D97', transform: istOffen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                        </div>

                        {/* Phasen */}
                        {istOffen && (
                            <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', padding: '1rem' }}>
                                {(p.phasen || []).length === 0 && (
                                    <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic', marginBottom: 10 }}>Noch keine Phasen definiert</div>
                                )}

                                {(p.phasen || []).map((ph, i) => {
                                    const phOffen = phaseOffen[ph.phase_id];
                                    const krCount = (ph.kriterien || []).length;
                                    const pflichtCount = (ph.kriterien || []).filter(k => k.pflicht).length;
                                    return (
                                        <div key={ph.phase_id} style={{ marginBottom: 8, border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, overflow: 'hidden' }}>
                                            {/* Phase-Header */}
                                            <div
                                                onClick={() => setPhaseOffen(prev => ({ ...prev, [ph.phase_id]: !phOffen }))}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F5F4F0', cursor: 'pointer' }}
                                            >
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: '50%',
                                                    background: p.farbe_hex + '22', color: p.farbe_hex,
                                                    border: `1.5px solid ${p.farbe_hex}`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 9, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0
                                                }}>{i + 1}</div>
                                                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{ph.label}</span>
                                                {krCount > 0 && (
                                                    <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 10, background: '#ECFDF5', color: '#15803D', border: '1px solid rgba(22,163,74,.15)', fontFamily: 'monospace' }}>
                                                        {krCount} Kriterien{pflichtCount > 0 ? ` (${pflichtCount} Pflicht)` : ''}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={e => { e.stopPropagation(); phaseLoeschen(ph.phase_id); }}
                                                    style={{ padding: '2px 7px', fontSize: 11, cursor: 'pointer', border: '1px solid rgba(220,38,38,.2)', borderRadius: 4, background: '#FEF2F2', color: '#B91C1C', fontFamily: 'inherit' }}
                                                >Löschen</button>
                                                <span style={{ fontSize: 12, color: '#A09D97', transform: phOffen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                                            </div>

                                            {/* Kriterien */}
                                            {phOffen && (
                                                <div style={{ padding: '10px 14px' }}>
                                                    {(ph.kriterien || []).length === 0 ? (
                                                        <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic', marginBottom: 10 }}>Noch keine Kriterien für diese Phase</div>
                                                    ) : (ph.kriterien || []).map(k => (
                                                        <div key={k.kriterium_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                                                            <span style={{ flex: 1, fontSize: 12.5 }}>{k.text}</span>
                                                            {k.typ && (
                                                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#F5F4F0', color: '#6B6860', fontFamily: 'monospace', flexShrink: 0 }}>{k.typ}</span>
                                                            )}
                                                            <span style={{
                                                                fontSize: 10, padding: '1px 6px', borderRadius: 8, fontFamily: 'monospace', flexShrink: 0,
                                                                background: k.pflicht ? '#FEF2F2' : '#F5F4F0',
                                                                color: k.pflicht ? '#B91C1C' : '#A09D97',
                                                                border: `1px solid ${k.pflicht ? 'rgba(220,38,38,.15)' : 'rgba(0,0,0,.09)'}`,
                                                            }}>{k.pflicht ? 'Pflicht' : 'Optional'}</span>
                                                            <button
                                                                onClick={() => kriteriumLoeschen(k.kriterium_id)}
                                                                style={{ width: 22, height: 22, padding: 0, fontSize: 13, lineHeight: 1, cursor: 'pointer', border: '1px solid rgba(220,38,38,.2)', borderRadius: 4, background: '#FEF2F2', color: '#B91C1C', fontFamily: 'inherit', flexShrink: 0 }}
                                                            >×</button>
                                                        </div>
                                                    ))}

                                                    {/* Kriterium hinzufügen */}
                                                    <div style={{ display: 'flex', gap: 7, marginTop: 10, alignItems: 'center' }}>
                                                        <input
                                                            value={neuerKText[ph.phase_id] || ''}
                                                            onChange={e => setNeuerKText(prev => ({ ...prev, [ph.phase_id]: e.target.value }))}
                                                            onKeyDown={e => e.key === 'Enter' && kriteriumHinzufuegen(ph.phase_id)}
                                                            placeholder="Kriterium eingeben…"
                                                            style={{ flex: 1, fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, fontFamily: 'inherit', outline: 'none' }}
                                                        />
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6B6860', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={neuerKPflicht[ph.phase_id] || false}
                                                                onChange={e => setNeuerKPflicht(prev => ({ ...prev, [ph.phase_id]: e.target.checked }))}
                                                            />
                                                            Pflicht
                                                        </label>
                                                        <button
                                                            onClick={() => kriteriumHinzufuegen(ph.phase_id)}
                                                            disabled={busy || !(neuerKText[ph.phase_id] || '').trim()}
                                                            style={{ padding: '5px 12px', fontSize: 12, cursor: 'pointer', border: 'none', borderRadius: 5, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}
                                                        >+</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Phase hinzufügen */}
                                {neuePhaseFormOffen[p.programm_id] ? (
                                    <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                                        <input
                                            autoFocus
                                            value={neuePhaseText[p.programm_id] || ''}
                                            onChange={e => setNeuePhaseText(prev => ({ ...prev, [p.programm_id]: e.target.value }))}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') phaseHinzufuegen(p.programm_id);
                                                if (e.key === 'Escape') setNeuePhaseFormOffen(prev => ({ ...prev, [p.programm_id]: false }));
                                            }}
                                            placeholder="Phasenname (z.B. Erstkontakt, Abklärung…)"
                                            style={{ flex: 1, fontSize: 12.5, padding: '6px 10px', border: '1px solid rgba(37,99,235,.3)', borderRadius: 6, fontFamily: 'inherit', outline: 'none' }}
                                        />
                                        <button onClick={() => phaseHinzufuegen(p.programm_id)} disabled={busy} style={{ padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', border: 'none', borderRadius: 5, background: '#2563EB', color: '#fff', fontFamily: 'inherit' }}>+</button>
                                        <button onClick={() => setNeuePhaseFormOffen(prev => ({ ...prev, [p.programm_id]: false }))} style={{ padding: '6px 10px', fontSize: 12.5, cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>✕</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setNeuePhaseFormOffen(prev => ({ ...prev, [p.programm_id]: true }))}
                                        style={{ marginTop: 8, width: '100%', padding: '7px', fontSize: 12.5, cursor: 'pointer', border: '1px dashed rgba(37,99,235,.3)', borderRadius: 6, background: '#F8FAFF', color: '#2563EB', fontFamily: 'inherit', textAlign: 'center' }}
                                    >+ Phase hinzufügen</button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Neues Programm Modal */}
            <Modal open={neuesProgrammOffen} onClose={() => setNeuesProgrammOffen(false)} title="Neues Programm erstellen" width={440}>
                {[
                    { label: 'Name', key: 'name', type: 'text' },
                    { label: 'Tarif pro Tag (CHF)', key: 'tarif_pro_tag', type: 'number' },
                    { label: 'Ø Dauer (Tage)', key: 'avg_dauer_tage', type: 'number' },
                    { label: 'Aufwand (h/Monat)', key: 'aufwand_h_monat', type: 'number' },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{f.label}</label>
                        <input
                            type={f.type}
                            value={npForm[f.key]}
                            onChange={e => setNpForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                    </div>
                ))}
                <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Farbe</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['#2563EB','#0891B2','#0D9488','#16A34A','#7C3AED','#D97706','#DC2626'].map(c => (
                            <div key={c} onClick={() => setNpForm(prev => ({ ...prev, farbe_hex: c }))} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: npForm.farbe_hex === c ? '3px solid #1A1917' : '2px solid transparent', transition: 'border .1s' }} />
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setNeuesProgrammOffen(false)} style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>Abbrechen</button>
                    <button onClick={programmErstellen} disabled={busy || !npForm.name || !npForm.tarif_pro_tag} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', opacity: (!npForm.name || !npForm.tarif_pro_tag) ? .5 : 1 }}>Erstellen</button>
                </div>
            </Modal>
        </div>
    );
}
