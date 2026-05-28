import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

const STATUS_STYLE = {
    'Ausstehend': { bg: '#FFFBEB', color: '#B45309' },
    'Bestätigt':  { bg: '#ECFDF5', color: '#15803D' },
    'Geplant':    { bg: '#EEF3FE', color: '#1D4ED8' },
    'Abgesagt':   { bg: '#FEF2F2', color: '#B91C1C' },
};

const JKAT = {
    'Standortgespräch':               { bg: '#E0F2FE', color: '#0369A1' },
    'Job Coaching':                    { bg: '#F0FDF4', color: '#166534' },
    'Beobachtung':                     { bg: '#F5F3FF', color: '#5B21B6' },
    'Zielfortschritt':                 { bg: '#FFF7ED', color: '#9A3412' },
    'Absenz':                          { bg: '#FEF2F2', color: '#991B1B' },
    'Kommunikation zuweisende Stelle': { bg: '#E0F2FE', color: '#075985' },
    'Externe Person':                  { bg: '#FDF4FF', color: '#7E22CE' },
    'Sonstiges':                       { bg: '#F5F4F0', color: '#6B6860' },
};

const TYP_FARBEN = {
    'IV-Stelle':        '#2563EB',
    'RAV':              '#7C3AED',
    'Sozialdienst':     '#D97706',
    'Arbeitgeber':      '#16A34A',
    'Arzt / Therapeut': '#0891B2',
    'Schule':           '#EA580C',
    'Sonstiges':        '#6B6860',
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
    const [journal, setJournal] = useState([]);
    const [termine, setTermine] = useState([]);
    const [laden, setLaden] = useState(true);

    const ladeDaten = useCallback(async () => {
        try {
            const dosRes = await client.get(`/dossiers/${id}`);
            const dos = dosRes.data;
            setDossier(dos);

            const [krRes, taskRes, journalRes, termRes] = await Promise.all([
                client.get(`/dossiers/${id}/phase/${phase_id}/kriterien`),
                dos.klient_id ? client.get(`/tasks/klient/${dos.klient_id}`) : Promise.resolve({ data: [] }),
                dos.klient_id ? client.get(`/journal/${dos.klient_id}`) : Promise.resolve({ data: [] }),
                dos.klient_id ? client.get(`/termine?klient_id=${dos.klient_id}`) : Promise.resolve({ data: [] }),
            ]);

            const aktPhase = (dos.phasen || []).find(p => p.phase_id === phase_id);
            const phaseStart = aktPhase?.start_datum ? new Date(aktPhase.start_datum) : null;
            const phaseEnde  = aktPhase?.end_datum   ? new Date(aktPhase.end_datum)   : null;

            console.log('[DossierPhase] phase_id (param):', phase_id, typeof phase_id);
            console.log('[DossierPhase] aktPhase:', aktPhase);
            console.log('[DossierPhase] phaseStart:', phaseStart, '| phaseEnde:', phaseEnde);
            console.log('[DossierPhase] tasks sample:', (taskRes.data || []).slice(0, 3).map(t => ({ phase_id: t.phase_id, text: t.text })));
            if ((taskRes.data || []).length > 0) {
                const t0 = taskRes.data[0];
                console.log('[DossierPhase] task phase_id type:', typeof t0.phase_id, '| value:', t0.phase_id, '| match:', t0.phase_id === phase_id);
            }

            setKriterien(krRes.data);

            setTasks((taskRes.data || []).filter(t => t.phase_id === phase_id));

            const alleJournal = journalRes.data || [];
            setJournal(phaseStart
                ? alleJournal.filter(j => new Date(j.datum) >= phaseStart)
                : alleJournal
            );

            const alleTermine = termRes.data || [];
            setTermine(phaseStart
                ? alleTermine.filter(t => {
                    const td = new Date(t.datum);
                    return phaseEnde ? (td >= phaseStart && td <= phaseEnde) : td >= phaseStart;
                })
                : alleTermine
            );
        } catch (err) {
            console.error(err);
        } finally {
            setLaden(false);
        }
    }, [id, phase_id]);

    useEffect(() => { ladeDaten(); }, [ladeDaten]);

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
            {/* Back */}
            <button onClick={() => navigate(`/dossiers/${id}`)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: '#6B6860', cursor: 'pointer', background: 'none', border: 'none',
                marginBottom: '.875rem', fontFamily: 'inherit', padding: 0
            }}>← Zurück zum Dossier</button>

            {/* ── HEADER ─────────────────────────────────── */}
            <div style={{ ...CARD, padding: '1.125rem 1.25rem', marginBottom: '.875rem' }}>
                {/* Breadcrumb */}
                <div style={{ fontSize: 11.5, color: '#A09D97', marginBottom: 6, display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: '#6B6860' }}>{dossier.vorname} {dossier.nachname}</span>
                    <span>·</span>
                    <span>{dossier.programm_name || '—'}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 600, color: '#1A1917' }}>{aktPhase?.label || '—'}</span>
                </div>

                {/* Phasenname */}
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.4px', marginBottom: '1rem' }}>
                    {aktPhase?.label || 'Phase'}
                </div>

                {/* Phasen-Stepper */}
                {phasen.length > 0 && (
                    <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 4 }}>
                        {phasen.map((ph, i, arr) => {
                            const viewIdx = arr.findIndex(p => p.phase_id === phase_id);
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
                            <span style={SECTION_HDR}>Aufgaben dieser Phase</span>
                            {offeneTasks > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#FFFBEB', color: '#B45309', border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace', marginLeft: 4 }}>{offeneTasks} offen</span>
                            )}
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

                    {/* Journal */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={SECTION_HDR}>📓 Journal</span>
                            {journal.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', color: '#6B6860', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace', marginLeft: 4 }}>{journal.length}</span>
                            )}
                        </div>
                        <div style={{ padding: '1rem' }}>
                            {journal.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine Journal-Einträge</div>
                            ) : journal.map((j, i) => {
                                const s = JKAT[j.kategorie] || JKAT['Sonstiges'];
                                return (
                                    <div key={i} style={{ border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, marginBottom: 6, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', background: '#F5F4F0' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 11.5, fontWeight: 500 }}>{j.kategorie}</div>
                                                <div style={{ fontSize: 10.5, color: '#6B6860', marginTop: 1 }}>{fmt(j.datum)} · {j.erfasst_von}</div>
                                            </div>
                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>{j.kategorie}</span>
                                        </div>
                                        <div style={{ padding: '8px 11px', fontSize: 11.5, color: '#6B6860', lineHeight: 1.6 }}>{j.text}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RECHTE SPALTE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>

                    {/* Termine dieser Phase */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={SECTION_HDR}>📅 Termine</span>
                            {termine.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', color: '#6B6860', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace', marginLeft: 4 }}>{termine.length}</span>
                            )}
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
                                        {t.notiz && <div style={{ fontSize: 11, color: '#6B6860', marginTop: 4, paddingLeft: 0, fontStyle: 'italic' }}>{t.notiz}</div>}
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
                                const farbe = TYP_FARBEN[p.typ] || '#6B6860';
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 7px', background: '#F5F4F0', borderRadius: 6, marginBottom: 5 }}>
                                        <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 10, background: farbe + '22', color: farbe, border: `1px solid ${farbe}33`, fontFamily: 'monospace', flexShrink: 0 }}>{p.typ}</span>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nachname} {p.vorname}</div>
                                            <div style={{ fontSize: 10.5, color: '#6B6860' }}>{p.rolle}{p.firma ? ` · ${p.firma}` : ''}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
