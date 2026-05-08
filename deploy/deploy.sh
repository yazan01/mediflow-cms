#!/bin/bash
# MediFlow CMS — First-time deployment script for Ubuntu
# Run as root: sudo bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/mediflow"
APP_USER="mediflow"
NODE_VERSION="20"

echo "==> [1/9] Installing system dependencies..."
apt-get update -q
apt-get install -y -q \
    git curl nginx mysql-server python3.11 python3.11-venv python3-pip \
    certbot python3-certbot-nginx

# Install Node.js
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi

echo "==> [2/9] Creating system user..."
id -u "$APP_USER" &>/dev/null || useradd --system --shell /bin/bash --create-home "$APP_USER"

echo "==> [3/9] Cloning / updating repository..."
if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull
else
    # REPLACE with your actual repo URL
    git clone https://github.com/YOUR_USERNAME/mediflow-cms.git "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [4/9] Setting up Python virtual environment..."
python3.11 -m venv "$APP_DIR/backend/.venv"
"$APP_DIR/backend/.venv/bin/pip" install --upgrade pip -q
"$APP_DIR/backend/.venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt" -q

echo "==> [5/9] Checking environment files..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
    echo ""
    echo "  !! IMPORTANT: Edit $APP_DIR/backend/.env with your secrets before continuing."
    echo "  !! Then re-run this script."
    echo ""
    exit 1
fi
if [ ! -f "$APP_DIR/.env.local" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env.local"
    echo ""
    echo "  !! IMPORTANT: Edit $APP_DIR/.env.local with your secrets before continuing."
    echo "  !! Then re-run this script."
    echo ""
    exit 1
fi

echo "==> [6/9] Running database migrations..."
cd "$APP_DIR/backend"
# On first deploy: create all tables, then stamp alembic as current
"$APP_DIR/backend/.venv/bin/python" -c "
from database import engine, Base
import models
Base.metadata.create_all(bind=engine)
print('Tables created.')
"
"$APP_DIR/backend/.venv/bin/alembic" upgrade head || true

echo "==> [7/9] Building Next.js frontend..."
cd "$APP_DIR"
npm ci --omit=dev
npm run build

echo "==> [8/9] Installing systemd services..."
cp "$APP_DIR/deploy/mediflow-backend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/mediflow-frontend.service" /etc/systemd/system/

# Fix ExecStart path to use the actual next binary
sed -i "s|/usr/bin/node_modules/.bin/next|$(which npx) next|g" /etc/systemd/system/mediflow-frontend.service

systemctl daemon-reload
systemctl enable mediflow-backend mediflow-frontend
systemctl restart mediflow-backend mediflow-frontend

echo "==> [9/9] Configuring Nginx..."
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/mediflow
ln -sf /etc/nginx/sites-available/mediflow /etc/nginx/sites-enabled/mediflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "======================================================"
echo "  MediFlow deployed at http://$(hostname -I | awk '{print $1}')"
echo "  Next step: sudo certbot --nginx -d yourdomain.com"
echo "======================================================"
