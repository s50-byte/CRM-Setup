import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import ZuweisungModal from '../components/ZuweisungModal';
import ExterneZuweisungModal from '../components/ExterneZuweisungModal';
import DossierFelderModal from '../components/DossierFelderModal';
import FerienModal from '../components/FerienModal';
import VerfuegungModal from '../components/VerfuegungModal';
import JournalModal from '../components/JournalModal';
import NeuerTerminModal from '../components/NeuerTerminModal';


const LABEL_FARBEN = {
    'LE': { bg: '#ECFDF5', color: '#15803D' },
    'TN': { bg: '#EEF3FE', color: '#1D4ED8' },
    'MA': { bg: '#F5F3FF', color: '#5B21B6' },
};

const INTAKE_BUCKETS = [
    { key: 'vorabklaerung',          label: 'Vorabklärung' },
    { key: 'berufsmassnahmen',       label: 'Berufsmassnahmen' },
    { key: 'integrationsmassnahmen', label: 'Integrationsmassnahmen' },
    { key: 'beratung_coaching',      label: 'Beratung & Coaching' },
    { key: 'programmstart',          label: 'Programmstart' },
];

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

const SELECT_STYLE = {
    fontSize: 12.5, padding: '5px 8px', border: '1px solid rgba(0,0,0,.13)',
    borderRadius: 5, background: '#fff', fontFamily: 'inherit', minWidth: 170, outline: 'none',
};

const BERUF_OPTIONEN_M = ['Informatiker', 'ICT-Fachmann', 'Kaufmann', 'Logistiker', 'Kundendialog-Spezialist'];
const BERUF_OPTIONEN_F = ['Informatikerin', 'ICT-Fachfrau', 'Kauffrau', 'Logistikerin', 'Kundendialog-Spezialistin'];
const FACHRICHTUNG_OPTIONEN = ['Applikationsentwicklung (API)', 'Plattformentwicklung (PFE)'];

function abschlussOptionen(beruf) {
    if (!beruf) return [];
    if (beruf === 'Kaufmann' || beruf === 'Kauffrau' || beruf === 'Logistiker' || beruf === 'Logistikerin') {
        return ['EFZ', 'EBA'];
    }
    return ['EFZ'];
}

function lehrjahrOptionen(beruf, abschluss) {
    if (!beruf || !abschluss) return [];
    if (abschluss === 'EBA') return ['1. Lehrjahr', '2. Lehrjahr'];
    const jahre = (beruf === 'Informatiker' || beruf === 'Informatikerin') ? 4 : 3;
    return Array.from({ length: jahre }, (_, i) => `${i + 1}. Lehrjahr`);
}

function fmtDauer(min) {
    if (!min) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}:${m.toString().padStart(2, '0')}h`;
}

function fmt(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-CH');
}

function TaggeldToggle({ wert, gesperrt, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 10.5, color: '#A09D97', whiteSpace: 'nowrap' }}>Taggeldabrechnung</span>
            <div style={{
                display: 'flex', borderRadius: 20, background: '#F5F4F0', padding: 2,
                border: '1px solid rgba(0,0,0,.09)', opacity: gesperrt ? .6 : 1,
            }}>
                {['intern', 'extern'].map(opt => (
                    <button
                        key={opt}
                        disabled={gesperrt}
                        onClick={() => onChange(opt)}
                        style={{
                            padding: '3px 10px', fontSize: 11, fontWeight: 500, border: 'none', borderRadius: 18,
                            cursor: gesperrt ? 'default' : 'pointer', fontFamily: 'inherit',
                            background: wert === opt ? '#2563EB' : 'transparent',
                            color: wert === opt ? '#fff' : '#6B6860',
                        }}
                    >{opt}</button>
                ))}
            </div>
        </div>
    );
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

    const [journalModal, setJournalModal] = useState(false);

    // Kommentar / Zeitachse
    const [kommentar, setKommentar] = useState('');

    // Ziele
    const [ziele, setZiele] = useState([]);
    const [zielInput, setZielInput] = useState('');
    const [zielFehler, setZielFehler] = useState('');

    const [termine, setTermine] = useState([]);

    // Modals
    const [zuweisungModal, setZuweisungModal] = useState(false);
    const [externeModal, setExterneModal] = useState(false);
    const [felderModal, setFelderModal] = useState(false);
    const [ferienModal, setFerienModal] = useState(false);
    const [terminModal, setTerminModal] = useState(false);
    const [detailTermin, setDetailTermin] = useState(null);

    // Programmhistorie
    const [verlaufOffen, setVerlaufOffen] = useState(false);

    // Ausbildung
    const [ausbildung, setAusbildung] = useState({ beruf: '', abschluss: '', fachrichtung: '', lehrjahr: '' });
    const [ausbildungSpeichern, setAusbildungSpeichern] = useState(false);
    const [ausbildungGespeichert, setAusbildungGespeichert] = useState(false);

    // Programmende (geplant)
    const [endeBearbeiten, setEndeBearbeiten] = useState(false);

    // Verfügungen
    const [verfuegungen, setVerfuegungen] = useState([]);
    const [verfuegungModal, setVerfuegungModal] = useState(false);
    const [gewaehlteVerfuegung, setGewaehlteVerfuegung] = useState(null);
    const [abgeschlosseneOffen, setAbgeschlosseneOffen] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const dosRes = await client.get(`/dossiers/${id}`);
                setDossier(dosRes.data);
                setZiele(dosRes.data.ziele || []);
                setAusbildung({
                    beruf:        dosRes.data.ausbildung_beruf || '',
                    abschluss:    dosRes.data.ausbildung_abschluss || '',
                    fachrichtung: dosRes.data.ausbildung_fachrichtung || '',
                    lehrjahr:     dosRes.data.ausbildung_lehrjahr || '',
                });
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
            client.get(`/termine?klient_id=${dossier.klient_id}`),
        ]).then(([j, t]) => {
            setJournal(j.data);
            setTermine(t.data);
        }).catch(console.error);
    }, [dossier?.klient_id]);

    useEffect(() => {
        client.get(`/verfuegungen/${id}`).then(r => setVerfuegungen(r.data)).catch(console.error);
    }, [id]);

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
        setZielFehler('');
        try {
            const r = await client.post(`/dossiers/${id}/ziele`, { text: zielInput.trim() });
            setZiele(prev => [...prev, r.data]);
            setZielInput('');
        } catch (err) {
            console.error(err);
            setZielFehler(err.response?.data?.error || 'Fehler beim Erstellen des Ziels.');
        }
    }

    async function toggleZiel(ziel_id) {
        setZielFehler('');
        try {
            const r = await client.put(`/dossiers/${id}/ziele/${ziel_id}`);
            setZiele(prev => prev.map(z => z.ziel_id === ziel_id ? r.data : z));
        } catch (err) {
            console.error(err);
            setZielFehler(err.response?.data?.error || 'Fehler beim Aktualisieren des Ziels.');
        }
    }

    async function deleteZiel(ziel_id) {
        setZielFehler('');
        try {
            await client.delete(`/dossiers/${id}/ziele/${ziel_id}`);
            setZiele(prev => prev.filter(z => z.ziel_id !== ziel_id));
        } catch (err) {
            console.error(err);
            setZielFehler(err.response?.data?.error || 'Fehler beim Löschen des Ziels.');
        }
    }

    function reloadVerfuegungen() {
        client.get(`/verfuegungen/${id}`).then(r => setVerfuegungen(r.data)).catch(console.error);
    }

    function loadTermine() {
        if (!dossier?.klient_id) return;
        client.get(`/termine?klient_id=${dossier.klient_id}`)
            .then(r => setTermine(r.data))
            .catch(console.error);
    }

    function reloadDossier() {
        client.get(`/dossiers/${id}`).then(r => {
            setDossier(r.data);
            setZiele(r.data.ziele || []);
            setAusbildung({
                beruf:        r.data.ausbildung_beruf || '',
                abschluss:    r.data.ausbildung_abschluss || '',
                fachrichtung: r.data.ausbildung_fachrichtung || '',
                lehrjahr:     r.data.ausbildung_lehrjahr || '',
            });
        });
    }

    function handleBerufChange(beruf) {
        const abschlussOpts = abschlussOptionen(beruf);
        const abschluss = abschlussOpts.includes(ausbildung.abschluss) ? ausbildung.abschluss : '';
        const zeigtFachrichtung = beruf === 'Informatiker' || beruf === 'Informatikerin';
        const fachrichtung = zeigtFachrichtung ? ausbildung.fachrichtung : '';
        const lehrjahrOpts = lehrjahrOptionen(beruf, abschluss);
        const lehrjahr = lehrjahrOpts.includes(ausbildung.lehrjahr) ? ausbildung.lehrjahr : '';
        setAusbildung({ beruf, abschluss, fachrichtung, lehrjahr });
    }

    function handleAbschlussChange(abschluss) {
        const lehrjahrOpts = lehrjahrOptionen(ausbildung.beruf, abschluss);
        const lehrjahr = lehrjahrOpts.includes(ausbildung.lehrjahr) ? ausbildung.lehrjahr : '';
        setAusbildung(a => ({ ...a, abschluss, lehrjahr }));
    }

    async function speichernEnddatum(wert) {
        setEndeBearbeiten(false);
        const aktuell = dossier.geplantes_enddatum ? dossier.geplantes_enddatum.slice(0, 10) : '';
        if ((wert || '') === aktuell) return;
        try {
            await client.put(`/dossiers/${id}/felder`, { geplantes_enddatum: wert || null });
            reloadDossier();
        } catch (err) { console.error(err); }
    }

    async function speichernAusbildung() {
        setAusbildungSpeichern(true);
        try {
            const body = {
                ausbildung_beruf: ausbildung.beruf || null,
                ausbildung_abschluss: ausbildung.abschluss || null,
                ausbildung_fachrichtung: ausbildung.fachrichtung || null,
                ausbildung_lehrjahr: ausbildung.lehrjahr || null,
            };
            console.log('speichernAusbildung – ausbildung State:', ausbildung);
            console.log('speichernAusbildung – Request Body:', body);
            await client.put(`/dossiers/${id}/felder`, body);
            reloadDossier();
            setAusbildungGespeichert(true);
            setTimeout(() => setAusbildungGespeichert(false), 2500);
        } catch (err) {
            console.error(err);
        } finally {
            setAusbildungSpeichern(false);
        }
    }

    async function speichernTaggeld(wert) {
        if (wert === dossier.taggeld_abrechnung) return;
        try {
            await client.put(`/dossiers/${id}/felder`, { taggeld_abrechnung: wert });
            reloadDossier();
        } catch (err) { console.error(err); }
    }

    if (laden) return <div style={{ padding: '2rem', color: '#6B6860', fontSize: 13 }}>Laden…</div>;
    if (!dossier) return <div style={{ padding: '2rem', color: '#B91C1C', fontSize: 13 }}>Dossier nicht gefunden</div>;

    const verlauf = dossier.programm_verlauf || [];
    const zugewiesen = dossier.zugewiesen || [];
    const phasen = dossier.phasen || [];
    const hatAktiveVerfuegung = verfuegungen.some(v => v.status === 'aktiv');
    const zeigeIntakeStepper = !dossier.intake_abgeschlossen && !hatAktiveVerfuegung;

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
            <div style={{ ...CARD, padding: '1rem 1.25rem', marginBottom: '.875rem' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                        width: 44, height: 44, borderRadius: 11, background: '#EEF3FE',
                        color: '#1D4ED8', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0, marginTop: 2
                    }}>
                        {(dossier.vorname?.[0] || '') + (dossier.nachname?.[0] || '')}
                    </div>

                    {/* Name + Badges + Buttons */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px', lineHeight: 1.2 }}>
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
                        <div style={{ marginTop: 9 }}>
                            <TaggeldToggle
                                wert={dossier.abteilung ? 'intern' : dossier.taggeld_abrechnung}
                                gesperrt={!!dossier.abteilung}
                                onChange={speichernTaggeld}
                            />
                        </div>
                        {/* Buttons horizontal, kompakt */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                            <button onClick={() => setJournalModal(true)} style={{
                                padding: '5px 12px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                                cursor: 'pointer', border: 'none', borderRadius: 5,
                                background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                            }}>+ Journal-Eintrag</button>
                            <button onClick={() => setFelderModal(true)} style={{
                                padding: '5px 12px', fontSize: 12, whiteSpace: 'nowrap',
                                cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                            }}>Arbeitsort ändern</button>
                            <button onClick={() => navigate('/praesenz?klient_id=' + dossier.klient_id + '&ansicht=verlauf&tage=7')} style={{
                                padding: '5px 12px', fontSize: 12, whiteSpace: 'nowrap',
                                cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                            }}>Präsenzverlauf</button>
                            <button onClick={() => setFerienModal(true)} style={{
                                padding: '5px 12px', fontSize: 12, whiteSpace: 'nowrap',
                                cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                background: '#fff', fontFamily: 'inherit', color: '#1A1917'
                            }}>Ferien erfassen</button>
                            <button onClick={() => navigate(`/klienten/${dossier.klient_id}`)} style={{
                                padding: '5px 12px', fontSize: 12, whiteSpace: 'nowrap',
                                cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5,
                                background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                            }}>Stammdaten →</button>
                        </div>
                    </div>

                    {/* Info-Grid zweispaltig, rechts */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '7px 20px' }}>
                            {[
                                { label: 'Programm',          value: dossier.programm_name },
                                { label: 'Pensum',             value: dossier.pensum_pct ? `${dossier.pensum_pct}%` : null },
                                { label: 'Zuweisende Stelle',  value: dossier.auftraggeber },
                                { label: 'Start',              value: dossier.laufend_start_datum ? fmt(dossier.laufend_start_datum) : null },
                                (dossier.zuweisende_person_nachname
                                    ? { label: 'Zuweisende Person', value: `${dossier.zuweisende_person_vorname || ''} ${dossier.zuweisende_person_nachname}`.trim() + (dossier.zuweisende_person_firma ? ` · ${dossier.zuweisende_person_firma}` : '') }
                                    : null),
                                { label: 'Ende (geplant)',     value: dossier.geplantes_enddatum ? fmt(dossier.geplantes_enddatum) : null, key: 'enddatum' },
                                { label: 'Standort',           value: dossier.standort_name },
                                { label: 'Arbeitsort',         value: dossier.abteilung ? `Intern: ${dossier.abteilung}` : dossier.arbeitgeber_firma ? `Extern: ${dossier.arbeitgeber_firma}` : null },
                            ].filter(Boolean).map((f, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <span style={{ fontSize: 10.5, color: '#A09D97', whiteSpace: 'nowrap' }}>{f.label}</span>
                                    {f.key === 'enddatum' ? (
                                        endeBearbeiten ? (
                                            <input
                                                type="date"
                                                autoFocus
                                                defaultValue={dossier.geplantes_enddatum ? dossier.geplantes_enddatum.slice(0, 10) : ''}
                                                onBlur={e => speichernEnddatum(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') e.target.blur();
                                                    if (e.key === 'Escape') setEndeBearbeiten(false);
                                                }}
                                                style={{ fontSize: 12, padding: '1px 4px', border: '1px solid rgba(0,0,0,.13)', borderRadius: 4, fontFamily: 'inherit', color: '#1A1917' }}
                                            />
                                        ) : (
                                            <span onClick={() => setEndeBearbeiten(true)} style={{ fontSize: 12, color: '#1A1917', whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '1px dashed #C7C4BC' }}>
                                                {f.value || '—'}
                                            </span>
                                        )
                                    ) : (
                                        <span style={{ fontSize: 12, color: '#1A1917', whiteSpace: 'nowrap' }}>{f.value || '—'}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        {/* SOLL/IST-Aufwand — nur wenn aktive Verfügung mit Positionen und SOLL-Stunden */}
                        {verfuegungen.some(v => v.status === 'aktiv' && v.soll_stunden_total != null) && (() => {
                            const ist = parseFloat(dossier.ist_total) || 0;
                            const soll = parseFloat(dossier.soll_total) || 0;
                            const verr = parseFloat(dossier.ist_verrechenbar) || 0;
                            const nverr = parseFloat(dossier.ist_nicht_verrechenbar) || 0;
                            const istFarbe = soll > 0 ? (ist < soll ? '#15803D' : ist > soll ? '#B91C1C' : '#1A1917') : '#1A1917';
                            return (
                                <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 6 }}>
                                    <span style={{ fontSize: 10.5, color: '#A09D97', display: 'block', marginBottom: 2 }}>Aufwand</span>
                                    <span style={{ fontSize: 12, color: '#1A1917', whiteSpace: 'nowrap' }}>
                                        SOLL: {soll.toFixed(1)}h / <span style={{ color: istFarbe }}>IST: {ist.toFixed(1)}h</span>
                                        <span style={{ color: '#9CA3AF', fontSize: 10.5 }}> (verr. {verr.toFixed(1)} + n.v. {nverr.toFixed(1)}h)</span>
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Ausbildung */}
                {(dossier.programm_name === 'Erstmalige berufliche Ausbildung' || dossier.programm_name === 'Gezielte Vorbereitung') && (() => {
                    const berufOptionen = dossier.anrede === 'Frau' ? BERUF_OPTIONEN_F : BERUF_OPTIONEN_M;
                    const zeigtFachrichtung = ausbildung.beruf === 'Informatiker' || ausbildung.beruf === 'Informatikerin';
                    const voraussichtlich = dossier.programm_name === 'Gezielte Vorbereitung';
                    return (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                            <div style={{ ...SECTION_HDR, marginBottom: 8 }}>
                                Ausbildung{voraussichtlich && <span style={{ textTransform: 'none', fontWeight: 400, color: '#A09D97', letterSpacing: 0 }}> (Voraussichtlich)</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <label style={{ fontSize: 10.5, color: '#A09D97' }}>Beruf</label>
                                    <select value={ausbildung.beruf} onChange={e => handleBerufChange(e.target.value)} style={SELECT_STYLE}>
                                        <option value="">— Wählen —</option>
                                        {berufOptionen.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <label style={{ fontSize: 10.5, color: '#A09D97' }}>Abschluss</label>
                                    <select value={ausbildung.abschluss} onChange={e => handleAbschlussChange(e.target.value)} disabled={!ausbildung.beruf} style={SELECT_STYLE}>
                                        <option value="">— Wählen —</option>
                                        {abschlussOptionen(ausbildung.beruf).map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                {zeigtFachrichtung && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <label style={{ fontSize: 10.5, color: '#A09D97' }}>Fachrichtung</label>
                                        <select value={ausbildung.fachrichtung} onChange={e => setAusbildung(a => ({ ...a, fachrichtung: e.target.value }))} style={SELECT_STYLE}>
                                            <option value="">— Wählen —</option>
                                            {FACHRICHTUNG_OPTIONEN.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <label style={{ fontSize: 10.5, color: '#A09D97' }}>Lehrjahr</label>
                                    <select value={ausbildung.lehrjahr} onChange={e => setAusbildung(a => ({ ...a, lehrjahr: e.target.value }))} disabled={!ausbildung.abschluss} style={SELECT_STYLE}>
                                        <option value="">— Wählen —</option>
                                        {lehrjahrOptionen(ausbildung.beruf, ausbildung.abschluss).map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <button onClick={speichernAusbildung} disabled={ausbildungSpeichern} style={{
                                    padding: '6px 14px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                                    cursor: ausbildungSpeichern ? 'default' : 'pointer', border: 'none', borderRadius: 5,
                                    background: ausbildungSpeichern ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit'
                                }}>{ausbildungSpeichern ? 'Speichern…' : 'Speichern'}</button>
                                {ausbildungGespeichert && <span style={{ fontSize: 12.5, color: '#16A34A' }}>Gespeichert ✓</span>}
                            </div>
                        </div>
                    );
                })()}

                {/* Warn-Banner */}
                {tageVerbleibend !== null && tageVerbleibend < 28 && (
                    <div style={{
                        marginTop: 10, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
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

            {/* ── INTAKE-STEPPER ─────────────────────────── */}
            {zeigeIntakeStepper && (
                <div style={{ ...CARD, padding: '.875rem 1.25rem', marginBottom: '.875rem' }}>
                    <div style={{ ...SECTION_HDR, marginBottom: '.625rem' }}>Intake-Status</div>
                    <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 4 }}>
                        {INTAKE_BUCKETS.map((b, i, arr) => {
                            const currentIdx = arr.findIndex(x => x.key === dossier.pipeline_status);
                            const done = i < currentIdx;
                            const active = i === currentIdx;
                            return (
                                <div
                                    key={b.key}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 68, position: 'relative' }}
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
                                    }}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <div style={{
                                        fontSize: 9, fontWeight: active ? 600 : 500, marginTop: 5,
                                        textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
                                        color: done ? '#15803D' : active ? '#2563EB' : '#A09D97',
                                    }}>{b.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── PHASEN-STEPPER ──────────────────────────── */}
            {phasen.length > 0 && hatAktiveVerfuegung && (
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
                            {zielFehler && (
                                <div style={{ fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid rgba(185,28,28,.15)', borderRadius: 6, padding: '6px 10px', marginTop: ziele.length > 0 ? 10 : 0 }}>
                                    {zielFehler}
                                </div>
                            )}
                            {dossier?.akt_verlauf_id ? (
                                <div style={{ display: 'flex', gap: 7, marginTop: ziele.length > 0 || zielFehler ? 10 : 0 }}>
                                    <input
                                        value={zielInput} onChange={e => setZielInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addZiel()}
                                        placeholder="Neues Ziel eingeben…"
                                        style={{ flex: 1, fontSize: 12.5, padding: '6px 10px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, fontFamily: 'inherit', outline: 'none' }}
                                    />
                                    <button onClick={addZiel} style={{ padding: '6px 14px', fontSize: 12.5, cursor: 'pointer', border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit', fontWeight: 500 }}>+</button>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: '#9A3412', background: '#FFF7ED', border: '1px solid rgba(154,52,18,.15)', borderRadius: 6, padding: '7px 10px', marginTop: ziele.length > 0 ? 10 : 0 }}>
                                    Programm noch nicht gestartet — Ziele können erst nach der ersten Verfügung mit Programm erfasst werden.
                                </div>
                            )}
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
                                    <button onClick={() => setJournalModal(true)} style={{
                                        width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12.5,
                                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, background: '#F5F4F0',
                                        color: '#6B6860', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12
                                    }}>+ Neuer Journal-Eintrag…</button>
                                    {journal.length === 0 ? (
                                        <div style={{ fontSize: 12, color: '#6B6860' }}>Noch keine Journal-Einträge</div>
                                    ) : journal.map((j, i) => {
                                        const s = JKAT[j.kategorie] || JKAT['Sonstiges'];
                                        const zeitBadge = fmtDauer(j.dauer_minuten);
                                        return (
                                            <div key={i} style={{ border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, marginBottom: 6, overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', background: '#F5F4F0' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 11.5, fontWeight: 500 }}>{j.kategorie}</div>
                                                        <div style={{ fontSize: 10.5, color: '#6B6860', marginTop: 1 }}>{fmt(j.datum)} · {j.erfasst_von}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                                                        {zeitBadge && (
                                                            <span style={{
                                                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, fontFamily: 'monospace',
                                                                background: j.verrechenbar ? '#ECFDF5' : '#F0F0EE',
                                                                color: j.verrechenbar ? '#15803D' : '#6B6860',
                                                                border: `1px solid ${j.verrechenbar ? 'rgba(22,163,74,.15)' : 'rgba(0,0,0,.09)'}`,
                                                            }}>{zeitBadge}</span>
                                                        )}
                                                        {j.leistung_tarifnr && (
                                                            <span style={{
                                                                fontSize: 10, padding: '2px 6px', borderRadius: 10, fontFamily: 'monospace',
                                                                background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(37,99,235,.15)',
                                                            }}>{j.leistung_tarifnr}</span>
                                                        )}
                                                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.03em' }}>{j.kategorie}</span>
                                                    </div>
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

                    {/* Termine */}
                    <div style={{ ...CARD, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                            <span style={SECTION_HDR}>Termine</span>
                            <button onClick={() => setTerminModal(true)} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#2563EB', fontWeight: 500 }}>+ Termin</button>
                        </div>
                        {termine.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Keine Termine</div>
                        ) : termine.map(t => (
                            <div
                                key={t.termin_id}
                                onClick={() => setDetailTermin(t)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 7px', background: '#F5F4F0', borderRadius: 6, marginBottom: 5, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#EEF3FE'}
                                onMouseLeave={e => e.currentTarget.style.background = '#F5F4F0'}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500 }}>{t.typ}</div>
                                    <div style={{ fontSize: 11, color: '#6B6860' }}>
                                        {fmt(t.datum)}{t.zeit ? ` · ${t.zeit.slice(0, 5)}` : ''}
                                    </div>
                                </div>
                                {t.status && (
                                    <span style={{
                                        fontSize: 10, padding: '2px 6px', borderRadius: 10, fontFamily: 'monospace',
                                        background: t.status === 'erledigt' ? '#ECFDF5' : '#F5F4F0',
                                        color: t.status === 'erledigt' ? '#15803D' : '#6B6860',
                                        border: t.status === 'erledigt' ? '1px solid rgba(22,163,74,.15)' : '1px solid rgba(0,0,0,.09)',
                                    }}>{t.status}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Verfügungen */}
                    <div style={{ ...CARD, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem', paddingBottom: '.5rem', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                            <span style={SECTION_HDR}>Verfügungen</span>
                            <button onClick={() => { setGewaehlteVerfuegung(null); setVerfuegungModal(true); }} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit', color: '#2563EB', fontWeight: 500 }}>+ Erfassen</button>
                        </div>

                        {verfuegungen.length === 0 && (
                            <div style={{ fontSize: 12, color: '#6B6860' }}>Noch keine Verfügungen</div>
                        )}

                        {/* Aktive Verfügungen */}
                        {verfuegungen.filter(v => v.status === 'aktiv').map(v => {
                            const VART_LABEL = { monatspauschale: 'Monatspausch.', fallpauschale: 'Fallpausch.', stundenpauschale: 'Std.pausch.' };
                            const VART_BADGE_FARBE = { monatspauschale: { bg: '#EEF3FE', color: '#1D4ED8' }, fallpauschale: { bg: '#FFF7ED', color: '#9A3412' }, stundenpauschale: { bg: '#F0FDF4', color: '#15803D' } };
                            return (
                                <div key={v.verfuegung_id} style={{ background: '#F0FDF4', border: '1px solid rgba(22,163,74,.2)', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{v.nummer}</div>
                                            {v.datum && <div style={{ fontSize: 10.5, color: '#6B6860', marginTop: 1 }}>{fmt(v.datum)}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                                            <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: '#ECFDF5', color: '#15803D', fontFamily: 'monospace' }}>aktiv</span>
                                            <button onClick={() => { setGewaehlteVerfuegung(v); setVerfuegungModal(true); }} style={{ fontSize: 11, padding: '2px 7px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 4, background: '#fff', fontFamily: 'inherit', color: '#1A1917' }}>Bearbeiten</button>
                                        </div>
                                    </div>
                                    {(v.positionen || []).length > 0 && (
                                        <div style={{ marginTop: 8, borderTop: '1px solid rgba(22,163,74,.15)', paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            {v.positionen.map((p, i) => {
                                                const bf = p.verrechnungsart ? (VART_BADGE_FARBE[p.verrechnungsart] || {}) : {};
                                                const betrag = parseFloat(p.betrag) || 0;
                                                const soll_h = parseFloat(p.soll_stunden) || 0;
                                                const tarif = parseFloat(p.stundenpreis) || 0;
                                                let sollAnzeige = null;
                                                if (p.verrechnungsart === 'monatspauschale' && betrag > 0)
                                                    sollAnzeige = `CHF ${betrag.toFixed(2)}/Mt. · ${tarif > 0 ? (Math.round(betrag / tarif * 10) / 10) + 'h/Mt.' : ''}`;
                                                else if (p.verrechnungsart === 'fallpauschale' && betrag > 0)
                                                    sollAnzeige = `CHF ${betrag.toFixed(2)} ges.`;
                                                else if (p.verrechnungsart === 'stundenpauschale')
                                                    sollAnzeige = `${soll_h}h · CHF ${(soll_h * tarif).toFixed(2)}`;
                                                return (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, flexWrap: 'wrap' }}>
                                                        <span style={{ color: '#374151', flex: 1, minWidth: 0 }}>{p.leistung_bezeichnung}</span>
                                                        {p.verrechnungsart && (
                                                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 8, background: bf.bg, color: bf.color, border: `1px solid ${bf.color}22`, fontFamily: 'monospace', flexShrink: 0 }}>
                                                                {VART_LABEL[p.verrechnungsart]}
                                                            </span>
                                                        )}
                                                        {sollAnzeige && <span style={{ fontFamily: 'monospace', color: '#6B6860', fontSize: 11, flexShrink: 0 }}>{sollAnzeige}</span>}
                                                    </div>
                                                );
                                            })}
                                            {(v.soll_stunden_total != null || v.soll_total_ertrag != null) && (
                                                <div style={{ borderTop: '1px solid rgba(22,163,74,.12)', paddingTop: 5, fontSize: 11, color: '#374151', display: 'flex', gap: 10, fontWeight: 500 }}>
                                                    <span>Gesamt-SOLL:</span>
                                                    {v.soll_stunden_total != null && <span>{v.soll_stunden_total}h</span>}
                                                    {v.soll_total_ertrag != null && <span>CHF {parseFloat(v.soll_total_ertrag).toFixed(2)}</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {v.bemerkung && <div style={{ fontSize: 11, color: '#6B6860', marginTop: 7, fontStyle: 'italic' }}>{v.bemerkung}</div>}
                                </div>
                            );
                        })}

                        {/* Abgeschlossene (aufklappbar) */}
                        {verfuegungen.filter(v => v.status !== 'aktiv').length > 0 && (
                            <div>
                                <button onClick={() => setAbgeschlosseneOffen(o => !o)} style={{ width: '100%', textAlign: 'left', fontSize: 11, color: '#6B6860', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit' }}>
                                    <span>{verfuegungen.filter(v => v.status !== 'aktiv').length} abgeschlossene</span>
                                    <span>{abgeschlosseneOffen ? '▴' : '▾'}</span>
                                </button>
                                {abgeschlosseneOffen && verfuegungen.filter(v => v.status !== 'aktiv').map(v => (
                                    <div key={v.verfuegung_id} style={{ background: '#F5F4F0', border: '1px solid rgba(0,0,0,.07)', borderRadius: 6, padding: '7px 9px', marginTop: 5 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6B6860' }}>{v.nummer}</span>
                                                {v.datum && <span style={{ fontSize: 10.5, color: '#A09D97', marginLeft: 7 }}>{fmt(v.datum)}</span>}
                                            </div>
                                            <button onClick={() => { setGewaehlteVerfuegung(v); setVerfuegungModal(true); }} style={{ fontSize: 11, padding: '2px 7px', cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 4, background: '#fff', fontFamily: 'inherit', color: '#1A1917' }}>Bearbeiten</button>
                                        </div>
                                        {(v.positionen || []).length > 0 && (
                                            <div style={{ marginTop: 5 }}>
                                                {v.positionen.map((p, i) => {
                                                    const betrag = parseFloat(p.betrag) || 0;
                                                    const soll_h = parseFloat(p.soll_stunden) || 0;
                                                    const wert = p.verrechnungsart === 'monatspauschale' ? `CHF ${betrag.toFixed(2)}/Mt.`
                                                        : p.verrechnungsart === 'fallpauschale' ? `CHF ${betrag.toFixed(2)}`
                                                        : p.verrechnungsart === 'stundenpauschale' ? `${soll_h}h`
                                                        : `${Number(p.soll_stunden)}h`;
                                                    return (
                                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', padding: '1px 0' }}>
                                                            <span>{p.leistung_bezeichnung}</span>
                                                            <span style={{ fontFamily: 'monospace', flexShrink: 0, marginLeft: 8 }}>{wert}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
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

            <FerienModal
                open={ferienModal}
                onClose={() => setFerienModal(false)}
                klientId={dossier.klient_id}
                onSaved={() => setFerienModal(false)}
            />

            <VerfuegungModal
                open={verfuegungModal}
                onClose={() => setVerfuegungModal(false)}
                dossierId={id}
                dossier={dossier}
                verfuegung={gewaehlteVerfuegung}
                onSaved={() => { reloadVerfuegungen(); reloadDossier(); }}
            />

            <JournalModal
                open={journalModal}
                onClose={() => setJournalModal(false)}
                klientId={dossier?.klient_id}
                dossierId={id}
                pipelineStatus={dossier?.pipeline_status}
                intakeAbgeschlossen={dossier?.intake_abgeschlossen}
                onSaved={(newEntry) => {
                    setJournal(prev => [newEntry, ...prev]);
                    reloadDossier();
                }}
            />
            <NeuerTerminModal
                open={terminModal}
                onClose={() => setTerminModal(false)}
                klientId={dossier?.klient_id}
                dossierZuweisungen={zugewiesen}
                onSaved={() => { setTerminModal(false); loadTermine(); }}
            />

            {detailTermin && (
                <div onClick={() => setDetailTermin(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#fff', borderRadius: 12, padding: '1.5rem',
                        width: 420, maxWidth: '90vw',
                        boxShadow: '0 8px 32px rgba(0,0,0,.18)',
                        maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1917' }}>{detailTermin.typ}</div>
                                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 3, fontFamily: 'monospace' }}>
                                    {new Date(detailTermin.datum).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    {detailTermin.zeit ? ` · ${detailTermin.zeit.slice(0, 5)} Uhr` : ''}
                                </div>
                            </div>
                            {detailTermin.status && (
                                <span style={{
                                    fontSize: 10.5, padding: '2px 8px', borderRadius: 10, fontFamily: 'monospace',
                                    background: detailTermin.status === 'erledigt' ? '#ECFDF5' : '#F5F4F0',
                                    color: detailTermin.status === 'erledigt' ? '#15803D' : '#6B6860',
                                    border: detailTermin.status === 'erledigt' ? '1px solid rgba(22,163,74,.15)' : '1px solid rgba(0,0,0,.09)',
                                }}>{detailTermin.status}</span>
                            )}
                        </div>

                        {detailTermin.personen && detailTermin.personen.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Teilnehmende</div>
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
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Notiz</div>
                                <div style={{
                                    fontSize: 13, padding: '10px 12px',
                                    background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                    borderRadius: 7, color: '#1A1917', lineHeight: 1.6, whiteSpace: 'pre-wrap'
                                }}>{detailTermin.notiz}</div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.07)' }}>
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
