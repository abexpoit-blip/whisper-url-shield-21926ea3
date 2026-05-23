#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
HOST="${HOST:-0.0.0.0}"
WRANGLER_CLI="node_modules/wrangler/wrangler-dist/cli.js"
WRANGLER_CONFIG="dist/server/wrangler.json"

if [ -f .wrangler/deploy/config.json ] && [ ! -f "${WRANGLER_CONFIG}" ]; then
  rm -f .wrangler/deploy/config.json
fi

if [ ! -f "${WRANGLER_CONFIG}" ]; then
  echo "Built server config not found at ${WRANGLER_CONFIG}. Run bun run build first." >&2
  exit 1
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :${PORT} )" | grep -q ":${PORT}"; then
  echo "Port ${PORT} is already in use. Stop the old process or set a different PORT." >&2
  exit 1
fi

if [ ! -f "${WRANGLER_CLI}" ]; then
  echo "Wrangler is not installed. Run bun install first." >&2
  exit 1
fi

exec node "${WRANGLER_CLI}" dev --config "${WRANGLER_CONFIG}" --port "${PORT}" --ip "${HOST}" --local --log-level info
