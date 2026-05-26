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

const ROLLEN_LISTE = ['Klientenführung', 'Job Coach', 'Fachperson'];

export default function Profil() {
    const { benutzer } = useAuth();
    const [pwAlt, setPwAlt] = useState('');
    const [pwNeu, setPwNeu] = useState('');
    const [pwBest, setPwBest] = useState('');
    const [pwMsg, setPwMsg] = useState('');

    const [rollen, setRollen] = useState(new Set());
    const [programme, setProgramme] = useState(new Set());
    const [standorte, setStandorte] = useState(new Set());
    const [alleProgramme, setAlleProgramme] = useState([]);
    const [alleStandorte, setAlleStandorte] = useState([]);
    const [rollenMsg, setRollenMsg] = useState('');
    const [programmeMsg, setProgrammeMsg] = useState('');
    const [standorteMsg, setStandorteMsg] = useState('');

    const initials = benutzer?.avatar_initials ||
        benutzer?.full_name?.split(' ').map(n => n[0]).join('') || '?';

    useEffect(() => {
        client.get('/benutzer/mein-profil').then(r => {
            setRollen(new Set(r.data.rollen.map(ro => ro.rolle_name)));
            setProgramme(new Set(r.data.programme.map(p => p.programm_id)));
            setStandorte(new Set((r.data.standorte || []).map(s => s.standort_id)));
        }).catch(console.error);
        client.get('/programme').then(r => setAlleProgramme(r.data)).catch(console.error);
        client.get('/standorte').then(r => setAlleStandorte(r.data)).catch(console.error);
    }, []);

    const toggleRolle = (rolle) =>
        setRollen(prev => { const s = new Set(prev); s.has(rolle) ? s.delete(rolle) : s.add(rolle); return s; });

    const toggleProgramm = (id) =>
        setProgramme(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const toggleStandort = (id) =>
        setStandorte(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const speichernRollen = async () => {
        try {
            await client.put('/benutzer/rollen', { rollen: [...rollen] });
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
                    {alleProgramme.map(p => (
                        <Toggle key={p.programm_id} label={p.name} checked={programme.has(p.programm_id)} onChange={() => toggleProgramm(p.programm_id)} />
                    ))}
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
            </div>
        </div>
    );
}
