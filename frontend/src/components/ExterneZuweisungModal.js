import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

const ROLLEN = ['IV-Stelle', 'RAV', 'Sozialdienst', 'Arbeitgeber', 'Arzt / Therapeut', 'Gesetzl. Vertreter', 'Sonstiges'];

export default function ExterneZuweisungModal({ open, onClose, onSaved, dossierId, zugewieseneExterne }) {
    const [personen, setPersonen] = useState([]);
    const [suche, setSuche] = useState('');
    const [auswahl, setAuswahl] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        client.get('/externe').then(r => {
            const standalone = r.data.personen || [];
            const orgMitglieder = (r.data.organisationen || []).flatMap(org =>
                (org.mitglieder || []).map(m => ({
                    ...m,
                    organisation_name: org.firma,
                }))
            );
            setPersonen([...standalone, ...orgMitglieder]);
        }).catch(console.error);
        setSuche('');
        setAuswahl(null);
    }, [open]);

    const zugewieseneIds = new Set((zugewieseneExterne || []).map(p => p.person_id));

    const gefiltert = personen.filter(p => {
        const text = `${p.nachname} ${p.vorname} ${p.funktion || ''} ${p.organisation_name || ''}`.toLowerCase();
        return (!suche || text.includes(suche.toLowerCase())) && !zugewieseneIds.has(p.person_id);
    });

    async function hinzufuegen(person_id, rolle) {
        setBusy(true);
        try {
            await client.post(`/externe/${person_id}/dossier`, { dossier_id: dossierId, rolle });
            onSaved();
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    async function entfernen(person_id) {
        setBusy(true);
        try {
            await client.delete(`/externe/${person_id}/dossier/${dossierId}`);
            onSaved();
        } catch (err) { console.error(err); }
        finally { setBusy(false); }
    }

    return (
        <Modal open={open} onClose={onClose} title="Externe Person zuweisen" width={520}>
            {(zugewieseneExterne?.length > 0) && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                        Bereits zugewiesen
                    </div>
                    {zugewieseneExterne.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: '#F5F4F0', borderRadius: 7, marginBottom: 5, border: '1px solid rgba(0,0,0,.06)' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#2563EB22', color: '#2563EB', border: '1px solid #2563EB33', fontFamily: 'monospace', flexShrink: 0 }}>{p.rolle}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.nachname} {p.vorname}</div>
                                {(p.funktion || p.firma) && (
                                    <div style={{ fontSize: 11, color: '#6B6860' }}>
                                        {p.funktion}{p.firma ? ` (${p.firma})` : ''}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => entfernen(p.person_id)}
                                disabled={busy}
                                style={{ padding: '3px 9px', fontSize: 11, cursor: 'pointer', border: '1px solid rgba(220,38,38,.2)', borderRadius: 5, background: '#FEF2F2', color: '#B91C1C', fontFamily: 'inherit' }}
                            >Entfernen</button>
                        </div>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(0,0,0,.07)', marginTop: 12, marginBottom: 14 }} />
                </div>
            )}

            <input
                type="text"
                value={suche}
                onChange={e => setSuche(e.target.value)}
                placeholder="Suchen nach Name, Funktion oder Organisation…"
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
            />

            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {gefiltert.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#6B6860', padding: '8px 0' }}>
                        {suche ? 'Keine Personen gefunden' : 'Alle externen Personen sind bereits zugewiesen'}
                    </div>
                ) : gefiltert.map((p, i) => {
                    const isSelected = auswahl?.person_id === p.person_id;
                    return (
                        <div
                            key={i}
                            onClick={() => setAuswahl(isSelected ? null : { person_id: p.person_id, rolle: 'Sonstiges' })}
                            style={{
                                padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                                border: `1px solid ${isSelected ? '#2563EB' : 'rgba(0,0,0,.07)'}`,
                                background: isSelected ? '#EEF3FE' : '#fff',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.nachname} {p.vorname}</div>
                                    {(p.funktion || p.organisation_name) && (
                                        <div style={{ fontSize: 11, color: '#6B6860' }}>
                                            {p.funktion}{p.organisation_name ? ` (${p.organisation_name})` : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {isSelected && (
                                <div style={{ marginTop: 9, display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select
                                        value={auswahl.rolle}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => { e.stopPropagation(); setAuswahl(a => ({ ...a, rolle: e.target.value })); }}
                                        style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid rgba(0,0,0,.09)', borderRadius: 5, background: '#fff', fontFamily: 'inherit' }}
                                    >
                                        {ROLLEN.map(r => <option key={r}>{r}</option>)}
                                    </select>
                                    <button
                                        onClick={e => { e.stopPropagation(); hinzufuegen(p.person_id, auswahl.rolle); }}
                                        disabled={busy}
                                        style={{ padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 5, background: '#2563EB', color: '#fff', fontFamily: 'inherit' }}
                                    >Zuweisen</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
