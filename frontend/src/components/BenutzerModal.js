import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

const SYSTEM_ROLLEN = [
    { value: 'kader',        label: 'Kader' },
    { value: 'leitungsteam', label: 'Leitungsteam' },
];

const ROLLEN_LISTE = ['Klientenführung', 'Job Coach', 'Fachperson'];

function FieldLabel({ children, required }) {
    return (
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
            {children}{required && <span style={{ color: '#B91C1C', marginLeft: 2 }}>*</span>}
        </label>
    );
}

function TextInput({ value, onChange, placeholder, type = 'text', disabled }) {
    return (
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            style={{
                width: '100%', fontSize: 13, padding: '7px 10px',
                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                background: disabled ? '#F5F4F0' : '#fff',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1A1917'
            }}
        />
    );
}

function Toggle({ label, checked, onChange }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', cursor: 'pointer', userSelect: 'none' }}>
            <div
                onClick={onChange}
                style={{
                    width: 32, height: 18, borderRadius: 9, flexShrink: 0,
                    background: checked ? '#2563EB' : '#D1D5DB',
                    position: 'relative', transition: 'background .15s', cursor: 'pointer'
                }}
            >
                <div style={{
                    position: 'absolute', top: 2, left: checked ? 16 : 2,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)'
                }} />
            </div>
            <span style={{ fontSize: 12.5, color: '#1A1917' }}>{label}</span>
        </label>
    );
}

function SectionLabel({ children }) {
    return (
        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '1rem', marginBottom: '.5rem', paddingBottom: '.25rem', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
            {children}
        </div>
    );
}

export default function BenutzerModal({ open, onClose, onSaved, benutzer }) {
    const istNeu = !benutzer;

    const [vorname, setVorname] = useState('');
    const [nachname, setNachname] = useState('');
    const [email, setEmail] = useState('');
    const [systemRolle, setSystemRolle] = useState('kader');
    const [passwort, setPasswort] = useState('');
    const [pensum, setPensum] = useState(100);
    const [selectedStandorte, setSelectedStandorte] = useState(new Set());
    const [selectedRollen, setSelectedRollen] = useState(new Set());
    const [selectedProgramme, setSelectedProgramme] = useState(new Set());
    const [alleStandorte, setAlleStandorte] = useState([]);
    const [alleProgramme, setAlleProgramme] = useState([]);
    const [busy, setBusy] = useState(false);
    const [fehler, setFehler] = useState('');
    const [deaktivierenBestaetigung, setDeaktivierenBestaetigung] = useState(false);

    useEffect(() => {
        if (!open) return;

        setFehler('');
        setDeaktivierenBestaetigung(false);
        setPasswort('');

        Promise.all([
            client.get('/standorte'),
            client.get('/programme'),
        ]).then(([st, pr]) => {
            setAlleStandorte(st.data);
            setAlleProgramme(pr.data);
        }).catch(console.error);

        if (benutzer) {
            // Volles Profil laden für Bearbeiten-Modus
            client.get(`/benutzer/${benutzer.user_id}`).then(r => {
                const d = r.data;
                const teile = (d.full_name || '').split(' ');
                setVorname(teile[0] || '');
                setNachname(teile.slice(1).join(' ') || '');
                setEmail(d.email || '');
                setSystemRolle(d.system_rolle || 'kader');
                setPensum(d.pensum_pct || 100);
                setSelectedStandorte(new Set((d.standorte || []).map(s => s.standort_id)));
                setSelectedRollen(new Set((d.rollen || []).map(r => r.rolle_name)));
                setSelectedProgramme(new Set((d.programme || []).map(p => p.programm_id)));
            }).catch(console.error);
        } else {
            setVorname('');
            setNachname('');
            setEmail('');
            setSystemRolle('kader');
            setPensum(100);
            setSelectedStandorte(new Set());
            setSelectedRollen(new Set());
            setSelectedProgramme(new Set());
        }
    }, [open, benutzer]);

    const toggle = (set, setFn, key) => {
        setFn(prev => {
            const s = new Set(prev);
            s.has(key) ? s.delete(key) : s.add(key);
            return s;
        });
    };

    const speichern = async () => {
        if (!vorname.trim() || !nachname.trim()) { setFehler('Vor- und Nachname erforderlich'); return; }
        if (!email.trim()) { setFehler('E-Mail erforderlich'); return; }
        if (istNeu && !passwort) { setFehler('Passwort erforderlich'); return; }

        setBusy(true);
        setFehler('');

        const payload = {
            full_name: `${vorname.trim()} ${nachname.trim()}`,
            email: email.trim(),
            system_rolle: systemRolle,
            pensum_pct: parseInt(pensum) || 100,
            avatar_initials: (vorname[0] || '').toUpperCase() + (nachname[0] || '').toUpperCase(),
            standorte: [...selectedStandorte],
            rollen: [...selectedRollen],
            programme: [...selectedProgramme],
        };

        if (istNeu) payload.passwort = passwort;

        try {
            if (istNeu) {
                await client.post('/benutzer', payload);
            } else {
                await client.put(`/benutzer/${benutzer.user_id}`, payload);
            }
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setBusy(false);
        }
    };

    const deaktivieren = async () => {
        if (!deaktivierenBestaetigung) { setDeaktivierenBestaetigung(true); return; }
        setBusy(true);
        try {
            await client.put(`/benutzer/${benutzer.user_id}/deaktivieren`);
            onSaved();
            onClose();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Deaktivieren');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={istNeu ? 'Neuer Benutzer' : 'Benutzer bearbeiten'} width={600}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div>
                    <FieldLabel required>Vorname</FieldLabel>
                    <TextInput value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Eva" />
                </div>
                <div>
                    <FieldLabel required>Nachname</FieldLabel>
                    <TextInput value={nachname} onChange={e => setNachname(e.target.value)} placeholder="Schweizer" />
                </div>
            </div>

            <div style={{ marginTop: 10 }}>
                <FieldLabel required>E-Mail</FieldLabel>
                <TextInput value={email} onChange={e => setEmail(e.target.value)} placeholder="eva.schweizer@kft-prototyp.ch" type="email" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem', marginTop: 10 }}>
                <div>
                    <FieldLabel>System-Rolle</FieldLabel>
                    <select
                        value={systemRolle}
                        onChange={e => setSystemRolle(e.target.value)}
                        style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', color: '#1A1917' }}
                    >
                        {SYSTEM_ROLLEN.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
                <div>
                    <FieldLabel>Pensum %</FieldLabel>
                    <TextInput value={pensum} onChange={e => setPensum(e.target.value)} type="number" placeholder="100" />
                </div>
            </div>

            {istNeu && (
                <div style={{ marginTop: 10 }}>
                    <FieldLabel required>Passwort</FieldLabel>
                    <TextInput value={passwort} onChange={e => setPasswort(e.target.value)} type="password" placeholder="Mindestens 8 Zeichen" />
                </div>
            )}

            <SectionLabel>Standorte</SectionLabel>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {alleStandorte.map(s => (
                    <Toggle
                        key={s.standort_id}
                        label={`${s.name} (${s.kuerzel})`}
                        checked={selectedStandorte.has(s.standort_id)}
                        onChange={() => toggle(selectedStandorte, setSelectedStandorte, s.standort_id)}
                    />
                ))}
            </div>

            <SectionLabel>Rollen</SectionLabel>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {ROLLEN_LISTE.map(r => (
                    <Toggle
                        key={r}
                        label={r}
                        checked={selectedRollen.has(r)}
                        onChange={() => toggle(selectedRollen, setSelectedRollen, r)}
                    />
                ))}
            </div>

            <SectionLabel>Programme</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                {alleProgramme.map(p => (
                    <Toggle
                        key={p.programm_id}
                        label={p.name}
                        checked={selectedProgramme.has(p.programm_id)}
                        onChange={() => toggle(selectedProgramme, setSelectedProgramme, p.programm_id)}
                    />
                ))}
            </div>

            {fehler && (
                <div style={{ marginTop: '0.75rem', fontSize: 12.5, color: '#B91C1C', padding: '6px 10px', background: '#FEF2F2', borderRadius: 6, border: '1px solid rgba(185,28,28,.15)' }}>
                    {fehler}
                </div>
            )}

            <div style={{ marginTop: '1.125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    {!istNeu && (
                        <button
                            onClick={deaktivieren}
                            disabled={busy}
                            style={{
                                padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                                border: `1px solid ${deaktivierenBestaetigung ? '#B91C1C' : 'rgba(0,0,0,.12)'}`,
                                borderRadius: 6,
                                background: deaktivierenBestaetigung ? '#FEF2F2' : '#fff',
                                color: deaktivierenBestaetigung ? '#B91C1C' : '#6B6860',
                            }}
                        >
                            {deaktivierenBestaetigung ? 'Wirklich deaktivieren?' : 'Deaktivieren'}
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', color: '#6B6860', fontFamily: 'inherit' }}>
                        Abbrechen
                    </button>
                    <button
                        onClick={speichern}
                        disabled={busy}
                        style={{ padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', border: 'none', borderRadius: 6, background: busy ? '#93C5FD' : '#2563EB', color: '#fff', fontFamily: 'inherit' }}
                    >
                        {busy ? 'Speichern…' : 'Speichern'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
