import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

const DIMENSIONEN = [
    { key: 'kader',           label: 'Kader' },
    { key: 'klient',          label: 'Klient' },
    { key: 'standort',        label: 'Standort' },
    { key: 'massnahme',       label: 'Massnahme' },
    { key: 'abteilung',       label: 'Abteilung' },
    { key: 'auftraggeber_typ',label: 'Auftraggeber-Typ' },
];

const SPALTEN_TYPEN = [
    { key: 'monate',   label: 'Monate' },
    { key: 'quartale', label: 'Quartale' },
    { key: 'wochen',   label: 'Wochen' },
    { key: 'jahr',     label: 'Jahr' },
];

const KENNZAHLEN_DEF = [
    { key: 'einnahmen_soll',   label: 'Einnahmen SOLL',  short: 'E-SOLL',    fmt: 'chf' },
    { key: 'einnahmen_ist',    label: 'Einnahmen IST',   short: 'E-IST',     fmt: 'chf' },
    { key: 'stunden_soll',     label: 'Stunden SOLL',    short: 'h-SOLL',    fmt: 'h' },
    { key: 'stunden_ist',      label: 'Stunden IST',     short: 'h-IST',     fmt: 'h' },
    { key: 'anzahl_klienten',  label: 'Anzahl Klienten', short: 'Kl.',       fmt: 'n' },
    { key: 'auslastung_pct',   label: 'Auslastung %',    short: 'Aust.',     fmt: 'pct' },
    { key: 'avg_std_klient',   label: 'Ø Std/Klient',    short: 'Ø h/Kl.',  fmt: 'h' },
    { key: 'freie_kapazitaet', label: 'Freie Kapazität', short: 'Frei h',   fmt: 'h' },
];
const KZ_MAP = Object.fromEntries(KENNZAHLEN_DEF.map(k => [k.key, k]));

function ersterMonat(offsetMonate = 0) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offsetMonate);
    return d.toISOString().slice(0, 10);
}
function letzterMonat(offsetMonate = 5) {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonate + 1, 0);
    return d.toISOString().slice(0, 10);
}

function fmtWert(v, fmt) {
    if (v === null || v === undefined) return '—';
    switch (fmt) {
        case 'chf': return Math.round(v).toLocaleString('de-CH');
        case 'h':   return Number(v).toFixed(1);
        case 'pct': return v !== null ? Number(v).toFixed(1) + '%' : '—';
        default:    return String(v);
    }
}

function istFarbe(kzKey, werte) {
    if (!kzKey.endsWith('_ist') && kzKey !== 'auslastung_pct') return null;
    if (kzKey === 'auslastung_pct') {
        const v = werte?.[kzKey];
        if (v === null || v === undefined) return null;
        if (v >= 90) return { bg: '#D1FAE5', color: '#065F46' };
        if (v >= 50) return { bg: '#FEF3C7', color: '#92400E' };
        return { bg: '#FEE2E2', color: '#991B1B' };
    }
    const sollKey = kzKey.replace('_ist', '_soll');
    const soll = werte?.[sollKey];
    const ist = werte?.[kzKey];
    if (!soll || soll === 0) return null;
    const ratio = ist / soll;
    if (ratio >= 0.9) return { bg: '#D1FAE5', color: '#065F46' };
    if (ratio >= 0.5) return { bg: '#FEF3C7', color: '#92400E' };
    return { bg: '#FEE2E2', color: '#991B1B' };
}

const CARD = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,.09)',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,.07)',
};
const CHIP_BASE = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 20, fontSize: 12,
    fontFamily: 'inherit', cursor: 'pointer', border: '1px solid transparent',
    fontWeight: 500,
};

export default function Reporting() {
    const [zeilen, setZeilen] = useState(['kader']);
    const [spalten, setSpalten] = useState(['monate']);
    const [kennzahlen, setKennzahlen] = useState(['einnahmen_soll', 'einnahmen_ist']);
    const [filter, setFilter] = useState({
        von: ersterMonat(0),
        bis: letzterMonat(5),
        standort_ids: [],
        programm_ids: [],
        user_ids: [],
        abteilungen: [],
        klient_ids: [],
        auftraggeber_typ: null,
    });
    const [optionen, setOptionen] = useState(null);
    const [ansichten, setAnsichten] = useState([]);
    const [resultat, setResultat] = useState(null);
    const [laden, setLaden] = useState(false);
    const [fehler, setFehler] = useState('');
    const [ansichtName, setAnsichtName] = useState('');
    const [zeigeSpeichern, setZeigeSpeichern] = useState(false);

    useEffect(() => {
        client.get('/reporting/optionen').then(r => setOptionen(r.data)).catch(console.error);
        client.get('/reporting/ansichten').then(r => setAnsichten(r.data)).catch(console.error);
    }, []);

    const ausfuehren = useCallback(async () => {
        setLaden(true);
        setFehler('');
        try {
            const r = await client.post('/reporting/query', { zeilen, spalten, kennzahlen, filter });
            setResultat(r.data);
        } catch (err) {
            setFehler(err.response?.data?.error || 'Fehler beim Laden.');
        } finally {
            setLaden(false);
        }
    }, [zeilen, spalten, kennzahlen, filter]);

    async function speichern() {
        if (!ansichtName.trim()) return;
        try {
            const r = await client.post('/reporting/ansichten', {
                name: ansichtName.trim(),
                konfiguration: { zeilen, spalten, kennzahlen, filter },
            });
            setAnsichten(prev => [r.data, ...prev]);
            setAnsichtName('');
            setZeigeSpeichern(false);
        } catch (err) {
            setFehler('Fehler beim Speichern.');
        }
    }

    async function loescheAnsicht(id) {
        await client.delete(`/reporting/ansichten/${id}`);
        setAnsichten(prev => prev.filter(a => a.id !== id));
    }

    function ladeAnsicht(a) {
        const k = a.konfiguration;
        if (k.zeilen) setZeilen(k.zeilen);
        if (k.spalten) setSpalten(k.spalten);
        if (k.kennzahlen) setKennzahlen(k.kennzahlen);
        if (k.filter) setFilter(k.filter);
        setResultat(null);
    }

    function toggleZeile(key) {
        setZeilen(prev => prev.includes(key) ? prev.filter(z => z !== key) : [key]);
    }
    function toggleSpalte(key) {
        setSpalten(prev => prev.includes(key) ? prev.filter(s => s !== key) : [key]);
    }
    function toggleKennzahl(key) {
        setKennzahlen(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }
    function setFilterF(key, value) {
        setFilter(prev => ({ ...prev, [key]: value }));
    }

    const inputStyle = {
        fontSize: 12.5, padding: '5px 8px',
        border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
        background: '#fff', fontFamily: 'inherit', outline: 'none',
        color: '#1A1917', boxSizing: 'border-box',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Reporting</h2>
                    <p style={{ margin: 0, fontSize: 12, color: '#6B6860' }}>Auswertungen & Kennzahlen</p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {!zeigeSpeichern ? (
                        <button onClick={() => setZeigeSpeichern(true)} style={{ ...inputStyle, cursor: 'pointer', border: '1px solid rgba(0,0,0,.12)', background: '#fff', color: '#6B6860' }}>
                            Ansicht speichern
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                                value={ansichtName}
                                onChange={e => setAnsichtName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && speichern()}
                                placeholder="Name der Ansicht…"
                                style={{ ...inputStyle, width: 200 }}
                                autoFocus
                            />
                            <button onClick={speichern} style={{ ...inputStyle, cursor: 'pointer', background: '#2563EB', color: '#fff', border: 'none', fontWeight: 500 }}>Speichern</button>
                            <button onClick={() => setZeigeSpeichern(false)} style={{ ...inputStyle, cursor: 'pointer' }}>✕</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Gespeicherte Ansichten */}
            {ansichten.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#A09D97', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Gespeichert:</span>
                    {ansichten.map(a => (
                        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <button onClick={() => ladeAnsicht(a)} style={{
                                ...CHIP_BASE,
                                background: '#EEF3FE', color: '#1D4ED8',
                                border: '1px solid rgba(29,78,216,.2)',
                            }}>{a.name}</button>
                            <button onClick={() => loescheAnsicht(a.id)} style={{
                                ...CHIP_BASE, padding: '3px 6px',
                                background: 'transparent', color: '#A09D97',
                                border: '1px solid transparent', fontSize: 10,
                            }}>✕</button>
                        </span>
                    ))}
                </div>
            )}

            {/* Konfigurations-Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>

                {/* Linker Pool */}
                <div style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Dimensionen</div>
                    {DIMENSIONEN.map(d => (
                        <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 12.5, color: zeilen.includes(d.key) ? '#2563EB' : '#1A1917' }}>{d.label}</span>
                            <button
                                onClick={() => toggleZeile(d.key)}
                                title="Als Zeile wählen"
                                style={{
                                    ...CHIP_BASE, padding: '2px 8px', fontSize: 11,
                                    background: zeilen.includes(d.key) ? '#2563EB' : '#F5F4F0',
                                    color: zeilen.includes(d.key) ? '#fff' : '#6B6860',
                                    border: 'none', cursor: 'pointer',
                                }}>
                                {zeilen.includes(d.key) ? '✓ Z' : '+Z'}
                            </button>
                        </div>
                    ))}

                    <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '4px 0' }} />
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Kennzahlen</div>
                    {KENNZAHLEN_DEF.map(k => (
                        <div key={k.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 12, color: kennzahlen.includes(k.key) ? '#2563EB' : '#1A1917' }}>{k.label}</span>
                            <button
                                onClick={() => toggleKennzahl(k.key)}
                                title="Kennzahl hinzufügen"
                                style={{
                                    ...CHIP_BASE, padding: '2px 8px', fontSize: 11,
                                    background: kennzahlen.includes(k.key) ? '#2563EB' : '#F5F4F0',
                                    color: kennzahlen.includes(k.key) ? '#fff' : '#6B6860',
                                    border: 'none', cursor: 'pointer',
                                }}>
                                {kennzahlen.includes(k.key) ? '✓ K' : '+K'}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Rechter Bereich */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* Mini-Pools */}
                    <div style={{ ...CARD, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                        {/* Zeilen */}
                        <div>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Zeilen</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {zeilen.length === 0 && <span style={{ fontSize: 12, color: '#A09D97' }}>Keine</span>}
                                {zeilen.map(z => {
                                    const d = DIMENSIONEN.find(d => d.key === z);
                                    return (
                                        <span key={z} style={{ ...CHIP_BASE, background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(29,78,216,.2)', fontSize: 12 }}>
                                            {d?.label}
                                            <span onClick={() => toggleZeile(z)} style={{ cursor: 'pointer', opacity: .6, fontSize: 10 }}>✕</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Spalten */}
                        <div>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Spalten</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {SPALTEN_TYPEN.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => toggleSpalte(s.key)}
                                        style={{
                                            ...CHIP_BASE, fontSize: 12,
                                            background: spalten.includes(s.key) ? '#EEF3FE' : '#F5F4F0',
                                            color: spalten.includes(s.key) ? '#1D4ED8' : '#6B6860',
                                            border: spalten.includes(s.key) ? '1px solid rgba(29,78,216,.2)' : '1px solid transparent',
                                        }}>{s.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Kennzahlen */}
                        <div>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Kennzahlen</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {kennzahlen.length === 0 && <span style={{ fontSize: 12, color: '#A09D97' }}>Keine</span>}
                                {kennzahlen.map(kk => {
                                    const kd = KZ_MAP[kk];
                                    return (
                                        <span key={kk} style={{ ...CHIP_BASE, background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(29,78,216,.2)', fontSize: 12 }}>
                                            {kd?.short || kk}
                                            <span onClick={() => toggleKennzahl(kk)} style={{ cursor: 'pointer', opacity: .6, fontSize: 10 }}>✕</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Filter + Ausführen */}
                    <div style={{ ...CARD, padding: 14 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Filter</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>

                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Von</label>
                                <input type="date" value={filter.von} onChange={e => setFilterF('von', e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Bis</label>
                                <input type="date" value={filter.bis} onChange={e => setFilterF('bis', e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>

                            {optionen?.standorte?.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Standort</label>
                                    <select multiple size={Math.min(optionen.standorte.length, 3)}
                                        value={filter.standort_ids}
                                        onChange={e => setFilterF('standort_ids', Array.from(e.target.selectedOptions, o => o.value))}
                                        style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                                        {optionen.standorte.map(s => <option key={s.standort_id} value={s.standort_id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {optionen?.kader?.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Kader</label>
                                    <select multiple size={Math.min(optionen.kader.length, 3)}
                                        value={filter.user_ids}
                                        onChange={e => setFilterF('user_ids', Array.from(e.target.selectedOptions, o => o.value))}
                                        style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                                        {optionen.kader.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                                    </select>
                                </div>
                            )}

                            {optionen?.massnahmen?.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Massnahme</label>
                                    <select multiple size={Math.min(optionen.massnahmen.length, 3)}
                                        value={filter.programm_ids}
                                        onChange={e => setFilterF('programm_ids', Array.from(e.target.selectedOptions, o => o.value))}
                                        style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                                        {optionen.massnahmen.map(p => <option key={p.programm_id} value={p.programm_id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {optionen?.abteilungen?.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Abteilung</label>
                                    <select multiple size={Math.min(optionen.abteilungen.length, 3)}
                                        value={filter.abteilungen}
                                        onChange={e => setFilterF('abteilungen', Array.from(e.target.selectedOptions, o => o.value))}
                                        style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                                        {optionen.abteilungen.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Auftraggeber</label>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {[null, 'IV', 'Gemeinde'].map(v => (
                                        <button key={v ?? 'alle'} onClick={() => setFilterF('auftraggeber_typ', v)} style={{
                                            ...CHIP_BASE, fontSize: 12,
                                            background: filter.auftraggeber_typ === v ? '#2563EB' : '#F5F4F0',
                                            color: filter.auftraggeber_typ === v ? '#fff' : '#6B6860',
                                            border: 'none', padding: '4px 10px',
                                        }}>{v ?? 'Alle'}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                                onClick={ausfuehren}
                                disabled={laden || kennzahlen.length === 0}
                                style={{
                                    padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: laden ? 'default' : 'pointer',
                                    border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                                    fontFamily: 'inherit', opacity: laden || kennzahlen.length === 0 ? .6 : 1,
                                }}>
                                {laden ? 'Wird geladen…' : '▶ Ausführen'}
                            </button>
                            {fehler && <span style={{ fontSize: 12, color: '#B91C1C' }}>{fehler}</span>}
                            {resultat && !laden && (
                                <span style={{ fontSize: 12, color: '#6B6860' }}>
                                    {resultat.zeilen.length} {resultat.zeilen.length === 1 ? 'Zeile' : 'Zeilen'} · {resultat.spalten.length} {resultat.spalten.length === 1 ? 'Spalte' : 'Spalten'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Resultat-Tabelle */}
            {resultat && (
                <div style={{ ...CARD, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%', minWidth: 600 }}>
                            <thead>
                                {/* Zeile 1: Perioden-Labels */}
                                <tr style={{ background: '#F5F4F0' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11.5, borderBottom: '1px solid rgba(0,0,0,.09)', minWidth: 140, position: 'sticky', left: 0, background: '#F5F4F0', zIndex: 1 }}>
                                        {DIMENSIONEN.find(d => d.key === zeilen[0])?.label || 'Zeile'}
                                    </th>
                                    {resultat.spalten.map(sp => (
                                        <th key={sp}
                                            colSpan={kennzahlen.length}
                                            style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 11, borderBottom: '1px solid rgba(0,0,0,.09)', borderLeft: '1px solid rgba(0,0,0,.06)', whiteSpace: 'nowrap', color: '#6B6860' }}>
                                            {sp}
                                        </th>
                                    ))}
                                    <th colSpan={kennzahlen.length}
                                        style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 11, borderBottom: '1px solid rgba(0,0,0,.09)', borderLeft: '2px solid rgba(0,0,0,.12)', color: '#6B6860' }}>
                                        Total
                                    </th>
                                </tr>
                                {/* Zeile 2: Kennzahl-Labels */}
                                <tr style={{ background: '#FAFAFA' }}>
                                    <th style={{ padding: '4px 12px', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 1, borderBottom: '2px solid rgba(0,0,0,.09)' }} />
                                    {[...resultat.spalten, '__total__'].map((sp, si) => (
                                        kennzahlen.map((kk, ki) => {
                                            const kd = KZ_MAP[kk];
                                            return (
                                                <th key={`${sp}-${kk}`}
                                                    style={{
                                                        padding: '3px 6px', fontWeight: 500, fontSize: 10.5, color: '#6B6860',
                                                        textAlign: 'right', whiteSpace: 'nowrap',
                                                        borderBottom: '2px solid rgba(0,0,0,.09)',
                                                        borderLeft: ki === 0 ? (sp === '__total__' ? '2px solid rgba(0,0,0,.12)' : '1px solid rgba(0,0,0,.06)') : undefined,
                                                    }}>
                                                    {kd?.short || kk}
                                                </th>
                                            );
                                        })
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {resultat.zeilen.length === 0 && (
                                    <tr>
                                        <td colSpan={1 + (resultat.spalten.length + 1) * kennzahlen.length}
                                            style={{ padding: '24px 12px', textAlign: 'center', color: '#A09D97', fontSize: 13 }}>
                                            Keine Daten im gewählten Zeitraum
                                        </td>
                                    </tr>
                                )}
                                {resultat.zeilen.map((zeile, zi) => (
                                    <tr key={zeile.id} style={{ background: zi % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                                        <td style={{
                                            padding: '6px 12px', fontWeight: 500, fontSize: 12.5,
                                            borderBottom: '1px solid rgba(0,0,0,.05)',
                                            position: 'sticky', left: 0,
                                            background: zi % 2 === 0 ? '#fff' : '#FAFAFA',
                                            zIndex: 1, maxWidth: 180, overflow: 'hidden',
                                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {zeile.label}
                                        </td>
                                        {[...resultat.spalten.map(sp => ({ sp, werte: zeile.werte[sp] })), { sp: '__total__', werte: zeile.total }].map(({ sp, werte }, si) =>
                                            kennzahlen.map((kk, ki) => {
                                                const kd = KZ_MAP[kk];
                                                const farbe = istFarbe(kk, werte);
                                                return (
                                                    <td key={`${sp}-${kk}`}
                                                        style={{
                                                            padding: '6px 6px', textAlign: 'right', fontSize: 12,
                                                            borderBottom: '1px solid rgba(0,0,0,.05)',
                                                            borderLeft: ki === 0 ? (sp === '__total__' ? '2px solid rgba(0,0,0,.12)' : '1px solid rgba(0,0,0,.06)') : undefined,
                                                            background: farbe?.bg || 'transparent',
                                                            color: farbe?.color || '#1A1917',
                                                            fontVariantNumeric: 'tabular-nums',
                                                        }}>
                                                        {fmtWert(werte?.[kk], kd?.fmt)}
                                                    </td>
                                                );
                                            })
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#F5F4F0', fontWeight: 600 }}>
                                    <td style={{
                                        padding: '7px 12px', fontSize: 12.5, fontWeight: 700,
                                        borderTop: '2px solid rgba(0,0,0,.12)',
                                        position: 'sticky', left: 0, background: '#F5F4F0', zIndex: 1,
                                    }}>Total</td>
                                    {[...resultat.spalten.map(sp => ({ sp, werte: resultat.total[sp] })), { sp: '__total__', werte: resultat.total_gesamt }].map(({ sp, werte }, si) =>
                                        kennzahlen.map((kk, ki) => {
                                            const kd = KZ_MAP[kk];
                                            const farbe = istFarbe(kk, werte);
                                            return (
                                                <td key={`total-${sp}-${kk}`}
                                                    style={{
                                                        padding: '7px 6px', textAlign: 'right', fontSize: 12,
                                                        borderTop: '2px solid rgba(0,0,0,.12)',
                                                        borderLeft: ki === 0 ? (sp === '__total__' ? '2px solid rgba(0,0,0,.12)' : '1px solid rgba(0,0,0,.06)') : undefined,
                                                        background: farbe?.bg || 'transparent',
                                                        color: farbe?.color || '#1A1917',
                                                        fontWeight: 700,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}>
                                                    {fmtWert(werte?.[kk], kd?.fmt)}
                                                </td>
                                            );
                                        })
                                    )}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {!resultat && !laden && (
                <div style={{ ...CARD, padding: '2.5rem', textAlign: 'center', color: '#A09D97', fontSize: 13 }}>
                    Konfiguration auswählen und <strong>Ausführen</strong> klicken
                </div>
            )}
        </div>
    );
}
