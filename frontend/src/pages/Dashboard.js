import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const navigate = useNavigate();
    const benutzer = JSON.parse(localStorage.getItem('benutzer') || '{}');

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('benutzer');
        navigate('/login');
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#F5F4F0',
            fontFamily: "'DM Sans', sans-serif",
            padding: '2rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                    Willkommen, {benutzer.full_name}
                </div>
                <button onClick={logout} style={{
                    padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                    border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                    background: '#fff', fontFamily: 'inherit'
                }}>
                    Abmelden
                </button>
            </div>
            <div style={{ marginTop: '2rem', color: '#6B6860' }}>
                Dashboard wird aufgebaut…
            </div>
        </div>
    );
}