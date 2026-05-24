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
BUILD_STAMP_FILE="dist/.sleepox-build"
STAGING_DIR="$APP_DIR/.deploy-build"
BACKUP_DIST="$APP_DIR/dist.previous"

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

    echo "📦 [2/4] prepare isolated build..."
    rm -rf "$STAGING_DIR"
    mkdir -p "$STAGING_DIR"
    tar \
      --exclude="./.git" \
      --exclude="./node_modules" \
      --exclude="./dist" \
      --exclude="./dist.previous" \
      --exclude="./.deploy-build" \
      -cf - . | tar -xf - -C "$STAGING_DIR"

    echo "🔨 [3/4] install + build in staging..."
    (
      cd "$STAGING_DIR"
      bun install
      APP_BUILD_VERSION="$(git rev-parse --short HEAD)-$(date +%s)" bun run build
    )

    if [ ! -f "$STAGING_DIR/dist/server/wrangler.json" ] || [ ! -d "$STAGING_DIR/dist/client" ]; then
      echo "❌ Build output is incomplete. Live app was NOT changed."
      exit 1
    fi

    echo "🚚 Publishing verified build..."
    rm -rf "$BACKUP_DIST"
    if [ -d "dist" ]; then
      mv dist "$BACKUP_DIST"
    fi
    mv "$STAGING_DIR/dist" dist
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$BUILD_STAMP_FILE"

    echo "♻️  [4/4] pm2 restart $PM2_NAME..."
    if ! pm2 restart "$PM2_NAME" --update-env; then
      echo "❌ PM2 restart failed. Rolling back to previous dist..."
      rm -rf dist
      if [ -d "$BACKUP_DIST" ]; then
        mv "$BACKUP_DIST" dist
        pm2 restart "$PM2_NAME" --update-env || true
      fi
      exit 1
    fi
    pm2 save
    rm -rf "$STAGING_DIR"

    echo ""
    echo "✅ Deploy complete!"
    echo "Build stamp: $(cat "$BUILD_STAMP_FILE")"
    pm2 list
    ;;
  *)
    echo "Unknown action: $action"
    echo "Usage: ./deploy.sh [deploy|logs|status|restart]"
    exit 1
    ;;
esac
