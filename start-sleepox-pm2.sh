#!/usr/bin/env bash
set -euo pipefail

cd /opt/sleepox-app-new

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"

exec bun run serve:selfhost