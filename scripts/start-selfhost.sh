#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
HOST="${HOST:-0.0.0.0}"
WRANGLER_CLI="node_modules/wrangler/wrangler-dist/cli.js"

if [ -f .wrangler/deploy/config.json ] && [ ! -f dist/server/wrangler.json ]; then
  rm -f .wrangler/deploy/config.json
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :${PORT} )" | grep -q ":${PORT}"; then
  echo "Port ${PORT} is already in use. Stop the old process or set a different PORT." >&2
  exit 1
fi

if [ ! -f "${WRANGLER_CLI}" ]; then
  echo "Wrangler is not installed. Run bun install first." >&2
  exit 1
fi

exec node "${WRANGLER_CLI}" dev --port "${PORT}" --ip "${HOST}" --local
