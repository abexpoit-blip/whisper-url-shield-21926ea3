#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
LOG_LEVEL="${WRANGLER_LOG_LEVEL:-warn}"
WRANGLER_CLI="node_modules/wrangler/wrangler-dist/cli.js"
WRANGLER_CONFIG="dist/server/wrangler.json"
CLIENT_DIR="dist/client"
ENV_FILE=".env"

export CI="${CI:-1}"
export WRANGLER_SEND_ERROR_REPORTS="${WRANGLER_SEND_ERROR_REPORTS:-false}"
export WRANGLER_SEND_METRICS="${WRANGLER_SEND_METRICS:-false}"
export CLOUDFLARE_INCLUDE_PROCESS_ENV="${CLOUDFLARE_INCLUDE_PROCESS_ENV:-true}"
export CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV="${CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:-true}"
export WRANGLER_CI_DISABLE_CONFIG_WATCHING="${WRANGLER_CI_DISABLE_CONFIG_WATCHING:-true}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -n "${SUPABASE_SECRET_KEY:-}" ]; then
  export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SECRET_KEY}"
fi

if [ -f .wrangler/deploy/config.json ] && [ ! -f "${WRANGLER_CONFIG}" ]; then
  rm -f .wrangler/deploy/config.json
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "Environment file not found at ${ENV_FILE}. Create it before starting self-host mode." >&2
  exit 1
fi

if [ ! -f "${WRANGLER_CLI}" ]; then
  echo "Wrangler is not installed. Run bun install first." >&2
  exit 1
fi

bun run verify-env

if [ ! -f "${WRANGLER_CONFIG}" ]; then
  echo "Built server config not found at ${WRANGLER_CONFIG}. Run ./deploy.sh first to build the app." >&2
  exit 1
fi

if [ ! -d "${CLIENT_DIR}" ]; then
  echo "Built client files not found at ${CLIENT_DIR}. Run ./deploy.sh first to build the app." >&2
  exit 1
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :${PORT} )" | grep -q ":${PORT}"; then
  echo "Port ${PORT} is already in use. Stop the old process or set a different PORT." >&2
  exit 1
fi

exec node "${WRANGLER_CLI}" dev \
  --config "${WRANGLER_CONFIG}" \
  --env-file "${ENV_FILE}" \
  --port "${PORT}" \
  --ip "${HOST}" \
  --local \
  --show-interactive-dev-session=false \
  --log-level "${LOG_LEVEL}"
