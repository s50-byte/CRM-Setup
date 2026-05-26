import { useState, useEffect } from 'react';
import Modal from './Modal';
import client from '../api/client';

const ROLLEN = ['Klientenführung', 'Job Coach', 'Fachperson', 'Stellvertretung'];

let _seq = 1;
const uid = () => String(_seq++);

function buildRows(zugewiesen) {
    const rows = [];
    for (const rolle of ROLLEN) {
        const existing = (zugewiesen || []).filter(z =>
            rolle === 'Stellvertretung'
                ? z.stellvertretung
                : z.rolle_im_fall === rolle && !z.stellvertretung
        );
        if (existing.length > 0) {
            for (const z of existing) rows.push({ id: uid(), rolle, user_id: z.user_id });
        } else {
            rows.push({ id: uid(), rolle, user_id: '' });
        }
    }
    return rows;
}

const SEL = {
    flex: 1, fontSize: 12, padding: '6px 9px',
    border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
    background: '#fff', fontFamily: 'inherit'
};

export default function ZuweisungModal({ open, onClose, onSaved, dossierId, zugewiesen, standortKuerzel }) {
    const [benutzer, setBenutzer] = useState([]);
    const [rows, setRows] = useState([]);
    const [laden, setLaden] = useState(false);
    const [speichern, setSpeichern] = useState(false);

    useEffect(() => {
        if (!open) return;
        setRows(buildRows(zugewiesen));
        setLaden(true);
        client.get('/benutzer')
            .then(r => setBenutzer(r.data))
            .catch(console.error)
            .finally(() => setLaden(false));
    }, [open]);

    const setUser = (id, user_id) =>
        setRows(rs => rs.map(r => r.id === id ? { ...r, user_id } : r));

    const addRow = (rolle) =>
        setRows(rs => {
            let insertAt = rs.length;
            for (let i = rs.length - 1; i >= 0; i--) {
                if (rs[i].rolle === rolle) { insertAt = i + 1; break; }
            }
            return [...rs.slice(0, insertAt), { id: uid(), rolle, user_id: '' }, ...rs.slice(insertAt)];
        });

    const removeRow = (id) =>
        setRows(rs => rs.filter(r => r.id !== id));

    const handleSpeichern = async () => {
        setSpeichern(true);
        try {
            const originalIds = new Set((zugewiesen || []).map(z => z.user_id));
            const toSave = rows.filter(r => r.user_id !== '');
            const newIds = new Set(toSave.map(r => r.user_id));

            for (const row of toSave) {
                await client.post(`/dossiers/${dossierId}/zuweisung`, {
                    user_id: row.user_id,
                    rolle_im_fall: row.rolle === 'Stellvertretung' ? 'Stellvertretung' : row.rolle,
                    stellvertretung: row.rolle === 'Stellvertretung'
                });
            }

            for (const id of originalIds) {
                if (!newIds.has(id)) {
                    await client.delete(`/dossiers/${dossierId}/zuweisung/${id}`);
                }
            }

            onSaved();
        } catch (err) {
            console.error(err);
        } finally {
            setSpeichern(false);
        }
    };

    const kandidaten = standortKuerzel
        ? benutzer.filter(u => u.standort_kuerzel === standortKuerzel)
        : benutzer;

    const selectedIds = new Set(rows.filter(r => r.user_id).map(r => r.user_id));

    return (
        <Modal open={open} onClose={onClose} title="Zuweisungen bearbeiten" width={600}>
            {laden ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6B6860', fontSize: 13 }}>Laden…</div>
            ) : (
                <div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        {ROLLEN.map(rolle => {
                            const rolleRows = rows.filter(r => r.rolle === rolle);
                            return (
                                <div key={rolle} style={{
                                    display: 'grid', gridTemplateColumns: '150px 1fr',
                                    gap: '8px 12px', alignItems: 'start',
                                    padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.06)'
                                }}>
                                    <div style={{ paddingTop: 7 }}>
                                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1A1917' }}>{rolle}</div>
                                    </div>
                                    <div>
                                        {rolleRows.map((row) => (
                                            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                                <select
                                                    value={row.user_id}
                                                    onChange={e => setUser(row.id, e.target.value)}
                                                    style={SEL}
                                                >
                                                    <option value="">— Person auswählen —</option>
                                                    {kandidaten.map(u => (
                                                        <option
                                                            key={u.user_id}
                                                            value={u.user_id}
                                                            disabled={selectedIds.has(u.user_id) && u.user_id !== row.user_id}
                                                        >
                                                            {u.full_name}{u.standort_kuerzel ? ` (${u.standort_kuerzel})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                {rolleRows.length > 1 && (
                                                    <button onClick={() => removeRow(row.id)} style={{
                                                        width: 26, height: 26, flexShrink: 0,
                                                        border: '1px solid rgba(220,38,38,.2)', borderRadius: 6,
                                                        background: '#FEF2F2', color: '#B91C1C',
                                                        cursor: 'pointer', fontSize: 15, lineHeight: 1,
                                                        fontFamily: 'inherit'
                                                    }}>×</button>
                                                )}
                                            </div>
                                        ))}
                                        <button onClick={() => addRow(rolle)} style={{
                                            fontSize: 11, color: '#2563EB', background: 'none',
                                            border: 'none', cursor: 'pointer', padding: '2px 0',
                                            fontFamily: 'inherit'
                                        }}>+ weitere Person</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: '0.5rem' }}>
                        <button onClick={onClose} style={{
                            padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                            border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
                            background: '#fff', fontFamily: 'inherit', color: '#6B6860'
                        }}>Abbrechen</button>
                        <button onClick={handleSpeichern} disabled={speichern} style={{
                            padding: '7px 18px', fontSize: 13, fontWeight: 500,
                            cursor: speichern ? 'default' : 'pointer', border: 'none',
                            borderRadius: 6, fontFamily: 'inherit',
                            background: speichern ? '#93C5FD' : '#2563EB', color: '#fff'
                        }}>Speichern</button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
