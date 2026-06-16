import { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { inputStyle, rowStyle, btnRow, btnPrimary, btnSecondary } from './FormField';
import client from '../api/client';

const TYPEN = ['IV-Stelle', 'RAV', 'Sozialdienst', 'Arbeitgeber', 'Arzt / Therapeut', 'Gesetzl. Vertreter', 'Sonstiges'];

const LEER = {
    nachname: '', vorname: '', funktion: '', typ: 'Sonstiges',
    firma: '', telefon: '', email: '', adresse: '', bemerkung: '',
    ist_organisation: false, organisation_id: '',
};

export default function ExternePersonModal({ open, onClose, onSaved, person, defaultIsOrganisation }) {
    const bearbeiten = !!person;
    const [form, setForm] = useState(LEER);
    const [fehler, setFehler] = useState('');
    const [speichern, setSpeichern] = useState(false);
    const [aktTab, setAktTab] = useState('details');

    const [organisationen, setOrganisationen] = useState([]);

    const [leistungen, setLeistungen] = useState([]);
    const [stundenpreise, setStundenpreise] = useState([]);
    const [neueLeistungId, setNeueLeistungId] = useState('');
    const [neuerPreis, setNeuerPreis] = useState('');
    const [spBusy, setSpBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFehler('');
        setAktTab('details');
        setNeueLeistungId('');
        setNeuerPreis('');
        setForm(person ? {
            nachname: person.nachname || '',
            vorname: person.vorname || '',
            funktion: person.funktion || '',
            typ: person.typ || 'Sonstiges',
            firma: person.firma || '',
            telefon: person.telefon || '',
            email: person.email || '',
            adresse: person.adresse || '',
            bemerkung: person.bemerkung || '',
            ist_organisation: person.ist_organisation || false,
            organisation_id: person.organisation_id || '',
        } : { ...LEER, ist_organisation: defaultIsOrganisation || false });

        client.get('/externe')
            .then(r => setOrganisationen(r.data.organisationen || []))
            .catch(console.error);

        if (person?.ist_organisation) {
            client.get('/leistungen').then(r => setLeistungen(r.data)).catch(console.error);
            ladeStundenpreise(person.person_id);
        }
    }, [open, person, defaultIsOrganisation]);

    function ladeStundenpreise(id) {
        client.get(`/externe/${id}/stundenpreise`)
            .then(r => setStundenpreise(r.data))
            .catch(console.error);
    }

    function set(f, v) { setForm(prev => ({ ...prev, [f]: v })); }

    async function handleSpeichern() {
        if (form.ist_organisation) {
            if (!form.firma.trim()) {
                setFehler('Name der Organisation ist erforderlich');
                return;
            }
        } else {
            if (!form.nachname.trim() || !form.vorname.trim()) {
                setFehler('Nachname und Vorname sind erforderlich');
                return;
            }
        }
        setFehler('');
        setSpeichern(true);
        try {
            const body = {
                ...form,
                organisation_id: form.organisation_id || null,
                nachname: form.ist_organisation
                    ? (form.nachname.trim() || form.firma.trim())
                    : form.nachname,
            };
            if (bearbeiten) {
                await client.put(`/externe/${person.person_id}`, body);
            } else {
                await client.post('/externe', body);
            }
            onSaved();
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern');
        } finally {
            setSpeichern(false);
        }
    }

    async function stundenpreisHinzufuegen() {
        if (!neueLeistungId || !neuerPreis) return;
        setSpBusy(true);
        try {
            await client.post(`/externe/${person.person_id}/stundenpreise`, {
                leistung_id: neueLeistungId,
                stundenpreis: parseFloat(neuerPreis),
            });
            setNeueLeistungId('');
            setNeuerPreis('');
            ladeStundenpreise(person.person_id);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Speichern des Stundenpreises');
        } finally {
            setSpBusy(false);
        }
    }

    async function stundenpreisLoeschen(leistung_id) {
        setSpBusy(true);
        try {
            await client.delete(`/externe/${person.person_id}/stundenpreise/${leistung_id}`);
            ladeStundenpreise(person.person_id);
        } catch (err) {
            console.error(err);
        } finally {
            setSpBusy(false);
        }
    }

    const zeigtTabs = bearbeiten && !!person?.ist_organisation;
    const modalTitel = bearbeiten
        ? (person.ist_organisation ? 'Organisation bearbeiten' : 'Externe Person bearbeiten')
        : (defaultIsOrganisation ? 'Neue Organisation' : 'Neue externe Person');

    return (
        <Modal open={open} onClose={onClose} title={modalTitel} width={600}>
            {/* Tabs */}
            {zeigtTabs && (
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,.09)', marginBottom: 16, marginTop: -4 }}>
                    {[
                        { key: 'details', label: 'Details' },
                        { key: 'stundenpreise', label: `Stundenpreise${stundenpreise.length > 0 ? ` (${stundenpreise.length})` : ''}` },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setAktTab(tab.key)} style={{
                            padding: '8px 16px', fontSize: 12.5, fontWeight: aktTab === tab.key ? 600 : 400,
                            cursor: 'pointer', border: 'none', background: 'transparent',
                            color: aktTab === tab.key ? '#2563EB' : '#6B6860',
                            borderBottom: aktTab === tab.key ? '2px solid #2563EB' : '2px solid transparent',
                            fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.04em',
                        }}>{tab.label}</button>
                    ))}
                </div>
            )}

            {fehler && (
                <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, padding: '9px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>
                    {fehler}
                </div>
            )}

            {/* Tab: Details */}
            {(!zeigtTabs || aktTab === 'details') && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: '8px 12px', background: '#F5F4F0', borderRadius: 7, border: '1px solid rgba(0,0,0,.07)' }}>
                        <input
                            type="checkbox"
                            id="ist_org_check"
                            checked={form.ist_organisation}
                            onChange={e => set('ist_organisation', e.target.checked)}
                            style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                        />
                        <label htmlFor="ist_org_check" style={{ fontSize: 12.5, cursor: 'pointer', fontWeight: 500, color: '#1A1917' }}>
                            Ist Organisation / Firma (kein Einzelkontakt)
                        </label>
                    </div>

                    {/* Organisation-Modus: Firma/Name als Pflichtfeld oben */}
                    {form.ist_organisation && (
                        <FormField label="Name der Organisation *">
                            <input
                                style={inputStyle}
                                value={form.firma}
                                onChange={e => set('firma', e.target.value)}
                                placeholder="z.B. IV-Stelle Zürich"
                                autoFocus
                            />
                        </FormField>
                    )}

                    <div style={rowStyle}>
                        <FormField label={form.ist_organisation ? 'Nachname (Ansprechperson)' : 'Nachname *'}>
                            <input
                                style={inputStyle}
                                value={form.nachname}
                                onChange={e => set('nachname', e.target.value)}
                                placeholder="Muster"
                                autoFocus={!form.ist_organisation}
                            />
                        </FormField>
                        <FormField label={form.ist_organisation ? 'Vorname (Ansprechperson)' : 'Vorname *'}>
                            <input
                                style={inputStyle}
                                value={form.vorname}
                                onChange={e => set('vorname', e.target.value)}
                                placeholder="Max"
                            />
                        </FormField>
                    </div>

                    {/* Person-Modus: Org-Zugehörigkeit */}
                    {!form.ist_organisation && (
                        <FormField label="Zugehörige Organisation">
                            <select style={inputStyle} value={form.organisation_id} onChange={e => set('organisation_id', e.target.value)}>
                                <option value="">— Keine —</option>
                                {organisationen.map(o => (
                                    <option key={o.person_id} value={o.person_id}>
                                        {o.firma || o.nachname}{o.vorname ? ` (${o.vorname})` : ''}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                    )}

                    <div style={rowStyle}>
                        <FormField label="Funktion">
                            <input style={inputStyle} value={form.funktion} onChange={e => set('funktion', e.target.value)} placeholder="z.B. Sachbearbeiterin" />
                        </FormField>
                        <FormField label="Typ">
                            <select style={inputStyle} value={form.typ} onChange={e => set('typ', e.target.value)}>
                                {TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </FormField>
                    </div>

                    {/* Firma: nur für Personen (für Orgs ist firma = Name der Organisation oben) */}
                    {!form.ist_organisation && (
                        <FormField label="Firma / Arbeitgeber">
                            <input style={inputStyle} value={form.firma} onChange={e => set('firma', e.target.value)} placeholder="z.B. Musterfirma AG" />
                        </FormField>
                    )}

                    <div style={rowStyle}>
                        <FormField label="Telefon">
                            <input style={inputStyle} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+41 44 123 45 67" />
                        </FormField>
                        <FormField label="E-Mail">
                            <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="max.muster@beispiel.ch" />
                        </FormField>
                    </div>

                    <FormField label="Adresse">
                        <input style={inputStyle} value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Strasse Nr., PLZ Ort" />
                    </FormField>

                    <FormField label="Bemerkung">
                        <textarea
                            value={form.bemerkung}
                            onChange={e => set('bemerkung', e.target.value)}
                            rows={3}
                            placeholder="Interne Notizen…"
                            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                        />
                    </FormField>

                    <div style={btnRow}>
                        <button style={btnSecondary} onClick={onClose}>Abbrechen</button>
                        <button style={{ ...btnPrimary, opacity: speichern ? .6 : 1, cursor: speichern ? 'default' : 'pointer' }} onClick={handleSpeichern} disabled={speichern}>
                            {speichern ? 'Speichern…' : 'Speichern'}
                        </button>
                    </div>
                </>
            )}

            {/* Tab: Stundenpreise */}
            {zeigtTabs && aktTab === 'stundenpreise' && (
                <div>
                    {stundenpreise.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '1rem 0', textAlign: 'center' }}>
                            Noch keine Stundenpreise erfasst
                        </div>
                    ) : (
                        <div style={{ marginBottom: 12 }}>
                            {stundenpreise.map(sp => (
                                <div key={sp.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 32px', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#6B6860' }}>{sp.tarifnr}</span>
                                    <span style={{ fontSize: 12.5, color: '#1A1917' }}>{sp.bezeichnung}</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: '#1A1917' }}>
                                        CHF {parseFloat(sp.stundenpreis).toFixed(2)}
                                    </span>
                                    <button
                                        onClick={() => stundenpreisLoeschen(sp.leistung_id)}
                                        disabled={spBusy}
                                        style={{ width: 32, height: 32, border: '1px solid rgba(220,38,38,.2)', borderRadius: 6, background: '#FEF2F2', color: '#B91C1C', cursor: spBusy ? 'default' : 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid rgba(0,0,0,.07)', paddingTop: 14 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 9 }}>
                            Stundenpreis hinzufügen / aktualisieren
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'center' }}>
                            <select
                                value={neueLeistungId}
                                onChange={e => setNeueLeistungId(e.target.value)}
                                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            >
                                <option value="">— Leistung wählen —</option>
                                {leistungen.map(l => (
                                    <option key={l.leistung_id} value={l.leistung_id}>
                                        {l.tarifnr} · {l.bezeichnung}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number" min="0" step="0.01"
                                value={neuerPreis}
                                onChange={e => setNeuerPreis(e.target.value)}
                                placeholder="CHF / Std."
                                style={{ fontSize: 13, padding: '6px 8px', border: '1px solid rgba(0,0,0,.12)', borderRadius: 6, background: '#fff', fontFamily: 'inherit', outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
                            />
                            <button
                                onClick={stundenpreisHinzufuegen}
                                disabled={spBusy || !neueLeistungId || !neuerPreis}
                                style={{
                                    padding: '6px 14px', fontSize: 12.5, cursor: (!neueLeistungId || !neuerPreis || spBusy) ? 'default' : 'pointer',
                                    border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                                    fontFamily: 'inherit', opacity: (!neueLeistungId || !neuerPreis || spBusy) ? .5 : 1, whiteSpace: 'nowrap'
                                }}
                            >Speichern</button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
