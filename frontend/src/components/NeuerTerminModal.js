import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const TYPEN = ['Erstgespräch', 'Schnuppereinsatz', 'Standortgespräch', 'Programmstart', 'Abschlussgespräch'];

export default function NeuerTerminModal({ open, onClose, onSaved, klientId, dossierZuweisungen }) {
    const { benutzer: currentUser } = useAuth();
    const [form, setForm] = useState({
        klient_id: klientId || '', typ: 'Erstgespräch', datum: '', zeit: '', notiz: ''
    });
    const [klienten, setKlienten] = useState([]);
    const [benutzer, setBenutzer] = useState([]);
    const [teilnehmende, setTeilnehmende] = useState([]);
    const [ichNehmeTeile, setIchNehmeTeile] = useState(true);
    const [dropdownOffen, setDropdownOffen] = useState(false);
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');

    useEffect(() => {
        if (!open) return;
        setDropdownOffen(false);
        if (!klientId) {
            client.get('/klienten').then(r => setKlienten(r.data)).catch(console.error);
        }
        if (!dossierZuweisungen) {
            client.get('/benutzer').then(r => setBenutzer(r.data)).catch(console.error);
        }
        if (klientId) setForm(prev => ({ ...prev, klient_id: klientId }));
    }, [open, klientId, dossierZuweisungen]);

    const personenListe = (dossierZuweisungen || benutzer).filter(b => b.user_id !== currentUser?.user_id);

    function set(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function toggleTeilnehmende(user_id) {
        setTeilnehmende(prev =>
            prev.includes(user_id) ? prev.filter(id => id !== user_id) : [...prev, user_id]
        );
    }

    async function speichern() {
        const effectiveKlientId = klientId || form.klient_id;
        if (!effectiveKlientId || !form.datum) {
            setFehler('Klient und Datum sind Pflichtfelder');
            return;
        }
        setFehler('');
        setLaden(true);
        try {
            const teilnehmendeFinal = ichNehmeTeile && currentUser?.user_id
                ? [...teilnehmende, currentUser.user_id]
                : teilnehmende;
            await client.post('/termine', {
                klient_id: effectiveKlientId,
                typ: form.typ,
                datum: form.datum,
                zeit: form.zeit || null,
                notiz: form.notiz || null,
                teilnehmende: teilnehmendeFinal,
            });
            onSaved();
            onClose();
            setForm({ klient_id: klientId || '', typ: 'Erstgespräch', datum: '', zeit: '', notiz: '' });
            setTeilnehmende([]);
            setIchNehmeTeile(true);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setLaden(false);
        }
    }

    const selectedLabel = teilnehmende.length === 0
        ? '— Auswählen —'
        : teilnehmende.length === 1
            ? (personenListe.find(b => b.user_id === teilnehmende[0])?.full_name || '1 Person')
            : `${teilnehmende.length} Personen ausgewählt`;

    return (
        <Modal open={open} onClose={onClose} title="Neuer Termin">
            {fehler && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 6, padding: '9px 12px', fontSize: 12,
                    color: '#B91C1C', marginBottom: 12
                }}>{fehler}</div>
            )}
            {!klientId && (
                <FormField label="Klient/in *">
                    <select style={inputStyle} value={form.klient_id} onChange={e => set('klient_id', e.target.value)}>
                        <option value="">— Klient auswählen —</option>
                        {klienten.map(k => (
                            <option key={k.klient_id} value={k.klient_id}>{k.nachname} {k.vorname}</option>
                        ))}
                    </select>
                </FormField>
            )}
            <FormField label="Typ">
                <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                    {TYPEN.map(t => <option key={t}>{t}</option>)}
                </select>
            </FormField>
            <div style={rowStyle}>
                <FormField label="Datum *">
                    <input type="date" style={inputStyle} value={form.datum} onChange={e => set('datum', e.target.value)} />
                </FormField>
                <FormField label="Zeit">
                    <input type="time" style={inputStyle} value={form.zeit} onChange={e => set('zeit', e.target.value)} />
                </FormField>
            </div>
            <FormField label="Teilnehmende Personen">
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => setDropdownOffen(o => !o)}
                        style={{
                            ...inputStyle,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            color: teilnehmende.length > 0 ? '#1A1917' : '#A09D97',
                        }}
                    >
                        <span>{selectedLabel}</span>
                        <span style={{ fontSize: 10, color: '#A09D97', marginLeft: 6 }}>{dropdownOffen ? '▲' : '▼'}</span>
                    </button>

                    {dropdownOffen && (
                        <>
                            <div onClick={() => setDropdownOffen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 10,
                                background: '#fff', border: '1px solid rgba(0,0,0,.12)',
                                borderRadius: 7, boxShadow: '0 4px 14px rgba(0,0,0,.12)',
                                maxHeight: 200, overflowY: 'auto',
                            }}>
                                {personenListe.length === 0 ? (
                                    <div style={{ padding: '10px 12px', fontSize: 12, color: '#A09D97' }}>Lädt…</div>
                                ) : personenListe.map(b => {
                                    const sel = teilnehmende.includes(b.user_id);
                                    return (
                                        <label
                                            key={b.user_id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 9,
                                                padding: '8px 12px', cursor: 'pointer',
                                                borderBottom: '1px solid rgba(0,0,0,.04)',
                                                background: sel ? '#F0F5FF' : '#fff',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={sel}
                                                onChange={() => toggleTeilnehmende(b.user_id)}
                                                style={{ accentColor: '#2563EB', flexShrink: 0 }}
                                            />
                                            <div style={{
                                                width: 22, height: 22, borderRadius: 6,
                                                background: sel ? '#2563EB' : '#D1D5DB',
                                                color: '#fff', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: 8.5, fontWeight: 700, flexShrink: 0
                                            }}>{b.avatar_initials || b.full_name?.[0] || '?'}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: sel ? 500 : 400, color: '#1A1917' }}>{b.full_name}</div>
                                                {b.rolle_im_fall && (
                                                    <div style={{ fontSize: 10.5, color: '#6B6860' }}>{b.rolle_im_fall}</div>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </FormField>
            <FormField label="Ich nehme teil">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 0' }}>
                    <input
                        type="checkbox"
                        checked={ichNehmeTeile}
                        onChange={e => setIchNehmeTeile(e.target.checked)}
                        style={{ accentColor: '#2563EB', width: 15, height: 15, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12.5, color: ichNehmeTeile ? '#1A1917' : '#A09D97' }}>
                        {ichNehmeTeile ? 'Ja — ich nehme an diesem Termin teil' : 'Nein — ich nehme nicht teil'}
                    </span>
                </label>
            </FormField>
            <FormField label="Notiz">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical', lineHeight: 1.5 }}
                    value={form.notiz} onChange={e => set('notiz', e.target.value)}
                    placeholder="Optional…"
                />
            </FormField>
            <div style={btnRow}>
                <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                <button style={{ ...btnPrimary, opacity: laden ? .7 : 1 }} onClick={speichern} disabled={laden}>
                    {laden ? 'Speichern…' : 'Termin erfassen'}
                </button>
            </div>
        </Modal>
    );
}
