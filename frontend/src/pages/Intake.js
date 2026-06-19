import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import NeueAnfrageModal from '../components/NeueAnfrageModal';

const BUCKETS = [
    { key: 'vorabklaerung',          label: 'Vorabklärung' },
    { key: 'berufsmassnahmen',       label: 'Berufsmassnahmen' },
    { key: 'integrationsmassnahmen', label: 'Integrationsmassnahmen' },
    { key: 'beratung_coaching',      label: 'Beratung & Coaching' },
    { key: 'programmstart',          label: 'Programmstart' },
];

const LABEL_FARBEN = { 'LE': '#16A34A', 'TN': '#2563EB', 'MA': '#7C3AED' };

function heute() { return new Date().toISOString().slice(0, 10); }
function fmtDatum(d) {
    return d ? new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
}

function Karte({ d, abgeschlossen, onNavigate, onDragStart }) {
    return (
        <div
            draggable={!abgeschlossen}
            onDragStart={abgeschlossen ? undefined : onDragStart}
            onClick={onNavigate}
            style={{
                background: abgeschlossen ? '#F5F4F0' : '#fff',
                border: '1px solid rgba(0,0,0,.09)',
                borderRadius: 6, padding: 8, marginBottom: 5,
                cursor: 'pointer', transition: 'border-color .15s',
                opacity: abgeschlossen ? .6 : 1,
                position: 'relative',
            }}
            onMouseOver={e => !abgeschlossen && (e.currentTarget.style.borderColor = '#2563EB')}
            onMouseOut={e => !abgeschlossen && (e.currentTarget.style.borderColor = 'rgba(0,0,0,.09)')}
        >
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>
                {d.vorname} {d.nachname}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {d.programm_name && (
                    <span style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 500,
                        background: (d.farbe_hex || '#888') + '22', color: d.farbe_hex || '#888',
                        border: `1px solid ${d.farbe_hex || '#888'}33`
                    }}>{d.programm_name}</span>
                )}
                {d.klient_label && LABEL_FARBEN[d.klient_label] && (
                    <span style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 500, fontFamily: 'monospace',
                        background: LABEL_FARBEN[d.klient_label] + '22', color: LABEL_FARBEN[d.klient_label],
                        border: `1px solid ${LABEL_FARBEN[d.klient_label]}33`
                    }}>{d.klient_label}</span>
                )}
            </div>
            <div style={{ fontSize: 10, color: '#6B6860' }}>{d.auftraggeber}</div>
            <div style={{ fontSize: 10, color: '#A09D97', marginTop: 1 }}>Eingang: {fmtDatum(d.eingang_datum)}</div>

            {abgeschlossen && d.absage_grund != null && (
                <div style={{ fontSize: 10, color: '#B91C1C', marginTop: 5, fontStyle: 'italic' }}>
                    {d.absage_grund}
                </div>
            )}
        </div>
    );
}

export default function Intake() {
    const [dossiers, setDossiers] = useState([]);
    const [laden, setLaden] = useState(true);
    const [suche, setSuche] = useState('');
    const [anfrageModal, setAnfrageModal] = useState(false);
    const [aufgeklappt, setAufgeklappt] = useState({});
    const [dragOverBucket, setDragOverBucket] = useState('');
    const navigate = useNavigate();

    function ladeDossiers() {
        return client.get('/dossiers').then(r => setDossiers(r.data));
    }

    useEffect(() => {
        ladeDossiers()
            .catch(console.error)
            .finally(() => setLaden(false));
    }, []);

    const gefiltert = dossiers;

    function matchSuche(d) {
        if (!suche) return true;
        const s = suche.toLowerCase();
        return (
            `${d.vorname} ${d.nachname}`.toLowerCase().includes(s) ||
            (d.programm_name || '').toLowerCase().includes(s) ||
            (d.auftraggeber || '').toLowerCase().includes(s) ||
            (d.absage_grund || '').toLowerCase().includes(s)
        );
    }

    async function verschieben(dossier, neuerBucket) {
        if (dossier.pipeline_status === neuerBucket) return;
        const alterLabel = BUCKETS.find(b => b.key === dossier.pipeline_status)?.label || dossier.pipeline_status;
        const neuerLabel = BUCKETS.find(b => b.key === neuerBucket)?.label || neuerBucket;
        try {
            await client.put(`/dossiers/${dossier.dossier_id}/intake`, {
                pipeline_status: neuerBucket,
                intake_abgeschlossen: dossier.intake_abgeschlossen || false,
                absage_grund: dossier.absage_grund || null,
                absage_notiz: dossier.absage_notiz || null,
            });
            await client.post('/journal', {
                klient_id: dossier.klient_id,
                kategorie: 'Sonstiges',
                datum: heute(),
                text: `Intake: Verschoben von ${alterLabel} nach ${neuerLabel}`,
            });
            await ladeDossiers();
        } catch (err) { console.error(err); }
    }

    function toggleAufgeklappt(key) {
        setAufgeklappt(prev => ({ ...prev, [key]: !prev[key] }));
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 19, fontWeight: 600 }}>Intake</div>
                        <div style={{ fontSize: 12, color: '#6B6860', marginTop: 2 }}>Alle laufenden Anfragen nach Bucket</div>
                    </div>
                </div>
                <button onClick={() => setAnfrageModal(true)} style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', borderRadius: 6,
                    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
                }}>+ Neue Anfrage</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <input
                    type="text"
                    value={suche}
                    onChange={e => setSuche(e.target.value)}
                    placeholder="Klient suchen..."
                    style={{
                        fontSize: 12.5, padding: '6px 10px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,.09)', background: '#F5F4F0',
                        fontFamily: 'inherit', width: 240, outline: 'none'
                    }}
                />
            </div>

            {laden ? (
                <div style={{ color: '#6B6860', fontSize: 12 }}>Laden…</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 9 }}>
                    {BUCKETS.map(bucket => {
                        const alle = gefiltert.filter(d => d.pipeline_status === bucket.key);
                        const aktive = alle.filter(d => d.intake_abgeschlossen !== true).filter(matchSuche);
                        const abgeschlossen = alle.filter(d => d.intake_abgeschlossen === true).filter(matchSuche);
                        const offen = !!aufgeklappt[bucket.key] || (!!suche && abgeschlossen.length > 0);
                        const abschlussLabel = bucket.key === 'programmstart' ? 'Start erfolgt' : 'Abgeschlossen';

                        return (
                            <div key={bucket.key}
                                onDragOver={e => { e.preventDefault(); setDragOverBucket(bucket.key); }}
                                onDragLeave={() => setDragOverBucket('')}
                                onDrop={e => {
                                    e.preventDefault();
                                    setDragOverBucket('');
                                    const id = e.dataTransfer.getData('text/plain');
                                    const dossier = dossiers.find(x => x.dossier_id === id);
                                    if (dossier) verschieben(dossier, bucket.key);
                                }}
                                style={{
                                    background: '#fff',
                                    border: `1px solid ${dragOverBucket === bucket.key ? '#2563EB' : 'rgba(0,0,0,.09)'}`,
                                    borderRadius: 10, padding: 9, boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                                    minHeight: 140, transition: 'border-color .1s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '.06em' }}>{bucket.label}</span>
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, fontFamily: 'monospace',
                                        background: '#F5F4F0', border: '1px solid rgba(0,0,0,.09)',
                                        borderRadius: 20, padding: '1px 6px', color: '#6B6860'
                                    }}>{aktive.length}</span>
                                </div>

                                {aktive.length === 0 && abgeschlossen.length === 0 && suche ? (
                                    <div style={{ fontSize: 11, color: '#A09D97', padding: '6px 2px', fontStyle: 'italic' }}>
                                        Keine Ergebnisse für „{suche}"
                                    </div>
                                ) : aktive.map(d => (
                                    <Karte
                                        key={d.dossier_id}
                                        d={d}
                                        abgeschlossen={false}
                                        onNavigate={() => navigate(`/dossiers/${d.dossier_id}`)}
                                        onDragStart={e => e.dataTransfer.setData('text/plain', d.dossier_id)}
                                    />
                                ))}

                                {abgeschlossen.length > 0 && (
                                    <>
                                        <div style={{ borderTop: '1px solid rgba(0,0,0,.07)', margin: '8px 0' }} />
                                        <button
                                            onClick={() => toggleAufgeklappt(bucket.key)}
                                            style={{
                                                width: '100%', textAlign: 'left', fontSize: 10.5, fontWeight: 600,
                                                color: '#6B6860', cursor: 'pointer', border: 'none', background: 'transparent',
                                                fontFamily: 'inherit', padding: '3px 0'
                                            }}
                                        >{offen ? '▾' : '▸'} {abschlussLabel} ({abgeschlossen.length})</button>
                                        {offen && abgeschlossen.map(d => (
                                            <Karte
                                                key={d.dossier_id}
                                                d={d}
                                                abgeschlossen={true}
                                                onNavigate={() => navigate(`/dossiers/${d.dossier_id}`)}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <NeueAnfrageModal
                open={anfrageModal}
                onClose={() => setAnfrageModal(false)}
                onSaved={() => {
                    setAnfrageModal(false);
                    ladeDossiers();
                }}
            />
        </div>
    );
}
