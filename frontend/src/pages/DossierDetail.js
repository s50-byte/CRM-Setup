import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const FARBEN = {
    'IV-Massnahme': '#2563EB', 'Ausbildung': '#16A34A', 'Beratung': '#7C3AED',
    'Abklärung': '#EA580C', 'Gez. Vorbereitung': '#D97706'
};

const LABEL_FARBEN = {
    'Lernender':               '#16A34A',
    'Teilnehmer':              '#2563EB',
    'Mitarbeiter mit IV-Rente':'#7C3AED',
};

const JKAT = {
    'Standortgespräch':          { bg: '#E0F2FE', color: '#0369A1' },
    'Job Coaching':               { bg: '#F0FDF4', color: '#166534' },
    'Beobachtung':                { bg: '#F5F3FF', color: '#5B21B6' },
    'Zielfortschritt':            { bg: '#FFF7ED', color: '#9A3412' },
    'Abwesenheit':                { bg: '#FEF2F2', color: '#991B1B' },
    'Kommunikation Auftraggeber': { bg: '#E0F2FE', color: '#075985' },
    'Externe Person':             { bg: '#FDF4FF', color: '#7E22CE' },
    'Sonstiges':                  { bg: '#F5F4F0', color: '#6B6860' },
};

export default function DossierDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { benutzer } = useAuth();
    const [dossier, setDossier] = useState(null);
    const [journal, setJournal] = useState([]);
    const [zeitachse, setZeitachse] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [laden, setLaden] = useState(true);
    const [aktTab, setAktTab] = useState('zeitachse');
    // Journal Form
    const [jKat, setJKat] = useState('Standortgespräch');
    const [jDatum, setJDatum] = useState(new Date().toISOString().slice(0, 10));
    const [jText, setJText] = useState('');
    const [jFormOpen, setJFormOpen] = useState(false);
    // Kommentar
    const [kommentar, setKommentar] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const [dosRes, journalRes, tasksRes] = await Promise.all([
                    client.get(`/dossiers/${id}`),
                    client.get(`/journal/${id.split('-')[0]}`).catch(() => ({ data: [] })),
                    client.get(`/tasks/klient/${id}`).catch(() => ({ data: [] })),
                ]);
                setDossier(dosRes.data);
                setJournal(journalRes.data);
                setTasks(tasksRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLaden(false);
            }
        }
        load();
    }, [id]);

    // Journal laden sobald dossier bekannt
    useEffect(() => {
        if (!dossier?.klient_id) return;
        Promise.all([
            client.get(`/journal/${dossier.klient_id}`),
            client.get(`/tasks/klient/${dossier.klient_id}`),
        ]).then(([j, t]) => {
            setJournal(j.data);
            setTasks(t.data);
        }).catch(console.error);
    }, [dossier?.klient_id]);

    async function addJournal() {
        if (!jText.trim()) return;
        try {
            const res = await client.post('/journal', {
                klient_id: dossier.klient_id,
                kategorie: jKat,
                datum: jDatum,
                text: jText,
            });
            setJournal(prev => [res.data, ...prev]);
            setJText('');
            setJFormOpen(false);
        } catch (err) {
            console.error(err);
        }
    }

    async function addKommentar() {
        if (!kommentar.trim()) return;
        setKommentar('');
        // Zeitachse lokal aktualisieren
        setZeitachse(prev => [{
            titel: 'Kommentar',
            text: kommentar,
            datum: new Date().toISOString(),
            typ: 'Kommentar',
            full_name: benutzer?.full_name,
        }, ...prev]);
    }

    async function toggleTask(task_id) {
        try {
            const res = await client.put(`/tasks/${task_id}/erledigt`);
            setTasks(prev => prev.map(t => t.task_id === task_id ? res.data : t));
        } catch (err) {
            console.error(err);
        }
    }

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!dossier) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Dossier nicht gefunden</div>;

    const farbe = FARBEN[dossier.programm_name] || '#888';
    const verlauf = dossier.programm_verlauf || [];
    const zugewiesen = dossier.zugewiesen || [];
    const offeneTasks = tasks.filter(t => !t.erledigt).length;

    return (
        <div>
            {/* Back */}
            <button onClick={() => navigate('/dossiers')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: '#6B6860', cursor: 'pointer', background: 'none', border: 'none',
                marginBottom: '.875rem', fontFamily: 'inherit', padding: 0
            }}>← Alle Dossiers</button>

            {/* Header */}
            <div style={{
                background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                borderRadius: 10, padding: '1rem', marginBottom: '.875rem',
                boxShadow: '0 1px 3px rgba(0,0,0,.07)'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 10, background: '#EEF3FE',
                        color: '#1D4ED8', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0
                    }}>
                        {(dossier.nachname?.[0] || '') + (dossier.vorname?.[0] || '')}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.3px' }}>
                                {dossier.nachname} {dossier.vorname}
                            </div>
                            <span style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                background: '#F5F3FF', color: '#5B21B6',
                                border: '1px solid rgba(124,58,237,.15)', fontFamily: 'monospace'
                            }}>{dossier.phase_label || dossier.pipeline_status}</span>
                            {dossier.klient_label && (() => {
                                const c = LABEL_FARBEN[dossier.klient_label] || '#6B6860';
                                return (
                                    <span style={{
                                        fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                        background: c + '22', color: c,
                                        border: `1px solid ${c}33`, fontFamily: 'monospace'
                                    }}>{dossier.klient_label}</span>
                                );
                            })()}
                            <span style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                background: '#F5F4F0', color: '#6B6860',
                                border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace'
                            }}>{verlauf.length} Programm{verlauf.length !== 1 ? 'e' : ''}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#6B6860', marginTop: 3, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            <span>{dossier.auftraggeber}</span>
                            {dossier.standort_name && (
                                <>
                                    <span style={{ color: '#A09D97' }}>·</span>
                                    <span>{dossier.standort_name}</span>
                                </>
                            )}
                            <span style={{ color: '#A09D97' }}>·</span>
                            <span>{dossier.programm_name || '—'}</span>
                            <span style={{ color: '#A09D97' }}>·</span>
                            <span>Eingang: {dossier.eingang_datum ? new Date(dossier.eingang_datum).toLocaleDateString('de-CH') : '—'}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <button onClick={() => setJFormOpen(true)} style={{
                            padding: '7px 14px', fontSize: 13, fontWeight: 500,
                            cursor: 'pointer', border: 'none', borderRadius: 6,
                            background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>+ Journal-Eintrag</button>
                    </div>
                </div>

                {/* Stepper */}
                {dossier.phasen && (
                    <div style={{ marginTop: '.875rem' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem' }}>Aktuelle Phase</div>
                        <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 3 }}>
                            {dossier.phasen.map((ph, i, arr) => {
                                const currentIdx = arr.findIndex(p => p.phase_id === dossier.akt_phase_id);
                                const done = i < currentIdx;
                                const active = i === currentIdx;
                                return (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 68, position: 'relative' }}>
                                        {i < arr.length - 1 && (
                                            <div style={{ position: 'absolute', top: 12, left: '50%', width: '100%', height: 2, background: done ? '#16A34A' : '#E3E1DA', zIndex: 0 }} />
                                        )}
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%', zIndex: 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 10, fontWeight: 600, fontFamily: 'monospace',
                                            background: done ? '#16A34A' : active ? '#2563EB' : '#fff',
                                            border: `2px solid ${done ? '#16A34A' : active ? '#2563EB' : '#E3E1DA'}`,
                                            color: done || active ? '#fff' : '#A09D97',
                                            boxShadow: active ? '0 0 0 4px rgba(37,99,235,.15)' : 'none'
                                        }}>
                                            {done ? '✓' : i + 1}
                                        </div>
                                        <div style={{
                                            fontSize: 9, fontWeight: active ? 600 : 500, marginTop: 5,
                                            textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
                                            color: done ? '#15803D' : active ? '#2563EB' : '#A09D97'
                                        }}>{ph.label}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Programmhistorie */}
            {verlauf.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, marginBottom: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
                    <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                        ⟳ Programmhistorie
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace', marginLeft: 6 }}>{verlauf.length} Programm{verlauf.length !== 1 ? 'e' : ''}</span>
                    </div>
                    <div style={{ padding: '1rem' }}>
                        {verlauf.map((v, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < verlauf.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.farbe_hex, flexShrink: 0, boxShadow: i === verlauf.length - 1 ? `0 0 0 3px ${v.farbe_hex}33` : 'none' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>{v.programm_name}</div>
                                    <div style={{ fontSize: 11, color: '#6B6860' }}>
                                        {v.start_datum ? new Date(v.start_datum).toLocaleDateString('de-CH') : '—'} – {v.end_datum ? new Date(v.end_datum).toLocaleDateString('de-CH') : 'laufend'}
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: 11, padding: '2px 7px', borderRadius: 20, fontFamily: 'monospace',
                                    background: v.status === 'Laufend' ? '#ECFDF5' : v.status === 'Geplant' ? '#EEF3FE' : '#F5F4F0',
                                    color: v.status === 'Laufend' ? '#15803D' : v.status === 'Geplant' ? '#1D4ED8' : '#6B6860',
                                    border: `1px solid ${v.status === 'Laufend' ? 'rgba(22,163,74,.15)' : v.status === 'Geplant' ? 'rgba(37,99,235,.15)' : 'rgba(0,0,0,.09)'}`
                                }}>{v.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tasks */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, marginBottom: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
                <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        ☑ Aufgaben
                        {offeneTasks > 0 && (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#FFFBEB', color: '#B45309', border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace', marginLeft: 6 }}>{offeneTasks} offen</span>
                        )}
                    </div>
                </div>
                <div style={{ padding: '1rem' }}>
                    {tasks.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#6B6860' }}>Keine Aufgaben</div>
                    ) : tasks.map((t, i) => (
                        <div key={i} onClick={() => toggleTask(t.task_id)} style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px',
                            borderRadius: 6, border: '1px solid rgba(0,0,0,.09)',
                            background: '#F5F4F0', fontSize: 12, marginBottom: 5,
                            cursor: 'pointer', opacity: t.erledigt ? .55 : 1,
                            transition: 'opacity .15s'
                        }}>
                            <div style={{
                                width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                                border: t.erledigt ? 'none' : '1.5px solid rgba(0,0,0,.09)',
                                background: t.erledigt ? '#16A34A' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: 9
                            }}>{t.erledigt ? '✓' : ''}</div>
                            <div style={{ flex: 1, textDecoration: t.erledigt ? 'line-through' : 'none', color: t.erledigt ? '#6B6860' : '#1A1917' }}>{t.text}</div>
                            <span style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 20, fontFamily: 'monospace',
                                background: t.prioritaet === 'Hoch' ? '#FEF2F2' : t.prioritaet === 'Mittel' ? '#FFFBEB' : '#F5F4F0',
                                color: t.prioritaet === 'Hoch' ? '#B91C1C' : t.prioritaet === 'Mittel' ? '#B45309' : '#6B6860',
                                border: `1px solid ${t.prioritaet === 'Hoch' ? 'rgba(220,38,38,.15)' : t.prioritaet === 'Mittel' ? 'rgba(217,119,6,.15)' : 'rgba(0,0,0,.09)'}`
                            }}>{t.prioritaet}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs: Zeitachse / Journal */}
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                    {['zeitachse', 'journal'].map(tab => (
                        <button key={tab} onClick={() => setAktTab(tab)} style={{
                            padding: '.65rem 1.25rem', fontSize: 12, fontWeight: aktTab === tab ? 600 : 400,
                            cursor: 'pointer', border: 'none', background: 'transparent',
                            color: aktTab === tab ? '#2563EB' : '#6B6860',
                            borderBottom: aktTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                            fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.05em'
                        }}>
                            {tab === 'zeitachse' ? '⟳ Zeitachse' : '📓 Journal'}
                        </button>
                    ))}
                </div>

                <div style={{ padding: '1rem' }}>
                    {aktTab === 'zeitachse' && (
                        <div>
                            <div style={{ display: 'flex', gap: 7, marginBottom: '1rem' }}>
                                <input
                                    type="text" value={kommentar}
                                    onChange={e => setKommentar(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addKommentar()}
                                    placeholder="Aktivität hinzufügen… (Enter)"
                                    style={{
                                        flex: 1, fontSize: 13, padding: '6px 11px',
                                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                        background: '#F5F4F0', fontFamily: 'inherit', outline: 'none'
                                    }}
                                />
                                <button onClick={addKommentar} style={{
                                    padding: '6px 14px', fontSize: 13, fontWeight: 500,
                                    cursor: 'pointer', border: 'none', borderRadius: 6,
                                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                                }}>Senden</button>
                            </div>
                            {zeitachse.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#6B6860' }}>Noch keine Einträge</div>
                            ) : zeitachse.map((e, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EEF3FE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 1 }}>✦</div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 500 }}>{e.titel}</div>
                                        <div style={{ fontSize: 10.5, color: '#6B6860', marginTop: 1 }}>
                                            {new Date(e.datum).toLocaleDateString('de-CH')} · {e.full_name}
                                        </div>
                                        {e.text && <div style={{ fontSize: 11, color: '#6B6860', background: '#F5F4F0', borderRadius: 6, padding: '6px 9px', marginTop: 5, borderLeft: '3px solid rgba(0,0,0,.09)' }}>{e.text}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {aktTab === 'journal' && (
                        <div>
                            {jFormOpen && (
                                <div style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                                        <select value={jKat} onChange={e => setJKat(e.target.value)} style={{
                                            flex: 1, minWidth: 160, fontSize: 12, padding: '5px 9px',
                                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                            background: '#fff', fontFamily: 'inherit'
                                        }}>
                                            {Object.keys(JKAT).map(k => <option key={k}>{k}</option>)}
                                        </select>
                                        <input type="date" value={jDatum} onChange={e => setJDatum(e.target.value)}
                                            style={{ flex: '0 0 130px', fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff' }}
                                        />
                                    </div>
                                    <textarea value={jText} onChange={e => setJText(e.target.value)}
                                        placeholder="Notiz erfassen…"
                                        style={{
                                            width: '100%', fontSize: 12, padding: '7px 9px',
                                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                            background: '#fff', minHeight: 70, resize: 'vertical',
                                            lineHeight: 1.5, fontFamily: 'inherit', marginBottom: 7,
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                                        <button onClick={() => setJFormOpen(false)} style={{
                                            padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                            background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                                        }}>Abbrechen</button>
                                        <button onClick={addJournal} style={{
                                            padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                                            border: 'none', borderRadius: 5,
                                            background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                                        }}>Speichern</button>
                                    </div>
                                </div>
                            )}
                            {journal.length === 0 ? (
                                <div style={{ fontSize: 12, color: '#6B6860' }}>Noch keine Journal-Einträge</div>
                            ) : journal.map((j, i) => {
                                const s = JKAT[j.kategorie] || JKAT['Sonstiges'];
                                return (
                                    <div key={i} style={{ border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, marginBottom: 6, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', background: '#F5F4F0' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: 500 }}>{j.kategorie}</div>
                                                <div style={{ fontSize: 10.5, color: '#6B6860', marginTop: 1 }}>
                                                    {new Date(j.datum).toLocaleDateString('de-CH')} · {j.erfasst_von}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20,
                                                background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.03em'
                                            }}>{j.kategorie}</span>
                                        </div>
                                        <div style={{ padding: '9px 11px', fontSize: 11.5, color: '#6B6860', lineHeight: 1.6 }}>
                                            {j.text}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar rechts — Zuweisung */}
            <div style={{ marginTop: '.875rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                        Zuweisung
                    </div>
                    {zugewiesen.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#6B6860' }}>Niemand zugewiesen</div>
                    ) : zugewiesen.map((u, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px', background: u.stellvertretung ? '#FFFBEB' : '#F5F4F0', borderRadius: 6, marginBottom: 6 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#EEF3FE', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                                {u.avatar_initials || u.full_name?.[0]}
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{u.full_name}</div>
                                <div style={{ fontSize: 10.5, color: '#6B6860' }}>
                                    {u.stellvertretung ? '⚡ Stellvertretung' : u.rolle_im_fall}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                        Klientendaten
                    </div>
                    {[
                        { label: 'Telefon', value: dossier.telefon },
                        { label: 'E-Mail', value: dossier.email },
                        { label: 'Adresse', value: dossier.adresse ? `${dossier.adresse}, ${dossier.plz} ${dossier.ort}` : null },
                        { label: 'Geburtsdatum', value: dossier.geburtsdatum ? new Date(dossier.geburtsdatum).toLocaleDateString('de-CH') : null },
                        { label: 'AHV-Nr.', value: dossier.ahv_nummer },
                    ].map((f, i) => f.value ? (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                            <span style={{ color: '#6B6860', width: 90, flexShrink: 0 }}>{f.label}</span>
                            <span style={{ fontWeight: 500 }}>{f.value}</span>
                        </div>
                    ) : null)}
                </div>
            </div>
        </div>
    );
}