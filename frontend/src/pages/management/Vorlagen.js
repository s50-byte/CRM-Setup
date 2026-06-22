import { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

const TYPEN = [
    { value: 'brief',    label: 'Brief' },
    { value: 'praesenz', label: 'Präsenz' },
    { value: 'bericht',  label: 'Bericht' },
];

const PLATZHALTER = [
    { key: 'anrede',            label: 'Anrede' },
    { key: 'vorname',           label: 'Vorname' },
    { key: 'nachname',          label: 'Nachname' },
    { key: 'adresse',           label: 'Adresse' },
    { key: 'plz',               label: 'PLZ' },
    { key: 'ort',               label: 'Ort' },
    { key: 'ahv_nr',            label: 'AHV-Nr.' },
    { key: 'geburtsdatum',      label: 'Geburtsdatum' },
    { key: 'programm',          label: 'Programm' },
    { key: 'phase',             label: 'Phase' },
    { key: 'standort',          label: 'Standort' },
    { key: 'abteilung',         label: 'Abteilung' },
    { key: 'startdatum',        label: 'Startdatum' },
    { key: 'enddatum',          label: 'Enddatum' },
    { key: 'verfuegung_nummer', label: 'Verfügungsnummer' },
    { key: 'zuweisende_stelle', label: 'Zuweisende Stelle' },
    { key: 'klientenfuehrung',  label: 'Klientenführung' },
    { key: 'datum_heute',       label: 'Datum heute' },
];

const LEER = { name: '', beschreibung: '', inhalt: '', typ: 'brief', leistung_ids: [] };

const S = {
    input: {
        fontSize: 13, padding: '6px 10px', borderRadius: 6,
        border: '1px solid rgba(0,0,0,.12)', background: '#fff',
        fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box',
    },
    label: { fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 4, display: 'block' },
    btn: (primary) => ({
        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        border: primary ? 'none' : '1px solid rgba(0,0,0,.12)', borderRadius: 6,
        background: primary ? '#2563EB' : '#fff', color: primary ? '#fff' : '#1A1917',
        fontFamily: 'inherit',
    }),
};

export default function Vorlagen() {
    const [vorlagen, setVorlagen] = useState([]);
    const [leistungen, setLeistungen] = useState([]);
    const [laden, setLaden] = useState(true);
    const [ausgewaehlt, setAusgewaehlt] = useState(null); // vorlage_id or 'neu'
    const [form, setForm] = useState(LEER);
    const [speichern, setSpeichern] = useState(false);
    const [vorschauText, setVorschauText] = useState('');
    const [vorschauLaden, setVorschauLaden] = useState(false);
    const [vorschauOffen, setVorschauOffen] = useState(false);
    const [loeschenId, setLoeschenId] = useState(null);
    const textareaRef = useRef(null);

    function ladeVorlagen() {
        return client.get('/vorlagen').then(r => setVorlagen(r.data));
    }

    useEffect(() => {
        Promise.all([
            ladeVorlagen(),
            client.get('/leistungen').then(r => setLeistungen(r.data)),
        ]).catch(console.error).finally(() => setLaden(false));
    }, []);

    function oeffneNeu() {
        setAusgewaehlt('neu');
        setForm(LEER);
        setVorschauOffen(false);
        setVorschauText('');
    }

    async function oeffneBearbeiten(v) {
        console.log('Vorlage öffnen:', v);
        setAusgewaehlt(v.vorlage_id);
        setForm({ name: v.name || '', beschreibung: v.beschreibung || '', inhalt: '', typ: v.typ || 'brief' });
        setVorschauOffen(false);
        setVorschauText('');
        try {
            const r = await client.get(`/vorlagen/${v.vorlage_id}`);
            setForm({
                name: r.data.name || '',
                beschreibung: r.data.beschreibung || '',
                inhalt: r.data.inhalt || '',
                typ: r.data.typ || 'brief',
                leistung_ids: r.data.leistung_ids || [],
            });
        } catch (err) {
            console.error('Vorlage laden:', err);
        }
    }

    function schliesseEditor() {
        setAusgewaehlt(null);
        setVorschauOffen(false);
        setVorschauText('');
    }

    function fuelleIn(key) {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = form.inhalt;
        const neu = val.slice(0, start) + `{${key}}` + val.slice(end);
        setForm(f => ({ ...f, inhalt: neu }));
        setTimeout(() => {
            ta.focus();
            const pos = start + key.length + 2;
            ta.setSelectionRange(pos, pos);
        }, 0);
    }

    async function handleSpeichern() {
        if (!form.name.trim() || !form.inhalt.trim()) return;
        setSpeichern(true);
        try {
            if (ausgewaehlt === 'neu') {
                await client.post('/vorlagen', form);
            } else {
                await client.put(`/vorlagen/${ausgewaehlt}`, form);
            }
            await ladeVorlagen();
            schliesseEditor();
        } catch (err) {
            console.error(err);
        } finally {
            setSpeichern(false);
        }
    }

    async function handleLoeschen(id) {
        try {
            await client.delete(`/vorlagen/${id}`);
            await ladeVorlagen();
            if (ausgewaehlt === id) schliesseEditor();
        } catch (err) {
            console.error(err);
        } finally {
            setLoeschenId(null);
        }
    }

    async function handleVorschau() {
        if (!form.inhalt.trim()) return;
        setVorschauLaden(true);
        setVorschauOffen(true);
        try {
            const r = await client.post('/vorlagen/vorschau', { inhalt: form.inhalt });
            setVorschauText(r.data.vorschau);
        } catch (err) {
            console.error(err);
            setVorschauText('Fehler beim Laden der Vorschau.');
        } finally {
            setVorschauLaden(false);
        }
    }

    const typLabel = (v) => TYPEN.find(t => t.value === v?.typ)?.label || v?.typ || '';

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ fontSize: 19, fontWeight: 600 }}>Dokumentvorlagen</div>
                    <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Serienbrief-Vorlagen mit Platzhaltern</div>
                </div>
                <button onClick={oeffneNeu} style={S.btn(true)}>+ Neue Vorlage</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: ausgewaehlt ? '280px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
                {/* LISTE */}
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
                    {laden ? (
                        <div style={{ padding: '1.5rem', fontSize: 12, color: '#6B6860' }}>Laden…</div>
                    ) : vorlagen.length === 0 ? (
                        <div style={{ padding: '1.5rem', fontSize: 12, color: '#A09D97', textAlign: 'center' }}>
                            Noch keine Vorlagen vorhanden.<br />
                            <button onClick={oeffneNeu} style={{ marginTop: 10, ...S.btn(true) }}>+ Neue Vorlage erstellen</button>
                        </div>
                    ) : vorlagen.map((v, i) => {
                        const aktiv = ausgewaehlt === v.vorlage_id;
                        return (
                            <div key={v.vorlage_id} style={{
                                borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none',
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 12px',
                                background: aktiv ? '#EEF3FE' : 'transparent',
                                cursor: 'pointer',
                            }}
                                onClick={() => oeffneBearbeiten(v)}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: aktiv ? 500 : 400, color: aktiv ? '#2563EB' : '#1A1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {v.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#A09D97', marginTop: 1 }}>{typLabel(v)}</div>
                                </div>
                                <button
                                    onClick={e => { e.stopPropagation(); setLoeschenId(v.vorlage_id); }}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#A09D97', padding: '2px 4px', lineHeight: 1 }}
                                    title="Löschen"
                                >✕</button>
                            </div>
                        );
                    })}
                </div>

                {/* EDITOR */}
                {ausgewaehlt && (
                    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.09)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.07)', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ fontSize: 15, fontWeight: 600 }}>
                                {ausgewaehlt === 'neu' ? 'Neue Vorlage' : 'Vorlage bearbeiten'}
                            </div>
                            <button onClick={schliesseEditor} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#A09D97' }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                                <label style={S.label}>Name *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="z.B. Einladungsschreiben"
                                    style={S.input}
                                />
                            </div>
                            <div>
                                <label style={S.label}>Typ</label>
                                <select
                                    value={form.typ}
                                    onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}
                                    style={S.input}
                                >
                                    {TYPEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={S.label}>Beschreibung</label>
                            <input
                                value={form.beschreibung}
                                onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                                placeholder="Kurze Beschreibung (optional)"
                                style={S.input}
                            />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={S.label}>Zugeordnete Massnahmen (Tarife)</label>
                            <div style={{
                                border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                                background: '#fff', maxHeight: 120, overflowY: 'auto', padding: '4px 0',
                            }}>
                                {leistungen.length === 0
                                    ? <div style={{ padding: '6px 10px', fontSize: 12, color: '#A09D97' }}>Keine Leistungen vorhanden</div>
                                    : leistungen.map(l => {
                                        const checked = form.leistung_ids.includes(l.leistung_id);
                                        return (
                                            <label key={l.leistung_id} style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '4px 10px', cursor: 'pointer', fontSize: 12.5,
                                                background: checked ? '#EEF3FE' : 'transparent',
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        const ids = checked
                                                            ? form.leistung_ids.filter(id => id !== l.leistung_id)
                                                            : [...form.leistung_ids, l.leistung_id];
                                                        setForm(f => ({ ...f, leistung_ids: ids }));
                                                    }}
                                                    style={{ accentColor: '#2563EB', flexShrink: 0 }}
                                                />
                                                <span style={{ fontFamily: 'monospace', color: '#2563EB', fontSize: 11 }}>{l.tarifnr}</span>
                                                <span style={{ color: '#1A1917' }}>{l.bezeichnung}</span>
                                            </label>
                                        );
                                    })
                                }
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, alignItems: 'start' }}>
                            <div>
                                <label style={S.label}>Inhalt *</label>
                                <textarea
                                    ref={textareaRef}
                                    value={form.inhalt}
                                    onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))}
                                    placeholder="Vorlagetext mit {platzhalter}…"
                                    rows={18}
                                    style={{ ...S.input, resize: 'vertical', lineHeight: 1.6, fontFamily: 'monospace', fontSize: 12.5 }}
                                />
                            </div>

                            <div>
                                <label style={S.label}>Platzhalter einfügen</label>
                                <div style={{ border: '1px solid rgba(0,0,0,.09)', borderRadius: 6, overflow: 'hidden' }}>
                                    {PLATZHALTER.map((ph, i) => (
                                        <button
                                            key={ph.key}
                                            onClick={() => fuelleIn(ph.key)}
                                            title={`{${ph.key}}`}
                                            style={{
                                                display: 'block', width: '100%', textAlign: 'left',
                                                padding: '5px 10px', fontSize: 11.5, cursor: 'pointer',
                                                border: 'none', borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : 'none',
                                                background: 'transparent', fontFamily: 'inherit', color: '#1A1917',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#EEF3FE'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontFamily: 'monospace', color: '#2563EB', fontSize: 10.5 }}>{`{${ph.key}}`}</span>
                                            <span style={{ color: '#6B6860', marginLeft: 5 }}>{ph.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleVorschau}
                                disabled={vorschauLaden || !form.inhalt.trim()}
                                style={{ ...S.btn(false), opacity: !form.inhalt.trim() ? .5 : 1 }}
                            >
                                {vorschauLaden ? 'Lädt…' : '👁 Vorschau'}
                            </button>
                            <button onClick={schliesseEditor} style={S.btn(false)}>Abbrechen</button>
                            <button
                                onClick={handleSpeichern}
                                disabled={speichern || !form.name.trim() || !form.inhalt.trim()}
                                style={{ ...S.btn(true), opacity: (!form.name.trim() || !form.inhalt.trim()) ? .5 : 1 }}
                            >
                                {speichern ? 'Speichert…' : 'Speichern'}
                            </button>
                        </div>

                        {vorschauOffen && (
                            <div style={{ marginTop: 20, borderTop: '1px solid rgba(0,0,0,.09)', paddingTop: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em' }}>Vorschau (Beispieldaten)</div>
                                    <button onClick={() => setVorschauOffen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#A09D97' }}>✕</button>
                                </div>
                                <pre style={{
                                    background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                    borderRadius: 6, padding: '1rem',
                                    fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                                    fontFamily: 'inherit', color: '#1A1917', margin: 0
                                }}>
                                    {vorschauLaden ? 'Lädt…' : vorschauText}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* LÖSCH-BESTÄTIGUNG */}
            {loeschenId && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '1.5rem', maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Vorlage löschen?</div>
                        <div style={{ fontSize: 13, color: '#6B6860', marginBottom: 20 }}>
                            Die Vorlage wird deaktiviert und aus der Liste entfernt.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setLoeschenId(null)} style={S.btn(false)}>Abbrechen</button>
                            <button
                                onClick={() => handleLoeschen(loeschenId)}
                                style={{ ...S.btn(false), background: '#FEF2F2', color: '#B91C1C', border: '1px solid rgba(185,28,28,.2)' }}
                            >Löschen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
