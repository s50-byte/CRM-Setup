import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import NeueAnfrageModal from '../components/NeueAnfrageModal';

const STAGES = ['Erstkontakt', 'In Abklärung', 'Erstgespräch', 'Schnupper', 'Programmstart'];
const FARBEN = {
    'IV-Massnahme': '#2563EB', 'Erstmalige berufliche Ausbildung': '#16A34A',
    'Beratung & Coaching': '#7C3AED', 'Erstmalige berufliche Abklärung': '#EA580C',
    'Gezielte Vorbereitung': '#D97706'
};

export default function Pipeline() {
    const [dossiers, setDossiers] = useState([]);
    const [laden, setLaden] = useState(true);
    const [anfrageModal, setAnfrageModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        client.get('/dossiers')
            .then(r => setDossiers(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Pipeline</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Alle laufenden Anfragen nach Status</div>
                </div>
                <button onClick={() => setAnfrageModal(true)} style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neue Anfrage</button>
            </div>

            {laden ? (
                <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 9 }}>
                    {STAGES.map(stage => {
                        const items = dossiers.filter(d => d.pipeline_status === stage);
                        return (
                            <div key={stage} style={{
                                background: '#fff', border: '1px solid rgba(0,0,0,.09)',
                                borderRadius: 10, padding: 9, boxShadow: '0 1px 3px rgba(0,0,0,.07)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>{stage}</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, fontFamily: 'monospace',
                                        background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                        borderRadius: 20, padding: '1px 6px', color: '#6B6860'
                                    }}>{items.length}</span>
                                </div>
                                {items.map((d, i) => {
                                    const farbe = FARBEN[d.programm_name] || '#888';
                                    return (
                                        <div key={i}
                                            onClick={() => navigate(`/dossiers/${d.dossier_id}`)}
                                            style={{
                                                background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                                borderRadius: 6, padding: 8, marginBottom: 5,
                                                cursor: 'pointer', transition: 'border-color .15s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.borderColor = '#2563EB'}
                                            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,.09)'}
                                        >
                                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
                                                {d.vorname} {d.nachname}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#6B6860' }}>{d.auftraggeber}</div>
                                            {d.programm_name && (
                                                <span style={{
                                                    display: 'inline-block', fontSize: 9, padding: '2px 6px',
                                                    borderRadius: 20, marginTop: 4, fontWeight: 500,
                                                    background: farbe + '22', color: farbe,
                                                    border: `1px solid ${farbe}33`
                                                }}>{d.programm_name}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
            <NeueAnfrageModal
                open={anfrageModal}
                onClose={() => setAnfrageModal(false)}
                onSaved={() => {
                    setAnfrageModal(false);
                    client.get('/dossiers').then(r => setDossiers(r.data));
                }}
            />
        </div>
    );
}