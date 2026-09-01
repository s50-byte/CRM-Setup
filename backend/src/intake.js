// ============================================================
// Intake abschliessen
// ============================================================
// Der Intake gilt als abgeschlossen, sobald zwei Dinge zusammenkommen: das
// Dossier steht auf "Programmstart" UND es gibt eine aktive Verfuegung.
//
// Frueher haing das an der Reihenfolge: nur das ANLEGEN einer Verfuegung
// schloss den Intake ab, und nur wenn das Dossier zu diesem Zeitpunkt schon
// auf Programmstart stand. Wurde erst die Verfuegung erfasst und danach
// verschoben - oder eine bestehende Verfuegung bearbeitet -, blieb der Intake
// offen und "Start erfolgt" wurde nie erreicht.
//
// Darum wird der Zustand jetzt aus beiden Richtungen geprueft.

async function intakeAbschliessenWennMoeglich(client, dossier_id) {
    const r = await client.query(
        `SELECT d.klient_id
         FROM dossier d
         WHERE d.dossier_id = $1::uuid
           AND d.pipeline_status = 'programmstart'
           AND d.intake_abgeschlossen IS NOT TRUE
           AND EXISTS (SELECT 1 FROM verfuegung v
                        WHERE v.dossier_id = d.dossier_id AND v.status = 'aktiv')`,
        [dossier_id]
    );
    if (!r.rows.length) return false;

    await client.query(
        `UPDATE dossier
            SET intake_abgeschlossen = TRUE,
                absage_grund = 'Verfügung eingetragen',
                status = 'aktiv',
                updated_at = NOW()
          WHERE dossier_id = $1::uuid`,
        [dossier_id]
    );
    return { klient_id: r.rows[0].klient_id };
}

module.exports = { intakeAbschliessenWennMoeglich };
