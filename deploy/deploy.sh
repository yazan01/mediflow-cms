#!/bin/bash
# MediFlow CMS — Fully automated Ubuntu deployment
# Usage: sudo bash /opt/mediflow/deploy/deploy.sh
#
# All inputs are collected FIRST — then the script runs end-to-end without stopping.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
C='\033[0;36m'; G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1m'; N='\033[0m'
info()  { echo -e "\n${C}▶${N} ${B}$*${N}"; }
ok()    { echo -e "  ${G}✓${N} $*"; }
warn()  { echo -e "  ${Y}!${N} $*"; }
fatal() { echo -e "\n${R}✗ ERROR:${N} $*\n" >&2; exit 1; }
banner(){ echo -e "\n${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

APP_DIR="/opt/mediflow"
APP_USER="mediflow"
NODE_VERSION="20"
DB_NAME="mediflow_db"
DB_USER="mediflow_app"

# ── Guard: must run as root ────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || fatal "Run as root:  sudo bash deploy.sh"

banner
echo -e "    ${B}MediFlow CMS — Automated Ubuntu Deployment${N}"
banner
echo ""
echo "  This script installs and configures MediFlow CMS end-to-end."
echo "  You will be asked a few questions, then it runs automatically."
echo ""
read -rp "  Press Enter to begin, or Ctrl+C to cancel... "

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 0 — Collect all inputs FIRST
# ═══════════════════════════════════════════════════════════════════════════════
banner
echo -e "  ${B}Step 1/2 — Configuration${N}"
banner
echo ""

# ── Git repo URL ───────────────────────────────────────────────────────────────
read -rp "  Git repository URL: " REPO_URL
[[ -n "$REPO_URL" ]] || fatal "Repository URL cannot be empty."

# ── Domain or IP ───────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "  Your server IP is: ${SERVER_IP}"
echo "  Enter a domain name for HTTPS, or press Enter to use the IP (HTTP only)."
read -rp "  Domain name [leave blank for ${SERVER_IP}]: " DOMAIN
DOMAIN="${DOMAIN:-$SERVER_IP}"

# Determine if DOMAIN is an IP address
IS_IP=false
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    IS_IP=true
    warn "Using IP address — HTTPS will NOT be configured. Set COOKIE_SECURE=false."
fi

# ── MySQL ──────────────────────────────────────────────────────────────────────
echo ""
MYSQL_INSTALLED=false
if command -v mysql &>/dev/null; then
    MYSQL_INSTALLED=true
fi

if $MYSQL_INSTALLED; then
    echo -e "  ${G}MySQL is already installed on this server.${N}"
    while true; do
        read -rsp "  Enter existing MySQL root password: " MYSQL_ROOT_PASS; echo ""
        if mysql -u root -p"${MYSQL_ROOT_PASS}" -e "SELECT 1;" &>/dev/null; then
            ok "MySQL connection verified."
            break
        fi
        warn "Incorrect password — please try again."
    done
else
    echo -e "  ${Y}MySQL is not installed — it will be installed automatically.${N}"
    echo "  Choose a strong root password for MySQL:"
    while true; do
        read -rsp "  New MySQL root password: " MYSQL_ROOT_PASS; echo ""
        read -rsp "  Confirm MySQL root password: " MYSQL_ROOT_PASS2; echo ""
        if [[ "$MYSQL_ROOT_PASS" == "$MYSQL_ROOT_PASS2" ]]; then
            [[ ${#MYSQL_ROOT_PASS} -ge 8 ]] && break || warn "Password must be at least 8 characters."
        else
            warn "Passwords do not match — try again."
        fi
    done
fi

# ── System Admin password ─────────────────────────────────────────────────────
echo ""
echo "  Set the password for the MediFlow system administrator account."
echo "  (Login: admin@mediflow.com)"
echo "  Requirements: 8+ chars, uppercase, lowercase, digit."
while true; do
    read -rsp "  System Admin password: " ADMIN_PASS; echo ""
    ERR=""
    [[ ${#ADMIN_PASS} -lt 8 ]]          && ERR="At least 8 characters required."
    [[ "$ADMIN_PASS" =~ [A-Z] ]]        || ERR="Must contain an uppercase letter."
    [[ "$ADMIN_PASS" =~ [a-z] ]]        || ERR="Must contain a lowercase letter."
    [[ "$ADMIN_PASS" =~ [0-9] ]]        || ERR="Must contain a digit."
    if [[ -n "$ERR" ]]; then warn "$ERR"; continue; fi
    read -rsp "  Confirm System Admin password: " ADMIN_PASS2; echo ""
    [[ "$ADMIN_PASS" == "$ADMIN_PASS2" ]] && break
    warn "Passwords do not match — try again."
done

# ── Confirmation ───────────────────────────────────────────────────────────────
echo ""
banner
echo -e "  ${B}Configuration Summary${N}"
echo ""
echo "  Repository:   ${REPO_URL}"
echo "  Server:       ${DOMAIN}"
$IS_IP && echo "  HTTPS:        No (IP-based, HTTP only)" \
       || echo "  HTTPS:        Yes (run certbot after deployment)"
echo "  Database:     ${DB_NAME}  (user: ${DB_USER})"
echo "  Admin email:  admin@mediflow.com"
echo ""
read -rp "  All inputs collected. Press Enter to start automated deployment... "

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — System dependencies
# ═══════════════════════════════════════════════════════════════════════════════
banner
echo -e "  ${B}Step 2/2 — Automated Installation${N}"
banner

info "[1/7] Installing system packages..."
apt-get update -q

if $MYSQL_INSTALLED; then
    apt-get install -y -q git curl nginx python3.11 python3.11-venv python3-pip \
        certbot python3-certbot-nginx
else
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q git curl nginx python3.11 \
        python3.11-venv python3-pip mysql-server certbot python3-certbot-nginx
    systemctl start mysql
    systemctl enable mysql
fi

# Node.js
if ! command -v node &>/dev/null || (( $(node -v 2>/dev/null | cut -d. -f1 | tr -d 'v') < NODE_VERSION )); then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
    apt-get install -y -q nodejs
fi
ok "System packages ready. Node $(node -v), Python $(python3.11 --version | cut -d' ' -f2)"

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — MySQL setup
# ═══════════════════════════════════════════════════════════════════════════════
info "[2/7] Configuring MySQL..."

# On a fresh MySQL 8 install, root uses auth_socket (no password).
# Lock it to a password after setting it.
if ! $MYSQL_INSTALLED; then
    mysql -u root <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASS}';
FLUSH PRIVILEGES;
SQL
    ok "MySQL root password set."
fi

# Generate a random password for the dedicated app DB user
DB_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

mysql -u root -p"${MYSQL_ROOT_PASS}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
ok "Database '${DB_NAME}' and user '${DB_USER}' created."

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — Repository + system user
# ═══════════════════════════════════════════════════════════════════════════════
info "[3/7] Setting up repository and system user..."
id -u "$APP_USER" &>/dev/null || useradd --system --shell /bin/bash --create-home "$APP_USER"

if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull --rebase
else
    git clone "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "Repository ready at ${APP_DIR}."

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Python environment
# ═══════════════════════════════════════════════════════════════════════════════
info "[4/7] Setting up Python virtual environment..."
python3.11 -m venv "$APP_DIR/backend/.venv"
"$APP_DIR/backend/.venv/bin/pip" install --upgrade pip -q
"$APP_DIR/backend/.venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt" -q
ok "Python venv ready."

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Generate .env files
# ═══════════════════════════════════════════════════════════════════════════════
info "[5/7] Generating secrets and writing environment files..."

JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(64))")
SETTINGS_KEY=$("$APP_DIR/backend/.venv/bin/python" -c \
    "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# COOKIE_SECURE: false when using IP (no HTTPS), true when domain is provided
$IS_IP && COOKIE_SECURE="false" || COOKIE_SECURE="true"

cat > "$APP_DIR/backend/.env" <<ENVEOF
DATABASE_URL=mysql+pymysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
SETTINGS_ENCRYPTION_KEY=${SETTINGS_KEY}
ALLOWED_ORIGINS=$( $IS_IP && echo "http://${DOMAIN}" || echo "https://${DOMAIN}" )
COOKIE_SECURE=${COOKIE_SECURE}
ENVEOF

cat > "$APP_DIR/.env.local" <<ENVEOF
BACKEND_URL=http://localhost:8000
JWT_SECRET=${JWT_SECRET}
ENVEOF

chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env" "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/backend/.env" "$APP_DIR/.env.local"
ok "Secrets generated and .env files written."

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Database: create tables + seed admin user
# ═══════════════════════════════════════════════════════════════════════════════
info "[6/7] Initialising database..."
cd "$APP_DIR/backend"

# Create all SQLAlchemy tables
"$APP_DIR/backend/.venv/bin/python" - <<PYEOF
import sys, os
sys.path.insert(0, '${APP_DIR}/backend')
from database import engine, Base
import models
Base.metadata.create_all(bind=engine)
print("  Tables created.")
PYEOF

# Stamp alembic to current head (tables already created above — no migration needed)
"$APP_DIR/backend/.venv/bin/alembic" stamp head 2>/dev/null && true

# Create/update System Admin with provided password
MEDIFLOW_ADMIN_PASSWORD="${ADMIN_PASS}" "$APP_DIR/backend/.venv/bin/python" - <<PYEOF
import sys, os
sys.path.insert(0, '${APP_DIR}/backend')
admin_pass = os.environ['MEDIFLOW_ADMIN_PASSWORD']
from database import SessionLocal
import models
from auth import hash_password, generate_id
db = SessionLocal()
try:
    admin = db.query(models.User).filter(models.User.email == 'admin@mediflow.com').first()
    if admin:
        admin.passwordHash = hash_password(admin_pass)
        db.commit()
        print("  Admin password updated.")
    else:
        db.add(models.User(
            id=generate_id(), name='System Admin', email='admin@mediflow.com',
            passwordHash=hash_password(admin_pass), roles=['SUPER_ADMIN'], isActive=True
        ))
        db.commit()
        print("  Admin user created.")
finally:
    db.close()
PYEOF

# Seed departments, main branch, sample doctor (skips admin — already exists)
"$APP_DIR/backend/.venv/bin/python" "$APP_DIR/backend/seed.py"

ok "Database initialised and admin user ready."

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — Frontend build + services + Nginx
# ═══════════════════════════════════════════════════════════════════════════════
info "[7/7] Building frontend and starting services..."

cd "$APP_DIR"
npm ci --omit=dev --silent
npm run build

# Systemd services
cp "$APP_DIR/deploy/mediflow-backend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/mediflow-frontend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable mediflow-backend mediflow-frontend
systemctl restart mediflow-backend mediflow-frontend
ok "Services started."

# Nginx config — HTTP-only for IP, full SSL config for domain
if $IS_IP; then
    cat > /etc/nginx/sites-available/mediflow <<NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 20M;

    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
        proxy_buffering    off;
        proxy_cache        off;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 120s;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location ~ /\.env { deny all; return 404; }
}
NGINXEOF
else
    # Domain-based: use the repo's nginx.conf, replace yourdomain.com placeholder
    cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/mediflow
    sed -i "s/yourdomain\.com/${DOMAIN}/g" /etc/nginx/sites-available/mediflow
fi

ln -sf /etc/nginx/sites-available/mediflow /etc/nginx/sites-enabled/mediflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "Nginx configured."

# ═══════════════════════════════════════════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════════════════════════════════════════
PROTO=$( $IS_IP && echo "http" || echo "http" )
ACCESS_URL="${PROTO}://${DOMAIN}"

banner
echo ""
echo -e "  ${G}${B}Deployment complete!${N}"
echo ""
echo -e "  ${B}URL:${N}      ${ACCESS_URL}"
echo -e "  ${B}Login:${N}    admin@mediflow.com"
echo -e "  ${B}Password:${N} [the password you just entered]"
echo ""
if ! $IS_IP; then
echo -e "  ${Y}NEXT STEP — Enable HTTPS:${N}"
echo "    sudo certbot --nginx -d ${DOMAIN}"
echo ""
fi
echo -e "  ${B}Useful commands:${N}"
echo "    Update system:  sudo bash ${APP_DIR}/deploy/update.sh"
echo "    Backend logs:   sudo journalctl -u mediflow-backend -f"
echo "    Frontend logs:  sudo journalctl -u mediflow-frontend -f"
echo "    Service status: sudo systemctl status mediflow-backend mediflow-frontend"
echo ""
banner
echo ""
