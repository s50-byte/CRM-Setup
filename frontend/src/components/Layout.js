import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import Klienten from '../pages/Klienten';
import Externe from '../pages/Externe';
import Pipeline from '../pages/Pipeline';
import Dossiers from '../pages/Dossiers';
import Termine from '../pages/Termine';
import Praesenz from '../pages/Praesenz';
import Aufgaben from '../pages/Aufgaben';
import Programme from '../pages/Programme';
import Profil from '../pages/Profil';
import DossierDetail from '../pages/DossierDetail';

const NAV = [
    { section: 'Mein Bereich' },
    { path: '/',          label: 'Dashboard',         icon: '⊞' },
    { path: '/meine',     label: 'Meine Klienten',    icon: '♥' },
    { path: '/aufgaben',  label: 'Aufgaben',           icon: '☑' },
    { section: 'Operativ' },
    { path: '/pipeline',  label: 'Pipeline',           icon: '⋮' },
    { path: '/dossiers',  label: 'Falldossiers',       icon: '📁' },
    { path: '/termine',   label: 'Termine',            icon: '📅' },
    { path: '/praesenz',  label: 'Präsenzkontrolle',   icon: '✓' },
    { section: 'Stammdaten' },
    { path: '/klienten',  label: 'Klienten',           icon: '👥' },
    { path: '/externe',   label: 'Externe Personen',   icon: '🏢' },
    { section: 'Verwaltung' },
    { path: '/programme', label: 'Programme',          icon: '⚙' },
    { path: '/profil',    label: 'Mein Profil',        icon: '👤' },
];

export default function Layout() {
    const { benutzer, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const initials = benutzer?.avatar_initials ||
        benutzer?.full_name?.split(' ').map(n => n[0]).join('') || '?';

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '224px 1fr',
            gridTemplateRows: '56px 1fr',
            height: '100vh',
            overflow: 'hidden',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            background: '#F5F4F0',
            color: '#1A1917'
        }}>
            {/* TOPBAR */}
            <div style={{
                gridColumn: '1/-1',
                background: '#fff',
                borderBottom: '1px solid rgba(0,0,0,.09)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 1.25rem',
                gap: 10,
                zIndex: 30
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 15 }}>
                    <div style={{
                        width: 30, height: 30, background: '#2563EB', borderRadius: 7,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 15
                    }}>✦</div>
                    IV-CRM
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                    background: '#FFFBEB', color: '#B45309',
                    border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace'
                }}>v2</span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                        padding: '4px 10px 4px 4px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0'
                    }}>
                        <div style={{
                            width: 26, height: 26, borderRadius: 7, background: '#EEF3FE',
                            color: '#1D4ED8', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 10, fontWeight: 600
                        }}>{initials}</div>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{benutzer?.full_name}</span>
                        <span style={{
                            fontSize: 10, padding: '1px 7px', borderRadius: 10,
                            background: '#EEF3FE', color: '#1D4ED8', fontFamily: 'monospace'
                        }}>{benutzer?.system_rolle}</span>
                    </div>
                    <button onClick={handleLogout} style={{
                        padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                        background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                    }}>Abmelden</button>
                </div>
            </div>

            {/* SIDEBAR */}
            <div style={{
                background: '#fff',
                borderRight: '1px solid rgba(0,0,0,.09)',
                overflowY: 'auto',
                padding: '.5rem 0 1.5rem'
            }}>
                {NAV.map((item, i) => {
                    if (item.section) {
                        return (
                            <div key={i} style={{
                                padding: '1rem 1rem .3rem',
                                fontSize: 9.5, fontWeight: 600, color: '#A09D97',
                                textTransform: 'uppercase', letterSpacing: '.08em'
                            }}>{item.section}</div>
                        );
                    }
                    const active = location.pathname === item.path;
                    return (
                        <button key={i} onClick={() => navigate(item.path)} style={{
                            display: 'flex', alignItems: 'center', gap: 9,
                            padding: '7px 12px 7px 1rem', fontSize: 13,
                            fontWeight: active ? 500 : 400,
                            color: active ? '#2563EB' : '#6B6860',
                            cursor: 'pointer', border: 'none',
                            background: active ? '#F5F4F0' : 'transparent',
                            width: '100%', textAlign: 'left',
                            borderLeft: active ? '3px solid #2563EB' : '3px solid transparent',
                            fontFamily: 'inherit'
                        }}>
                            <span style={{ fontSize: 14, opacity: active ? 1 : .75 }}>{item.icon}</span>
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {/* MAIN */}
            <div style={{ overflowY: 'auto', padding: '1.5rem 1.75rem', background: '#F5F4F0' }}>
                <Routes>
                    <Route path="/"          element={<Dashboard />} />
                    <Route path="/meine"     element={<Klienten meine />} />
                    <Route path="/aufgaben"  element={<Aufgaben />} />
                    <Route path="/pipeline"  element={<Pipeline />} />
                    <Route path="/dossiers"  element={<Dossiers />} />
                    <Route path="/termine"   element={<Termine />} />
                    <Route path="/praesenz"  element={<Praesenz />} />
                    <Route path="/klienten"  element={<Klienten />} />
                    <Route path="/externe"   element={<Externe />} />
                    <Route path="/programme" element={<Programme />} />
                    <Route path="/profil"    element={<Profil />} />
                    <Route path="/dossiers/:id" element={<DossierDetail />} />
                </Routes>
            </div>
        </div>
    );
}