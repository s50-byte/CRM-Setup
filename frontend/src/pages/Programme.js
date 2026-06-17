import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import Modal from '../components/Modal';

const UEBERSICHT = '__uebersicht__';

const ROLLEN = ['Klientenführung', 'Job Coach', 'Fachperson'];

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

const GRUPPEN_FARBEN = {
    'BM': { bg: '#F0FDF4', border: '#86EFAC', header: '#15803D' },
    'IM': { bg: '#FFF7ED', border: '#FCD34D', header: '#C2410C' },
    'BC': { bg: '#F5F3FF', border: '#C4B5FD', header: '#5B21B6' },
    'GM': { bg: '#FFFBEB', border: '#FDE68A', header: '#B45309' },
    'Weitere': { bg: '#F5F4F0', border: '#D1D5DB', header: '#6B6860' },
};

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

function formatCHF(val) {
    if (!val && val !== 0) return '—';
    return Number(val).toLocaleString('de-CH');
}

export default function Programme() {
    const { benutzer } = useAuth();
    const istLeitungsteam = ['kader', 'leitungsteam'].includes(benutzer?.system_rolle);
    const [editModus, setEditModus] = useState(false);
    const editierbar = istLeitungsteam && editModus;

    const [gruppen, setGruppen] = useState([]);
    const [laden, setLaden] = useState(true);
    const [expandedGruppe, setExpandedGruppe] = useState({});
    const [expandedProg, setExpandedProg] = useState({});
    const [activePhase, setActivePhase] = useState({});
    const [progDoks, setProgDoks] = useState({});
    const [phaseDoks, setPhaseDoks] = useState({});
    const [renamePhase, setRenamePhase] = useState(null);
    const [neuerKForm, setNeuerKForm] = useState({});
    const [neuePhaseForm, setNeuePhaseForm] = useState({});
    const [dokModal, setDokModal] = useState(null);
    const [dokForm, setDokForm] = useState({ dateiname: '', typ: 'Sonstiges' });
    const [fehler, setFehler] = useState('');
    const [busy, setBusy] = useState(false);

    const allesProgramme = gruppen.flatMap(g => g.programme || []);

    const ladeProgramme = useCallback(async () => {
        try {
            const r = await client.get('/programme?grouped=true');
            const gs = r.data.gruppen || [];
            setGruppen(gs);
            // Alle Gruppen standardmässig aufklappen
            const initExpanded = {};
            gs.forEach(g => { initExpanded[g.gruppe] = true; });
            setExpandedGruppe(prev => ({ ...initExpanded, ...prev }));
        } catch (err) { console.error(err); }
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

    function toggleGruppe(gruppeKey) {
        setExpandedGruppe(prev => ({ ...prev, [gruppeKey]: !prev[gruppeKey] }));
    }

    function toggleProgramm(prog) {
        const isNowOpen = !expandedProg[prog.programm_id];
        setExpandedProg(prev => ({ ...prev, [prog.programm_id]: isNowOpen }));
        if (isNowOpen) {
            loadProgDoks(prog.programm_id);
            if (!activePhase[prog.programm_id]) {
                setActivePhase(prev => ({ ...prev, [prog.programm_id]: UEBERSICHT }));
            }
        }
    }

    function selectPhase(programm_id, phase_id) {
        setActivePhase(prev => ({ ...prev, [programm_id]: phase_id }));
        setFehler('');
        setRenamePhase(null);
        if (phase_id !== UEBERSICHT && phaseDoks[phase_id] === undefined) {
            loadPhaseDoks(phase_id);
        }
    }

    async function phaseUmbenennen() {
        if (!renamePhase?.label.trim()) { setRenamePhase(null); return; }
        const prog = allesProgramme.find(p => p.phasen?.some(ph => ph.phase_id === renamePhase.phase_id));
        if (!prog) return;
        try {
            await client.put(`/programme/${prog.programm_id}/phasen/${renamePhase.phase_id}`, { label: renamePhase.label.trim() });
            setRenamePhase(null);
            await ladeProgramme();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Umbenennen');
        }
    }

    async function phaseHinzufuegen(programm_id) {
        const text = (neuePhaseForm[programm_id]?.text || '').trim();
        if (!text) return;
        setBusy(true);
        setFehler('');
        try {
            const r = await client.post(`/programme/${programm_id}/phasen`, { label: text });
            setNeuePhaseForm(prev => ({ ...prev, [programm_id]: { open: false, text: '' } }));
            await ladeProgramme();
            if (r.data?.phase_id) {
                setActivePhase(prev => ({ ...prev, [programm_id]: r.data.phase_id }));
                loadPhaseDoks(r.data.phase_id);
            }
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Hinzufügen der Phase');
        } finally { setBusy(false); }
    }

    async function phaseLoeschen(phase_id, programm_id) {
        if (!window.confirm('Phase und alle ihre Kriterien löschen?')) return;
        setFehler('');
        try {
            await client.delete(`/programme/phasen/${phase_id}`);
            setActivePhase(prev => prev[programm_id] === phase_id ? { ...prev, [programm_id]: UEBERSICHT } : prev);
            await ladeProgramme();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Löschen der Phase');
        }
    }

    async function kriteriumHinzufuegen(phase_id) {
        const form = neuerKForm[phase_id] || {};
        const text = (form.text || '').trim();
        if (!text) return;
        setBusy(true);
        setFehler('');
        try {
            await client.post(`/programme/phasen/${phase_id}/kriterien`, { text, pflicht: form.pflicht || false });
            setNeuerKForm(prev => ({ ...prev, [phase_id]: { text: '', pflicht: false } }));
            await ladeProgramme();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Hinzufügen des Kriteriums');
        } finally { setBusy(false); }
    }

    async function kriteriumLoeschen(kriterium_id) {
        setFehler('');
        try {
            await client.delete(`/programme/kriterien/${kriterium_id}`);
            await ladeProgramme();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Löschen');
        }
    }

    async function dokumentHochladen() {
        if (!dokForm.dateiname.trim() || !dokModal) return;
        setBusy(true);
        setFehler('');
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
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Hochladen');
        } finally { setBusy(false); }
    }

    async function dokumentLoeschen(pdok_id, programm_id, phase_id) {
        if (!window.confirm('Dokument löschen?')) return;
        setFehler('');
        try {
            await client.delete(`/dokumente/programm/${pdok_id}`);
            if (phase_id) setPhaseDoks(prev => ({ ...prev, [phase_id]: (prev[phase_id] || []).filter(d => d.pdok_id !== pdok_id) }));
            else setProgDoks(prev => ({ ...prev, [programm_id]: (prev[programm_id] || []).filter(d => d.pdok_id !== pdok_id) }));
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Löschen');
        }
    }

    async function toggleProgRolle(programm_id, currentRollen, rolle, checked) {
        const newRollen = checked ? [...currentRollen, rolle] : currentRollen.filter(r => r !== rolle);
        setGruppen(prev => prev.map(g => ({
            ...g,
            programme: g.programme.map(p => p.programm_id === programm_id ? { ...p, rollen: newRollen } : p)
        })));
        try {
            await client.put(`/programme/${programm_id}/rollen`, { rollen: newRollen });
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern der Rollen');
            await ladeProgramme();
        }
    }

    async function togglePhaseRolle(programm_id, phase_id, currentRollen, rolle, checked) {
        const newRollen = checked ? [...currentRollen, rolle] : currentRollen.filter(r => r !== rolle);
        setGruppen(prev => prev.map(g => ({
            ...g,
            programme: g.programme.map(p => p.programm_id === programm_id ? {
                ...p,
                phasen: (p.phasen || []).map(ph => ph.phase_id === phase_id ? { ...ph, rollen: newRollen } : ph)
            } : p)
        })));
        try {
            await client.put(`/programme/${programm_id}/phasen/${phase_id}/rollen`, { rollen: newRollen });
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern der Rollen');
            await ladeProgramme();
        }
    }

    if (laden) return <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>;

    return (
        <div>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Programmübersicht</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Leistungsarten, Phasen, Kriterien und Dokumente</div>
                </div>
                {istLeitungsteam && (
                    <div onClick={() => setEditModus(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: editModus ? '#2563EB' : '#6B6860' }}>Bearbeiten</span>
                        <div style={{ width: 36, height: 20, borderRadius: 10, background: editModus ? '#2563EB' : '#D1D5DB', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: 3, left: editModus ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
                        </div>
                    </div>
                )}
            </div>

            {gruppen.length === 0 && (
                <div style={{ ...CARD, padding: '2rem', textAlign: 'center', color: '#A09D97', fontSize: 13 }}>
                    Noch keine Programme definiert
                </div>
            )}

            {/* EBENE 1: Gruppen */}
            {gruppen.map(gruppe => {
                const gf = GRUPPEN_FARBEN[gruppe.gruppe] || GRUPPEN_FARBEN['Weitere'];
                const isGruppeOpen = !!expandedGruppe[gruppe.gruppe];

                return (
                    <div key={gruppe.gruppe} style={{ marginBottom: '1rem' }}>
                        {/* Gruppe-Header */}
                        <div
                            onClick={() => toggleGruppe(gruppe.gruppe)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px', cursor: 'pointer', userSelect: 'none',
                                background: gf.bg, border: `1px solid ${gf.border}`,
                                borderRadius: isGruppeOpen ? '8px 8px 0 0' : 8,
                                borderBottom: isGruppeOpen ? `1px solid ${gf.border}` : undefined,
                            }}
                        >
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fff', color: gf.header, border: `1px solid ${gf.border}`, fontFamily: 'monospace' }}>
                                {gruppe.gruppe}
                            </span>
                            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: gf.header }}>{gruppe.label}</span>
                            <span style={{ fontSize: 11, color: gf.header, opacity: .7 }}>{gruppe.programme.length} Leistungsarten</span>
                            <span style={{ fontSize: 13, color: gf.header, transform: isGruppeOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                        </div>

                        {/* EBENE 2: Programme innerhalb Gruppe */}
                        {isGruppeOpen && (
                            <div style={{ border: `1px solid ${gf.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                                {gruppe.programme.map((p, pi) => {
                                    const isProgOpen = !!expandedProg[p.programm_id];
                                    const phasen = p.phasen || [];
                                    const activePhasId = activePhase[p.programm_id] || UEBERSICHT;
                                    const activePhaseObj = activePhasId === UEBERSICHT ? null : phasen.find(ph => ph.phase_id === activePhasId);
                                    const isLast = pi === gruppe.programme.length - 1;

                                    return (
                                        <div key={p.programm_id} style={{ borderBottom: isLast && !isProgOpen ? 'none' : '1px solid rgba(0,0,0,.06)', background: '#fff' }}>
                                            {/* Programm-Header (Ebene 2) */}
                                            <div
                                                onClick={() => toggleProgramm(p)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                                            >
                                                <div style={{ width: 10, height: 10, borderRadius: 3, background: p.farbe_hex, flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                                                    {p.tarifziffer && (
                                                        <div style={{ fontSize: 11, color: '#6B6860', marginTop: 1, fontFamily: 'monospace' }}>{p.tarifziffer}</div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {p.entschaedigungsart && (
                                                        <span style={{ ...BADGE, fontSize: 10, color: '#6B6860' }}>{p.entschaedigungsart}</span>
                                                    )}
                                                    {p.tarif && (
                                                        <span style={{ ...BADGE, fontSize: 10, color: '#1A1917' }}>CHF {formatCHF(p.tarif)}</span>
                                                    )}
                                                    <span style={{ fontSize: 11, color: '#A09D97' }}>{phasen.length} Phase{phasen.length !== 1 ? 'n' : ''}</span>
                                                </div>
                                                <span style={{ fontSize: 13, color: '#A09D97', transform: isProgOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                                            </div>

                                            {/* EBENE 3: Phasen-Inhalt */}
                                            {isProgOpen && (
                                                <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', minHeight: 280 }}>

                                                    {/* Phasen-Navigation links */}
                                                    <div style={{ width: 220, borderRight: '1px solid rgba(0,0,0,.06)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div
                                                                onClick={() => selectPhase(p.programm_id, UEBERSICHT)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                                    padding: '8px 14px', cursor: 'pointer',
                                                                    borderLeft: `3px solid ${activePhasId === UEBERSICHT ? p.farbe_hex : 'transparent'}`,
                                                                    background: activePhasId === UEBERSICHT ? p.farbe_hex + '12' : 'transparent',
                                                                    borderBottom: '1px solid rgba(0,0,0,.05)',
                                                                }}
                                                            >
                                                                <span style={{ fontSize: 13 }}>◎</span>
                                                                <span style={{ fontSize: 12.5, fontWeight: activePhasId === UEBERSICHT ? 600 : 400, color: activePhasId === UEBERSICHT ? '#1A1917' : '#6B6860' }}>Übersicht</span>
                                                            </div>

                                                            {phasen.length === 0 && (
                                                                <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic', padding: '8px 14px' }}>Noch keine Phasen</div>
                                                            )}
                                                            {phasen.map((ph, i) => {
                                                                const isActive = activePhasId === ph.phase_id;
                                                                const isRenaming = renamePhase?.phase_id === ph.phase_id;
                                                                return (
                                                                    <div
                                                                        key={ph.phase_id}
                                                                        onClick={() => selectPhase(p.programm_id, ph.phase_id)}
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
                                                                        {isRenaming && editierbar ? (
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
                                                                                title={editierbar ? 'Doppelklick zum Umbenennen' : undefined}
                                                                                onDoubleClick={editierbar ? e => {
                                                                                    e.stopPropagation();
                                                                                    setRenamePhase({ phase_id: ph.phase_id, label: ph.label });
                                                                                } : undefined}
                                                                            >{ph.label}</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {editierbar && (
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

                                                    {/* Inhalt rechts */}
                                                    <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', maxHeight: 520 }}>
                                                        {fehler && (
                                                            <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 14 }}>
                                                                {fehler}
                                                            </div>
                                                        )}

                                                        {/* Übersicht */}
                                                        {activePhasId === UEBERSICHT && (
                                                            <>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                                                    <div style={{ width: 12, height: 12, borderRadius: 4, background: p.farbe_hex, flexShrink: 0 }} />
                                                                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                                                                </div>

                                                                {/* Leistungs-Infos */}
                                                                {(p.tarifziffer || p.tarif || p.entschaedigungsart) && (
                                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                                                                        {p.tarifziffer && <span style={{ ...BADGE, fontSize: 11.5 }}>{p.tarifziffer}</span>}
                                                                        {p.entschaedigungsart && <span style={{ ...BADGE, fontSize: 11.5 }}>{p.entschaedigungsart}</span>}
                                                                        {p.tarif && <span style={{ ...BADGE, fontSize: 11.5 }}>CHF {formatCHF(p.tarif)}</span>}
                                                                    </div>
                                                                )}

                                                                {phasen.length > 0 && (
                                                                    <Section title="Phasen">
                                                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                            {phasen.map((ph, i) => (
                                                                                <button
                                                                                    key={ph.phase_id}
                                                                                    onClick={() => selectPhase(p.programm_id, ph.phase_id)}
                                                                                    style={{
                                                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                                        padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                                                                                        fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
                                                                                        background: p.farbe_hex + '15', color: p.farbe_hex,
                                                                                        border: `1px solid ${p.farbe_hex}30`,
                                                                                    }}
                                                                                >
                                                                                    <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: .8 }}>{i + 1}</span>
                                                                                    {ph.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </Section>
                                                                )}

                                                                <Section title="Zuständige Rollen">
                                                                    {editierbar ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                                            {ROLLEN.map(rolle => (
                                                                                <label key={rolle} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={(p.rollen || []).includes(rolle)}
                                                                                        onChange={e => toggleProgRolle(p.programm_id, p.rollen || [], rolle, e.target.checked)}
                                                                                        style={{ cursor: 'pointer', accentColor: p.farbe_hex }}
                                                                                    />
                                                                                    <span style={{ fontSize: 13 }}>{rolle}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    ) : (() => {
                                                                        const alleRollen = [...new Set((p.phasen || []).flatMap(ph => ph.rollen || []))];
                                                                        return alleRollen.length === 0 ? (
                                                                            <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic' }}>Keine Rollen definiert</div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                                {alleRollen.map(rolle => (
                                                                                    <span key={rolle} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: p.farbe_hex + '15', color: p.farbe_hex, border: `1px solid ${p.farbe_hex}30`, fontWeight: 500 }}>{rolle}</span>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </Section>

                                                                <Section
                                                                    title="Programm-Dokumente"
                                                                    headerRight={editierbar && (
                                                                        <button style={BTN_ADD} onClick={() => {
                                                                            setDokModal({ programm_id: p.programm_id, phase_id: null });
                                                                            setDokForm({ dateiname: '', typ: 'Sonstiges' });
                                                                        }}>+ Dokument</button>
                                                                    )}
                                                                >
                                                                    <DokListe
                                                                        docs={progDoks[p.programm_id]}
                                                                        onDelete={editierbar ? id => dokumentLoeschen(id, p.programm_id, null) : null}
                                                                    />
                                                                </Section>
                                                            </>
                                                        )}

                                                        {/* Phase-Inhalt */}
                                                        {activePhasId !== UEBERSICHT && (
                                                            activePhaseObj ? (
                                                                <>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                                                        <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{activePhaseObj.label}</div>
                                                                        {editierbar && (
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

                                                                    <Section title="Kriterien">
                                                                        {(activePhaseObj.kriterien || []).length === 0 && (
                                                                            <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic', marginBottom: 8 }}>
                                                                                Keine Kriterien definiert
                                                                            </div>
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
                                                                                {editierbar && (
                                                                                    <button style={BTN_DEL_SM} onClick={() => kriteriumLoeschen(k.kriterium_id)}>×</button>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        {editierbar && (
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

                                                                    <Section title="Involvierte Rollen">
                                                                        {editierbar ? (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                                                {ROLLEN.map(rolle => (
                                                                                    <label key={rolle} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={(activePhaseObj.rollen || []).includes(rolle)}
                                                                                            onChange={e => togglePhaseRolle(p.programm_id, activePhaseObj.phase_id, activePhaseObj.rollen || [], rolle, e.target.checked)}
                                                                                            style={{ cursor: 'pointer', accentColor: p.farbe_hex }}
                                                                                        />
                                                                                        <span style={{ fontSize: 13 }}>{rolle}</span>
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        ) : (activePhaseObj.rollen || []).length === 0 ? (
                                                                            <div style={{ fontSize: 11.5, color: '#A09D97', fontStyle: 'italic' }}>Keine Rollen definiert</div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                                {(activePhaseObj.rollen || []).map(rolle => (
                                                                                    <span key={rolle} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: p.farbe_hex + '15', color: p.farbe_hex, border: `1px solid ${p.farbe_hex}30`, fontWeight: 500 }}>{rolle}</span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </Section>

                                                                    <Section
                                                                        title="Phasen-Dokumente"
                                                                        headerRight={editierbar && (
                                                                            <button style={BTN_ADD} onClick={() => {
                                                                                setDokModal({ programm_id: p.programm_id, phase_id: activePhaseObj.phase_id });
                                                                                setDokForm({ dateiname: '', typ: 'Sonstiges' });
                                                                            }}>+ Dokument</button>
                                                                        )}
                                                                    >
                                                                        <DokListe
                                                                            docs={phaseDoks[activePhaseObj.phase_id]}
                                                                            onDelete={editierbar ? id => dokumentLoeschen(id, p.programm_id, activePhaseObj.phase_id) : null}
                                                                        />
                                                                    </Section>
                                                                </>
                                                            ) : (
                                                                <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic', paddingTop: 8 }}>← Phase auswählen</div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
        </div>
    );
}
