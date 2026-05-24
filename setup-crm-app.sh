#!/bin/bash
# ============================================================
# IV-CRM — Setup VM 1: App-Server (crm-app)
# IP: 192.168.130.10
# Benutzer: simon
# ============================================================
set -e  # Skript stoppt bei jedem Fehler

echo ""
echo "======================================"
echo " IV-CRM App-Server Setup startet..."
echo "======================================"
echo ""

# ------------------------------
# 1. System aktualisieren
# ------------------------------
echo "[1/7] System aktualisieren..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
echo "      ✓ System aktuell"

# ------------------------------
# 2. Basis-Pakete installieren
# ------------------------------
echo "[2/7] Basis-Pakete installieren..."
sudo apt-get install -y -qq \
  curl \
  git \
  wget \
  unzip \
  ufw \
  htop \
  nano
echo "      ✓ Basis-Pakete installiert"

# ------------------------------
# 3. Node.js 22 installieren
# ------------------------------
echo "[3/7] Node.js 22 installieren..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - -qq
sudo apt-get install -y -qq nodejs
echo "      ✓ Node.js $(node --version) installiert"
echo "      ✓ npm $(npm --version) installiert"

# ------------------------------
# 4. PM2 installieren
# ------------------------------
echo "[4/7] PM2 installieren (hält Node.js am Laufen)..."
sudo npm install -g pm2 --quiet
sudo pm2 startup systemd -u simon --hp /home/simon | tail -1 | sudo bash
echo "      ✓ PM2 installiert"

# ------------------------------
# 5. nginx installieren
# ------------------------------
echo "[5/7] nginx installieren..."
sudo apt-get install -y -qq nginx

# nginx Konfiguration für IV-CRM
sudo tee /etc/nginx/sites-available/iv-crm > /dev/null << 'NGINX'
server {
    listen 80;
    server_name 192.168.130.10;

    # Frontend (React Build)
    root /var/www/iv-crm;
    index index.html;

    # React Router — alle Routen zum index.html weiterleiten
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API-Anfragen an Node.js weiterleiten
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Standard-Site deaktivieren, IV-CRM aktivieren
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/iv-crm /etc/nginx/sites-enabled/iv-crm

# Webroot erstellen
sudo mkdir -p /var/www/iv-crm
sudo chown simon:simon /var/www/iv-crm

# nginx starten
sudo systemctl enable nginx -q
sudo systemctl restart nginx
echo "      ✓ nginx installiert und konfiguriert"

# ------------------------------
# 6. App-Verzeichnis vorbereiten
# ------------------------------
echo "[6/7] App-Verzeichnis vorbereiten..."
mkdir -p /home/simon/iv-crm-backend
mkdir -p /home/simon/iv-crm-frontend
echo "      ✓ Verzeichnisse erstellt:"
echo "        /home/simon/iv-crm-backend  (Node.js API)"
echo "        /home/simon/iv-crm-frontend (React App)"

# ------------------------------
# 7. Firewall konfigurieren
# ------------------------------
echo "[7/7] Firewall konfigurieren..."
sudo ufw allow ssh    > /dev/null
sudo ufw allow http   > /dev/null
sudo ufw --force enable > /dev/null
echo "      ✓ Firewall aktiv (SSH + HTTP erlaubt)"

echo ""
echo "======================================"
echo " ✓ crm-app Setup abgeschlossen!"
echo "======================================"
echo ""
echo " Nächster Schritt: Setup auf crm-db (192.168.130.11)"
echo ""
