// Fallrollen (klient_user.rolle_im_fall bzw. benutzer_aufgabe.rolle_name).
//
// Diese Rollen sagen, welche Funktion jemand in einem konkreten Fall hat – sie
// haben nichts mit den System-Rollen (benutzer.system_rolle) und damit nichts
// mit Berechtigungen zu tun. Abteilungsleitung und Bereichsleitung sind
// gleichrangig zu den uebrigen Fallrollen (Feedback 06.07.2026).
//
// Die Liste stand vorher an sieben Stellen dupliziert und lief auseinander.
export const FALLROLLEN = [
    'Klientenführung',
    'Job Coach',
    'Fachperson',
    'Abteilungsleitung',
    'Bereichsleitung',
];

// Rollen, die an einem konkreten Fall vergeben werden. Abteilungs- und
// Bereichsleitung gehoeren nicht dazu: das sind Funktionen einer Person, keine
// Zustaendigkeit in einem einzelnen Dossier.
export const ROLLEN_ZUWEISUNG = [
    'Klientenführung', 'Job Coach', 'Fachperson', 'Stellvertretung',
];

// Kuerzel fuer knappe Darstellungen, etwa in der Dossierliste.
export const ROLLEN_KUERZEL = {
    'Klientenführung':   'KF',
    'Fachperson':        'FP',
    'Job Coach':         'JC',
    'Abteilungsleitung': 'AL',
    'Bereichsleitung':   'BL',
    'Stellvertretung':   'SV',
};

// Kontextspezifische Varianten
export const ROLLEN_EIGENES_PROFIL = [...FALLROLLEN, 'Intake'];
export const ROLLEN_FILTER        = ['Alle', ...FALLROLLEN];

export const ROLLE_FARBE = {
    'Klientenführung':   { bg: '#EEF3FE', color: '#1D4ED8', linie: '#2563EB' },
    'Job Coach':         { bg: '#F0FDF4', color: '#15803D', linie: '#16A34A' },
    'Fachperson':        { bg: '#F5F3FF', color: '#5B21B6', linie: '#7C3AED' },
    'Abteilungsleitung': { bg: '#FFF7ED', color: '#C2410C', linie: '#EA580C' },
    'Bereichsleitung':   { bg: '#FEF2F2', color: '#B91C1C', linie: '#DC2626' },
    'Teamleitung':       { bg: '#FFF7ED', color: '#C2410C', linie: '#C2410C' },
    'Management':        { bg: '#FDF4FF', color: '#7E22CE', linie: '#7E22CE' },
};
