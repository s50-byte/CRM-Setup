import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function Login() {
    const [email, setEmail] = useState('');
    const [passwort, setPasswort] = useState('');
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);
    const navigate = useNavigate();

    async function handleLogin(e) {
        e.preventDefault();
        setFehler('');
        setLaden(true);
        try {
            const res = await client.post('/auth/login', { email, passwort });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('benutzer', JSON.stringify(res.data.benutzer));
            navigate('/');
        } catch (err) {
            setFehler(err.response?.data?.error || 'Verbindungsfehler');
        } finally {
            setLaden(false);
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#F5F4F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'DM Sans', sans-serif"
        }}>
            <div style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,.09)',
                borderRadius: 12,
                padding: '2.5rem',
                width: 380,
                boxShadow: '0 4px 24px rgba(0,0,0,.08)'
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
                    <div style={{
                        width: 36, height: 36, background: '#2563EB',
                        borderRadius: 9, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#fff', fontSize: 18
                    }}>
                        ✦
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-.2px' }}>IV-CRM</div>
                        <div style={{ fontSize: 11, color: '#6B6860' }}>Soziale Integration</div>
                    </div>
                </div>

                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Anmelden</div>
                <div style={{ fontSize: 13, color: '#6B6860', marginBottom: '1.5rem' }}>
                    Bitte melde dich mit deinen Zugangsdaten an.
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{
                            display: 'block', fontSize: 11, fontWeight: 600,
                            color: '#6B6860', textTransform: 'uppercase',
                            letterSpacing: '.04em', marginBottom: 4
                        }}>E-Mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%', fontSize: 13, padding: '9px 12px',
                                border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                background: '#F5F4F0', fontFamily: 'inherit',
                                outline: 'none', boxSizing: 'border-box'
                            }}
                            placeholder="name@organisation.ch"
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{
                            display: 'block', fontSize: 11, fontWeight: 600,
                            color: '#6B6860', textTransform: 'uppercase',
                            letterSpacing: '.04em', marginBottom: 4
                        }}>Passwort</label>
                        <input
                            type="password"
                            value={passwort}
                            onChange={e => setPasswort(e.target.value)}
                            required
                            style={{
                                width: '100%', fontSize: 13, padding: '9px 12px',
                                border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                                background: '#F5F4F0', fontFamily: 'inherit',
                                outline: 'none', boxSizing: 'border-box'
                            }}
                            placeholder="••••••••"
                        />
                    </div>

                    {fehler && (
                        <div style={{
                            background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                            borderRadius: 6, padding: '9px 12px', fontSize: 12,
                            color: '#B91C1C', marginBottom: 16
                        }}>
                            {fehler}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={laden}
                        style={{
                            width: '100%', padding: '10px 0', fontSize: 14,
                            fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                            background: laden ? '#93C5FD' : '#2563EB',
                            color: '#fff', border: 'none', borderRadius: 6,
                            transition: 'background .15s'
                        }}
                    >
                        {laden ? 'Anmelden…' : 'Anmelden'}
                    </button>
                </form>
            </div>
        </div>
    );
}