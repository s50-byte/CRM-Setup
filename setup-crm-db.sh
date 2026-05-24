#!/bin/bash
# ============================================================
# IV-CRM — Setup VM 2: Datenbank-Server (crm-db)
# IP: 192.168.130.11
# Benutzer: simon
# ============================================================
set -e

echo ""
echo "======================================"
echo " IV-CRM Datenbank-Server Setup..."
echo "======================================"
echo ""

# ------------------------------
# 1. System aktualisieren
# ------------------------------
echo "[1/5] System aktualisieren..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
echo "      ✓ System aktuell"

# ------------------------------
# 2. Basis-Pakete
# ------------------------------
echo "[2/5] Basis-Pakete installieren..."
sudo apt-get install -y -qq \
  curl \
  wget \
  ufw \
  htop \
  nano
echo "      ✓ Basis-Pakete installiert"

# ------------------------------
# 3. PostgreSQL 16 installieren
# ------------------------------
echo "[3/5] PostgreSQL 16 installieren..."

# PostgreSQL offizielles Repository hinzufügen
sudo apt-get install -y -qq gnupg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
  sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq postgresql-16
echo "      ✓ PostgreSQL $(psql --version | awk '{print $3}') installiert"

# ------------------------------
# 4. PostgreSQL konfigurieren
# ------------------------------
echo "[4/5] PostgreSQL konfigurieren..."

# Datenbank und Benutzer anlegen
sudo -u postgres psql << 'SQL'
-- Applikations-Benutzer anlegen
CREATE USER crm_user WITH PASSWORD 'CRM_sicher_2025!';

-- Datenbank anlegen
CREATE DATABASE iv_crm OWNER crm_user;

-- Berechtigungen setzen
GRANT ALL PRIVILEGES ON DATABASE iv_crm TO crm_user;

-- Verbindungsinfo ausgeben
\echo '✓ Datenbank iv_crm angelegt'
\echo '✓ Benutzer crm_user angelegt'
SQL

# postgresql.conf: Lauscht auf internem Interface (nicht nur localhost)
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '192.168.130.11,localhost'/" $PG_CONF

# pg_hba.conf: Zugriff von crm-app (192.168.130.10) erlauben
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
echo "" | sudo tee -a $PG_HBA > /dev/null
echo "# IV-CRM App-Server" | sudo tee -a $PG_HBA > /dev/null
echo "host    iv_crm    crm_user    192.168.130.10/32    scram-sha-256" | sudo tee -a $PG_HBA > /dev/null

# PostgreSQL neu starten
sudo systemctl restart postgresql
sudo systemctl enable postgresql -q
echo "      ✓ PostgreSQL konfiguriert"
echo "        - Lauscht auf: 192.168.130.11 + localhost"
echo "        - Datenbank:   iv_crm"
echo "        - Benutzer:    crm_user"
echo "        - Zugriff von: 192.168.130.10 (crm-app)"

# ------------------------------
# 5. Firewall konfigurieren
# ------------------------------
echo "[5/5] Firewall konfigurieren..."
sudo ufw allow ssh > /dev/null
# PostgreSQL nur von crm-app erlauben
sudo ufw allow from 192.168.130.10 to any port 5432 > /dev/null
sudo ufw --force enable > /dev/null
echo "      ✓ Firewall aktiv"
echo "        - SSH:         alle"
echo "        - Port 5432:   nur 192.168.130.10"

echo ""
echo "======================================"
echo " ✓ crm-db Setup abgeschlossen!"
echo "======================================"
echo ""
echo " Verbindungsdaten für crm-app:"
echo "   Host:     192.168.130.11"
echo "   Port:     5432"
echo "   Datenbank: iv_crm"
echo "   Benutzer:  crm_user"
echo "   Passwort:  CRM_sicher_2025!"
echo ""
echo " Nächster Schritt: Datenbankschema einspielen"
echo ""
