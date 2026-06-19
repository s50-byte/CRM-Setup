import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import Klienten from '../pages/Klienten';
import Externe from '../pages/Externe';
import Intake from '../pages/Intake';
import Dossiers from '../pages/Dossiers';
import Termine from '../pages/Termine';
import Praesenz from '../pages/Praesenz';
import Aufgaben from '../pages/Aufgaben';
import Programme from '../pages/Programme';
import Profil from '../pages/Profil';
import DossierDetail from '../pages/DossierDetail';
import DossierPhase from '../pages/DossierPhase';
import KlientDetail from '../pages/KlientDetail';
import ExterneDetail from '../pages/ExterneDetail';
import Standorte from '../pages/Standorte';
import Gantt from '../pages/Gantt';
import Leistungen from '../pages/management/Leistungen';
import ManagementDashboard from '../pages/management/ManagementDashboard';
import Auslastung from '../pages/management/Auslastung';
import Benutzer from '../pages/management/Benutzer';
import Reporting from '../pages/management/Reporting';

const MANAGEMENT_ROLLEN = ['leitungsteam', 'admin'];

const NAV = [
    { section: 'Mein Bereich' },
    { path: '/',          label: 'Dashboard',         icon: '⊞' },
    { path: '/meine',     label: 'Meine Klienten',    icon: '♥' },
    { path: '/aufgaben',  label: 'Aufgaben',           icon: '☑' },
    { section: 'Operativ' },
    { path: '/intake',    label: 'Intake',             icon: '⋮' },
    { path: '/dossiers',  label: 'Klientendossiers',   icon: '📁' },
    { path: '/termine',   label: 'Termine',            icon: '📅' },
    { path: '/praesenz',  label: 'Präsenzkontrolle',   icon: '✓' },
    { section: 'Stammdaten' },
    { path: '/klienten',  label: 'Klienten',           icon: '👥' },
    { path: '/externe',   label: 'Externe Kontakte',   icon: '🏢' },
    { section: 'Verwaltung' },
    { path: '/programme', label: 'Programmübersicht',   icon: '⚙' },
    { path: '/profil',    label: 'Mein Profil',        icon: '👤' },
    { path: '/standorte', label: 'Standorte',          icon: '📍' },
];

const MANAGEMENT_NAV = [
    { section: 'Management' },
    { path: '/management',             label: 'Dashboard',  icon: '📊' },
    { path: '/management/auslastung',  label: 'Auslastung', icon: '👥' },
    { path: '/gantt',                  label: 'Auslastungsplanung', icon: '📅' },
    { path: '/management/finanzen',    label: 'Finanzen',   icon: '💰' },
    { path: '/management/reporting',   label: 'Reporting',  icon: '📊' },
    { path: '/management/leistungen',  label: 'Leistungskatalog', icon: '📋' },
    { path: '/management/benutzer',    label: 'Benutzer',   icon: '⚙' },
    { path: '/standorte',              label: 'Standorte',  icon: '📍' },
];

function Platzhalter({ titel }) {
    return (
        <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
            {titel} — kommt bald
        </div>
    );
}

function MgmtToggle({ aktiv, onToggle }) {
    return (
        <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: aktiv ? '#2563EB' : '#6B6860' }}>Management</span>
            <div style={{
                width: 36, height: 20, borderRadius: 10,
                background: aktiv ? '#2563EB' : '#D1D5DB',
                position: 'relative', transition: 'background .2s',
                flexShrink: 0
            }}>
                <div style={{
                    position: 'absolute', top: 3, left: aktiv ? 19 : 3,
                    width: 14, height: 14, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s'
                }} />
            </div>
        </div>
    );
}

function istManagementPfad(pathname) {
    return pathname.startsWith('/management') || pathname === '/gantt' || pathname === '/standorte';
}

export default function Layout() {
    const { benutzer, logout, managementModus, setManagementModus } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const istManagementUser = MANAGEMENT_ROLLEN.includes(benutzer?.system_rolle);

    useEffect(() => {
        setManagementModus(istManagementPfad(location.pathname));
    }, [location.pathname, setManagementModus]);

    function handleLogout() {
        logout();
        navigate('/login');
    }

    const initials = benutzer?.avatar_initials ||
        benutzer?.full_name?.split(' ').map(n => n[0]).join('') || '?';

    const aktivNav = (managementModus && istManagementUser) ? MANAGEMENT_NAV : NAV;

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
                        width: 30, height: 30, background: managementModus && istManagementUser ? '#7C3AED' : '#2563EB', borderRadius: 7,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 15, transition: 'background .2s'
                    }}>✦</div>
                    Klientenführungstool Prototyp
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                    background: '#FFFBEB', color: '#B45309',
                    border: '1px solid rgba(217,119,6,.15)', fontFamily: 'monospace'
                }}>v2</span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {istManagementUser && (
                        <MgmtToggle aktiv={managementModus} onToggle={() => {
                            navigate(managementModus ? '/' : '/management');
                        }} />
                    )}
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
                {aktivNav.map((item, i) => {
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
                            color: active ? (managementModus && istManagementUser ? '#7C3AED' : '#2563EB') : '#6B6860',
                            cursor: 'pointer', border: 'none',
                            background: active ? '#F5F4F0' : 'transparent',
                            width: '100%', textAlign: 'left',
                            borderLeft: active ? `3px solid ${managementModus && istManagementUser ? '#7C3AED' : '#2563EB'}` : '3px solid transparent',
                            fontFamily: 'inherit'
                        }}>
                            <span style={{ fontSize: 14, opacity: active ? 1 : .75 }}>{item.icon}</span>
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {/* MAIN */}
            <div style={{ overflow: 'auto', padding: '1.5rem 1.75rem', background: '#F5F4F0' }}>
                <Routes>
                    <Route path="/"          element={<Dashboard />} />
                    <Route path="/meine"     element={<Klienten meine />} />
                    <Route path="/aufgaben"  element={<Aufgaben />} />
                    <Route path="/intake"    element={<Intake />} />
                    <Route path="/dossiers"  element={<Dossiers />} />
                    <Route path="/termine"   element={<Termine />} />
                    <Route path="/praesenz"  element={<Praesenz />} />
                    <Route path="/gantt"     element={<Gantt />} />
                    <Route path="/klienten"  element={<Klienten />} />
                    <Route path="/externe"   element={<Externe />} />
                    <Route path="/programme" element={<Programme />} />
                    <Route path="/profil"    element={<Profil />} />
                    <Route path="/dossiers/:id/phase/:phase_id" element={<DossierPhase />} />
                    <Route path="/dossiers/:id" element={<DossierDetail />} />
                    <Route path="/klienten/:id" element={<KlientDetail />} />
                    <Route path="/externe/:id"  element={<ExterneDetail />} />
                    <Route path="/standorte"    element={<Standorte />} />
                    <Route path="/management"              element={<ManagementDashboard />} />
                    <Route path="/management/auslastung"   element={<Auslastung />} />
                    <Route path="/management/finanzen"     element={<Platzhalter titel="Finanzen" />} />
                    <Route path="/management/reporting"    element={<Reporting />} />
                    <Route path="/management/leistungen"   element={<Leistungen />} />
                    <Route path="/management/benutzer"     element={<Benutzer />} />
                </Routes>
            </div>
        </div>
    );
}
