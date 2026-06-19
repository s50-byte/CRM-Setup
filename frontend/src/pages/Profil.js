import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

const CARD = {
    background: '#fff', border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)'
};
const SECTION_LABEL = {
    fontSize: 10.5, fontWeight: 600, color: '#6B6860',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem'
};
const GRUPPEN_HDR = {
    fontSize: 10.5, fontWeight: 600, color: '#A09D97',
    textTransform: 'uppercase', letterSpacing: '.06em',
    marginTop: '.875rem', marginBottom: '.4rem',
    paddingBottom: '.35rem', borderBottom: '1px solid rgba(0,0,0,.07)',
};

function Toggle({ label, checked, onChange }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,.05)' }}>
            <div
                onClick={onChange}
                style={{
                    width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                    background: checked ? '#2563EB' : '#D1D5DB',
                    position: 'relative', transition: 'background .15s', cursor: 'pointer'
                }}
            >
                <div style={{
                    position: 'absolute', top: 3, left: checked ? 19 : 3,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)'
                }} />
            </div>
            <span style={{ fontSize: 13, color: '#1A1917', userSelect: 'none' }}>{label}</span>
        </label>
    );
}

const ROLLEN_LISTE = ['Klientenführung', 'Job Coach', 'Fachperson', 'Intake'];
const ABTEILUNGEN_LISTE = ['BI IT', 'Admin 1', 'Admin 2', 'Admin 3', 'Logistik', 'Telefonservice', 'Wäscheservice', 'Restwert'];
const BEREICH_LISTE = [
    { value: 'BM', label: 'Berufsmassnahmen' },
    { value: 'IM', label: 'Integrationsmassnahmen' },
    { value: 'BC', label: 'Beratung & Coaching' },
];

export default function Profil() {
    const { benutzer } = useAuth();
    const [pwAlt, setPwAlt] = useState('');
    const [pwNeu, setPwNeu] = useState('');
    const [pwBest, setPwBest] = useState('');
    const [pwMsg, setPwMsg] = useState('');

    const [rollen, setRollen] = useState(new Set());
    const [intakeBereiche, setIntakeBereiche] = useState(new Set());
    const [programme, setProgramme] = useState(new Set());
    const [standorte, setStandorte] = useState(new Set());
    const [abteilungen, setAbteilungen] = useState(new Set());
    const [programmGruppen, setProgrammGruppen] = useState([]);
    const [aufgeklappt, setAufgeklappt] = useState({ BM: true, IM: true, BC: true, GM: true });
    const [alleStandorte, setAlleStandorte] = useState([]);
    const [rollenMsg, setRollenMsg] = useState('');
    const [programmeMsg, setProgrammeMsg] = useState('');
    const [standorteMsg, setStandorteMsg] = useState('');
    const [abteilungenMsg, setAbteilungenMsg] = useState('');

    const initials = benutzer?.avatar_initials ||
        benutzer?.full_name?.split(' ').map(n => n[0]).join('') || '?';

    useEffect(() => {
        client.get('/benutzer/mein-profil').then(r => {
            setRollen(new Set(r.data.rollen.map(ro => ro.rolle_name)));
            setIntakeBereiche(new Set(r.data.intake_bereiche || []));
            setProgramme(new Set(r.data.programme.map(p => p.programm_id)));
            setStandorte(new Set((r.data.standorte || []).map(s => s.standort_id)));
            setAbteilungen(new Set(r.data.abteilungen || []));
        }).catch(console.error);
        client.get('/programme?grouped=true').then(r => setProgrammGruppen(r.data.gruppen || [])).catch(console.error);
        client.get('/standorte').then(r => setAlleStandorte(r.data)).catch(console.error);
    }, []);

    const toggleRolle = (rolle) =>
        setRollen(prev => { const s = new Set(prev); s.has(rolle) ? s.delete(rolle) : s.add(rolle); return s; });

    const toggleBereich = (bereich) =>
        setIntakeBereiche(prev => { const s = new Set(prev); s.has(bereich) ? s.delete(bereich) : s.add(bereich); return s; });

    const toggleProgramm = (id) =>
        setProgramme(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const toggleStandort = (id) =>
        setStandorte(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const toggleAbteilung = (name) =>
        setAbteilungen(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });

    const toggleGruppeAufgeklappt = (gruppe) =>
        setAufgeklappt(prev => ({ ...prev, [gruppe]: !(prev[gruppe] !== false) }));

    const speichernRollen = async () => {
        try {
            await client.put('/benutzer/rollen', { rollen: [...rollen] });
            await client.put('/benutzer/intake-bereiche', {
                bereiche: rollen.has('Intake') ? [...intakeBereiche] : [],
            });
            setRollenMsg('Gespeichert ✓');
            setTimeout(() => setRollenMsg(''), 2500);
        } catch (err) { console.error(err); }
    };

    const speichernProgramme = async () => {
        try {
            await client.put('/benutzer/programme', { programme: [...programme] });
            setProgrammeMsg('Gespeichert ✓');
            setTimeout(() => setProgrammeMsg(''), 2500);
        } catch (err) { console.error(err); }
    };

    const speichernStandorte = async () => {
        try {
            await client.put('/benutzer/standorte', { standorte: [...standorte] });
            setStandorteMsg('Gespeichert ✓');
            setTimeout(() => setStandorteMsg(''), 2500);
        } catch (err) { console.error(err); }
    };

    const speichernAbteilungen = async () => {
        try {
            await client.put('/benutzer/einstellung/abteilungen', { wert: JSON.stringify([...abteilungen]) });
            setAbteilungenMsg('Gespeichert ✓');
            setTimeout(() => setAbteilungenMsg(''), 2500);
        } catch (err) { console.error(err); }
    };

    const passwortAendern = async () => {
        if (pwNeu !== pwBest) { setPwMsg('Passwörter stimmen nicht überein'); return; }
        try {
            await client.put('/benutzer/passwort', { altes_passwort: pwAlt, neues_passwort: pwNeu });
            setPwMsg('Passwort geändert ✓');
            setPwAlt(''); setPwNeu(''); setPwBest('');
            setTimeout(() => setPwMsg(''), 2500);
        } catch (err) {
            setPwMsg(err.response?.data?.error || 'Fehler');
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 19, fontWeight: 600 }}>Mein Profil</div>
                <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>
                    {benutzer?.full_name} · {benutzer?.system_rolle}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Persönliche Daten */}
                <div style={CARD}>
                    <div style={SECTION_LABEL}>Persönliche Daten</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: '#EEF3FE', color: '#1D4ED8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 600
                        }}>{initials}</div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>{benutzer?.full_name}</div>
                            <div style={{ fontSize: 12, color: '#6B6860' }}>{benutzer?.email}</div>
                        </div>
                    </div>
                    {[
                        { label: 'Name', value: benutzer?.full_name },
                        { label: 'E-Mail', value: benutzer?.email },
                        { label: 'Systemrolle', value: benutzer?.system_rolle, readOnly: true },
                        { label: 'Pensum', value: benutzer?.pensum_pct + '%' },
                    ].map((f, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{f.label}</label>
                            <input
                                defaultValue={f.value}
                                readOnly={!!f.readOnly}
                                style={{
                                    width: '100%', fontSize: 13, padding: '7px 11px',
                                    border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                    background: f.readOnly ? '#F5F4F0' : '#fff',
                                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1A1917'
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Passwort */}
                <div style={CARD}>
                    <div style={SECTION_LABEL}>Passwort ändern</div>
                    {[
                        { label: 'Aktuelles Passwort', val: pwAlt, set: setPwAlt },
                        { label: 'Neues Passwort',     val: pwNeu, set: setPwNeu },
                        { label: 'Bestätigen',          val: pwBest, set: setPwBest },
                    ].map((f, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{f.label}</label>
                            <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={{
                                width: '100%', fontSize: 13, padding: '7px 11px',
                                border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
                            }} />
                        </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '.5rem' }}>
                        <button onClick={passwortAendern} style={{
                            padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>Passwort ändern</button>
                        {pwMsg && <span style={{ fontSize: 12.5, color: pwMsg.includes('✓') ? '#16A34A' : '#B91C1C' }}>{pwMsg}</span>}
                    </div>
                </div>

                {/* Meine Rollen */}
                <div style={CARD}>
                    <div style={SECTION_LABEL}>Meine Rollen</div>
                    {ROLLEN_LISTE.map(rolle => (
                        <Toggle key={rolle} label={rolle} checked={rollen.has(rolle)} onChange={() => toggleRolle(rolle)} />
                    ))}
                    {rollen.has('Intake') && (
                        <div style={{ marginLeft: 18, marginTop: 4 }}>
                            {BEREICH_LISTE.map(b => (
                                <Toggle key={b.value} label={b.label} checked={intakeBereiche.has(b.value)} onChange={() => toggleBereich(b.value)} />
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '.875rem' }}>
                        <button onClick={speichernRollen} style={{
                            padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>Speichern</button>
                        {rollenMsg && <span style={{ fontSize: 12.5, color: '#16A34A' }}>{rollenMsg}</span>}
                    </div>
                </div>

                {/* Meine Programme */}
                <div style={CARD}>
                    <div style={SECTION_LABEL}>Meine Programme</div>
                    {programmGruppen.map(gruppe => {
                        const offen = aufgeklappt[gruppe.gruppe] !== false;
                        return (
                            <div key={gruppe.gruppe}>
                                <div
                                    onClick={() => toggleGruppeAufgeklappt(gruppe.gruppe)}
                                    style={{ ...GRUPPEN_HDR, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <span style={{ fontSize: 9, width: 10, display: 'inline-block' }}>{offen ? '▼' : '▶'}</span>
                                    <span>{gruppe.label}</span>
                                </div>
                                {offen && gruppe.programme.map(p => (
                                    <Toggle key={p.programm_id} label={p.name} checked={programme.has(p.programm_id)} onChange={() => toggleProgramm(p.programm_id)} />
                                ))}
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '.875rem' }}>
                        <button onClick={speichernProgramme} style={{
                            padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>Speichern</button>
                        {programmeMsg && <span style={{ fontSize: 12.5, color: '#16A34A' }}>{programmeMsg}</span>}
                    </div>
                </div>

                {/* Meine Standorte */}
                <div style={CARD}>
                    <div style={SECTION_LABEL}>Meine Standorte</div>
                    {alleStandorte.map(s => (
                        <Toggle key={s.standort_id} label={`${s.name} (${s.kuerzel})`} checked={standorte.has(s.standort_id)} onChange={() => toggleStandort(s.standort_id)} />
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '.875rem' }}>
                        <button onClick={speichernStandorte} style={{
                            padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>Speichern</button>
                        {standorteMsg && <span style={{ fontSize: 12.5, color: '#16A34A' }}>{standorteMsg}</span>}
                    </div>
                </div>

                {/* Meine Abteilungen */}
                <div style={CARD}>
                    <div style={SECTION_LABEL}>Meine Abteilungen</div>
                    {ABTEILUNGEN_LISTE.map(name => (
                        <Toggle key={name} label={name} checked={abteilungen.has(name)} onChange={() => toggleAbteilung(name)} />
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '.875rem' }}>
                        <button onClick={speichernAbteilungen} style={{
                            padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                        }}>Speichern</button>
                        {abteilungenMsg && <span style={{ fontSize: 12.5, color: '#16A34A' }}>{abteilungenMsg}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
