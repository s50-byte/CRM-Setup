const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host: '192.168.130.11',
    port: 5432,
    database: 'iv_crm',
    user: 'crm_user',
    password: 'CRM_sicher_2025!'
});

bcrypt.hash('Admin2025!', 12).then(hash => {
    return pool.query(
        `INSERT INTO benutzer (full_name, email, password_hash, system_rolle, pensum_pct, avatar_initials)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Simon Admin', 'simon@iv-crm.ch', hash, 'management', 100, 'SA']
    );
}).then(() => {
    console.log('✓ Admin-Benutzer erstellt');
    console.log('  Email:    simon@iv-crm.ch');
    console.log('  Passwort: Admin2025!');
    pool.end();
}).catch(err => {
    console.error('Fehler:', err.message);
    pool.end();
});