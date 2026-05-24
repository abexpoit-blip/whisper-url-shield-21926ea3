#!/usr/bin/env bash
# SLEEPOX deploy script — updates the app on the self-hosted VPS
# Usage: ./deploy.sh                 (deploy; auto local/remote)
#        LOCAL=1 ./deploy.sh         (force deploy on current VPS shell)
#        ./deploy.sh logs            (tail logs)
#        ./deploy.sh status          (container status)

set -e

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-supabase.sleepox.com}"
VPS_IP="${VPS_IP:-75.119.144.171}"
APP_DIR="${APP_DIR:-/opt/sleepox-app-new}"

is_vps_shell() {
  [ "${LOCAL:-0}" = "1" ] || hostname -I 2>/dev/null | tr ' ' '\n' | grep -qx "$VPS_IP"
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}

run_local() {
  local action="$1"
  cd "$APP_DIR"
  local compose
  compose="$(compose_cmd)"

  case "$action" in
    deploy)
      git pull
      $compose pull
      $compose up -d --remove-orphans
      $compose ps
      ;;
    logs)
      $compose logs -f --tail=100
      ;;
    status)
      $compose ps
      ;;
    restart)
      $compose restart
      $compose ps
      ;;
  esac
}

run_remote() {
  local action="$1"
  ssh "$VPS_USER@$VPS_HOST" "LOCAL=1 APP_DIR='$APP_DIR' bash -s '$action'" < "$0"
}

case "${1:-deploy}" in
  deploy)
    echo "🚀 Deploying to $VPS_HOST ..."
    if is_vps_shell; then
      run_local deploy
    else
      run_remote deploy
    fi
    echo "✅ Deploy complete."
    ;;
  logs)
    if is_vps_shell; then run_local logs; else run_remote logs; fi
    ;;
  status)
    if is_vps_shell; then run_local status; else run_remote status; fi
    ;;
  restart)
    if is_vps_shell; then run_local restart; else run_remote restart; fi
    ;;
  *)
    echo "Usage: $0 [deploy|logs|status|restart]"
    exit 1
    ;;
esac
