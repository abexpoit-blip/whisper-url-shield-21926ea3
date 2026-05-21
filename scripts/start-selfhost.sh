#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
HOST="${HOST:-0.0.0.0}"

if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :${PORT} )" | grep -q ":${PORT}"; then
  echo "Port ${PORT} is already in use. Stop the old process or set a different PORT." >&2
  exit 1
fi

exec bunx wrangler dev --port "${PORT}" --ip "${HOST}" --local
