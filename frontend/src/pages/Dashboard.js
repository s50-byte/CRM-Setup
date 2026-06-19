import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const STATUS_STYLE = {
    'Ausstehend': { bg: '#FFFBEB', color: '#B45309', border: 'rgba(217,119,6,.15)' },
    'Bestätigt':  { bg: '#ECFDF5', color: '#15803D', border: 'rgba(22,163,74,.15)' },
    'Geplant':    { bg: '#EEF3FE', color: '#1D4ED8', border: 'rgba(37,99,235,.15)' },
    'Abgesagt':   { bg: '#FEF2F2', color: '#B91C1C', border: 'rgba(220,38,38,.15)' },
};

function berechneTageVerbleibend(start_datum, avg_dauer_tage) {
    if (!start_datum || !avg_dauer_tage) return null;
    const ende = new Date(start_datum);
    ende.setDate(ende.getDate() + avg_dauer_tage);
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    return Math.floor((ende - heute) / (1000 * 60 * 60 * 24));
}

const STATUS_LABELS = {
    'anwesend': 'Anwesend', 'krank': 'Krank', 'unentschuldigt': 'Unentschuldigt',
    'verspaetet': 'Verspätet', 'schule': 'Schule', 'ferien': 'Ferien',
    'feiertag': 'Feiertag', 'unfall': 'Unfall',
};

function MeldungKarte({ m, onAcknowledge, onTerminClick, abgesagteTerminIds }) {
    const sl = s => STATUS_LABELS[s] || s || '—';
    return (
        <div style={{
            border: '1px solid rgba(0,0,0,.07)', borderRadius: 8,
            padding: '.625rem .875rem', background: '#FAFAFA',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1A1917', marginBottom: 5 }}>
                    {new Date(m.created_at).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'long' })}
                    <span style={{ fontWeight: 400, color: '#A09D97', marginLeft: 6 }}>
                        · {new Date(m.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </span>
                </div>
                {(m.aenderungen || []).map((a, i) => {
                    if (a.typ === 'feedback_antwort') {
                        return (
                            <div key={i} style={{ marginTop: 3 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1917' }}>
                                    Antwort auf dein Feedback: <span style={{ color: '#15803D' }}>{a.status_label || a.status}</span>
                                </div>
                                <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{a.antwort}</div>
                                {a.feedback_notiz && (
                                    <div style={{ fontSize: 11, color: '#A09D97', marginTop: 3 }}>
                                        Dein Feedback: {a.feedback_notiz.length > 80 ? a.feedback_notiz.slice(0, 80) + '…' : a.feedback_notiz}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    if (a.typ === 'termin_absage') {
                        return (
                            <div
                                key={i}
                                onClick={a.termin_id && onTerminClick ? () => onTerminClick(a.termin_id) : undefined}
                                style={{ marginTop: 3, cursor: a.termin_id && onTerminClick ? 'pointer' : 'default' }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#B91C1C', textDecorationLine: a.termin_id && onTerminClick ? 'underline' : 'none', textDecorationColor: 'rgba(185,28,28,.3)' }}>
                                    Termin abgesagt: {a.termin_typ} am {new Date(a.datum).toLocaleDateString('de-CH')}
                                </div>
                                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Klient: {a.klient_name}</div>
                            </div>
                        );
                    }
                    if (a.typ === 'termin_einladung') {
                        const abgesagt = abgesagteTerminIds?.has(a.termin_id);
                        return (
                            <div
                                key={i}
                                onClick={!abgesagt && a.termin_id && onTerminClick ? () => onTerminClick(a.termin_id) : undefined}
                                style={{
                                    marginTop: 4,
                                    display: 'flex', gap: 10, padding: '8px 10px',
                                    background: abgesagt ? '#F5F4F0' : '#EEF3FE',
                                    borderRadius: 7,
                                    border: `1px solid ${abgesagt ? 'rgba(0,0,0,.07)' : 'rgba(37,99,235,.15)'}`,
                                    cursor: !abgesagt && a.termin_id && onTerminClick ? 'pointer' : 'default',
                                    opacity: abgesagt ? 0.6 : 1,
                                }}
                            >
                                <div style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>📅</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: abgesagt ? '#6B6860' : '#1D4ED8' }}>
                                            Termin: {a.termin_typ}
                                        </div>
                                        {abgesagt && (
                                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', border: '1px solid rgba(220,38,38,.2)', fontFamily: 'monospace' }}>Abgesagt</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: '#374151', marginTop: 2 }}>
                                        {new Date(a.datum).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6B6860', marginTop: 1 }}>Klient: {a.klient_name}</div>
                                </div>
                            </div>
                        );
                    }
                    if (a.typ === 'feedback_eingang') {
                        return (
                            <div key={i} style={{ marginTop: 3 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1917' }}>
                                    Neues Feedback von {m.erstellt_von_name || 'Unbekannt'}{a.screen ? `: ${a.screen}` : ''}
                                </div>
                                {a.notiz && (
                                    <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
                                        {a.notiz.length > 100 ? a.notiz.slice(0, 100) + '…' : a.notiz}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    if (a.alter_status === 'Vorabklärung') {
                        return (
                            <div key={i} style={{ fontSize: 12, color: '#6B6860', marginTop: 3 }}>
                                Neue Intake-Zuweisung: <strong style={{ color: '#1A1917' }}>{a.klient_name}</strong> → <strong>{a.neuer_status}</strong>
                            </div>
                        );
                    }
                    const art = a.art || (a.alter_status === null ? 'ersterfassung' : a.alter_status === a.neuer_status ? 'kommentar' : 'status');
                    return (
                        <div key={i} style={{ fontSize: 12, color: '#6B6860', marginTop: 3 }}>
                            <strong style={{ color: '#1A1917' }}>{a.name}</strong>
                            {art === 'ersterfassung' && <span> · <strong>{sl(a.neuer_status)}</strong> erfasst</span>}
                            {art === 'status'        && <span> · {sl(a.alter_status)} → <strong>{sl(a.neuer_status)}</strong></span>}
                            {art === 'kommentar'     && <span> · Status unverändert ({sl(a.neuer_status)})</span>}
                            {a.kommentar && <span style={{ fontSize: 11.5 }}> | {a.kommentar}</span>}
                        </div>
                    );
                })}
            </div>
            {onAcknowledge && (
                <button onClick={() => onAcknowledge(m.meldung_id)} style={{
                    fontSize: 11.5, padding: '5px 12px', borderRadius: 5, cursor: 'pointer', flexShrink: 0,
                    border: '1px solid rgba(22,163,74,.25)', background: '#F0FDF4',
                    fontFamily: 'inherit', color: '#15803D', fontWeight: 500, whiteSpace: 'nowrap'
                }}>✓ Gelesen</button>
            )}
        </div>
    );
}

export default function Dashboard() {
    const { benutzer } = useAuth();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [termine, setTermine] = useState([]);
    const [dossiers, setDossiers] = useState([]);
    const [meldungen, setMeldungen] = useState([]);
    const [fruehereMeldungen, setFruehereMeldungen] = useState([]);
    const [frueherOffen, setFrueherOffen] = useState(false);
    const [laden, setLaden] = useState(true);
    const [detailTermin, setDetailTermin] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const onFocus = () => setRefreshKey(k => k + 1);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);

    useEffect(() => {
        async function loadData() {
            try {
                const [tasksRes, termineRes, dossiersRes, meldungenRes, frueherRes] = await Promise.all([
                    client.get('/tasks'),
                    client.get('/termine'),
                    client.get('/dossiers?meine=true'),
                    client.get('/meldungen'),
                    client.get('/meldungen/alle?acknowledged=true'),
                ]);
                setTasks(tasksRes.data);
                console.log('nächste termine:', termineRes.data);
                setTermine(termineRes.data);
                setDossiers(dossiersRes.data);
                setMeldungen(meldungenRes.data);
                setFruehereMeldungen(frueherRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLaden(false);
            }
        }
        loadData();
    }, [refreshKey]);

    async function ladeTerminDetail(termin_id) {
        try {
            const r = await client.get(`/termine/${termin_id}`);
            setDetailTermin(r.data);
        } catch (err) {
            console.error(err);
        }
    }

    async function acknowledge(meldung_id) {
        try {
            await client.put(`/meldungen/${meldung_id}/acknowledge`);
            const moved = meldungen.find(m => m.meldung_id === meldung_id);
            setMeldungen(prev => prev.filter(m => m.meldung_id !== meldung_id));
            if (moved) setFruehereMeldungen(prev => [{ ...moved, acknowledged: true }, ...prev]);
        } catch (err) {
            console.error(err);
        }
    }

    const abgesagteTerminIds = new Set(
        [...meldungen, ...fruehereMeldungen]
            .flatMap(m => m.aenderungen || [])
            .filter(a => a.typ === 'termin_absage' && a.termin_id)
            .map(a => a.termin_id)
    );

    const hatNurTerminEinladung = m => (m.aenderungen || []).every(a => a.typ === 'termin_einladung');
    const meldungenAnzeige = meldungen.filter(m => !hatNurTerminEinladung(m));
    const fruehereMeldungenAnzeige = fruehereMeldungen.filter(m => !hatNurTerminEinladung(m));

    const offeneTasks = tasks.filter(t => !t.erledigt);
    const heute = new Date().toISOString().slice(0, 10);
    const heuteTermine = termine.filter(t => t.datum === heute);
    const naechsteTermine = termine
        .filter(t => t.datum >= heute && t.status !== 'Abgesagt')
        .sort((a, b) => a.datum.localeCompare(b.datum) || (a.zeit || '').localeCompare(b.zeit || ''));
    const baldAblaufend = dossiers.filter(d => {
        const tage = berechneTageVerbleibend(d.laufend_start_datum, d.avg_dauer_tage);
        return tage !== null && tage < 28;
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>
                        Guten Morgen, {benutzer?.full_name?.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                        {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                    { label: 'Offene Aufgaben', wert: offeneTasks.length, farbe: '#D97706' },
                    { label: 'Termine heute', wert: heuteTermine.length, farbe: '#1A1917' },
                    { label: 'Erledigte Tasks', wert: tasks.filter(t => t.erledigt).length, farbe: '#16A34A' },
                    { label: 'Bald ablaufend', wert: baldAblaufend.length, farbe: baldAblaufend.length > 0 ? '#B91C1C' : '#16A34A', link: '/dossiers' },
                ].map((k, i) => (
                    <div key={i} onClick={k.link ? () => navigate(k.link) : undefined} style={{
                        background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                        borderRadius: 10, padding: '.875rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                        cursor: k.link ? 'pointer' : 'default'
                    }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 21, fontWeight: 600, color: k.farbe }}>{laden ? '…' : k.wert}</div>
                    </div>
                ))}
            </div>

            {/* Benachrichtigungen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Neue Benachrichtigungen */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.75rem' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            Neue Benachrichtigungen
                        </div>
                        {meldungenAnzeige.length > 0 && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                                background: '#DC2626', color: '#fff', minWidth: 16, textAlign: 'center'
                            }}>{meldungenAnzeige.length}</span>
                        )}
                    </div>
                    {laden ? (
                        <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>
                    ) : meldungenAnzeige.length === 0 ? (
                        <div style={{ color: '#15803D', fontSize: 12.5, fontWeight: 500 }}>Keine offenen Meldungen ✓</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {meldungenAnzeige.map(m => (
                                <MeldungKarte key={m.meldung_id} m={m} onAcknowledge={acknowledge} onTerminClick={ladeTerminDetail} abgesagteTerminIds={abgesagteTerminIds} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Frühere Benachrichtigungen */}
                {!laden && fruehereMeldungenAnzeige.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                        <div
                            onClick={() => setFrueherOffen(v => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1rem',
                                cursor: 'pointer', userSelect: 'none',
                                background: frueherOffen ? '#fff' : '#FAFAF9',
                                borderBottom: frueherOffen ? '1px solid rgba(0,0,0,.08)' : 'none',
                            }}
                        >
                            <span style={{ fontSize: 10, color: '#6B6860', fontFamily: 'monospace', lineHeight: 1 }}>
                                {frueherOffen ? '▼' : '▶'}
                            </span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Frühere Benachrichtigungen
                            </span>
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                                background: '#F5F4F0', color: '#6B6860', minWidth: 16, textAlign: 'center'
                            }}>{fruehereMeldungenAnzeige.length}</span>
                        </div>
                        {frueherOffen && (
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '520px', overflowY: 'auto' }}>
                                {fruehereMeldungenAnzeige.map(m => (
                                    <MeldungKarte key={m.meldung_id} m={m} onTerminClick={ladeTerminDetail} abgesagteTerminIds={abgesagteTerminIds} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Offene Aufgaben */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>
                        Offene Aufgaben
                    </div>
                    {laden ? <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div> :
                    offeneTasks.length === 0 ? <div style={{ color: '#6B6860', fontSize: 12 }}>Keine offenen Aufgaben</div> :
                    offeneTasks.slice(0, 5).map((t, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.05)'
                        }}>
                            <div style={{
                                width: 15, height: 15, borderRadius: 4,
                                border: '1.5px solid rgba(0,0,0,.09)', flexShrink: 0
                            }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{t.text}</div>
                                <div style={{ fontSize: 10.5, color: '#6B6860' }}>
                                    {t.vorname} {t.nachname} · {t.faellig_am ? new Date(t.faellig_am).toLocaleDateString('de-CH') : '—'}
                                </div>
                            </div>
                            <span style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 20, fontFamily: 'monospace',
                                background: t.prioritaet === 'Hoch' ? '#FEF2F2' : t.prioritaet === 'Mittel' ? '#FFFBEB' : '#F5F4F0',
                                color: t.prioritaet === 'Hoch' ? '#B91C1C' : t.prioritaet === 'Mittel' ? '#B45309' : '#6B6860',
                                border: `1px solid ${t.prioritaet === 'Hoch' ? 'rgba(220,38,38,.15)' : t.prioritaet === 'Mittel' ? 'rgba(217,119,6,.15)' : 'rgba(0,0,0,.09)'}`
                            }}>{t.prioritaet}</span>
                        </div>
                    ))}
                </div>

                {/* Nächste Termine */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>
                        Nächste Termine
                    </div>
                    {laden ? <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div> :
                    naechsteTermine.length === 0 ? <div style={{ color: '#6B6860', fontSize: 12 }}>Keine kommenden Termine</div> :
                    naechsteTermine.slice(0, 5).map((t, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 9,
                            padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.05)'
                        }}>
                            <div style={{
                                background: '#EEF3FE', borderRadius: 6, padding: '5px 7px',
                                textAlign: 'center', minWidth: 38
                            }}>
                                <div style={{ fontSize: 9, fontWeight: 600, color: '#1D4ED8', textTransform: 'uppercase' }}>
                                    {new Date(t.datum).toLocaleDateString('de-CH', { month: 'short' })}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', fontFamily: 'monospace' }}>
                                    {new Date(t.datum).getDate()}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{t.typ}</div>
                                <div style={{ fontSize: 10.5, color: '#6B6860' }}>
                                    {t.vorname} {t.nachname} · {t.zeit || 'Ganztag'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {detailTermin && (
                <div onClick={() => setDetailTermin(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#fff', borderRadius: 12, padding: '1.5rem',
                        width: 480, maxWidth: '90vw',
                        boxShadow: '0 8px 32px rgba(0,0,0,.18)',
                        maxHeight: '85vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1917' }}>{detailTermin.typ}</div>
                                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 3, fontFamily: 'monospace' }}>
                                    {new Date(detailTermin.datum).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    {detailTermin.zeit ? ` · ${detailTermin.zeit.slice(0, 5)} Uhr` : ''}
                                </div>
                            </div>
                            {detailTermin.status && (() => {
                                const s = STATUS_STYLE[detailTermin.status] || STATUS_STYLE['Ausstehend'];
                                return (
                                    <span style={{
                                        fontSize: 11, padding: '3px 9px', borderRadius: 20,
                                        background: s.bg, color: s.color,
                                        border: `1px solid ${s.border}`, fontFamily: 'monospace'
                                    }}>{detailTermin.status}</span>
                                );
                            })()}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Klient/in</div>
                                <button
                                    onClick={() => { setDetailTermin(null); navigate(`/klienten/${detailTermin.klient_id}`); }}
                                    style={{
                                        fontSize: 13, fontWeight: 500, color: '#2563EB', cursor: 'pointer',
                                        border: 'none', background: 'none', padding: 0, fontFamily: 'inherit',
                                        textDecoration: 'underline', textDecorationColor: 'rgba(37,99,235,.3)'
                                    }}
                                >
                                    {detailTermin.vorname} {detailTermin.nachname}
                                </button>
                            </div>

                            {detailTermin.personen && detailTermin.personen.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Teilnehmende Personen</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {detailTermin.personen.map((p, i) => (
                                            <span key={i} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                fontSize: 12, padding: '3px 9px 3px 5px',
                                                borderRadius: 20, background: '#F5F4F0',
                                                border: '1px solid rgba(0,0,0,.09)'
                                            }}>
                                                <div style={{
                                                    width: 18, height: 18, borderRadius: 5,
                                                    background: '#E5E7EB', color: '#374151',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 8, fontWeight: 700
                                                }}>{p.avatar_initials || p.full_name?.[0] || '?'}</div>
                                                {p.full_name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {detailTermin.notiz && (
                                <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Notiz</div>
                                    <div style={{
                                        fontSize: 13, padding: '10px 12px',
                                        background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                        borderRadius: 7, color: '#1A1917', lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap'
                                    }}>{detailTermin.notiz}</div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(0,0,0,.07)' }}>
                            <button onClick={() => setDetailTermin(null)} style={{
                                padding: '7px 18px', fontSize: 13, cursor: 'pointer',
                                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                                background: '#fff', fontFamily: 'inherit', color: '#1A1917', fontWeight: 500
                            }}>Schliessen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}