#!/usr/bin/env bash
# Connect fitandsleek-bakong-proxy tunnel (token from Cloudflare Zero Trust dashboard).
set -euo pipefail
TOKEN_FILE="$HOME/.fitandsleek/cloudflared-tunnel.token"
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "ERROR: Paste your tunnel token into: $TOKEN_FILE"
  echo "Cloudflare → Tunnels → fitandsleek-bakong-proxy → Install connector → copy token"
  exit 1
fi
TOKEN="$(tr -d ' \n\r' < "$TOKEN_FILE")"
exec cloudflared tunnel run --token "$TOKEN"
