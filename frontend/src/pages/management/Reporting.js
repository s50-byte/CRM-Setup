import { useState, useEffect, useCallback, useRef } from 'react';
import Chart from 'chart.js/auto';
import client from '../../api/client';

const ALLE_DIMENSIONEN = [
    { key: 'kader',           label: 'Kader' },
    { key: 'klient',          label: 'Klienten' },
    { key: 'standort',        label: 'Standort' },
    { key: 'massnahme',       label: 'Massnahme' },
    { key: 'abteilung',       label: 'Abteilung' },
    { key: 'auftraggeber_typ',label: 'Zuweisende Stelle' },
    { key: 'monate',          label: 'Monate',   zeitDim: true },
    { key: 'quartale',        label: 'Quartale', zeitDim: true },
    { key: 'wochen',          label: 'Wochen',   zeitDim: true },
    { key: 'jahr',            label: 'Jahre',    zeitDim: true },
];
function dimLabel(key) {
    return ALLE_DIMENSIONEN.find(d => d.key === key)?.label || key;
}

const KENNZAHLEN_DEF = [
    { key: 'einnahmen_soll',   label: 'Einnahmen SOLL',      short: 'E-SOLL',   fmt: 'chf' },
    { key: 'einnahmen_ist',    label: 'Einnahmen IST',        short: 'E-IST',    fmt: 'chf' },
    { key: 'stunden_soll',     label: 'Stunden SOLL',         short: 'h-SOLL',   fmt: 'h' },
    { key: 'stunden_ist',      label: 'Stunden IST',          short: 'h-IST',    fmt: 'h' },
    { key: 'anzahl_klienten',  label: 'Anzahl Klienten',      short: 'Kl.',      fmt: 'n' },
    { key: 'auslastung_pct',   label: 'Auslastung %',         short: 'Aust.',    fmt: 'pct' },
    { key: 'avg_std_klient',   label: 'Durchschnitt Std / Klient', short: 'Ø h/Kl.', fmt: 'h' },
    { key: 'freie_kapazitaet', label: 'Freie Kapazität',      short: 'Frei h',  fmt: 'h' },
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

const CHART_FARBEN = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED', '#0891B2', '#D97706', '#DC2626', '#059669'];
const TIME_DIMS = new Set(['monate', 'quartale', 'wochen', 'jahr']);

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
const POOL_TITLE = {
    fontSize: 10.5, fontWeight: 600, color: '#A09D97',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
};

function fmtWert(v, fmt) {
    if (v === null || v === undefined) return '—';
    switch (fmt) {
        case 'chf': return Math.round(v).toLocaleString('de-CH');
        case 'h':   return Number(v).toFixed(1);
        case 'pct': return Number(v).toFixed(1) + '%';
        default:    return String(v);
    }
}

function istFarbe(kzKey, werte) {
    if (!kzKey.endsWith('_ist') && kzKey !== 'auslastung_pct') return null;
    if (kzKey === 'auslastung_pct') {
        const v = werte?.[kzKey];
        if (v == null) return null;
        if (v >= 90) return { bg: '#D1FAE5', color: '#065F46' };
        if (v >= 50) return { bg: '#FEF3C7', color: '#92400E' };
        return { bg: '#FEE2E2', color: '#991B1B' };
    }
    const soll = werte?.[kzKey.replace('_ist', '_soll')];
    const ist = werte?.[kzKey];
    if (!soll || soll === 0) return null;
    const ratio = ist / soll;
    if (ratio >= 0.9) return { bg: '#D1FAE5', color: '#065F46' };
    if (ratio >= 0.5) return { bg: '#FEF3C7', color: '#92400E' };
    return { bg: '#FEE2E2', color: '#991B1B' };
}

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

    const btnLabel = selected.length === 0 ? `Alle ${label}` : `${selected.length} ${label}`;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>{label}</label>
            <button onClick={() => setOffen(o => !o)} style={{
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
                                <input type="checkbox" checked={checked} onChange={() => toggle(key)}
                                    style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#2563EB' }} />
                                {lbl}
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

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
    const [ansicht, setAnsicht] = useState('tabelle');
    const [diagrammTyp, setDiagrammTyp] = useState('auto');
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

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

    useEffect(() => {
        if (zeilen.length === 0 || kennzahlen.length === 0) return;
        const timer = setTimeout(ausfuehren, 500);
        return () => clearTimeout(timer);
    }, [ausfuehren]);

    useEffect(() => {
        if (!resultat || ansicht !== 'diagramm' || !chartRef.current) return;
        if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
        if (resultat.zeilen.length === 0 || kennzahlen.length === 0) return;

        const effTyp = diagrammTyp !== 'auto' ? diagrammTyp
            : TIME_DIMS.has(spalten[0]) ? 'linie'
            : TIME_DIMS.has(zeilen[0]) ? 'balken_h'
            : 'balken_v';

        let chartType, data, options;

        if (effTyp === 'torte') {
            const kz = kennzahlen[0];
            const kzDef = KZ_MAP[kz];
            const labels = resultat.zeilen.map(z => z.label);
            chartType = 'pie';
            data = {
                labels,
                datasets: [{
                    data: resultat.zeilen.map(z => z.total?.[kz] != null ? Number(z.total[kz]) : 0),
                    backgroundColor: CHART_FARBEN.slice(0, labels.length),
                }],
            };
            options = {
                responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtWert(ctx.raw, kzDef?.fmt)}` } },
                },
            };
        } else {
            const isHorizontal = effTyp === 'balken_h';
            const isStacked = effTyp === 'gestapelt';
            const isFill = effTyp === 'flaeche';
            chartType = (effTyp === 'linie' || isFill) ? 'line' : 'bar';

            const fmtSet = new Set(kennzahlen.map(kz => KZ_MAP[kz]?.fmt));
            const hasDualAxis = !isStacked && fmtSet.has('chf') && fmtSet.has('h');

            let colorIdx = 0;
            const buildDs = (zeile, kz, label) => {
                const kzDef = KZ_MAP[kz];
                const farbe = CHART_FARBEN[colorIdx++ % CHART_FARBEN.length];
                return {
                    label,
                    data: resultat.spalten.map(sp => {
                        const v = zeile.werte[sp]?.[kz];
                        return v != null ? Number(v) : 0;
                    }),
                    borderColor: farbe,
                    backgroundColor: chartType === 'line' ? farbe + '33' : farbe + 'CC',
                    borderWidth: chartType === 'line' ? 2 : 1,
                    pointRadius: chartType === 'line' ? 3 : undefined,
                    fill: isFill || undefined,
                    tension: chartType === 'line' ? 0.3 : undefined,
                    yAxisID: hasDualAxis ? (kzDef?.fmt === 'h' ? 'y1' : 'y') : 'y',
                    _kzFmt: kzDef?.fmt,
                };
            };

            let datasets;
            if (resultat.zeilen.length === 1) {
                datasets = kennzahlen.map(kz => buildDs(resultat.zeilen[0], kz, KZ_MAP[kz]?.label || kz));
            } else if (kennzahlen.length === 1) {
                datasets = resultat.zeilen.map(zeile => buildDs(zeile, kennzahlen[0], zeile.label));
            } else {
                datasets = resultat.zeilen.flatMap(zeile =>
                    kennzahlen.map(kz => buildDs(zeile, kz, `${zeile.label} — ${KZ_MAP[kz]?.short || kz}`))
                );
            }

            const vieleDatensaetze = datasets.length > 8;
            data = { labels: resultat.spalten, datasets };

            const tickCb = fmt => v => {
                if (fmt === 'chf') return v.toLocaleString('de-CH');
                if (fmt === 'h') return v.toFixed(1) + ' h';
                if (fmt === 'pct') return v + '%';
                return v;
            };

            options = {
                responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
                ...(isHorizontal ? { indexAxis: 'y' } : {}),
                plugins: {
                    legend: {
                        position: vieleDatensaetze ? 'bottom' : 'top',
                        labels: { boxWidth: vieleDatensaetze ? 10 : 12, font: { size: vieleDatensaetze ? 10 : 11 }, padding: vieleDatensaetze ? 6 : 10 },
                    },
                    tooltip: {
                        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtWert(ctx.raw, ctx.dataset._kzFmt)}` },
                    },
                },
                scales: hasDualAxis ? {
                    x: { ticks: { font: { size: 11 } } },
                    y: { beginAtZero: true, position: 'left', ticks: { font: { size: 11 }, callback: tickCb('chf') } },
                    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 11 }, callback: tickCb('h') } },
                } : {
                    x: { stacked: isStacked, ticks: { font: { size: 11 } } },
                    y: { stacked: isStacked, beginAtZero: true, ticks: { font: { size: 11 } } },
                },
            };
        }

        chartInstance.current = new Chart(chartRef.current, { type: chartType, data, options });
        return () => {
            if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
        };
    }, [resultat, ansicht, diagrammTyp, kennzahlen, zeilen, spalten]);

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
        } catch {
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

    const filterAktiv = filter.standort_ids.length + filter.programm_ids.length +
        filter.user_ids.length + filter.abteilungen.length +
        filter.klient_ids.length + (filter.auftraggeber_typ ? 1 : 0) > 0;

    const dimBtnStyle = (aktiv, farbe) => ({
        ...CHIP_BASE, padding: '2px 7px', fontSize: 10, flexShrink: 0,
        background: aktiv ? farbe : '#F5F4F0',
        color: aktiv ? '#fff' : '#6B6860',
        border: 'none', cursor: 'pointer',
    });

    function DimRow({ d }) {
        const inZ = zeilen.includes(d.key);
        const inS = spalten.includes(d.key);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, flex: 1, color: (inZ || inS) ? '#2563EB' : '#1A1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.label}
                </span>
                <button onClick={() => {
                    if (inZ) setZeilen([]);
                    else if (inS) { setZeilen([d.key]); setSpalten(zeilen[0] ? [zeilen[0]] : []); }
                    else setZeilen([d.key]);
                }} style={dimBtnStyle(inZ, '#2563EB')}>{inZ ? '✓ Z' : '+Z'}</button>
                <button onClick={() => {
                    if (inS) setSpalten([]);
                    else if (inZ) { setSpalten([d.key]); setZeilen(spalten[0] ? [spalten[0]] : []); }
                    else setSpalten([d.key]);
                }} style={dimBtnStyle(inS, '#7C3AED')}>{inS ? '✓ S' : '+S'}</button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header */}
            <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Reporting</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#6B6860' }}>Auswertungen & Kennzahlen</p>
            </div>

            {/* OBERER BEREICH: 3 Spalten */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'start' }}>

                {/* Spalte 1: Dimensionen */}
                <div style={{ ...CARD, padding: 14, maxHeight: 310, overflowY: 'auto' }}>
                    <div style={POOL_TITLE}>Dimensionen</div>
                    {ALLE_DIMENSIONEN.filter(d => !d.zeitDim).map(d => <DimRow key={d.key} d={d} />)}
                    <div style={{ height: 1, background: 'rgba(0,0,0,.07)', margin: '6px 0' }} />
                    {ALLE_DIMENSIONEN.filter(d => d.zeitDim).map(d => <DimRow key={d.key} d={d} />)}
                </div>

                {/* Spalte 2: Kennzahlen */}
                <div style={{ ...CARD, padding: 14, maxHeight: 310, overflowY: 'auto' }}>
                    <div style={POOL_TITLE}>Kennzahlen</div>
                    {KENNZAHLEN_DEF.map(k => {
                        const aktiv = kennzahlen.includes(k.key);
                        return (
                            <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                <span style={{ fontSize: 12.5, flex: 1, color: aktiv ? '#2563EB' : '#1A1917' }}>{k.label}</span>
                                <button onClick={() => toggleKennzahl(k.key)} style={dimBtnStyle(aktiv, '#2563EB')}>
                                    {aktiv ? '✓ K' : '+K'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Spalte 3: Filter */}
                <div style={{ ...CARD, padding: 14, maxHeight: 310, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ ...POOL_TITLE, marginBottom: 0 }}>
                            Filter
                            {filterAktiv && (
                                <span style={{ marginLeft: 6, background: '#2563EB', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9.5, fontWeight: 700 }}>Aktiv</span>
                            )}
                        </div>
                        {filterAktiv && (
                            <button onClick={() => setFilter({ ...FILTER_DEFAULT })} style={{
                                fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                                border: '1px solid rgba(0,0,0,.12)', borderRadius: 5,
                                background: '#fff', fontFamily: 'inherit', color: '#6B6860',
                            }}>zurücksetzen</button>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Von</label>
                            <input type="date" value={filter.von} onChange={e => setFilterF('von', e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Bis</label>
                            <input type="date" value={filter.bis} onChange={e => setFilterF('bis', e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                    </div>
                    {optionen?.standorte?.length > 0 && (
                        <MultiSelectDropdown label="Standort" options={optionen.standorte} selected={filter.standort_ids}
                            onChange={v => setFilterF('standort_ids', v)} getKey={s => s.standort_id} getLabel={s => s.name} />
                    )}
                    {optionen?.kader?.length > 0 && (
                        <MultiSelectDropdown label="Kader" options={optionen.kader} selected={filter.user_ids}
                            onChange={v => setFilterF('user_ids', v)} getKey={u => u.user_id} getLabel={u => u.full_name} />
                    )}
                    {optionen?.massnahmen?.length > 0 && (
                        <MultiSelectDropdown label="Massnahme" options={optionen.massnahmen} selected={filter.programm_ids}
                            onChange={v => setFilterF('programm_ids', v)} getKey={p => p.programm_id} getLabel={p => p.name} />
                    )}
                    {optionen?.abteilungen?.length > 0 && (
                        <MultiSelectDropdown label="Abteilung" options={optionen.abteilungen.map(a => ({ key: a, label: a }))}
                            selected={filter.abteilungen} onChange={v => setFilterF('abteilungen', v)}
                            getKey={a => a.key} getLabel={a => a.label} />
                    )}
                    {optionen?.klienten?.length > 0 && (
                        <MultiSelectDropdown label="Klient" options={optionen.klienten} selected={filter.klient_ids}
                            onChange={v => setFilterF('klient_ids', v)} getKey={k => k.klient_id} getLabel={k => k.name} />
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860', marginBottom: 3 }}>Auftraggeber-Typ</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[null, 'IV', 'Gemeinde'].map(v => (
                                <button key={v ?? 'alle'} onClick={() => setFilterF('auftraggeber_typ', v)} style={{
                                    ...CHIP_BASE, fontSize: 11.5,
                                    background: filter.auftraggeber_typ === v ? '#2563EB' : '#F5F4F0',
                                    color: filter.auftraggeber_typ === v ? '#fff' : '#6B6860',
                                    border: 'none', padding: '4px 10px',
                                }}>{v ?? 'Alle'}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* MITTLERER BEREICH: Aktive Konfiguration */}
            <div style={{ ...CARD, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div>
                        <div style={POOL_TITLE}>Zeilen</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 28 }}>
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
                        <div style={POOL_TITLE}>Spalten</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 28 }}>
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
                        <div style={POOL_TITLE}>Kennzahlen</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 28 }}>
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
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={ausfuehren} disabled={laden || kennzahlen.length === 0} style={{
                        padding: '6px 16px', fontSize: 12.5, fontWeight: 500,
                        cursor: laden || kennzahlen.length === 0 ? 'default' : 'pointer',
                        border: 'none', borderRadius: 6, background: '#2563EB', color: '#fff',
                        fontFamily: 'inherit', opacity: laden || kennzahlen.length === 0 ? .6 : 1,
                    }}>{laden ? '⟳ Wird geladen…' : '▶ Ausführen'}</button>
                    {fehler && <span style={{ fontSize: 12, color: '#B91C1C' }}>{fehler}</span>}
                    {laden && resultat && <span style={{ fontSize: 12, color: '#6B6860' }}>Wird aktualisiert…</span>}
                </div>
            </div>

            {/* UNTERER BEREICH: Resultat */}
            {resultat && (
                <div style={{ ...CARD, overflow: 'hidden', opacity: laden ? 0.6 : 1, transition: 'opacity .2s' }}>

                    {/* Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.07)', flexWrap: 'wrap' }}>
                        {/* Links: Gespeicherte Ansichten + Speichern */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                            {!zeigeSpeichern ? (
                                <button onClick={() => setZeigeSpeichern(true)} style={{
                                    fontSize: 11.5, padding: '4px 10px', cursor: 'pointer',
                                    border: '1px solid rgba(0,0,0,.12)', borderRadius: 6,
                                    background: '#fff', fontFamily: 'inherit', color: '#6B6860',
                                }}>+ Ansicht speichern</button>
                            ) : (
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                    <input value={ansichtName} onChange={e => setAnsichtName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && speichern()}
                                        placeholder="Name der Ansicht…" style={{ ...inputStyle, width: 180 }} autoFocus />
                                    <button onClick={speichern} style={{ ...inputStyle, cursor: 'pointer', background: '#2563EB', color: '#fff', border: 'none', fontWeight: 500 }}>Speichern</button>
                                    <button onClick={() => setZeigeSpeichern(false)} style={{ ...inputStyle, cursor: 'pointer' }}>✕</button>
                                </div>
                            )}
                            {ansichten.map(a => (
                                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <button onClick={() => ladeAnsicht(a)} style={{
                                        ...CHIP_BASE, background: '#EEF3FE', color: '#1D4ED8',
                                        border: '1px solid rgba(29,78,216,.2)', fontSize: 11.5,
                                    }}>{a.name}</button>
                                    <button onClick={() => loescheAnsicht(a.id)} style={{
                                        ...CHIP_BASE, padding: '3px 5px', background: 'transparent',
                                        color: '#A09D97', border: '1px solid transparent', fontSize: 10,
                                    }}>✕</button>
                                </span>
                            ))}
                        </div>
                        {/* Rechts: Stats + Diagramm-Controls + Toggle */}
                        <span style={{ fontSize: 12, color: '#6B6860', whiteSpace: 'nowrap' }}>
                            {resultat.zeilen.length} {resultat.zeilen.length === 1 ? 'Zeile' : 'Zeilen'} · {resultat.spalten.length} {resultat.spalten.length === 1 ? 'Spalte' : 'Spalten'}
                        </span>
                        {ansicht === 'diagramm' && (
                            <select value={diagrammTyp} onChange={e => setDiagrammTyp(e.target.value)}
                                style={{ ...inputStyle, fontSize: 12, cursor: 'pointer' }}>
                                <option value="auto">Auto</option>
                                <option value="linie">Linie</option>
                                <option value="balken_v">Balken (vertikal)</option>
                                <option value="balken_h">Balken (horizontal)</option>
                                <option value="gestapelt">Gestapelt</option>
                                <option value="flaeche">Fläche</option>
                                <option value="torte">Torte</option>
                            </select>
                        )}
                        <div style={{ display: 'flex', gap: 2 }}>
                            {[{ key: 'tabelle', label: '▦ Tabelle' }, { key: 'diagramm', label: '▤ Diagramm' }].map(({ key, label }) => (
                                <button key={key} onClick={() => setAnsicht(key)} style={{
                                    padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                                    border: 'none', borderRadius: 6, fontFamily: 'inherit',
                                    fontWeight: ansicht === key ? 600 : 400,
                                    background: ansicht === key ? '#2563EB' : '#F5F4F0',
                                    color: ansicht === key ? '#fff' : '#6B6860',
                                }}>{label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Tabellen-Ansicht */}
                    {ansicht === 'tabelle' && (
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
                                        {[...resultat.spalten, '__total__'].map(sp =>
                                            kennzahlen.map((kk, ki) => (
                                                <th key={`${sp}-${kk}`} style={{
                                                    padding: '3px 6px', fontWeight: 500, fontSize: 10.5, color: '#6B6860',
                                                    textAlign: 'right', whiteSpace: 'nowrap',
                                                    borderBottom: '2px solid rgba(0,0,0,.09)',
                                                    borderLeft: ki === 0 ? (sp === '__total__' ? '2px solid rgba(0,0,0,.12)' : '1px solid rgba(0,0,0,.06)') : undefined,
                                                }}>
                                                    {KZ_MAP[kk]?.short || kk}
                                                </th>
                                            ))
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
                                                        <td key={`${sp}-${kk}`} style={{
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
                                                    <td key={`total-${sp}-${kk}`} style={{
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
                    )}

                    {/* Diagramm-Ansicht */}
                    {ansicht === 'diagramm' && (
                        <div style={{ padding: '16px 20px', height: 420, boxSizing: 'border-box' }}>
                            {resultat.zeilen.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#A09D97', fontSize: 13, paddingTop: 60 }}>
                                    Keine Daten im gewählten Zeitraum
                                </div>
                            ) : (
                                <canvas ref={chartRef} />
                            )}
                        </div>
                    )}
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
