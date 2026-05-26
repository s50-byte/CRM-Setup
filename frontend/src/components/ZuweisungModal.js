import { useState, useEffect } from 'react';
import Modal from './Modal';
import client from '../api/client';

const ROLLEN = ['Klientenführung', 'Job Coach', 'Fachperson', 'Teamleitung'];

export default function ZuweisungModal({ open, onClose, dossierId, bereitsZugewiesen, onSaved }) {
    const [benutzer, setBenutzer] = useState([]);
    const [laden, setLaden] = useState(false);
    const [ausgewaehlt, setAusgewaehlt] = useState(null);
    const [rolle, setRolle] = useState('Klientenführung');
    const [stellvertretung, setStellvertretung] = useState(false);
    const [speichern, setSpeichern] = useState(false);

    useEffect(() => {
        if (!open) return;
        setAusgewaehlt(null);
        setRolle('Klientenführung');
        setStellvertretung(false);
        setLaden(true);
        client.get('/benutzer')
            .then(r => setBenutzer(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [open]);

    const bereitsIds = new Set((bereitsZugewiesen || []).map(u => u.user_id));

    const handleSpeichern = async () => {
        if (!ausgewaehlt) return;
        setSpeichern(true);
        try {
            await client.post(`/dossiers/${dossierId}/zuweisung`, {
                user_id: ausgewaehlt,
                rolle_im_fall: rolle,
                stellvertretung
            });
            onSaved();
        } catch (err) {
            console.error(err);
        } finally {
            setSpeichern(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Person einem Dossier zuweisen" width={600}>
            {laden ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 13 }}>Laden…</div>
            ) : (
                <div>
                    <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: '1rem', border: '1px solid rgba(0,0,0,.09)', borderRadius: 8 }}>
                        {benutzer.map(u => {
                            const bereits = bereitsIds.has(u.user_id);
                            const selected = ausgewaehlt === u.user_id;
                            return (
                                <div
                                    key={u.user_id}
                                    onClick={() => !bereits && setAusgewaehlt(u.user_id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '9px 12px',
                                        borderBottom: '1px solid rgba(0,0,0,.05)',
                                        background: selected ? '#EEF3FE' : '#fff',
                                        cursor: bereits ? 'default' : 'pointer',
                                        opacity: bereits ? 0.5 : 1,
                                        outline: selected ? '2px solid #2563EB' : 'none',
                                        outlineOffset: -2,
                                        borderRadius: 0,
                                    }}
                                >
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 8,
                                        background: selected ? '#BFDBFE' : '#EEF3FE',
                                        color: '#1D4ED8', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0
                                    }}>{u.avatar_initials}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{u.full_name}</div>
                                        <div style={{ fontSize: 11, color: '#6B6860' }}>
                                            {u.system_rolle}
                                            {u.standort_kuerzel && ` · ${u.standort_kuerzel}`}
                                            {u.rollen?.length > 0 && ` · ${u.rollen.map(r => r.rolle_name).join(', ')}`}
                                        </div>
                                    </div>
                                    {bereits && (
                                        <span style={{ fontSize: 11, color: '#6B6860', fontStyle: 'italic', flexShrink: 0 }}>
                                            Bereits zugewiesen
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {ausgewaehlt && (
                        <div style={{
                            display: 'flex', gap: 16, alignItems: 'flex-end',
                            padding: '12px 14px', background: '#F5F4F0',
                            borderRadius: 8, marginBottom: '1rem',
                            border: '1px solid rgba(0,0,0,.09)'
                        }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Rolle im Fall</label>
                                <select value={rolle} onChange={e => setRolle(e.target.value)} style={{
                                    fontSize: 12, padding: '5px 9px', border: '1px solid rgba(0,0,0,.12)',
                                    borderRadius: 6, background: '#fff', fontFamily: 'inherit', width: '100%'
                                }}>
                                    {ROLLEN.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', paddingBottom: 3, flexShrink: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={stellvertretung}
                                    onChange={e => setStellvertretung(e.target.checked)}
                                />
                                Stellvertretung
                            </label>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={onClose} style={{
                            padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                            background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                        }}>Abbrechen</button>
                        <button
                            onClick={handleSpeichern}
                            disabled={!ausgewaehlt || speichern}
                            style={{
                                padding: '7px 18px', fontSize: 13, fontWeight: 500,
                                cursor: ausgewaehlt && !speichern ? 'pointer' : 'default',
                                border: 'none', borderRadius: 6, fontFamily: 'inherit',
                                background: ausgewaehlt && !speichern ? '#2563EB' : '#93C5FD',
                                color: '#fff'
                            }}
                        >Zuweisen</button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
