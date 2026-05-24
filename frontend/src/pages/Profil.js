import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profil() {
    const { benutzer } = useAuth();
    const [gespeichert, setGespeichert] = useState(false);

    const initials = benutzer?.avatar_initials ||
        benutzer?.full_name?.split(' ').map(n => n[0]).join('') || '?';

    function speichern() {
        setGespeichert(true);
        setTimeout(() => setGespeichert(false), 2000);
    }

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
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>
                        Persönliche Daten
                    </div>

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
                        { label: 'Systemrolle', value: benutzer?.system_rolle },
                        { label: 'Pensum', value: benutzer?.pensum_pct + '%' },
                    ].map((f, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <label style={{
                                display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860',
                                textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3
                            }}>{f.label}</label>
                            <input
                                defaultValue={f.value}
                                readOnly={f.label === 'Systemrolle'}
                                style={{
                                    width: '100%', fontSize: 13, padding: '7px 11px',
                                    border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                    background: f.label === 'Systemrolle' ? '#F5F4F0' : '#fff',
                                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                                    color: '#1A1917'
                                }}
                            />
                        </div>
                    ))}

                    <button onClick={speichern} style={{
                        marginTop: '.5rem', padding: '7px 16px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: gespeichert ? '#16A34A' : '#2563EB',
                        color: '#fff', fontFamily: 'inherit', transition: 'background .2s'
                    }}>
                        {gespeichert ? '✓ Gespeichert' : 'Speichern'}
                    </button>
                </div>

                {/* Passwort ändern */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.75rem' }}>
                        Passwort ändern
                    </div>
                    {[
                        { label: 'Aktuelles Passwort', id: 'pw-alt' },
                        { label: 'Neues Passwort', id: 'pw-neu' },
                        { label: 'Bestätigen', id: 'pw-best' },
                    ].map((f, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <label style={{
                                display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860',
                                textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3
                            }}>{f.label}</label>
                            <input type="password" id={f.id} style={{
                                width: '100%', fontSize: 13, padding: '7px 11px',
                                border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                background: '#fff', fontFamily: 'inherit',
                                outline: 'none', boxSizing: 'border-box'
                            }} />
                        </div>
                    ))}
                    <button style={{
                        marginTop: '.5rem', padding: '7px 16px', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', border: 'none', borderRadius: 6,
                        background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                    }}>Passwort ändern</button>
                </div>
            </div>
        </div>
    );
}