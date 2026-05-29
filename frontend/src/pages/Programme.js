import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import Modal from '../components/Modal';

const CARD = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};

const BTN_ADD = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, padding: '3px 8px', borderRadius: 5,
    border: '1px solid rgba(37,99,235,.25)', background: '#EEF3FE',
    color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 500, flexShrink: 0,
};

const BTN_DEL_SM = {
    width: 20, height: 20, padding: 0, fontSize: 13, lineHeight: 1,
    cursor: 'pointer', border: '1px solid rgba(220,38,38,.2)',
    borderRadius: 4, background: '#FEF2F2', color: '#B91C1C',
    fontFamily: 'inherit', flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
};

const INPUT_S = {
    fontSize: 12, padding: '5px 9px',
    border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
    fontFamily: 'inherit', outline: 'none', background: '#fff',
};

const BADGE = {
    fontSize: 11, padding: '2px 7px', borderRadius: 20,
    background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
    fontFamily: 'monospace', flexShrink: 0,
};

const DOK_TYPEN = [
    'IV-Verfügung', 'Lebenslauf', 'Arztbericht', 'Anmeldeformular',
    'Leistungsvereinbarung', 'Abschlussbericht', 'Erstgesprächsprotokoll', 'Sonstiges',
];

function Section({ title, children, headerRight }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</div>
                {headerRight}
            </div>
            {children}
        </div>
    );
}

function DokListe({ docs, onDelete }) {
    if (!docs) return <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic' }}>Laden…</div>;
    if (docs.length === 0) return <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic' }}>Keine Dokumente</div>;
    return (
        <div>
            {docs.map(d => (
                <div key={d.pdok_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 5, background: '#F5F4F0', color: '#6B6860', border: '1px solid rgba(0,0,0,.08)', fontFamily: 'monospace', flexShrink: 0 }}>{d.typ || '—'}</span>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{d.dateiname}</span>
                    {onDelete && (
                        <button style={BTN_DEL_SM} onClick={() => onDelete(d.pdok_id)}>×</button>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function Programme() {
    const { benutzer } = useAuth();
    const istLeitungsteam = ['teamleitung', 'management'].includes(benutzer?.system_rolle);

    const [programme, setProgramme] = useState([]);
    const [laden, setLaden] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [activePhase, setActivePhase] = useState({});
    const [progDoks, setProgDoks] = useState({});
    const [phaseDoks, setPhaseDoks] = useState({});
    const [renamePhase, setRenamePhase] = useState(null);
    const [neuerKForm, setNeuerKForm] = useState({});
    const [neuePhaseForm, setNeuePhaseForm] = useState({});
    const [dokModal, setDokModal] = useState(null);
    const [dokForm, setDokForm] = useState({ dateiname: '', typ: 'Sonstiges' });
    const [neuesProgrammOffen, setNeuesProgrammOffen] = useState(false);
    const [npForm, setNpForm] = useState({ name: '', farbe_hex: '#2563EB', tarif_pro_tag: '', avg_dauer_tage: 60, aufwand_h_monat: 10 });
    const [busy, setBusy] = useState(false);

    const ladeProgramme = useCallback(async () => {
        try { const r = await client.get('/programme'); setProgramme(r.data); }
        catch (err) { console.error(err); }
        finally { setLaden(false); }
    }, []);

    useEffect(() => { ladeProgramme(); }, [ladeProgramme]);

    async function loadProgDoks(programm_id) {
        try {
            const r = await client.get(`/dokumente/programm/${programm_id}`);
            setProgDoks(prev => ({ ...prev, [programm_id]: r.data }));
        } catch (err) { console.error(err); }
    }

    async function loadPhaseDoks(phase_id) {
        try {
            const r = await client.get(`/dokumente/phase/${phase_id}`);
            setPhaseDoks(prev => ({ ...prev, [phase_id]: r.data }));
        } catch (err) { console.error(err); }
    }

    function toggleProgramm(prog) {
        const isNowOpen = !expanded[prog.programm_id];
        setExpanded(prev => ({ ...prev, [prog.programm_id]: isNowOpen }));
        if (isNowOpen) {
            loadProgDoks(prog.programm_id);
            const phasen = prog.phasen || [];
            if (phasen.length > 0 && !activePhase[prog.programm_id]) {
                const first = phasen[0];
                setActivePhase(prev => ({ ...prev, [prog.programm_id]: first.phase_id }));
                loadPhaseDoks(first.phase_id);
            }
        }
    }

    function selectPhase(programm_id, phase) {
        setActivePhase(prev => ({ ...prev, [programm_id]: phase.phase_id }));
        if (phaseDoks[phase.phase_id] === undefined) loadPhaseDoks(phase.phase_id);
        setRenamePhase(null);
    }

    async function phaseUmbenennen() {
        if (!renamePhase?.label.trim()) { setRenamePhase(null); return; }
        const prog = programme.find(p => p.phasen?.some(ph => ph.phase_id === renamePhase.phase_id));
        if (!prog) return;
        try {
            await client.put(`/programme/${prog.programm_id}/phasen/${renamePhase.phase_id}`, { label: renamePhase.label.trim() });
            setRenamePhase(null);
            await ladeProgramme();
        } catch (err) { console.error(err); }
    }

    async function phaseHinzufuegen(programm_id) {
        const text = (neuePhaseForm[programm_id]?.text || '').trim();
        if (!text) return;
        setBusy(true);
        try {
            const r = await client.post(`/programme/${programm_id}/phasen`, { label: text });
            setNeuePhaseForm(prev => ({ ...prev, [programm_id]: { open: false, text: '' } }));
            await ladeProgramme();
            if (r.data?.phase_id) {
                setActivePhase(prev => ({ ...prev, [programm_id]: r.data.phase_id }));
                loadPhaseDoks(r.data.phase_id);
            }
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    async function phaseLoeschen(phase_id, programm_id) {
        if (!window.confirm('Phase und alle ihre Kriterien löschen?')) return;
        try {
            await client.delete(`/programme/phasen/${phase_id}`);
            setActivePhase(prev => prev[programm_id] === phase_id ? { ...prev, [programm_id]: null } : prev);
            await ladeProgramme();
        } catch (err) { console.error(err); }
    }

    async function kriteriumHinzufuegen(phase_id) {
        const form = neuerKForm[phase_id] || {};
        const text = (form.text || '').trim();
        if (!text) return;
        setBusy(true);
        try {
            await client.post(`/programme/phasen/${phase_id}/kriterien`, { text, pflicht: form.pflicht || false });
            setNeuerKForm(prev => ({ ...prev, [phase_id]: { text: '', pflicht: false } }));
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

    async function dokumentHochladen() {
        if (!dokForm.dateiname.trim() || !dokModal) return;
        setBusy(true);
        try {
            await client.post('/dokumente/programm', {
                programm_id: dokModal.programm_id,
                phase_id: dokModal.phase_id || null,
                dateiname: dokForm.dateiname.trim(),
                typ: dokForm.typ,
            });
            if (dokModal.phase_id) await loadPhaseDoks(dokModal.phase_id);
            else await loadProgDoks(dokModal.programm_id);
            setDokModal(null);
            setDokForm({ dateiname: '', typ: 'Sonstiges' });
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    async function dokumentLoeschen(pdok_id, programm_id, phase_id) {
        if (!window.confirm('Dokument löschen?')) return;
        try {
            await client.delete(`/dokumente/programm/${pdok_id}`);
            if (phase_id) setPhaseDoks(prev => ({ ...prev, [phase_id]: (prev[phase_id] || []).filter(d => d.pdok_id !== pdok_id) }));
            else setProgDoks(prev => ({ ...prev, [programm_id]: (prev[programm_id] || []).filter(d => d.pdok_id !== pdok_id) }));
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
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Knowledge Pool</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Phasen, Kriterien, Dokumente und Tarife pro Programm</div>
                </div>
                {istLeitungsteam && (
                    <button onClick={() => setNeuesProgrammOffen(true)} style={{
                        padding: '7px 14px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>+ Neues Programm</button>
                )}
            </div>

            {programme.length === 0 && (
                <div style={{ ...CARD, padding: '2rem', textAlign: 'center', color: '#A09D97', fontSize: 13 }}>
                    Noch keine Programme definiert
                </div>
            )}

            {programme.map(p => {
                const isOpen = !!expanded[p.programm_id];
                const phasen = p.phasen || [];
                const activePhasId = activePhase[p.programm_id];
                const activePhaseObj = phasen.find(ph => ph.phase_id === activePhasId);

                return (
                    <div key={p.programm_id} style={{ ...CARD, marginBottom: '.875rem', overflow: 'hidden' }}>
                        {/* Programm-Header */}
                        <div
                            onClick={() => toggleProgramm(p)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem', cursor: 'pointer', userSelect: 'none' }}
                        >
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: p.farbe_hex, flexShrink: 0 }} />
                            <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                            <span style={BADGE}>CHF {p.tarif_pro_tag}/Tag</span>
                            <span style={BADGE}>Ø {p.avg_dauer_tage}d</span>
                            <span style={{ ...BADGE, background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(37,99,235,.15)' }}>
                                {phasen.length} Phasen
                            </span>
                            <span style={{ fontSize: 13, color: '#A09D97', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                        </div>

                        {/* Expanded: 2-column layout */}
                        {isOpen && (
                            <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', minHeight: 280 }}>

                                {/* LEFT: Phase navigation */}
                                <div style={{ width: 220, borderRight: '1px solid rgba(0,0,0,.06)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '10px 0', flex: 1 }}>
                                        {phasen.length === 0 && (
                                            <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic', padding: '8px 14px' }}>Noch keine Phasen</div>
                                        )}
                                        {phasen.map((ph, i) => {
                                            const isActive = activePhasId === ph.phase_id;
                                            const isRenaming = renamePhase?.phase_id === ph.phase_id;
                                            return (
                                                <div
                                                    key={ph.phase_id}
                                                    onClick={() => selectPhase(p.programm_id, ph)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        padding: '7px 14px', cursor: 'pointer',
                                                        borderLeft: `3px solid ${isActive ? p.farbe_hex : 'transparent'}`,
                                                        background: isActive ? p.farbe_hex + '12' : 'transparent',
                                                        transition: 'background .1s',
                                                    }}
                                                >
                                                    <div style={{
                                                        width: 18, height: 18, borderRadius: '50%',
                                                        background: isActive ? p.farbe_hex : p.farbe_hex + '22',
                                                        color: isActive ? '#fff' : p.farbe_hex,
                                                        border: `1.5px solid ${p.farbe_hex}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 9, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0
                                                    }}>{i + 1}</div>
                                                    {isRenaming && istLeitungsteam ? (
                                                        <input
                                                            autoFocus
                                                            value={renamePhase.label}
                                                            onChange={e => setRenamePhase(prev => ({ ...prev, label: e.target.value }))}
                                                            onBlur={phaseUmbenennen}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') phaseUmbenennen();
                                                                if (e.key === 'Escape') setRenamePhase(null);
                                                                e.stopPropagation();
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                            style={{ ...INPUT_S, flex: 1, fontSize: 12, padding: '2px 5px' }}
                                                        />
                                                    ) : (
                                                        <span
                                                            style={{ flex: 1, fontSize: 12.5, fontWeight: isActive ? 500 : 400 }}
                                                            title={istLeitungsteam ? 'Doppelklick zum Umbenennen' : undefined}
                                                            onDoubleClick={istLeitungsteam ? e => {
                                                                e.stopPropagation();
                                                                setRenamePhase({ phase_id: ph.phase_id, label: ph.label });
                                                            } : undefined}
                                                        >{ph.label}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* + Phase hinzufügen */}
                                    {istLeitungsteam && (
                                        neuePhaseForm[p.programm_id]?.open ? (
                                            <div style={{ padding: '8px 12px 12px', display: 'flex', gap: 5 }}>
                                                <input
                                                    autoFocus
                                                    value={neuePhaseForm[p.programm_id]?.text || ''}
                                                    onChange={e => setNeuePhaseForm(prev => ({ ...prev, [p.programm_id]: { ...prev[p.programm_id], text: e.target.value } }))}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') phaseHinzufuegen(p.programm_id);
                                                        if (e.key === 'Escape') setNeuePhaseForm(prev => ({ ...prev, [p.programm_id]: { open: false, text: '' } }));
                                                    }}
                                                    placeholder="Phasenname…"
                                                    style={{ ...INPUT_S, flex: 1, fontSize: 11.5 }}
                                                />
                                                <button onClick={() => phaseHinzufuegen(p.programm_id)} disabled={busy} style={{ ...BTN_ADD, padding: '3px 10px' }}>+</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={e => { e.stopPropagation(); setNeuePhaseForm(prev => ({ ...prev, [p.programm_id]: { open: true, text: '' } })); }}
                                                style={{ margin: '6px 12px 12px', padding: '5px', fontSize: 11.5, cursor: 'pointer', border: '1px dashed rgba(37,99,235,.3)', borderRadius: 5, background: '#F8FAFF', color: '#2563EB', fontFamily: 'inherit', textAlign: 'center' }}
                                            >+ Phase</button>
                                        )
                                    )}
                                </div>

                                {/* RIGHT: Phase content */}
                                <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', maxHeight: 520 }}>
                                    {!activePhaseObj ? (
                                        <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic', paddingTop: 8 }}>
                                            {phasen.length === 0 ? 'Noch keine Phasen vorhanden' : '← Phase auswählen'}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Phase-Kopfzeile */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                                <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{activePhaseObj.label}</div>
                                                {istLeitungsteam && (
                                                    <>
                                                        <button style={BTN_ADD} onClick={() => setRenamePhase({ phase_id: activePhaseObj.phase_id, label: activePhaseObj.label })}>
                                                            Umbenennen
                                                        </button>
                                                        <button
                                                            style={{ ...BTN_ADD, border: '1px solid rgba(220,38,38,.25)', background: '#FEF2F2', color: '#B91C1C' }}
                                                            onClick={() => phaseLoeschen(activePhaseObj.phase_id, p.programm_id)}
                                                        >
                                                            Löschen
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {/* Kriterien */}
                                            <Section title="Kriterien">
                                                {(activePhaseObj.kriterien || []).length === 0 && (
                                                    <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic', marginBottom: 8 }}>Keine Kriterien definiert</div>
                                                )}
                                                {(activePhaseObj.kriterien || []).map(k => (
                                                    <div key={k.kriterium_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                                                        <span style={{ flex: 1, fontSize: 12.5 }}>{k.text}</span>
                                                        <span style={{
                                                            fontSize: 10, padding: '1px 6px', borderRadius: 8, fontFamily: 'monospace', flexShrink: 0,
                                                            background: k.pflicht ? '#FEF2F2' : '#F5F4F0',
                                                            color: k.pflicht ? '#B91C1C' : '#A09D97',
                                                            border: `1px solid ${k.pflicht ? 'rgba(220,38,38,.15)' : 'rgba(0,0,0,.09)'}`,
                                                        }}>{k.pflicht ? 'Pflicht' : 'Optional'}</span>
                                                        {istLeitungsteam && (
                                                            <button style={BTN_DEL_SM} onClick={() => kriteriumLoeschen(k.kriterium_id)}>×</button>
                                                        )}
                                                    </div>
                                                ))}
                                                {istLeitungsteam && (
                                                    <div style={{ display: 'flex', gap: 7, marginTop: 10, alignItems: 'center' }}>
                                                        <input
                                                            value={neuerKForm[activePhaseObj.phase_id]?.text || ''}
                                                            onChange={e => setNeuerKForm(prev => ({ ...prev, [activePhaseObj.phase_id]: { ...prev[activePhaseObj.phase_id], text: e.target.value } }))}
                                                            onKeyDown={e => e.key === 'Enter' && kriteriumHinzufuegen(activePhaseObj.phase_id)}
                                                            placeholder="Kriterium eingeben…"
                                                            style={{ ...INPUT_S, flex: 1 }}
                                                        />
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6B6860', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={neuerKForm[activePhaseObj.phase_id]?.pflicht || false}
                                                                onChange={e => setNeuerKForm(prev => ({ ...prev, [activePhaseObj.phase_id]: { ...prev[activePhaseObj.phase_id], pflicht: e.target.checked } }))}
                                                            />
                                                            Pflicht
                                                        </label>
                                                        <button
                                                            onClick={() => kriteriumHinzufuegen(activePhaseObj.phase_id)}
                                                            disabled={busy || !(neuerKForm[activePhaseObj.phase_id]?.text || '').trim()}
                                                            style={{ padding: '5px 12px', fontSize: 12, cursor: 'pointer', border: 'none', borderRadius: 5, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}
                                                        >+</button>
                                                    </div>
                                                )}
                                            </Section>

                                            {/* Phasen-Dokumente */}
                                            <Section
                                                title="Phasen-Dokumente"
                                                headerRight={istLeitungsteam && (
                                                    <button style={BTN_ADD} onClick={() => {
                                                        setDokModal({ programm_id: p.programm_id, phase_id: activePhaseObj.phase_id });
                                                        setDokForm({ dateiname: '', typ: 'Sonstiges' });
                                                    }}>+ Dokument</button>
                                                )}
                                            >
                                                <DokListe
                                                    docs={phaseDoks[activePhaseObj.phase_id]}
                                                    onDelete={istLeitungsteam ? id => dokumentLoeschen(id, p.programm_id, activePhaseObj.phase_id) : null}
                                                />
                                            </Section>

                                            {/* Programm-Dokumente */}
                                            <Section
                                                title="Programm-Dokumente"
                                                headerRight={istLeitungsteam && (
                                                    <button style={BTN_ADD} onClick={() => {
                                                        setDokModal({ programm_id: p.programm_id, phase_id: null });
                                                        setDokForm({ dateiname: '', typ: 'Sonstiges' });
                                                    }}>+ Dokument</button>
                                                )}
                                            >
                                                <DokListe
                                                    docs={progDoks[p.programm_id]}
                                                    onDelete={istLeitungsteam ? id => dokumentLoeschen(id, p.programm_id, null) : null}
                                                />
                                            </Section>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Dokument hochladen Modal */}
            <Modal
                open={!!dokModal}
                onClose={() => setDokModal(null)}
                title={dokModal?.phase_id ? 'Phasen-Dokument hochladen' : 'Programm-Dokument hochladen'}
                width={400}
            >
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Datei wählen</label>
                    <input
                        type="file"
                        style={{ ...INPUT_S, width: '100%', boxSizing: 'border-box', padding: '6px 8px' }}
                        onChange={e => {
                            const f = e.target.files?.[0];
                            if (f && !dokForm.dateiname) setDokForm(prev => ({ ...prev, dateiname: f.name }));
                        }}
                    />
                </div>
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Dateiname *</label>
                    <input
                        style={{ ...INPUT_S, width: '100%', boxSizing: 'border-box' }}
                        value={dokForm.dateiname}
                        onChange={e => setDokForm(prev => ({ ...prev, dateiname: e.target.value }))}
                        placeholder="z.B. IV-Verfügung_Vorlage.pdf"
                    />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Typ</label>
                    <select
                        style={{ ...INPUT_S, width: '100%', boxSizing: 'border-box' }}
                        value={dokForm.typ}
                        onChange={e => setDokForm(prev => ({ ...prev, typ: e.target.value }))}
                    >
                        {DOK_TYPEN.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setDokModal(null)} style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>Abbrechen</button>
                    <button
                        onClick={dokumentHochladen}
                        disabled={busy || !dokForm.dateiname.trim()}
                        style={{ padding: '7px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', opacity: busy || !dokForm.dateiname.trim() ? .5 : 1 }}
                    >{busy ? 'Hochladen…' : 'Hochladen'}</button>
                </div>
            </Modal>

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
                        {['#2563EB', '#0891B2', '#0D9488', '#16A34A', '#7C3AED', '#D97706', '#DC2626'].map(c => (
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
