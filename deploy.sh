#!/usr/bin/env bash
# SLEEPOX deploy script — pushes latest code to self-hosted Supabase VPS
# Usage: ./deploy.sh           (deploy)
#        ./deploy.sh logs      (tail logs)
#        ./deploy.sh status    (container status)

set -e

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-supabase.sleepox.com}"
APP_DIR="${APP_DIR:-/opt/sleepox}"

case "${1:-deploy}" in
  deploy)
    echo "🚀 Deploying to $VPS_HOST ..."
    ssh "$VPS_USER@$VPS_HOST" "cd $APP_DIR && \
      git pull && \
      docker compose pull && \
      docker compose up -d --remove-orphans && \
      docker compose ps"
    echo "✅ Deploy complete."
    ;;
  logs)
    ssh "$VPS_USER@$VPS_HOST" "cd $APP_DIR && docker compose logs -f --tail=100"
    ;;
  status)
    ssh "$VPS_USER@$VPS_HOST" "cd $APP_DIR && docker compose ps"
    ;;
  restart)
    ssh "$VPS_USER@$VPS_HOST" "cd $APP_DIR && docker compose restart && docker compose ps"
    ;;
  *)
    echo "Usage: $0 [deploy|logs|status|restart]"
    exit 1
    ;;
esac
