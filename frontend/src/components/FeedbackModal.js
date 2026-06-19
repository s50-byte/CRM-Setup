import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from './Modal';
import FormField, { inputStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

export default function FeedbackModal({ open, onClose }) {
    const location = useLocation();
    const [notiz, setNotiz] = useState('');
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');
    const [gesendet, setGesendet] = useState(false);

    function schliessen() {
        setNotiz('');
        setFehler('');
        setGesendet(false);
        onClose();
    }

    async function senden() {
        if (notiz.trim().length < 10) {
            setFehler('Feedback muss mindestens 10 Zeichen enthalten');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            await client.post('/feedback', { screen: location.pathname, notiz: notiz.trim() });
            setGesendet(true);
            setTimeout(schliessen, 2000);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Senden');
        } finally {
            setLaden(false);
        }
    }

    return (
        <Modal open={open} onClose={schliessen} title="Feedback geben">
            {gesendet ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', fontSize: 14, color: '#15803D', fontWeight: 500 }}>
                    Danke für dein Feedback!
                </div>
            ) : (
                <>
                    {fehler && (
                        <div style={{
                            background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                            borderRadius: 6, padding: '9px 12px', fontSize: 12,
                            color: '#B91C1C', marginBottom: 12
                        }}>{fehler}</div>
                    )}
                    <FormField label="Dein Feedback *">
                        <textarea
                            style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                            value={notiz}
                            onChange={e => setNotiz(e.target.value)}
                            placeholder="Dein Feedback..."
                        />
                    </FormField>
                    <div style={{ fontSize: 11, color: '#6B6860' }}>Screen: {location.pathname}</div>
                    <div style={btnRow}>
                        <button style={btnSecondary} onClick={schliessen}>Abbrechen</button>
                        <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={senden} disabled={laden}>
                            {laden ? 'Senden…' : 'Senden'}
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
}
