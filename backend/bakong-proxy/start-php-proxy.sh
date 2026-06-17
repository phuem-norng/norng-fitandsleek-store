#!/usr/bin/env bash
# Bakong MD5 proxy for NBC (must run on Cambodia internet).
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE="../.env"
PORT="${BAKONG_PROXY_PORT:-8787}"

if [[ -f "$ENV_FILE" ]]; then
  BAKONG_TOKEN="$(grep '^BAKONG_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  BAKONG_PROXY_SECRET="$(grep '^BAKONG_PROXY_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  [[ -n "${BAKONG_TOKEN:-}" ]] && export BAKONG_TOKEN
  [[ -n "${BAKONG_PROXY_SECRET:-}" ]] && export BAKONG_PROXY_SECRET
fi

if [[ -z "${BAKONG_TOKEN:-}" ]]; then
  echo "ERROR: BAKONG_TOKEN missing in backend/.env"
  exit 1
fi

echo "Bakong PHP proxy on http://127.0.0.1:${PORT}/index.php"
exec php -S "127.0.0.1:${PORT}" -t .
