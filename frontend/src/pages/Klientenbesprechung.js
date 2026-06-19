import { useState, useEffect } from 'react';
import client from '../api/client';

const GRUPPEN_LABELS = {
    'BM': 'Berufliche Massnahmen',
    'IM': 'Integrationsmassnahmen',
    'BC': 'Beratung & Coaching',
    'GM': 'Gemeinde',
};

const LABEL_FARBEN = { 'LE': '#16A34A', 'TN': '#2563EB', 'MA': '#7C3AED' };

const PRIO_FARBE = { 'hoch': '#B91C1C', 'mittel': '#B45309', 'niedrig': '#6B7280' };

function fmtDatum(d) {
    return d ? new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
}

function fmtZeit(z) {
    return z ? String(z).slice(0, 5) : '';
}

function Initialen({ name, size = 36 }) {
    const parts = (name || '').split(' ').filter(Boolean);
    const ini = parts.length >= 2
        ? parts[0][0] + parts[parts.length - 1][0]
        : (name || '?')[0];
    return (
        <div style={{
            width: size, height: size, borderRadius: Math.round(size * 0.25),
            background: '#EEF3FE', color: '#1D4ED8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.35), fontWeight: 700, flexShrink: 0,
            letterSpacing: '0.02em'
        }}>
            {ini.toUpperCase()}
        </div>
    );
}

const INPUT_S = {
    fontSize: 12.5, padding: '5px 8px', borderRadius: 6,
    border: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0',
    fontFamily: 'inherit', outline: 'none',
};

// ── Banner-Card (links in Phase 2)
function BannerCard({ klient, aktiv, onClick }) {
    return (
        <div onClick={onClick} style={{
            padding: '7px 8px',
            borderRadius: 6,
            marginBottom: 4,
            cursor: 'pointer',
            background: aktiv ? '#EEF3FE' : '#F5F4F0',
            border: `1px solid ${aktiv ? '#2563EB' : 'rgba(0,0,0,.07)'}`,
            transition: 'border-color .12s, background .12s',
        }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: aktiv ? '#1D4ED8' : '#1A1917', lineHeight: 1.25, marginBottom: 2 }}>
                {klient.vorname} {klient.nachname}
            </div>
            {klient.programm_name && (
                <div style={{ fontSize: 10, color: '#6B6860', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {klient.programm_name}
                </div>
            )}
            {klient.klientenfuehrung_name && (
                <div style={{ fontSize: 10, color: '#A09D97', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {klient.klientenfuehrung_name}
                </div>
            )}
            <div style={{ marginTop: 3 }}>
                <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 10, fontWeight: 600,
                    background: aktiv ? '#DBEAFE' : '#E5E7EB',
                    color: aktiv ? '#1D4ED8' : '#6B7280',
                }}>
                    {aktiv ? 'aktiv' : 'offen'}
                </span>
            </div>
        </div>
    );
}

// ── Stat-Karte (in Detail-Card)
function StatKarte({ label, wert, sub }) {
    return (
        <div style={{
            background: '#F5F4F0', borderRadius: 8, padding: '10px 12px',
            border: '1px solid rgba(0,0,0,.07)', minWidth: 100, flex: '1 1 0',
        }}>
            <div style={{ fontSize: 10, color: '#6B6860', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1917' }}>{wert}</div>
            {sub && <div style={{ fontSize: 10, color: '#A09D97', marginTop: 1 }}>{sub}</div>}
        </div>
    );
}

// ── Detail-Karte (rechts in Phase 2)
function DetailKarte({ klient, besprochen, onMarkiereBesprochen, onEntferneBesprochen, notiz, onNotizChange, onSpeichereNotiz, gespeichert }) {
    const aufgaben = klient.offene_aufgaben || [];
    const termine = klient.naechste_termine || [];
    const journal = klient.letzter_journal;

    return (
        <div style={{
            background: '#fff', border: '1px solid rgba(0,0,0,.09)',
            borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.07)',
            height: '100%', overflowY: 'auto', boxSizing: 'border-box',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Initialen name={`${klient.vorname} ${klient.nachname}`} size={44} />
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1917' }}>
                            {klient.vorname} {klient.nachname}
                            {klient.klient_label && LABEL_FARBEN[klient.klient_label] && (
                                <span style={{
                                    marginLeft: 8, fontSize: 11, padding: '2px 7px', borderRadius: 20,
                                    fontWeight: 600, fontFamily: 'monospace',
                                    background: LABEL_FARBEN[klient.klient_label] + '22',
                                    color: LABEL_FARBEN[klient.klient_label],
                                    border: `1px solid ${LABEL_FARBEN[klient.klient_label]}33`,
                                }}>{klient.klient_label}</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {klient.programm_name && (
                                <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                                    background: (klient.farbe_hex || '#888') + '22',
                                    color: klient.farbe_hex || '#888',
                                    border: `1px solid ${klient.farbe_hex || '#888'}33`,
                                }}>{klient.programm_name}</span>
                            )}
                            {klient.phase_label && (
                                <span style={{ fontSize: 11, color: '#6B6860' }}>Phase: {klient.phase_label}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Besprochen-Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                    <input
                        type="checkbox"
                        checked={!!besprochen}
                        onChange={e => e.target.checked ? onMarkiereBesprochen() : onEntferneBesprochen()}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16A34A' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: besprochen ? '#16A34A' : '#6B6860' }}>
                        {besprochen ? 'Besprochen ✓' : 'Besprochen'}
                    </span>
                </label>
            </div>

            {/* Stat-Karten */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <StatKarte
                    label="Stunden SOLL"
                    wert={klient.stunden_soll != null ? `${klient.stunden_soll} h` : '—'}
                />
                <StatKarte
                    label="Stunden IST"
                    wert={klient.stunden_ist != null ? `${klient.stunden_ist} h` : '—'}
                />
                <StatKarte
                    label="Programmende"
                    wert={fmtDatum(klient.geplantes_enddatum)}
                />
                <StatKarte
                    label="Standort"
                    wert={klient.standort_kuerzel || klient.standort_name || '—'}
                    sub={klient.standort_kuerzel ? klient.standort_name : null}
                />
            </div>

            {/* Offene Aufgaben */}
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                    Offene Aufgaben ({aufgaben.length})
                </div>
                {aufgaben.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine offenen Aufgaben</div>
                ) : aufgaben.map(t => (
                    <div key={t.task_id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                        padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.06)',
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                            background: PRIO_FARBE[t.prioritaet] || '#6B7280',
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#1A1917' }}>{t.text}</div>
                            {t.faellig_am && (
                                <div style={{ fontSize: 10, color: '#A09D97' }}>Fällig: {fmtDatum(t.faellig_am)}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Nächste Termine */}
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                    Nächste Termine
                </div>
                {termine.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Keine bevorstehenden Termine</div>
                ) : termine.map(t => (
                    <div key={t.termin_id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,.06)',
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1917', minWidth: 60 }}>{fmtDatum(t.datum)}</div>
                        {t.zeit && <div style={{ fontSize: 12, color: '#6B6860', minWidth: 38 }}>{fmtZeit(t.zeit)}</div>}
                        <div style={{ fontSize: 12, color: '#6B6860' }}>{t.typ}</div>
                    </div>
                ))}
            </div>

            {/* Letzter Journal-Eintrag */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                    Letzter Journal-Eintrag
                </div>
                {!journal ? (
                    <div style={{ fontSize: 12, color: '#A09D97', fontStyle: 'italic' }}>Kein Eintrag vorhanden</div>
                ) : (
                    <div style={{ background: '#F5F4F0', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(0,0,0,.07)' }}>
                        <div style={{ fontSize: 10, color: '#A09D97', marginBottom: 3 }}>
                            {fmtDatum(journal.datum)} · {journal.kategorie}
                        </div>
                        <div style={{ fontSize: 12, color: '#1A1917', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                            {journal.text}
                        </div>
                    </div>
                )}
            </div>

            {/* Besprechungsnotiz */}
            <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                    Besprechungsnotiz
                </div>
                <textarea
                    value={notiz || ''}
                    onChange={e => onNotizChange(e.target.value)}
                    placeholder="Notizen zur Besprechung..."
                    rows={4}
                    style={{
                        width: '100%', fontSize: 12.5, padding: '8px 10px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0',
                        fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                        boxSizing: 'border-box', lineHeight: 1.5,
                    }}
                />
                <button
                    onClick={onSpeichereNotiz}
                    disabled={!notiz?.trim() || gespeichert}
                    style={{
                        marginTop: 6, padding: '6px 14px', fontSize: 12.5, fontWeight: 500,
                        cursor: !notiz?.trim() || gespeichert ? 'default' : 'pointer',
                        border: 'none', borderRadius: 6,
                        background: gespeichert ? '#16A34A' : (!notiz?.trim() ? '#E5E7EB' : '#2563EB'),
                        color: gespeichert ? '#fff' : (!notiz?.trim() ? '#9CA3AF' : '#fff'),
                        fontFamily: 'inherit', transition: 'background .15s',
                    }}
                >
                    {gespeichert ? 'Gespeichert ✓' : 'Notiz speichern'}
                </button>
            </div>
        </div>
    );
}

// ── Haupt-Komponente
export default function Klientenbesprechung() {
    const [klienten, setKlienten] = useState([]);
    const [laden, setLaden] = useState(true);
    const [phase, setPhase] = useState('filter');
    const [besprechungKlienten, setBesprechungKlienten] = useState([]);

    // Filter
    const [selStandort, setSelStandort] = useState('');
    const [selAbteilung, setSelAbteilung] = useState('');
    const [selGruppe, setSelGruppe] = useState('');
    const [selKF, setSelKF] = useState('');

    // Besprechungs-State
    const [aktuellerIndex, setAktuellerIndex] = useState(0);
    const [besprochen, setBesprochen] = useState({});
    const [notizen, setNotizen] = useState({});
    const [gespeichert, setGespeichert] = useState({});
    const [sichtbarN, setSichtbarN] = useState(5);

    useEffect(() => {
        client.get('/klientenbesprechung')
            .then(r => setKlienten(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    useEffect(() => {
        function berechne() {
            const verfuegbar = window.innerHeight - 56 - 100;
            const cardHoehe = 88;
            let n = Math.floor(verfuegbar / cardHoehe);
            if (n % 2 === 0) n--;
            setSichtbarN(Math.max(3, n));
        }
        berechne();
        window.addEventListener('resize', berechne);
        return () => window.removeEventListener('resize', berechne);
    }, []);

    // Dropdown-Optionen aus geladenen Daten ableiten
    const standorte = [...new Map(
        klienten.filter(k => k.standort_id).map(k => [k.standort_id, { id: k.standort_id, name: k.standort_name }])
    ).values()].sort((a, b) => a.name.localeCompare(b.name));

    const abteilungen = [...new Set(klienten.map(k => k.abteilung).filter(Boolean))].sort();
    const gruppen = [...new Set(klienten.map(k => k.gruppe).filter(Boolean))].sort();

    const kfPersonen = [...new Map(
        klienten.filter(k => k.kf_user_id).map(k => [k.kf_user_id, { id: k.kf_user_id, name: k.klientenfuehrung_name }])
    ).values()].sort((a, b) => a.name.localeCompare(b.name));

    // Gefilterte Liste (Phase 1)
    const gefiltert = klienten.filter(k => {
        if (selStandort && String(k.standort_id) !== selStandort) return false;
        if (selAbteilung && k.abteilung !== selAbteilung) return false;
        if (selGruppe && k.gruppe !== selGruppe) return false;
        if (selKF && k.kf_user_id !== selKF) return false;
        return true;
    });

    // Offene Klienten in Phase 2
    const offene = besprechungKlienten.filter(k => !besprochen[k.klient_id]);

    // Index klemmen
    useEffect(() => {
        if (offene.length > 0 && aktuellerIndex >= offene.length) {
            setAktuellerIndex(offene.length - 1);
        }
    }, [offene.length, aktuellerIndex]);

    // Auto-Wechsel zu Phase 3
    useEffect(() => {
        if (phase === 'besprechung' && besprechungKlienten.length > 0 && offene.length === 0) {
            setPhase('abschluss');
        }
    }, [offene.length, phase, besprechungKlienten.length]);

    const clampedIndex = Math.min(aktuellerIndex, Math.max(0, offene.length - 1));
    const aktuellerKlient = offene[clampedIndex] || null;

    // Karussell-Fenster
    const halfN = Math.floor(sichtbarN / 2);
    const windowStart = Math.max(0, Math.min(
        clampedIndex - halfN,
        Math.max(0, offene.length - sichtbarN)
    ));
    const sichtbareKlienten = offene.slice(windowStart, windowStart + sichtbarN);

    function starten() {
        if (gefiltert.length === 0) return;
        setBesprechungKlienten(gefiltert);
        setBesprochen({});
        setNotizen({});
        setGespeichert({});
        setAktuellerIndex(0);
        setPhase('besprechung');
    }

    function beenden() {
        setPhase('filter');
        setBesprechungKlienten([]);
        setBesprochen({});
        setNotizen({});
        setGespeichert({});
        setAktuellerIndex(0);
    }

    function markiereBesprochen(klientId) {
        setBesprochen(prev => ({ ...prev, [klientId]: true }));
    }

    function entferneBesprochen(klientId) {
        setBesprochen(prev => {
            const next = { ...prev };
            delete next[klientId];
            return next;
        });
    }

    async function speichereNotiz(klient) {
        const text = (notizen[klient.klient_id] || '').trim();
        if (!text) return;
        try {
            await client.post('/journal', {
                klient_id: klient.klient_id,
                kategorie: 'Klientenbesprechung',
                datum: new Date().toISOString().slice(0, 10),
                text,
            });
            setGespeichert(prev => ({ ...prev, [klient.klient_id]: true }));
        } catch (err) {
            console.error(err);
        }
    }

    // ─────────────────────────────────────────────────
    // PHASE 1: Filter & Auswahl
    // ─────────────────────────────────────────────────
    if (phase === 'filter') {
        return (
            <div>
                {/* Header */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Klientenbesprechung</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                        Klienten auswählen und Besprechung starten
                    </div>
                </div>

                {/* Filter */}
                <div style={{
                    background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                    borderRadius: 10, padding: '14px 16px', marginBottom: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
                }}>
                    {standorte.length > 0 && (
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#6B6860', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Standort</div>
                            <select value={selStandort} onChange={e => setSelStandort(e.target.value)} style={INPUT_S}>
                                <option value="">Alle Standorte</option>
                                {standorte.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                    {abteilungen.length > 0 && (
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#6B6860', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Abteilung</div>
                            <select value={selAbteilung} onChange={e => setSelAbteilung(e.target.value)} style={INPUT_S}>
                                <option value="">Alle Abteilungen</option>
                                {abteilungen.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    )}
                    {gruppen.length > 0 && (
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#6B6860', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Programm-Gruppe</div>
                            <select value={selGruppe} onChange={e => setSelGruppe(e.target.value)} style={INPUT_S}>
                                <option value="">Alle Gruppen</option>
                                {gruppen.map(g => <option key={g} value={g}>{GRUPPEN_LABELS[g] || g}</option>)}
                            </select>
                        </div>
                    )}
                    {kfPersonen.length > 0 && (
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#6B6860', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Klientenführung</div>
                            <select value={selKF} onChange={e => setSelKF(e.target.value)} style={INPUT_S}>
                                <option value="">Alle</option>
                                {kfPersonen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                        <button
                            onClick={starten}
                            disabled={gefiltert.length === 0 || laden}
                            style={{
                                padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: gefiltert.length > 0 ? 'pointer' : 'default',
                                border: 'none', borderRadius: 6,
                                background: gefiltert.length > 0 ? '#2563EB' : '#E5E7EB',
                                color: gefiltert.length > 0 ? '#fff' : '#9CA3AF',
                                fontFamily: 'inherit', transition: 'background .15s',
                            }}
                        >
                            Klientenbesprechung starten ({gefiltert.length})
                        </button>
                    </div>
                </div>

                {/* Tabelle */}
                {laden ? (
                    <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>
                ) : (
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(0,0,0,.09)', background: '#FAFAF9' }}>
                                    {['Name', 'Programm', 'Phase', 'Klientenführung', 'Standort'].map(h => (
                                        <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {gefiltert.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', color: '#A09D97', fontSize: 12, fontStyle: 'italic' }}>
                                            Keine aktiven Klienten für die gewählten Filter
                                        </td>
                                    </tr>
                                ) : gefiltert.map((k, i) => (
                                    <tr key={k.klient_id} style={{ borderBottom: i < gefiltert.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none' }}>
                                        <td style={{ padding: '9px 14px', fontWeight: 500 }}>
                                            {k.nachname}, {k.vorname}
                                            {k.klient_label && LABEL_FARBEN[k.klient_label] && (
                                                <span style={{
                                                    marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 10, fontWeight: 600, fontFamily: 'monospace',
                                                    background: LABEL_FARBEN[k.klient_label] + '22', color: LABEL_FARBEN[k.klient_label],
                                                    border: `1px solid ${LABEL_FARBEN[k.klient_label]}33`,
                                                }}>{k.klient_label}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '9px 14px' }}>
                                            {k.programm_name ? (
                                                <span style={{
                                                    fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 500,
                                                    background: (k.farbe_hex || '#888') + '22', color: k.farbe_hex || '#888',
                                                    border: `1px solid ${k.farbe_hex || '#888'}33`,
                                                }}>{k.programm_name}</span>
                                            ) : <span style={{ color: '#A09D97' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '9px 14px', color: '#6B6860', fontSize: 12 }}>{k.phase_label || '—'}</td>
                                        <td style={{ padding: '9px 14px', color: '#6B6860', fontSize: 12 }}>{k.klientenfuehrung_name || '—'}</td>
                                        <td style={{ padding: '9px 14px', color: '#6B6860', fontSize: 12 }}>{k.standort_name || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────
    // PHASE 2: Besprechung läuft
    // ─────────────────────────────────────────────────
    if (phase === 'besprechung') {
        const besprochenAnzahl = Object.keys(besprochen).length;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 3rem)' }}>
                {/* Mini-Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 12,
                }}>
                    <div>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>Klientenbesprechung</span>
                        <span style={{ marginLeft: 12, fontSize: 12, color: '#6B6860' }}>
                            {besprochenAnzahl} / {besprechungKlienten.length} besprochen
                        </span>
                    </div>
                    <button onClick={beenden} style={{
                        padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#6B6860',
                    }}>Abbrechen</button>
                </div>

                {/* Fortschrittsbalken */}
                <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%', borderRadius: 2, background: '#16A34A',
                        width: `${besprechungKlienten.length > 0 ? (besprochenAnzahl / besprechungKlienten.length) * 100 : 0}%`,
                        transition: 'width .3s ease',
                    }} />
                </div>

                {/* Layout: Banner links + Detail rechts */}
                <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
                    {/* Banner links */}
                    <div style={{ width: 138, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        <button
                            onClick={() => setAktuellerIndex(prev => Math.max(0, prev - 1))}
                            disabled={clampedIndex === 0}
                            style={{
                                marginBottom: 4, padding: '5px', fontSize: 14, cursor: clampedIndex > 0 ? 'pointer' : 'default',
                                border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff',
                                color: clampedIndex > 0 ? '#1A1917' : '#D1D5DB', fontFamily: 'inherit',
                            }}>▲</button>

                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            {sichtbareKlienten.map((k, i) => (
                                <BannerCard
                                    key={k.klient_id}
                                    klient={k}
                                    aktiv={windowStart + i === clampedIndex}
                                    onClick={() => setAktuellerIndex(windowStart + i)}
                                />
                            ))}
                            {offene.length === 0 && (
                                <div style={{ fontSize: 11, color: '#16A34A', textAlign: 'center', padding: 8, fontWeight: 500 }}>
                                    Alle besprochen ✓
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setAktuellerIndex(prev => Math.min(offene.length - 1, prev + 1))}
                            disabled={clampedIndex >= offene.length - 1}
                            style={{
                                marginTop: 4, padding: '5px', fontSize: 14,
                                cursor: clampedIndex < offene.length - 1 ? 'pointer' : 'default',
                                border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff',
                                color: clampedIndex < offene.length - 1 ? '#1A1917' : '#D1D5DB', fontFamily: 'inherit',
                            }}>▼</button>
                    </div>

                    {/* Detail rechts */}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                        {aktuellerKlient ? (
                            <DetailKarte
                                klient={aktuellerKlient}
                                besprochen={!!besprochen[aktuellerKlient.klient_id]}
                                onMarkiereBesprochen={() => markiereBesprochen(aktuellerKlient.klient_id)}
                                onEntferneBesprochen={() => entferneBesprochen(aktuellerKlient.klient_id)}
                                notiz={notizen[aktuellerKlient.klient_id] || ''}
                                onNotizChange={text => setNotizen(prev => ({ ...prev, [aktuellerKlient.klient_id]: text }))}
                                onSpeichereNotiz={() => speichereNotiz(aktuellerKlient)}
                                gespeichert={!!gespeichert[aktuellerKlient.klient_id]}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B6860', fontSize: 13 }}>
                                Kein Klient ausgewählt
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────
    // PHASE 3: Abschluss
    // ─────────────────────────────────────────────────
    if (phase === 'abschluss') {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                        <div style={{ fontSize: 19, fontWeight: 600 }}>Besprechung abgeschlossen</div>
                        <div style={{ fontSize: 12, color: '#16A34A', marginTop: 2, fontWeight: 500 }}>
                            Alle {besprechungKlienten.length} Klienten besprochen ✓
                        </div>
                    </div>
                    <button onClick={beenden} style={{
                        padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: 'none', borderRadius: 6, background: '#2563EB',
                        color: '#fff', fontFamily: 'inherit',
                    }}>Besprechung beenden</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                    {besprechungKlienten.map(k => {
                        const hatNotiz = !!(notizen[k.klient_id]?.trim());
                        return (
                            <div key={k.klient_id} style={{
                                background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                                borderRadius: 10, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <Initialen name={`${k.vorname} ${k.nachname}`} size={32} />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                                            {k.vorname} {k.nachname}
                                        </div>
                                        {k.programm_name && (
                                            <div style={{ fontSize: 11, color: '#6B6860' }}>{k.programm_name}</div>
                                        )}
                                    </div>
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                                        background: '#DCFCE7', color: '#16A34A',
                                    }}>✓ Besprochen</span>
                                </div>
                                {hatNotiz ? (
                                    <div style={{
                                        fontSize: 11.5, color: '#374151', lineHeight: 1.5,
                                        background: '#F5F4F0', borderRadius: 6, padding: '7px 9px',
                                        border: '1px solid rgba(0,0,0,.07)',
                                    }}>
                                        {notizen[k.klient_id]}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 11, color: '#A09D97', fontStyle: 'italic' }}>Keine Notiz erfasst</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}
