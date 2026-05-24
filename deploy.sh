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
SCRIPT_PATH="$APP_DIR/deploy.sh"

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
    old_head="$(git rev-parse HEAD 2>/dev/null || true)"
    git pull --ff-only
    new_head="$(git rev-parse HEAD 2>/dev/null || true)"

    if [ -n "$old_head" ] && [ "$old_head" != "$new_head" ] && git diff --name-only "$old_head" "$new_head" -- deploy.sh | grep -qx "deploy.sh"; then
      echo "🔁 deploy.sh updated from GitHub. Restarting with the latest deploy script..."
      chmod +x "$SCRIPT_PATH"
      exec "$SCRIPT_PATH" "$action"
    fi

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
