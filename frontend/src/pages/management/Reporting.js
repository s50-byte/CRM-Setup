import { useState, useEffect, useCallback, useRef } from 'react';
import client from '../../api/client';

const ALLE_DIMENSIONEN = [
    { key: 'kader',           label: 'Kader' },
    { key: 'klient',          label: 'Klient' },
    { key: 'standort',        label: 'Standort' },
    { key: 'massnahme',       label: 'Massnahme' },
    { key: 'abteilung',       label: 'Abteilung' },
    { key: 'auftraggeber_typ',label: 'Auftraggeber-Typ' },
    { key: 'monate',          label: 'Monate',   zeitDim: true },
    { key: 'quartale',        label: 'Quartale', zeitDim: true },
    { key: 'wochen',          label: 'Wochen',   zeitDim: true },
    { key: 'jahr',            label: 'Jahre',    zeitDim: true },
];
function dimLabel(key) {
    return ALLE_DIMENSIONEN.find(d => d.key === key)?.label || key;
}

const KENNZAHLEN_DEF = [
    { key: 'einnahmen_soll',   label: 'Einnahmen SOLL',  short: 'E-SOLL',   fmt: 'chf' },
    { key: 'einnahmen_ist',    label: 'Einnahmen IST',   short: 'E-IST',    fmt: 'chf' },
    { key: 'stunden_soll',     label: 'Stunden SOLL',    short: 'h-SOLL',   fmt: 'h' },
    { key: 'stunden_ist',      label: 'Stunden IST',     short: 'h-IST',    fmt: 'h' },
    { key: 'anzahl_klienten',  label: 'Anzahl Klienten', short: 'Kl.',      fmt: 'n' },
    { key: 'auslastung_pct',   label: 'Auslastung %',    short: 'Aust.',    fmt: 'pct' },
    { key: 'avg_std_klient',   label: 'Ø Std/Klient',   short: 'Ø h/Kl.', fmt: 'h' },
    { key: 'freie_kapazitaet', label: 'Freie Kapazität', short: 'Frei h',  fmt: 'h' },
];
const KZ_MAP = Object.fromEntries(KENNZAHLEN_DEF.map(k => [k.key, k]));

const FILTER_DEFAULT = {
    von: `${new Date().getFullYear()}-01-01`,
    bis: `${new Date().getFullYear()}-12-31`,
    standort_ids: [],
    programm_ids: [],
    user_ids: [],
    abteilungen: [],
    klient_ids: [],
    auftraggeber_typ: null,
};

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

// Dropdown mit Checkbox-Liste für Mehrfachauswahl
function MultiSelectDropdown({ label, options, selected, onChange, getKey, getLabel }) {
    const [offen, setOffen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!offen) return;
        function handleOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) setOffen(false);
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [offen]);

    function toggle(key) {
        onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
    }

    const btnLabel = selected.length === 0
        ? `Alle ${label}`
        : `${selected.length} ${label}${selected.length === 1 ? '' : ''}`;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>{label}</label>
            <button
                onClick={() => setOffen(o => !o)}
                style={{
                    width: '100%', textAlign: 'left', padding: '5px 8px 5px 10px',
                    fontSize: 12.5, border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                    background: offen ? '#F5F4F0' : '#fff', fontFamily: 'inherit', cursor: 'pointer',
                    color: selected.length > 0 ? '#1D4ED8' : '#6B6860',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                    boxSizing: 'border-box',
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{btnLabel}</span>
                <span style={{ fontSize: 8, opacity: .5, flexShrink: 0 }}>▼</span>
            </button>
            {offen && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0,
                    background: '#fff', border: '1px solid rgba(0,0,0,.12)',
                    borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                    zIndex: 200, maxHeight: 220, overflowY: 'auto',
                }}>
                    {options.length === 0 && (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: '#A09D97' }}>Keine Optionen</div>
                    )}
                    {options.map(opt => {
                        const key = getKey(opt);
                        const lbl = getLabel(opt);
                        const checked = selected.includes(key);
                        return (
                            <label key={key} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 12px', cursor: 'pointer',
                                background: checked ? '#EEF3FE' : 'transparent',
                                fontSize: 12.5, color: checked ? '#1D4ED8' : '#1A1917',
                                borderBottom: '1px solid rgba(0,0,0,.04)',
                                userSelect: 'none',
                            }}>
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(key)}
                                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#2563EB' }}
                                />
                                {lbl}
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
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
    const [filter, setFilter] = useState({ ...FILTER_DEFAULT });
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

    // Automatische Aktualisierung mit 500ms Debounce
    useEffect(() => {
        if (zeilen.length === 0 || kennzahlen.length === 0) return;
        const timer = setTimeout(ausfuehren, 500);
        return () => clearTimeout(timer);
    }, [ausfuehren]);

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

    function filterZuruecksetzen() {
        setFilter({ ...FILTER_DEFAULT });
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

    const filterAktiv = filter.standort_ids.length + filter.programm_ids.length +
        filter.user_ids.length + filter.abteilungen.length +
        filter.klient_ids.length + (filter.auftraggeber_typ ? 1 : 0) > 0;

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
                                ...CHIP_BASE, background: '#EEF3FE', color: '#1D4ED8',
                                border: '1px solid rgba(29,78,216,.2)',
                            }}>{a.name}</button>
                            <button onClick={() => loescheAnsicht(a.id)} style={{
                                ...CHIP_BASE, padding: '3px 6px', background: 'transparent',
                                color: '#A09D97', border: '1px solid transparent', fontSize: 10,
                            }}>✕</button>
                        </span>
                    ))}
                </div>
            )}

            {/* Konfigurations-Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>

                {/* Linker Pool */}
                <div style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Dimensionen</div>
                    {ALLE_DIMENSIONEN.map((d, i) => {
                        const inZ = zeilen.includes(d.key);
                        const inS = spalten.includes(d.key);
                        const prevIsTime = i > 0 && !ALLE_DIMENSIONEN[i - 1].zeitDim && d.zeitDim;
                        return (
                            <div key={d.key}>
                                {prevIsTime && <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '4px 0' }} />}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 12.5, color: (inZ || inS) ? '#2563EB' : '#1A1917', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                                    <button onClick={() => {
                                        if (inZ) { setZeilen([]); }
                                        else if (inS) { setZeilen([d.key]); setSpalten(zeilen[0] ? [zeilen[0]] : []); }
                                        else { setZeilen([d.key]); }
                                    }} style={{
                                        ...CHIP_BASE, padding: '2px 7px', fontSize: 10, flexShrink: 0,
                                        background: inZ ? '#2563EB' : '#F5F4F0',
                                        color: inZ ? '#fff' : '#6B6860',
                                        border: 'none', cursor: 'pointer',
                                    }}>
                                        {inZ ? '✓ Z' : '+Z'}
                                    </button>
                                    <button onClick={() => {
                                        if (inS) { setSpalten([]); }
                                        else if (inZ) { setSpalten([d.key]); setZeilen(spalten[0] ? [spalten[0]] : []); }
                                        else { setSpalten([d.key]); }
                                    }} style={{
                                        ...CHIP_BASE, padding: '2px 7px', fontSize: 10, flexShrink: 0,
                                        background: inS ? '#7C3AED' : '#F5F4F0',
                                        color: inS ? '#fff' : '#6B6860',
                                        border: 'none', cursor: 'pointer',
                                    }}>
                                        {inS ? '✓ S' : '+S'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '4px 0' }} />
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>Kennzahlen</div>
                    {KENNZAHLEN_DEF.map(k => (
                        <div key={k.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 12, color: kennzahlen.includes(k.key) ? '#2563EB' : '#1A1917' }}>{k.label}</span>
                            <button onClick={() => toggleKennzahl(k.key)} style={{
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
                        <div>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Zeilen</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {zeilen.length === 0 && <span style={{ fontSize: 12, color: '#A09D97' }}>Keine</span>}
                                {zeilen.map(z => (
                                    <span key={z} style={{ ...CHIP_BASE, background: '#EEF3FE', color: '#1D4ED8', border: '1px solid rgba(29,78,216,.2)', fontSize: 12 }}>
                                        {dimLabel(z)}
                                        <span onClick={() => toggleZeile(z)} style={{ cursor: 'pointer', opacity: .6, fontSize: 10 }}>✕</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Spalten</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {spalten.length === 0 && <span style={{ fontSize: 12, color: '#A09D97' }}>Keine</span>}
                                {spalten.map(s => (
                                    <span key={s} style={{ ...CHIP_BASE, background: '#F3E8FF', color: '#7C3AED', border: '1px solid rgba(124,58,237,.2)', fontSize: 12 }}>
                                        {dimLabel(s)}
                                        <span onClick={() => toggleSpalte(s)} style={{ cursor: 'pointer', opacity: .6, fontSize: 10 }}>✕</span>
                                    </span>
                                ))}
                            </div>
                        </div>

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

                    {/* Filter */}
                    <div style={{ ...CARD, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A09D97', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                Filter
                                {filterAktiv && (
                                    <span style={{ marginLeft: 6, background: '#2563EB', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9.5, fontWeight: 700 }}>Aktiv</span>
                                )}
                            </div>
                            {filterAktiv && (
                                <button onClick={filterZuruecksetzen} style={{
                                    fontSize: 11.5, padding: '3px 10px', cursor: 'pointer',
                                    border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                                    background: '#fff', fontFamily: 'inherit', color: '#6B6860',
                                }}>Filter zurücksetzen</button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>

                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Von</label>
                                <input type="date" value={filter.von} onChange={e => setFilterF('von', e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Bis</label>
                                <input type="date" value={filter.bis} onChange={e => setFilterF('bis', e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>

                            {optionen?.standorte?.length > 0 && (
                                <MultiSelectDropdown
                                    label="Standort"
                                    options={optionen.standorte}
                                    selected={filter.standort_ids}
                                    onChange={v => setFilterF('standort_ids', v)}
                                    getKey={s => s.standort_id}
                                    getLabel={s => s.name}
                                />
                            )}

                            {optionen?.kader?.length > 0 && (
                                <MultiSelectDropdown
                                    label="Kader"
                                    options={optionen.kader}
                                    selected={filter.user_ids}
                                    onChange={v => setFilterF('user_ids', v)}
                                    getKey={u => u.user_id}
                                    getLabel={u => u.full_name}
                                />
                            )}

                            {optionen?.massnahmen?.length > 0 && (
                                <MultiSelectDropdown
                                    label="Massnahme"
                                    options={optionen.massnahmen}
                                    selected={filter.programm_ids}
                                    onChange={v => setFilterF('programm_ids', v)}
                                    getKey={p => p.programm_id}
                                    getLabel={p => p.name}
                                />
                            )}

                            {optionen?.abteilungen?.length > 0 && (
                                <MultiSelectDropdown
                                    label="Abteilung"
                                    options={optionen.abteilungen.map(a => ({ key: a, label: a }))}
                                    selected={filter.abteilungen}
                                    onChange={v => setFilterF('abteilungen', v)}
                                    getKey={a => a.key}
                                    getLabel={a => a.label}
                                />
                            )}

                            {optionen?.klienten?.length > 0 && (
                                <MultiSelectDropdown
                                    label="Klient"
                                    options={optionen.klienten}
                                    selected={filter.klient_ids}
                                    onChange={v => setFilterF('klient_ids', v)}
                                    getKey={k => k.klient_id}
                                    getLabel={k => k.name}
                                />
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
                                    padding: '7px 18px', fontSize: 13, fontWeight: 500,
                                    cursor: laden || kennzahlen.length === 0 ? 'default' : 'pointer',
                                    border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                                    fontFamily: 'inherit', opacity: laden || kennzahlen.length === 0 ? .6 : 1,
                                }}>
                                {laden ? '⟳ Wird geladen…' : '▶ Ausführen'}
                            </button>
                            {!filterAktiv && (
                                <button onClick={filterZuruecksetzen} style={{
                                    fontSize: 11.5, padding: '6px 12px', cursor: 'pointer',
                                    border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                                    background: '#fff', fontFamily: 'inherit', color: '#6B6860',
                                }}>Filter zurücksetzen</button>
                            )}
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

            {/* Loading-Indikator (Overlay-Stil wenn Tabelle bereits da) */}
            {laden && resultat && (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#6B6860', padding: '8px 0' }}>
                    Wird aktualisiert…
                </div>
            )}

            {/* Resultat-Tabelle */}
            {resultat && (
                <div style={{ ...CARD, overflow: 'hidden', opacity: laden ? 0.6 : 1, transition: 'opacity .2s' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%', minWidth: 600 }}>
                            <thead>
                                <tr style={{ background: '#F5F4F0' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11.5, borderBottom: '1px solid rgba(0,0,0,.09)', minWidth: 140, position: 'sticky', left: 0, background: '#F5F4F0', zIndex: 1 }}>
                                        {dimLabel(zeilen[0]) || 'Zeile'}
                                    </th>
                                    {resultat.spalten.map(sp => (
                                        <th key={sp} colSpan={kennzahlen.length}
                                            style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 11, borderBottom: '1px solid rgba(0,0,0,.09)', borderLeft: '1px solid rgba(0,0,0,.06)', whiteSpace: 'nowrap', color: '#6B6860' }}>
                                            {sp}
                                        </th>
                                    ))}
                                    <th colSpan={kennzahlen.length}
                                        style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 11, borderBottom: '1px solid rgba(0,0,0,.09)', borderLeft: '2px solid rgba(0,0,0,.12)', color: '#6B6860' }}>
                                        Total
                                    </th>
                                </tr>
                                <tr style={{ background: '#FAFAFA' }}>
                                    <th style={{ padding: '4px 12px', position: 'sticky', left: 0, background: '#FAFAFA', zIndex: 1, borderBottom: '2px solid rgba(0,0,0,.09)' }} />
                                    {[...resultat.spalten, '__total__'].map((sp) =>
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
                                    )}
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
                                        {[...resultat.spalten.map(sp => ({ sp, werte: zeile.werte[sp] })), { sp: '__total__', werte: zeile.total }].map(({ sp, werte }) =>
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
                                <tr style={{ background: '#F5F4F0' }}>
                                    <td style={{
                                        padding: '7px 12px', fontSize: 12.5, fontWeight: 700,
                                        borderTop: '2px solid rgba(0,0,0,.12)',
                                        position: 'sticky', left: 0, background: '#F5F4F0', zIndex: 1,
                                    }}>Total</td>
                                    {[...resultat.spalten.map(sp => ({ sp, werte: resultat.total[sp] })), { sp: '__total__', werte: resultat.total_gesamt }].map(({ sp, werte }) =>
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

            {!resultat && laden && (
                <div style={{ ...CARD, padding: '2.5rem', textAlign: 'center', color: '#6B6860', fontSize: 13 }}>
                    Wird geladen…
                </div>
            )}

            {!resultat && !laden && (
                <div style={{ ...CARD, padding: '2.5rem', textAlign: 'center', color: '#A09D97', fontSize: 13 }}>
                    Konfiguration auswählen — der Report lädt automatisch
                </div>
            )}
        </div>
    );
}
