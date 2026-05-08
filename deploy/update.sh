#!/bin/bash
# MediFlow CMS — Update script (run after every git push to production)
# Usage: sudo bash /opt/mediflow/deploy/update.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/mediflow"
APP_USER="mediflow"

echo "==> [1/5] Pulling latest code..."
git -C "$APP_DIR" pull
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [2/5] Updating Python dependencies..."
"$APP_DIR/backend/.venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt" -q

echo "==> [3/5] Running database migrations..."
cd "$APP_DIR/backend"
"$APP_DIR/backend/.venv/bin/alembic" upgrade head

echo "==> [4/5] Rebuilding Next.js frontend..."
cd "$APP_DIR"
npm ci --omit=dev
npm run build

echo "==> [5/5] Restarting services..."
systemctl restart mediflow-backend mediflow-frontend

echo ""
echo "======================================================"
echo "  Update complete. Services restarted."
echo "  Check logs: journalctl -u mediflow-backend -n 50"
echo "              journalctl -u mediflow-frontend -n 50"
echo "======================================================"
