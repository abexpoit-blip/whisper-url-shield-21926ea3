#!/usr/bin/env bash
# Deploy Sleepox app on VPS (self-hosted, PM2 + Supabase docker stack)
# Usage on VPS:
#   cd /opt/sleepox-app-new && ./deploy.sh
#   ./deploy.sh logs      # live PM2 logs
#   ./deploy.sh status    # PM2 + supabase status
#   ./deploy.sh restart   # restart only (no pull/build)

set -e

APP_DIR="/opt/sleepox-app-new"
PM2_NAME="sleepox"
SUPABASE_DIR="/opt/supabase-docker"

cd "$APP_DIR"

action="${1:-deploy}"

case "$action" in
  logs)
    pm2 logs "$PM2_NAME" --lines 100
    ;;
  status)
    echo "=== PM2 ==="
    pm2 list
    echo ""
    echo "=== Supabase containers ==="
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "supabase|realtime" || true
    ;;
  restart)
    echo "♻️  Restarting PM2 process..."
    pm2 restart "$PM2_NAME" --update-env
    pm2 save
    ;;
  deploy|"")
    echo "🚀 Deploying sleepox app..."

    echo "📥 [1/4] git pull..."
    git pull --ff-only

    echo "📦 [2/4] bun install..."
    bun install

    echo "🔨 [3/4] bun run build..."
    bun run build

    echo "♻️  [4/4] pm2 restart $PM2_NAME..."
    pm2 restart "$PM2_NAME" --update-env
    pm2 save

    echo ""
    echo "✅ Deploy complete!"
    pm2 list
    ;;
  *)
    echo "Unknown action: $action"
    echo "Usage: ./deploy.sh [deploy|logs|status|restart]"
    exit 1
    ;;
esac
