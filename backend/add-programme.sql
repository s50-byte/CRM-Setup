INSERT INTO programm (name, farbe_hex, tarif_pro_tag, avg_dauer_tage, aufwand_h_monat) VALUES
    ('Aufbautraining',    '#0891B2', 130.00, 45, 9),
    ('Arbeitstraining',   '#0D9488', 140.00, 60, 10),
    ('IM für Jugendliche','#7C3AED', 160.00, 90, 11)
ON CONFLICT (name) DO NOTHING;
