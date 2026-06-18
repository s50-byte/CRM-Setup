import { useState, useEffect } from 'react';
import client from '../api/client';
import Modal from './Modal';

export default function ExterneZuweisungModal({ open, onClose, onSaved, dossierId, zugewieseneExterne }) {
    const [personen, setPersonen] = useState([]);
    const [suche, setSuche] = useState('');
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
    }, [open]);

    const zugewieseneIds = new Set((zugewieseneExterne || []).map(p => p.person_id));

    const gefiltert = personen.filter(p => {
        const text = `${p.nachname} ${p.vorname} ${p.funktion || ''} ${p.organisation_name || ''}`.toLowerCase();
        return (!suche || text.includes(suche.toLowerCase())) && !zugewieseneIds.has(p.person_id);
    });

    async function hinzufuegen(p) {
        console.log('person beim Zuweisen:', p);
        const rolle = p.funktion || p.typ || 'Sonstiges';
        setBusy(true);
        try {
            await client.post(`/externe/${p.person_id}/dossier`, { dossier_id: dossierId, rolle });
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
                    const rolleLabel = p.funktion || p.typ || 'Sonstiges';
                    return (
                        <div
                            key={i}
                            onClick={() => !busy && hinzufuegen(p)}
                            style={{
                                padding: '8px 10px', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer',
                                border: '1px solid rgba(0,0,0,.07)',
                                background: '#fff',
                                display: 'flex', alignItems: 'center', gap: 9,
                                transition: 'background .1s',
                            }}
                            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = '#F5F4F0'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.nachname} {p.vorname}</div>
                                <div style={{ fontSize: 11, color: '#6B6860' }}>
                                    {rolleLabel}{p.organisation_name ? ` (${p.organisation_name})` : ''}
                                </div>
                            </div>
                            <span style={{ fontSize: 11, color: '#2563EB', opacity: .6 }}>+ Zuweisen</span>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
