import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import NeueAufgabeModal from '../components/NeueAufgabeModal';
import NeuerTerminModal from '../components/NeuerTerminModal';
import DokumentModal from '../components/DokumentModal';
import StandortWechselModal from '../components/StandortWechselModal';

const STATUS_STYLE = {
    'Ausstehend': { bg: '#FFFBEB', color: '#B45309' },
    'Bestätigt':  { bg: '#ECFDF5', color: '#15803D' },
    'Geplant':    { bg: '#EEF3FE', color: '#1D4ED8' },
    'Abgesagt':   { bg: '#FEF2F2', color: '#B91C1C' },
};

const DOK_FARBEN = {
    'IV-Verfügung':          '#7C3AED',
    'Lebenslauf':            '#2563EB',
    'Arztbericht':           '#0891B2',
    'Anmeldeformular':       '#16A34A',
    'Leistungsvereinbarung': '#D97706',
    'Abschlussbericht':      '#B91C1C',
    'Erstgesprächsprotokoll':'#EA580C',
    'Sonstiges':             '#6B6860',
};

const CARD = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};

const SECTION_HDR = {
    fontSize: 10.5, fontWeight: 600, color: '#6B6860',
    textTransform: 'uppercase', letterSpacing: '.06em',
};

const BTN_PLUS = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, padding: '3px 8px', borderRadius: 5,
    border: '1px solid rgba(37,99,235,.25)', background: '#EEF3FE',
    color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 500, flexShrink: 0,
};

const DATE_INPUT_STYLE = {
    fontSize: 12.5, padding: '5px 8px', border: '1px solid rgba(0,0,0,.13)',
    borderRadius: 5, background: '#fff', fontFamily: 'inherit', outline: 'none',
};

function fmt(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-CH');
}

function KriteriumTypBadge({ typ, pflicht }) {
    if (!typ && !pflicht) return null;
    const label = typ || (pflicht ? 'Pflicht' : 'Optional');
    return (
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: pflicht ? '#FEF2F2' : '#F5F4F0', color: pflicht ? '#B91C1C' : '#6B6860', border: `1px solid ${pflicht ? 'rgba(220,38,38,.15)' : 'rgba(0,0,0,.09)'}`, fontFamily: 'monospace', flexShrink: 0 }}>
            {label}
        </span>
    );
}

export default function DossierPhase() {
    const { id, phase_id } = useParams();
    const navigate = useNavigate();

    const [dossier, setDossier] = useState(null);
    const [kriterien, setKriterien] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [termine, setTermine] = useState([]);
    const [dokumente, setDokumente] = useState([]);
    const [laden, setLaden] = useState(true);

    const [aufgabeModal, setAufgabeModal] = useState(false);
    const [terminModal, setTerminModal] = useState(false);
    const [dokumentModal, setDokumentModal] = useState(false);
    const [standortModal, setStandortModal] = useState(false);

    // Phasen-Zeitraum
    const [zeitraum, setZeitraum] = useState({ von: '', bis: '' });
    const [zeitraumSpeichern, setZeitraumSpeichern] = useState(false);
    const [zeitraumGespeichert, setZeitraumGespeichert] = useState(false);

    const ladeDaten = useCallback(async () => {
        try {
            const dosRes = await client.get(`/dossiers/${id}`);
            const dos = dosRes.data;
            setDossier(dos);

            const [krRes, taskRes, termRes, dokRes, zrRes] = await Promise.all([
                client.get(`/dossiers/${id}/phase/${phase_id}/kriterien`),
                dos.klient_id ? client.get(`/tasks/klient/${dos.klient_id}`) : Promise.resolve({ data: [] }),
                dos.klient_id ? client.get(`/termine?klient_id=${dos.klient_id}`) : Promise.resolve({ data: [] }),
                dos.klient_id ? client.get(`/dokumente?klient_id=${dos.klient_id}&phase_id=${phase_id}`) : Promise.resolve({ data: [] }),
                client.get(`/dossiers/${id}/phase/${phase_id}/zeitraum`),
            ]);

            const phaseTasks = (taskRes.data || []).filter(t => t.phase_id === phase_id);
            setKriterien(krRes.data);
            setTasks(phaseTasks);
            setTermine(termRes.data || []);
            setDokumente(dokRes.data || []);
            setZeitraum({
                von: zrRes.data?.start_datum ? zrRes.data.start_datum.slice(0, 10) : '',
                bis: zrRes.data?.end_datum ? zrRes.data.end_datum.slice(0, 10) : '',
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLaden(false);
        }
    }, [id, phase_id]);

    useEffect(() => { ladeDaten(); }, [ladeDaten]);

    async function speichernZeitraum() {
        setZeitraumSpeichern(true);
        try {
            await client.put(`/dossiers/${id}/phase/${phase_id}/zeitraum`, {
                start_datum: zeitraum.von || null,
                end_datum: zeitraum.bis || null,
            });
            setZeitraumGespeichert(true);
            setTimeout(() => setZeitraumGespeichert(false), 2500);
        } catch (err) {
            console.error(err);
        } finally {
            setZeitraumSpeichern(false);
        }
    }

    async function toggleKriterium(kriterium_id) {
        try {
            const r = await client.put(`/dossiers/${id}/phase/${phase_id}/kriterien/${kriterium_id}`);
            setKriterien(prev => prev.map(k =>
                k.kriterium_id === kriterium_id
                    ? { ...k, erfuellt: r.data.erfuellt, erfuellt_am: r.data.erfuellt_am }
                    : k
            ));
        } catch (err) { console.error(err); }
    }

    async function toggleTask(task_id) {
        try {
            const r = await client.put(`/tasks/${task_id}/erledigt`);
            setTasks(prev => prev.map(t => t.task_id === task_id ? { ...t, ...r.data } : t));
        } catch (err) { console.error(err); }
    }

    async function deleteDokument(dokument_id) {
        if (!window.confirm('Dokument wirklich löschen?')) return;
        try {
            await client.delete(`/dokumente/${dokument_id}`);
            setDokumente(prev => prev.filter(d => d.dokument_id !== dokument_id));
        } catch (err) { console.error(err); }
    }

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!dossier) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Dossier nicht gefunden</div>;

    const phasen = dossier.phasen || [];
    const aktPhase = phasen.find(p => p.phase_id === phase_id);
    const zugewiesen = dossier.zugewiesen || [];
    const externePersonen = dossier.externe_personen || [];

    const erledigtCount = kriterien.filter(k => k.erfuellt).length;
    const offeneTasks = tasks.filter(t => !t.erledigt).length;

    return (
        <div>
            {/* Back + Standort-Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '.875rem' }}>
                <button onClick={() => navigate(`/dossiers/${id}`)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                    color: '#6B6860', cursor: 'pointer', background: 'none', border: 'none',
                    fontFamily: 'inherit', padding: 0
                }}>← Zurück zum Dossier</button>
                <button onClick={() => setStandortModal(true)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, padding: '3px 9px', borderRadius: 5,
                    border: '1px solid rgba(0,0,0,.12)', background: '#F5F4F0',
                    color: '#6B6860', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}>📍 Standort wechseln</button>
            </div>

            {/* ── HEADER ─────────────────────────────────── */}
            <div style={{ ...CARD, padding: '1.125rem 1.25rem', marginBottom: '.875rem' }}>
                <div style={{ fontSize: 11.5, color: '#A09D97', marginBottom: 6, display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: '#6B6860' }}>{dossier.vorname} {dossier.nachname}</span>
                    <span>·</span>
                    <span>{dossier.programm_name || '—'}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 600, color: '#1A1917' }}>{aktPhase?.label || '—'}</span>
                </div>

                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.4px', marginBottom: '.75rem' }}>
                    {aktPhase?.label || 'Phase'}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 10.5, color: '#A09D97' }}>Phase von</label>
                        <input type="date" value={zeitraum.von} onChange={e => setZeitraum(z => ({ ...z, von: e.target.value }))} style={DATE_INPUT_STYLE} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 10.5, color: '#A09D97' }}>Phase bis</label>
                        <input type="date" value={zeitraum.bis} onChange={e => setZeitraum(z => ({ ...z, bis: e.target.value }))} style={DATE_INPUT_STYLE} />
                    </div>
                    <button onClick={speichernZeitraum} disabled={zeitraumSpeichern} style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                        cursor: zeitraumSpeichern ? 'default' : 'pointer', border: 'none', borderRadius: 5,
                        background: zeitraumSpeichern ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>{zeitraumSpeichern ? 'Speichern…' : 'Speichern'}</button>
                    {zeitraumGespeichert && <span style={{ fontSize: 12.5, color: '#16A34A' }}>Gespeichert ✓</span>}
                </div>

                {phasen.length > 0 && (
                    <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 4 }}>
                        {phasen.map((ph, i, arr) => {
                            const aktIdx = arr.findIndex(p => p.phase_id === dossier.akt_phase_id);
                            const done = i < aktIdx;
                            const active = ph.phase_id === phase_id;
                            const isAkt = ph.phase_id === dossier.akt_phase_id;
                            return (
                                <div
                                    key={ph.phase_id}
                                    onClick={() => navigate(`/dossiers/${id}/phase/${ph.phase_id}`)}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 68, position: 'relative', cursor: 'pointer' }}
                                >
                                    {i < arr.length - 1 && (
                                        <div style={{ position: 'absolute', top: 12, left: '50%', width: '100%', height: 2, background: done ? '#16A34A' : '#E3E1DA', zIndex: 0 }} />
                                    )}
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%', zIndex: 1,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, fontWeight: 600, fontFamily: 'monospace',
                                        background: active ? '#7C3AED' : done ? '#16A34A' : isAkt ? '#2563EB' : '#fff',
                                        border: `2px solid ${active ? '#7C3AED' : done ? '#16A34A' : isAkt ? '#2563EB' : '#E3E1DA'}`,
                                        color: (active || done || isAkt) ? '#fff' : '#A09D97',
                                        boxShadow: active ? '0 0 0 4px rgba(124,58,237,.2)' : isAkt ? '0 0 0 3px rgba(37,99,235,.12)' : 'none',
                                        transition: 'all .15s',
                                    }}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <div style={{
                                        fontSize: 9, fontWeight: active ? 700 : 500, marginTop: 5,
                                        textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
                                        color: active ? '#7C3AED' : done ? '#15803D' : isAkt ? '#2563EB' : '#A09D97',
                                    }}>{ph.label}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── ZWEISPALTEN-LAYOUT ──────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem' }}>

                {/* LINKE SPALTE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem', minWidth: 0 }}>

                    {/* Kriterien / Checkliste */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={SECTION_HDR}>☑ Kriterien</span>
                            {kriterien.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: erledigtCount === kriterien.length ? '#ECFDF5' : '#F5F4F0', color: erledigtCount === kriterien.length ? '#15803D' : '#6B6860', border: `1px solid ${erledigtCount === kriterien.length ? 'rgba(22,163,74,.15)' : 'rgba(0,0,0,.09)'}`, fontFamily: 'monospace', marginLeft: 4 }}>
                                    {erledigtCount}/{kriterien.length}
                                </span>
                            )}
                        </div>
                        <div style={{ padding: '1rem' }}>
                            {kriterien.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine Kriterien für diese Phase definiert</div>
                            ) : kriterien.map(k => (
                                <div key={k.kriterium_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                                    <div
                                        onClick={() => toggleKriterium(k.kriterium_id)}
                                        style={{
                                            width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer', marginTop: 1,
                                            border: k.erfuellt ? 'none' : '1.5px solid rgba(0,0,0,.15)',
                                            background: k.erfuellt ? '#16A34A' : '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10
                                        }}
                                    >{k.erfuellt ? '✓' : ''}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                            <span
                                                onClick={() => toggleKriterium(k.kriterium_id)}
                                                style={{ fontSize: 12.5, cursor: 'pointer', textDecoration: k.erfuellt ? 'line-through' : 'none', color: k.erfuellt ? '#A09D97' : '#1A1917' }}
                                            >{k.text}</span>
                                            <KriteriumTypBadge typ={k.typ} pflicht={k.pflicht} />
                                        </div>
                                        {k.erfuellt && k.erfuellt_am && (
                                            <div style={{ fontSize: 10.5, color: '#15803D', marginTop: 2 }}>Erledigt am {fmt(k.erfuellt_am)}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tasks dieser Phase */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ ...SECTION_HDR, flex: 1 }}>Aufgaben dieser Phase</span>
                            {offeneTasks > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#FFFBEB', color: '#B45309', border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace' }}>{offeneTasks} offen</span>
                            )}
                            <button style={BTN_PLUS} onClick={() => setAufgabeModal(true)}>+ Aufgabe</button>
                        </div>
                        <div style={{ padding: '1rem' }}>
                            {tasks.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine Aufgaben für diese Phase</div>
                            ) : tasks.map(t => (
                                <div key={t.task_id} onClick={() => toggleTask(t.task_id)} style={{
                                    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px',
                                    borderRadius: 6, border: '1px solid rgba(0,0,0,.09)',
                                    background: '#F5F4F0', fontSize: 12, marginBottom: 5,
                                    cursor: 'pointer', opacity: t.erledigt ? .55 : 1,
                                }}>
                                    <div style={{
                                        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                                        border: t.erledigt ? 'none' : '1.5px solid rgba(0,0,0,.09)',
                                        background: t.erledigt ? '#16A34A' : '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9
                                    }}>{t.erledigt ? '✓' : ''}</div>
                                    <div style={{ flex: 1, textDecoration: t.erledigt ? 'line-through' : 'none', color: t.erledigt ? '#6B6860' : '#1A1917' }}>{t.text}</div>
                                    {t.faellig_am && (
                                        <span style={{ fontSize: 10.5, color: '#6B6860', fontFamily: 'monospace', flexShrink: 0 }}>{fmt(t.faellig_am)}</span>
                                    )}
                                    <span style={{
                                        fontSize: 11, padding: '2px 7px', borderRadius: 20, fontFamily: 'monospace', flexShrink: 0,
                                        background: t.prioritaet === 'Hoch' ? '#FEF2F2' : t.prioritaet === 'Mittel' ? '#FFFBEB' : '#F5F4F0',
                                        color: t.prioritaet === 'Hoch' ? '#B91C1C' : t.prioritaet === 'Mittel' ? '#B45309' : '#6B6860',
                                        border: `1px solid ${t.prioritaet === 'Hoch' ? 'rgba(220,38,38,.15)' : t.prioritaet === 'Mittel' ? 'rgba(217,119,6,.15)' : 'rgba(0,0,0,.09)'}`
                                    }}>{t.prioritaet}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dokumente */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ ...SECTION_HDR, flex: 1 }}>📄 Dokumente</span>
                            {dokumente.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', color: '#6B6860', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>{dokumente.length}</span>
                            )}
                            <button style={BTN_PLUS} onClick={() => setDokumentModal(true)}>+ Dokument</button>
                        </div>
                        <div style={{ padding: '1rem' }}>
                            {dokumente.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine Dokumente für diese Phase</div>
                            ) : dokumente.map(d => {
                                const farbe = DOK_FARBEN[d.typ] || '#6B6860';
                                return (
                                    <div key={d.dokument_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 6, border: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0', marginBottom: 5 }}>
                                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: farbe + '22', color: farbe, border: `1px solid ${farbe}33`, fontFamily: 'monospace', flexShrink: 0 }}>{d.typ || '—'}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dateiname}</div>
                                            <div style={{ fontSize: 10.5, color: '#6B6860' }}>{d.erstellt_von_name || '—'} · {fmt(d.erstellt_am)}</div>
                                        </div>
                                        <button
                                            onClick={() => deleteDokument(d.dokument_id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A09D97', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}
                                            title="Löschen"
                                        >✕</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RECHTE SPALTE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>

                    {/* Termine */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ ...SECTION_HDR, flex: 1 }}>📅 Termine</span>
                            {termine.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', color: '#6B6860', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>{termine.length}</span>
                            )}
                            <button style={BTN_PLUS} onClick={() => setTerminModal(true)}>+ Termin</button>
                        </div>
                        <div style={{ padding: '1rem' }}>
                            {termine.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine Termine</div>
                            ) : termine.map((t, i) => {
                                const ss = STATUS_STYLE[t.status] || STATUS_STYLE['Ausstehend'];
                                return (
                                    <div key={t.termin_id} style={{ padding: '8px 0', borderBottom: i < termine.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.typ}</div>
                                                <div style={{ fontSize: 11, color: '#6B6860', marginTop: 2 }}>
                                                    {fmt(t.datum)}{t.zeit ? ` · ${t.zeit.slice(0, 5)}` : ''}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 20, background: ss.bg, color: ss.color, fontFamily: 'monospace', flexShrink: 0 }}>{t.status}</span>
                                        </div>
                                        {t.notiz && <div style={{ fontSize: 11, color: '#6B6860', marginTop: 4, fontStyle: 'italic' }}>{t.notiz}</div>}
                                        {(t.personen || []).length > 0 && (
                                            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                                                {t.personen.map((p, pi) => (
                                                    <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B6860' }}>
                                                        <div style={{ width: 18, height: 18, borderRadius: 5, background: '#EEF3FE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600 }}>
                                                            {p.avatar_initials || p.full_name?.[0]}
                                                        </div>
                                                        {p.full_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Zugewiesene Kader */}
                    <div style={{ ...CARD, padding: '1rem' }}>
                        <div style={{ ...SECTION_HDR, marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>Zugewiesene Kader</div>
                        {zugewiesen.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Niemand zugewiesen</div>
                        ) : zugewiesen.map((u, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 7px', background: u.stellvertretung ? '#FFFBEB' : '#F5F4F0', borderRadius: 6, marginBottom: 5 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, background: '#EEF3FE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                                    {u.avatar_initials || u.full_name?.[0]}
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>{u.full_name}</div>
                                    <div style={{ fontSize: 10.5, color: '#6B6860' }}>{u.stellvertretung ? '⚡ Stellvertretung' : u.rolle_im_fall}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Externe Personen */}
                    {externePersonen.length > 0 && (
                        <div style={{ ...CARD, padding: '1rem' }}>
                            <div style={{ ...SECTION_HDR, marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>Externe Personen</div>
                            {externePersonen.map((p, i) => {
                                return (
                                    <div
                                        key={i}
                                        onClick={() => navigate(`/externe/${p.person_id}`)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 7px', background: '#F5F4F0', borderRadius: 6, marginBottom: 5, cursor: 'pointer' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#EEF3FE'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#F5F4F0'; }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.vorname} {p.nachname}</div>
                                            <div style={{ fontSize: 11, color: '#6B6860' }}>{p.rolle}{p.firma ? ` · ${p.firma}` : ''}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS */}
            <NeueAufgabeModal
                open={aufgabeModal}
                onClose={() => setAufgabeModal(false)}
                onSaved={ladeDaten}
                klientId={dossier.klient_id}
                phaseId={phase_id}
            />
            <NeuerTerminModal
                open={terminModal}
                onClose={() => setTerminModal(false)}
                onSaved={ladeDaten}
                klientId={dossier.klient_id}
            />
            <DokumentModal
                open={dokumentModal}
                onClose={() => setDokumentModal(false)}
                onSaved={ladeDaten}
                klientId={dossier.klient_id}
                phaseId={phase_id}
            />
            <StandortWechselModal
                open={standortModal}
                onClose={() => setStandortModal(false)}
                onSaved={ladeDaten}
                dossierId={id}
                dossier={dossier}
            />
        </div>
    );
}
