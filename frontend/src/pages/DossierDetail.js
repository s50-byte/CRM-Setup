import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import ZuweisungModal from '../components/ZuweisungModal';
import Modal from '../components/Modal';
import ExterneZuweisungModal from '../components/ExterneZuweisungModal';
import DossierFelderModal from '../components/DossierFelderModal';

const LABEL_FARBEN = {
    'LE': { bg: '#ECFDF5', color: '#15803D' },
    'TN': { bg: '#EEF3FE', color: '#1D4ED8' },
    'MA': { bg: '#F5F3FF', color: '#5B21B6' },
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

const JKAT = {
    'Standortgespräch':                 { bg: '#E0F2FE', color: '#0369A1' },
    'Job Coaching':                      { bg: '#F0FDF4', color: '#166534' },
    'Beobachtung':                       { bg: '#F5F3FF', color: '#5B21B6' },
    'Zielfortschritt':                   { bg: '#FFF7ED', color: '#9A3412' },
    'Absenz':                            { bg: '#FEF2F2', color: '#991B1B' },
    'Kommunikation zuweisende Stelle':   { bg: '#E0F2FE', color: '#075985' },
    'Externe Person':                    { bg: '#FDF4FF', color: '#7E22CE' },
    'Sonstiges':                         { bg: '#F5F4F0', color: '#6B6860' },
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

export default function DossierDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { benutzer } = useAuth();

    const [dossier, setDossier] = useState(null);
    const [journal, setJournal] = useState([]);
    const [zeitachse, setZeitachse] = useState([]);
    const [laden, setLaden] = useState(true);
    const [aktTab, setAktTab] = useState('journal');

    // Journal-Formular
    const [jKat, setJKat] = useState('Standortgespräch');
    const [jDatum, setJDatum] = useState(new Date().toISOString().slice(0, 10));
    const [jText, setJText] = useState('');
    const [jFormOpen, setJFormOpen] = useState(false);

    // Kommentar / Zeitachse
    const [kommentar, setKommentar] = useState('');

    // Ziele
    const [ziele, setZiele] = useState([]);
    const [zielInput, setZielInput] = useState('');

    // Modals
    const [zuweisungModal, setZuweisungModal] = useState(false);
    const [externeModal, setExterneModal] = useState(false);
    const [agModal, setAgModal] = useState(false);
    const [felderModal, setFelderModal] = useState(false);
    const [agListe, setAgListe] = useState([]);
    const [agAuswahl, setAgAuswahl] = useState('');

    // Programmhistorie
    const [verlaufOffen, setVerlaufOffen] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const dosRes = await client.get(`/dossiers/${id}`);
                setDossier(dosRes.data);
                setZiele(dosRes.data.ziele || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLaden(false);
            }
        }
        load();
    }, [id]);

    useEffect(() => {
        if (!dossier?.klient_id) return;
        Promise.all([
            client.get(`/journal/${dossier.klient_id}`),
        ]).then(([j]) => {
            setJournal(j.data);
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
        } catch (err) { console.error(err); }
    }

    async function addKommentar() {
        if (!kommentar.trim()) return;
        setKommentar('');
        setZeitachse(prev => [{
            titel: 'Kommentar',
            text: kommentar,
            datum: new Date().toISOString(),
            typ: 'Kommentar',
            full_name: benutzer?.full_name,
        }, ...prev]);
    }

    async function addZiel() {
        if (!zielInput.trim()) return;
        try {
            const r = await client.post(`/dossiers/${id}/ziele`, { text: zielInput.trim() });
            setZiele(prev => [...prev, r.data]);
            setZielInput('');
        } catch (err) { console.error(err); }
    }

    async function toggleZiel(ziel_id) {
        try {
            const r = await client.put(`/dossiers/${id}/ziele/${ziel_id}`);
            setZiele(prev => prev.map(z => z.ziel_id === ziel_id ? r.data : z));
        } catch (err) { console.error(err); }
    }

    async function deleteZiel(ziel_id) {
        try {
            await client.delete(`/dossiers/${id}/ziele/${ziel_id}`);
            setZiele(prev => prev.filter(z => z.ziel_id !== ziel_id));
        } catch (err) { console.error(err); }
    }

    async function oeffneAgModal() {
        client.get('/externe').then(r => {
            setAgListe(r.data.filter(p => p.typ === 'Arbeitgeber'));
            setAgAuswahl(dossier.arbeitgeber_id || '');
            setAgModal(true);
        }).catch(console.error);
    }

    async function speichernArbeitgeber() {
        try {
            await client.put(`/dossiers/${id}/arbeitgeber`, { arbeitgeber_id: agAuswahl || null });
            const r = await client.get(`/dossiers/${id}`);
            setDossier(r.data);
            setAgModal(false);
        } catch (err) { console.error(err); }
    }

    function reloadDossier() {
        client.get(`/dossiers/${id}`).then(r => {
            setDossier(r.data);
            setZiele(r.data.ziele || []);
        });
    }

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!dossier) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Dossier nicht gefunden</div>;

    const verlauf = dossier.programm_verlauf || [];
    const zugewiesen = dossier.zugewiesen || [];
    const phasen = dossier.phasen || [];

    const tageVerbleibend = (() => {
        if (!dossier.geplantes_enddatum) return null;
        const ende = new Date(dossier.geplantes_enddatum);
        const heute = new Date(); heute.setHours(0, 0, 0, 0);
        return Math.floor((ende - heute) / (1000 * 60 * 60 * 24));
    })();

    return (
        <div>
            {/* Back */}
            <button onClick={() => navigate('/dossiers')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                color: '#6B6860', cursor: 'pointer', background: 'none', border: 'none',
                marginBottom: '.875rem', fontFamily: 'inherit', padding: 0
            }}>← Alle Dossiers</button>

            {/* ── HEADER ─────────────────────────────────── */}
            <div style={{ ...CARD, padding: '1.125rem 1.25rem', marginBottom: '.875rem' }}>
                {/* Row 1: Avatar + Name + Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 11, background: '#EEF3FE',
                        color: '#1D4ED8', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0
                    }}>
                        {(dossier.vorname?.[0] || '') + (dossier.nachname?.[0] || '')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.4px', lineHeight: 1.2 }}>
                            {dossier.vorname} {dossier.nachname}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                            {dossier.phase_label && (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F5F3FF', color: '#5B21B6', border: '1px solid rgba(124,58,237,.15)', fontFamily: 'monospace' }}>
                                    {dossier.phase_label}
                                </span>
                            )}
                            {dossier.klient_label && LABEL_FARBEN[dossier.klient_label] && (
                                <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace',
                                    background: LABEL_FARBEN[dossier.klient_label].bg,
                                    color: LABEL_FARBEN[dossier.klient_label].color,
                                    border: `1px solid ${LABEL_FARBEN[dossier.klient_label].color}33`,
                                }}>{dossier.klient_label}</span>
                            )}
                            {dossier.pipeline_status && (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F5F4F0', color: '#6B6860', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace' }}>
                                    {dossier.pipeline_status}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Row 2: drei Spalten — 40% | 35% | 25% */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Linke Spalte (40%): Programm, Zuweisende Stelle, Zuweisende Person, Standort */}
                    <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Programm</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>{dossier.programm_name || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Zuweisende Stelle</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>{dossier.auftraggeber || '—'}</span>
                        </div>
                        {(dossier.zuweisende_person_vorname || dossier.zuweisende_person_nachname) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 11, color: '#6B6860' }}>Zuweisende Person</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>
                                    {dossier.zuweisende_person_vorname} {dossier.zuweisende_person_nachname}
                                    {dossier.zuweisende_person_firma && <span style={{ fontWeight: 400, color: '#6B6860' }}> · {dossier.zuweisende_person_firma}</span>}
                                </span>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Standort</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>{dossier.standort_name || '—'}</span>
                        </div>
                    </div>

                    {/* Mittlere Spalte (35%): Pensum, Start, Ende, Arbeitsort */}
                    <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Pensum</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>{dossier.pensum_pct ? `${dossier.pensum_pct}%` : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Start</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>{fmt(dossier.laufend_start_datum)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Ende (geplant)</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>{fmt(dossier.geplantes_enddatum)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: '#6B6860' }}>Arbeitsort</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1917' }}>
                                {dossier.abteilung
                                    ? `Intern: ${dossier.abteilung}`
                                    : dossier.arbeitgeber_firma
                                    ? `Extern: ${dossier.arbeitgeber_firma}`
                                    : '—'}
                            </span>
                        </div>
                    </div>

                    {/* Rechte Spalte (25%): Buttons */}
                    <div style={{ flex: '0 0 25%', display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-start' }}>
                        <button onClick={() => { setJFormOpen(true); setAktTab('journal'); }} style={{
                            minWidth: 160, padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                            cursor: 'pointer', border: 'none', borderRadius: 6,
                            background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>+ Journal-Eintrag</button>
                        <button onClick={() => setFelderModal(true)} style={{
                            minWidth: 160, padding: '7px 14px', fontSize: 12.5,
                            cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                            background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                        }}>Arbeitsort ändern</button>
                        <button onClick={() => navigate(`/klienten/${dossier.klient_id}`)} style={{
                            minWidth: 160, padding: '7px 14px', fontSize: 12.5,
                            cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                            background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                        }}>Stammdaten →</button>
                    </div>
                </div>

                {/* Warn-Banner */}
                {tageVerbleibend !== null && tageVerbleibend < 28 && (
                    <div style={{
                        marginTop: 12, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: tageVerbleibend < 14 ? '#FEF2F2' : '#FFFBEB',
                        color: tageVerbleibend < 14 ? '#B91C1C' : '#B45309',
                        border: `1px solid ${tageVerbleibend < 14 ? 'rgba(220,38,38,.2)' : 'rgba(217,119,6,.2)'}`,
                    }}>
                        ⚠ {tageVerbleibend < 0
                            ? 'Programmende überschritten'
                            : tageVerbleibend < 14
                            ? `Programmende in ${tageVerbleibend} Tag${tageVerbleibend === 1 ? '' : 'en'} — Abschlussbericht fällig`
                            : `Programmende in ${Math.ceil(tageVerbleibend / 7)} Woche${Math.ceil(tageVerbleibend / 7) === 1 ? '' : 'n'}`}
                    </div>
                )}
            </div>

            {/* ── PHASEN-STEPPER ──────────────────────────── */}
            {phasen.length > 0 && (
                <div style={{ ...CARD, padding: '.875rem 1.25rem', marginBottom: '.875rem' }}>
                    <div style={{ ...SECTION_HDR, marginBottom: '.625rem' }}>Aktuelle Phase</div>
                    <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 4 }}>
                        {phasen.map((ph, i, arr) => {
                            const currentIdx = arr.findIndex(p => p.phase_id === dossier.akt_phase_id);
                            const done = i < currentIdx;
                            const active = i === currentIdx;
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
                                        background: done ? '#16A34A' : active ? '#2563EB' : '#fff',
                                        border: `2px solid ${done ? '#16A34A' : active ? '#2563EB' : '#E3E1DA'}`,
                                        color: done || active ? '#fff' : '#A09D97',
                                        boxShadow: active ? '0 0 0 4px rgba(37,99,235,.15)' : 'none',
                                        transition: 'all .15s',
                                    }}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <div style={{
                                        fontSize: 9, fontWeight: active ? 600 : 500, marginTop: 5,
                                        textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
                                        color: done ? '#15803D' : active ? '#2563EB' : '#A09D97',
                                    }}>{ph.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── ZWEISPALTEN-LAYOUT ──────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1rem', marginBottom: '.875rem' }}>

                {/* LINKE SPALTE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem', minWidth: 0 }}>

                    {/* Ziele */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ padding: '.65rem 1rem', borderBottom: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={SECTION_HDR}>◎ Ziele aus Vereinbarung</span>
                            {ziele.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#ECFDF5', color: '#15803D', border: '1px solid rgba(22,163,74,.15)', fontFamily: 'monospace', marginLeft: 6 }}>
                                    {ziele.filter(z => z.erreicht).length}/{ziele.length}
                                </span>
                            )}
                        </div>
                        <div style={{ padding: '1rem' }}>
                            {ziele.map(z => (
                                <div key={z.ziel_id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                                    <div onClick={() => toggleZiel(z.ziel_id)} style={{
                                        width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                                        border: z.erreicht ? 'none' : '1.5px solid rgba(0,0,0,.15)',
                                        background: z.erreicht ? '#16A34A' : '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9
                                    }}>{z.erreicht ? '✓' : ''}</div>
                                    <span onClick={() => toggleZiel(z.ziel_id)} style={{
                                        flex: 1, fontSize: 12.5, cursor: 'pointer',
                                        textDecoration: z.erreicht ? 'line-through' : 'none',
                                        color: z.erreicht ? '#A09D97' : '#1A1917',
                                    }}>{z.text}</span>
                                    {z.erreicht_am && (
                                        <span style={{ fontSize: 10.5, color: '#A09D97', fontFamily: 'monospace', flexShrink: 0 }}>
                                            {fmt(z.erreicht_am)}
                                        </span>
                                    )}
                                    <button onClick={() => deleteZiel(z.ziel_id)} style={{
                                        width: 22, height: 22, flexShrink: 0, border: '1px solid rgba(220,38,38,.2)',
                                        borderRadius: 5, background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer',
                                        fontSize: 13, lineHeight: 1, fontFamily: 'inherit', padding: 0
                                    }}>×</button>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: 7, marginTop: ziele.length > 0 ? 10 : 0 }}>
                                <input
                                    value={zielInput} onChange={e => setZielInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addZiel()}
                                    placeholder="Neues Ziel eingeben…"
                                    style={{ flex: 1, fontSize: 12.5, padding: '6px 10px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, fontFamily: 'inherit', outline: 'none' }}
                                />
                                <button onClick={addZiel} style={{ padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}>+</button>
                            </div>
                        </div>
                    </div>

                    {/* Zeitachse & Journal Tabs */}
                    <div style={{ ...CARD, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.09)' }}>
                            {['journal', 'zeitachse'].map(tab => (
                                <button key={tab} onClick={() => setAktTab(tab)} style={{
                                    padding: '.65rem 1.25rem', fontSize: 12, fontWeight: aktTab === tab ? 600 : 400,
                                    cursor: 'pointer', border: 'none', background: 'transparent',
                                    color: aktTab === tab ? '#2563EB' : '#6B6860',
                                    borderBottom: aktTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                                    fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.05em',
                                }}>
                                    {tab === 'journal' ? '📓 Journal' : '⟳ Zeitachse'}
                                </button>
                            ))}
                        </div>

                        <div style={{ padding: '1rem' }}>
                            {/* Journal Tab */}
                            {aktTab === 'journal' && (
                                <div>
                                    {!jFormOpen ? (
                                        <button onClick={() => setJFormOpen(true)} style={{
                                            width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12.5,
                                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0',
                                            color: '#6B6860', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12
                                        }}>+ Neuer Journal-Eintrag…</button>
                                    ) : (
                                        <div style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
                                            <div style={{ display: 'flex', gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
                                                <select value={jKat} onChange={e => setJKat(e.target.value)} style={{ flex: 1, minWidth: 160, fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', fontFamily: 'inherit' }}>
                                                    {Object.keys(JKAT).map(k => <option key={k}>{k}</option>)}
                                                </select>
                                                <input type="date" value={jDatum} onChange={e => setJDatum(e.target.value)} style={{ flex: '0 0 130px', fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff' }} />
                                            </div>
                                            <textarea value={jText} onChange={e => setJText(e.target.value)} placeholder="Notiz erfassen…" style={{ width: '100%', fontSize: 12, padding: '7px 9px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', minHeight: 70, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', marginBottom: 7, boxSizing: 'border-box' }} />
                                            <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                                                <button onClick={() => setJFormOpen(false)} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>Abbrechen</button>
                                                <button onClick={addJournal} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', border: 'none', borderRadius: 5, background: '#2563EB', color: '#fff', fontFamily: 'inherit' }}>Speichern</button>
                                            </div>
                                        </div>
                                    )}
                                    {journal.length === 0 ? (
                                        <div style={{ fontSize: 12, color: '#6B6860' }}>Noch keine Journal-Einträge</div>
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
                            )}

                            {/* Zeitachse Tab */}
                            {aktTab === 'zeitachse' && (
                                <div>
                                    <div style={{ display: 'flex', gap: 7, marginBottom: '1rem' }}>
                                        <input
                                            type="text" value={kommentar}
                                            onChange={e => setKommentar(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addKommentar()}
                                            placeholder="Aktivität hinzufügen… (Enter)"
                                            style={{ flex: 1, fontSize: 13, padding: '6px 11px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0', fontFamily: 'inherit', outline: 'none' }}
                                        />
                                        <button onClick={addKommentar} style={{ padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit' }}>Senden</button>
                                    </div>
                                    {zeitachse.length === 0 ? (
                                        <div style={{ fontSize: 12, color: '#6B6860' }}>Noch keine Einträge</div>
                                    ) : zeitachse.map((e, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EEF3FE', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 1 }}>✦</div>
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 500 }}>{e.titel}</div>
                                                <div style={{ fontSize: 10.5, color: '#6B6860', marginTop: 1 }}>{fmt(e.datum)} · {e.full_name}</div>
                                                {e.text && <div style={{ fontSize: 11, color: '#6B6860', background: '#F5F4F0', borderRadius: 6, padding: '6px 9px', marginTop: 5, borderLeft: '3px solid rgba(0,0,0,.09)' }}>{e.text}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RECHTE SPALTE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>

                    {/* Zugewiesene Kader */}
                    <div style={{ ...CARD, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                            <span style={SECTION_HDR}>Zugewiesene Kader</span>
                            <button onClick={() => setZuweisungModal(true)} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#2563EB', fontWeight: 500 }}>+ Person</button>
                        </div>
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
                    <div style={{ ...CARD, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                            <span style={SECTION_HDR}>Externe Personen</span>
                            <button onClick={() => setExterneModal(true)} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#2563EB', fontWeight: 500 }}>+ Person</button>
                        </div>
                        {(dossier.externe_personen || []).length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Keine externen Personen</div>
                        ) : (dossier.externe_personen || []).map((p, i) => {
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

                    {/* Klientendaten kompakt */}
                    <div style={{ ...CARD, padding: '1rem' }}>
                        <div style={{ ...SECTION_HDR, marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>Klientendaten</div>
                        {[
                            { label: 'Telefon',      value: dossier.telefon },
                            { label: 'E-Mail',       value: dossier.email },
                            { label: 'Geburtsdatum', value: dossier.geburtsdatum ? fmt(dossier.geburtsdatum) : null },
                            { label: 'AHV-Nr.',      value: dossier.ahv_nummer },
                        ].filter(f => f.value).map((f, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                                <span style={{ color: '#6B6860', width: 90, flexShrink: 0 }}>{f.label}</span>
                                <span style={{ fontWeight: 500, wordBreak: 'break-all' }}>{f.value}</span>
                            </div>
                        ))}
                        {!dossier.telefon && !dossier.email && !dossier.geburtsdatum && !dossier.ahv_nummer && (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Keine Kontaktdaten</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── PROGRAMMHISTORIE (aufklappbar) ─────────── */}
            {verlauf.length > 0 && (
                <div style={{ ...CARD, overflow: 'hidden', marginBottom: '.875rem' }}>
                    <button
                        onClick={() => setVerlaufOffen(v => !v)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '.75rem 1rem',
                            border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                            borderBottom: verlaufOffen ? '1px solid rgba(0,0,0,.05)' : 'none',
                        }}
                    >
                        <span style={{ ...SECTION_HDR, flex: 1, textAlign: 'left' }}>
                            ⟳ Programmhistorie
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)', fontFamily: 'monospace', color: '#6B6860' }}>
                            {verlauf.length} Programm{verlauf.length !== 1 ? 'e' : ''}
                        </span>
                        <span style={{ fontSize: 13, color: '#A09D97', transform: verlaufOffen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
                    </button>

                    {verlaufOffen && (
                        <div style={{ padding: '0 1rem 1rem' }}>
                            {verlauf.map((v, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < verlauf.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.farbe_hex, flexShrink: 0, boxShadow: v.status === 'Laufend' ? `0 0 0 3px ${v.farbe_hex}33` : 'none' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{v.programm_name}</div>
                                        <div style={{ fontSize: 11, color: '#6B6860' }}>
                                            {fmt(v.start_datum)} – {v.end_datum ? fmt(v.end_datum) : 'laufend'}
                                            {v.geplantes_enddatum && !v.end_datum && (
                                                <span style={{ color: '#A09D97' }}> (geplant {fmt(v.geplantes_enddatum)})</span>
                                            )}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 11, padding: '2px 7px', borderRadius: 20, fontFamily: 'monospace',
                                        background: v.status === 'Laufend' ? '#ECFDF5' : v.status === 'Geplant' ? '#EEF3FE' : '#F5F4F0',
                                        color: v.status === 'Laufend' ? '#15803D' : v.status === 'Geplant' ? '#1D4ED8' : '#6B6860',
                                        border: `1px solid ${v.status === 'Laufend' ? 'rgba(22,163,74,.15)' : v.status === 'Geplant' ? 'rgba(37,99,235,.15)' : 'rgba(0,0,0,.09)'}`,
                                    }}>{v.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── MODALS ──────────────────────────────────── */}
            <ZuweisungModal
                open={zuweisungModal}
                onClose={() => setZuweisungModal(false)}
                dossierId={id}
                zugewiesen={zugewiesen}
                standortKuerzel={dossier.standort_kuerzel}
                onSaved={() => { setZuweisungModal(false); reloadDossier(); }}
            />

            <ExterneZuweisungModal
                open={externeModal}
                onClose={() => setExterneModal(false)}
                dossierId={id}
                zugewieseneExterne={dossier.externe_personen || []}
                onSaved={() => { setExterneModal(false); reloadDossier(); }}
            />

            <DossierFelderModal
                open={felderModal}
                onClose={() => setFelderModal(false)}
                dossierId={id}
                dossier={dossier}
                onSaved={() => { setFelderModal(false); reloadDossier(); }}
            />

            <Modal open={agModal} onClose={() => setAgModal(false)} title="Arbeitgeber / Partnerfirma zuweisen" width={480}>
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                        Arbeitgeber (Typ: Arbeitgeber)
                    </label>
                    <select value={agAuswahl} onChange={e => setAgAuswahl(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', fontFamily: 'inherit' }}>
                        <option value="">— Kein Arbeitgeber —</option>
                        {agListe.map(p => (
                            <option key={p.person_id} value={p.person_id}>
                                {p.firma ? `${p.firma} (${p.vorname} ${p.nachname})` : `${p.vorname} ${p.nachname}`}
                            </option>
                        ))}
                    </select>
                    {agListe.length === 0 && (
                        <div style={{ fontSize: 11.5, color: '#A09D97', marginTop: 6 }}>Keine externen Personen vom Typ "Arbeitgeber" vorhanden.</div>
                    )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setAgModal(false)} style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#6B6860' }}>Abbrechen</button>
                    <button onClick={speichernArbeitgeber} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit' }}>Speichern</button>
                </div>
            </Modal>
        </div>
    );
}
