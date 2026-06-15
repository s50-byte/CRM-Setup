import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const ERLAUBTE_ROLLEN = ['kader', 'leitungsteam', 'management', 'teamleitung'];

const ROLLEN_OPTS = ['Alle', 'Klientenführung', 'Job Coach', 'Fachperson'];

const ROLLE_FARBEN = {
    'Klientenführung': '#2563EB',
    'Job Coach':       '#16A34A',
    'Fachperson':      '#7C3AED',
};

const LABEL_FARBEN = {
    'LE': { bg: '#ECFDF5', color: '#15803D' },
    'TN': { bg: '#EEF3FE', color: '#1D4ED8' },
    'MA': { bg: '#F5F3FF', color: '#5B21B6' },
};

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const CARD = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};

const INPUT_S = { fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', cursor: 'pointer' };

const ROW_H = 46;
const HEADER_H = 30;
const LEFT_W = 250;
const BAR_H = 16;

function isoDate(d) {
    return d.toISOString().slice(0, 10);
}

function heuteISO() {
    return isoDate(new Date());
}

function plus6MonateISO() {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return isoDate(d);
}

function fmt(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-CH');
}

function startOfWeek(d) {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // 0 = Montag
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getKW(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const diff = date - firstThursday;
    return 1 + Math.round(diff / (7 * 86400000));
}

const ZOOM_OPTS = [
    { key: 'wochen',   label: 'Wochen',   breite: 40 },
    { key: 'monate',   label: 'Monate',   breite: 80 },
    { key: 'quartale', label: 'Quartale', breite: 200 },
];

function ZoomToggle({ value, onChange }) {
    return (
        <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, overflow: 'hidden' }}>
            {ZOOM_OPTS.map((o, i) => (
                <button key={o.key} onClick={() => onChange(o.key)} style={{
                    padding: '5px 12px', fontSize: 12, fontWeight: value === o.key ? 600 : 400,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: value === o.key ? '#2563EB' : '#fff',
                    color: value === o.key ? '#fff' : '#6B6860',
                    borderLeft: i > 0 ? '1px solid rgba(0,0,0,.09)' : 'none',
                }}>{o.label}</button>
            ))}
        </div>
    );
}

function MultiSelect({ label, options, selected, onChange }) {
    const [open, setOpen] = useState(false);

    function toggle(value) {
        if (selected.includes(value)) onChange(selected.filter(s => s !== value));
        else onChange([...selected, value]);
    }

    return (
        <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6B6860', display: 'block', marginBottom: 3 }}>{label}</label>
            <button onClick={() => setOpen(o => !o)} style={{ ...INPUT_S, minWidth: 150, textAlign: 'left' }}>
                {selected.length === 0 ? 'Alle' : `${selected.length} ausgewählt`} ▾
            </button>
            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                        background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,.12)', padding: 6, minWidth: 200, maxHeight: 240, overflowY: 'auto',
                    }}>
                        {options.length === 0 && (
                            <div style={{ padding: '4px 6px', fontSize: 12, color: '#A09D97' }}>Keine Optionen</div>
                        )}
                        {options.map(o => (
                            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 12.5, cursor: 'pointer', borderRadius: 4 }}>
                                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                                {o.label}
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function Gantt() {
    const { benutzer } = useAuth();
    const navigate = useNavigate();

    const [von, setVon] = useState(heuteISO());
    const [bis, setBis] = useState(plus6MonateISO());
    const [standortIds, setStandortIds] = useState([]);
    const [programmIds, setProgrammIds] = useState([]);
    const [userId, setUserId] = useState('');
    const [rolle, setRolle] = useState('Alle');
    const [zoomLevel, setZoomLevel] = useState('monate');

    const [standorte, setStandorte] = useState([]);
    const [programme, setProgramme] = useState([]);
    const [benutzerListe, setBenutzerListe] = useState([]);
    const [daten, setDaten] = useState([]);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState(null);

    const berechtigt = ERLAUBTE_ROLLEN.includes(benutzer?.system_rolle);

    useEffect(() => {
        if (!berechtigt) return;
        Promise.all([
            client.get('/standorte'),
            client.get('/programme'),
            client.get('/benutzer'),
        ]).then(([st, pr, bn]) => {
            setStandorte(st.data || []);
            setProgramme(pr.data || []);
            setBenutzerListe((bn.data || []).filter(b => b.aktiv));
        }).catch(console.error);
    }, [berechtigt]);

    useEffect(() => {
        if (!berechtigt) return;
        setLaden(true);
        const params = new URLSearchParams({ von, bis });
        if (standortIds.length) params.set('standort_ids', standortIds.join(','));
        if (programmIds.length) params.set('programm_ids', programmIds.join(','));
        if (userId) params.set('user_id', userId);
        if (rolle !== 'Alle') params.set('rolle', rolle);
        client.get(`/gantt?${params.toString()}`)
            .then(r => setDaten(r.data))
            .catch(e => setFehler(e.response?.data?.error || 'Fehler beim Laden'))
            .finally(() => setLaden(false));
    }, [berechtigt, von, bis, standortIds, programmIds, userId, rolle]);

    if (!berechtigt) {
        return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Keine Berechtigung für diese Ansicht.</div>;
    }

    const vonDate = new Date(von);
    const bisDate = new Date(bis);
    const totalDays = Math.max(1, Math.round((bisDate - vonDate) / 86400000));

    function pct(dateStr) {
        const d = new Date(dateStr);
        const days = (d - vonDate) / 86400000;
        return Math.min(100, Math.max(0, (days / totalDays) * 100));
    }

    // Zeitstrahl-Spalten je nach Zoom-Level
    const colWidth = ZOOM_OPTS.find(o => o.key === zoomLevel).breite;
    const spalten = [];
    if (zoomLevel === 'wochen') {
        let cur = startOfWeek(vonDate);
        while (cur < bisDate) {
            const next = new Date(cur);
            next.setDate(next.getDate() + 7);
            const segStart = cur < vonDate ? vonDate : cur;
            const segEnd = next > bisDate ? bisDate : next;
            const days = Math.max(0.0001, (segEnd - segStart) / 86400000);
            spalten.push({ label: `KW${getKW(cur)}`, days });
            cur = next;
        }
    } else if (zoomLevel === 'quartale') {
        let cur = new Date(vonDate.getFullYear(), Math.floor(vonDate.getMonth() / 3) * 3, 1);
        while (cur < bisDate) {
            const next = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
            const segStart = cur < vonDate ? vonDate : cur;
            const segEnd = next > bisDate ? bisDate : next;
            const days = Math.max(0.0001, (segEnd - segStart) / 86400000);
            const quartal = Math.floor(cur.getMonth() / 3) + 1;
            spalten.push({ label: `Q${quartal} ${String(cur.getFullYear()).slice(2)}`, days });
            cur = next;
        }
    } else {
        let cur = new Date(vonDate.getFullYear(), vonDate.getMonth(), 1);
        while (cur < bisDate) {
            const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
            const segStart = cur < vonDate ? vonDate : cur;
            const segEnd = next > bisDate ? bisDate : next;
            const days = Math.max(0.0001, (segEnd - segStart) / 86400000);
            spalten.push({ label: `${MONATE[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, days });
            cur = next;
        }
    }
    const timelineWidth = Math.max(1200, spalten.length * colWidth);

    // Wochenlinien
    const wochenlinien = [];
    {
        let cur = new Date(vonDate);
        while (cur < bisDate) {
            wochenlinien.push(pct(isoDate(cur)));
            cur.setDate(cur.getDate() + 7);
        }
    }

    const heutePct = pct(heuteISO());
    const heuteImBereich = new Date(heuteISO()) >= vonDate && new Date(heuteISO()) <= bisDate;

    return (
        <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.3px' }}>Auslastungsplanung</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Phasen- und Massnahmenverlauf aller Klient:innen im Zeitstrahl</div>
                </div>
                <ZoomToggle value={zoomLevel} onChange={setZoomLevel} />
            </div>

            {/* Filter-Leiste */}
            <div style={{ ...CARD, padding: '.875rem 1.125rem', marginBottom: '1rem', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 500, color: '#6B6860', display: 'block', marginBottom: 3 }}>Von</label>
                    <input type="date" value={von} onChange={e => setVon(e.target.value)} style={INPUT_S} />
                </div>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 500, color: '#6B6860', display: 'block', marginBottom: 3 }}>Bis</label>
                    <input type="date" value={bis} onChange={e => setBis(e.target.value)} style={INPUT_S} />
                </div>
                <MultiSelect
                    label="Standort"
                    options={standorte.map(s => ({ value: s.standort_id, label: s.name }))}
                    selected={standortIds}
                    onChange={setStandortIds}
                />
                <MultiSelect
                    label="Massnahme"
                    options={programme.map(p => ({ value: p.programm_id, label: p.name }))}
                    selected={programmIds}
                    onChange={setProgrammIds}
                />
                <div>
                    <label style={{ fontSize: 11, fontWeight: 500, color: '#6B6860', display: 'block', marginBottom: 3 }}>Kader/Betreuer</label>
                    <select value={userId} onChange={e => setUserId(e.target.value)} style={INPUT_S}>
                        <option value="">Alle</option>
                        {benutzerListe.map(b => <option key={b.user_id} value={b.user_id}>{b.full_name}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: 11, fontWeight: 500, color: '#6B6860', display: 'block', marginBottom: 3 }}>Rolle</label>
                    <select value={rolle} onChange={e => setRolle(e.target.value)} style={INPUT_S}>
                        {ROLLEN_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {rolle !== 'Alle' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#5B21B6', background: '#F5F3FF', border: '1px solid rgba(124,58,237,.15)', borderRadius: 6, padding: '5px 10px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLLE_FARBEN[rolle] || '#A09D97', display: 'inline-block' }} />
                        Rollen-Brille: nur Phasen mit Rolle „{rolle}“
                    </div>
                )}
            </div>

            {/* Legende */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '.75rem', fontSize: 11.5, color: '#6B6860' }}>
                {Object.entries(ROLLE_FARBEN).map(([name, color]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
                        {name}
                    </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: '#E5E7EB', display: 'inline-block' }} />
                    Massnahmenzeitraum
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 2, height: 12, background: '#DC2626', display: 'inline-block' }} />
                    Heute
                </div>
            </div>

            {/* Gantt */}
            <div style={{ ...CARD, overflow: 'hidden' }}>
                {laden && <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 13 }}>Laden…</div>}
                {fehler && <div style={{ padding: '2rem', textAlign: 'center', color: '#B91C1C', fontSize: 13 }}>⚠ {fehler}</div>}
                {!laden && !fehler && daten.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#A09D97', fontSize: 12 }}>Keine Einträge für diese Filterung</div>
                )}
                {!laden && !fehler && daten.length > 0 && (
                    <div style={{ display: 'flex', overflowX: 'auto' }}>
                        {/* LINKE SPALTE */}
                        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '1px solid rgba(0,0,0,.09)', position: 'sticky', left: 0, zIndex: 5, background: '#fff' }}>
                            <div style={{
                                height: HEADER_H, display: 'flex', alignItems: 'center', padding: '0 12px',
                                fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em',
                                borderBottom: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0',
                            }}>Klient</div>
                            {daten.map(row => (
                                <div key={row.dossier_id} onClick={() => navigate(`/dossiers/${row.dossier_id}`)} style={{
                                    height: ROW_H, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                    padding: '0 12px', gap: 3, borderBottom: '1px solid rgba(0,0,0,.05)', cursor: 'pointer',
                                    background: '#fff',
                                }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.klient_name}</div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {row.programm_name && (
                                            <span style={{
                                                fontSize: 10, padding: '1px 6px', borderRadius: 10, fontFamily: 'monospace',
                                                background: `${row.programm_farbe || '#6B6860'}1A`, color: row.programm_farbe || '#6B6860',
                                                border: `1px solid ${row.programm_farbe || '#6B6860'}33`,
                                            }}>{row.programm_name}</span>
                                        )}
                                        {row.klient_label && LABEL_FARBEN[row.klient_label] && (
                                            <span style={{
                                                fontSize: 10, padding: '1px 6px', borderRadius: 10, fontFamily: 'monospace',
                                                background: LABEL_FARBEN[row.klient_label].bg, color: LABEL_FARBEN[row.klient_label].color,
                                                border: `1px solid ${LABEL_FARBEN[row.klient_label].color}33`,
                                            }}>{row.klient_label}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* RECHTE SPALTE — ZEITSTRAHL */}
                        <div style={{ position: 'relative', width: timelineWidth, flexShrink: 0 }}>
                            {/* Wochenlinien */}
                            {wochenlinien.map((p, i) => (
                                <div key={`w${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p}%`, width: 1, background: 'rgba(0,0,0,.045)', zIndex: 1 }} />
                            ))}
                            {/* Heute-Linie */}
                            {heuteImBereich && (
                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${heutePct}%`, width: 2, background: '#DC2626', zIndex: 2 }} />
                            )}

                            {/* Spalten-Header */}
                            <div style={{ display: 'flex', height: HEADER_H, borderBottom: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0', position: 'relative', zIndex: 1 }}>
                                {spalten.map((s, i) => (
                                    <div key={i} style={{
                                        flex: s.days, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10.5, fontWeight: 600, color: '#6B6860',
                                        borderRight: i < spalten.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
                                        whiteSpace: 'nowrap', overflow: 'hidden',
                                    }}>{s.label}</div>
                                ))}
                            </div>

                            {/* Zeilen */}
                            {daten.map(row => {
                                let bgStart = row.start_datum;
                                let bgEnd = row.geplantes_enddatum;

                                if (rolle !== 'Alle' && row.phasen.length > 0) {
                                    const starts = row.phasen.map(p => p.start_datum).filter(Boolean);
                                    const ends = row.phasen.map(p => p.end_datum).filter(Boolean);
                                    if (starts.length) bgStart = starts.reduce((a, b) => (a < b ? a : b));
                                    if (ends.length) bgEnd = ends.reduce((a, b) => (a > b ? a : b));
                                }

                                const left = bgStart ? pct(bgStart) : 0;
                                const right = bgEnd ? pct(bgEnd) : 100;
                                const width = Math.max(0, right - left);

                                return (
                                    <div key={row.dossier_id} style={{ height: ROW_H, position: 'relative', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                        {/* Grauer Hintergrund-Balken */}
                                        <div title={`${row.programm_name || 'Massnahme'}: ${fmt(bgStart)} – ${fmt(bgEnd)}`} style={{
                                            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                            left: `${left}%`, width: `${width}%`, height: BAR_H,
                                            background: '#E5E7EB', borderRadius: 4,
                                        }} />

                                        {/* Phasen-Balken */}
                                        {row.phasen.map(p => {
                                            const pStart = p.start_datum || bgStart;
                                            const pEnd = p.end_datum || bgEnd;
                                            if (!pStart && !pEnd) return null;
                                            const pLeft = pct(pStart || pEnd);
                                            const pRight = pct(pEnd || pStart);
                                            const pWidth = Math.max(0.6, pRight - pLeft);
                                            const farbe = ROLLE_FARBEN[(p.rollen || [])[0]] || '#A09D97';
                                            const rollenText = (p.rollen || []).join(', ') || '—';
                                            return (
                                                <div key={p.phase_id}
                                                    title={`${p.phase_label}\n${fmt(p.start_datum)} – ${fmt(p.end_datum)}\nRollen: ${rollenText}`}
                                                    style={{
                                                        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                                        left: `${pLeft}%`, width: `${pWidth}%`, height: BAR_H,
                                                        background: farbe, borderRadius: 4, cursor: 'default',
                                                    }} />
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
