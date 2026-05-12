#!/usr/bin/env sh
# One-shot: ~/.cloudflared/config.yml, Docker fullstack (5173), tunnel DNS route, macOS LaunchAgent for cloudflared.
# DNS conflict cleanup (delete stray A): run scripts/cloudflare-prune-tunnel-dns.sh after adding API token.

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CFD="${HOME}/.cloudflared"
PLIST="${HOME}/Library/LaunchAgents/com.fitandsleek.cloudflared-tunnel.plist"
TUNNEL_ID="c5ad8ac1-d927-4236-911d-aeac8efbfcab"
TUNNEL_NAME="fitandsleek-dev"
HOSTNAME="app.fitandsleek.phuemnorng-kalapakteam.space"

if ! command -v cloudflared >/dev/null 2>&1; then
  printf "cloudflared not found. Install: brew install cloudflare/cloudflare/cloudflared\n" >&2
  exit 1
fi
CLOUDFL_BIN=$(command -v cloudflared)

mkdir -p "$CFD"
mkdir -p "${HOME}/Library/LaunchAgents"

cat > "$CFD/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CFD/${TUNNEL_ID}.json

ingress:
  - hostname: $HOSTNAME
    service: http://127.0.0.1:5173
  - service: http_status:404
EOF
printf "Wrote %s/config.yml\n" "$CFD"

if [ ! -f "$CFD/${TUNNEL_ID}.json" ]; then
  printf "Missing credentials %s/${TUNNEL_ID}.json — run: cloudflared tunnel login && cloudflared tunnel create %s\n" "$CFD" "$TUNNEL_NAME" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  printf "docker compose not found\n" >&2
  exit 1
fi

docker network inspect fitandsleek_fullstack_default >/dev/null 2>&1 || docker network create fitandsleek_fullstack_default
(
  cd "$ROOT_DIR"
  $DC -f docker-compose.fullstack.yml up -d db backend frontend
)
printf "Docker services db/backend/frontend started (5173, 8000).\n"

cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" || true
printf "Requested tunnel DNS route for %s\n" "$HOSTNAME"

# LaunchAgent: keep tunnel running after logout (user session GUI domain)
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fitandsleek.cloudflared-tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>$CLOUDFL_BIN</string>
    <string>tunnel</string>
    <string>run</string>
  </array>
  <key>StandardOutPath</key>
  <string>$CFD/tunnel-launchd.log</string>
  <key>StandardErrorPath</key>
  <string>$CFD/tunnel-launchd.err</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
EOF

UID_NUM=$(id -u)
launchctl bootout "gui/${UID_NUM}/com.fitandsleek.cloudflared-tunnel" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "$PLIST" 2>/dev/null || {
  printf "Note: launchctl bootstrap failed (grant Terminal Full Disk Access or run manually):\n  launchctl bootstrap gui/%s %s\n" "$UID_NUM" "$PLIST" >&2
}
launchctl kickstart -k "gui/${UID_NUM}/com.fitandsleek.cloudflared-tunnel" 2>/dev/null || true

printf "\nTunnel service installed. Logs: %s/tunnel-launchd.log\n" "$CFD"
printf "If the site still times out, delete stray A records in Cloudflare DNS or run:\n  sh scripts/cloudflare-prune-tunnel-dns.sh\n(after copying .env.example → cloudflare-tunnel-app-hostname.env with API token)\n"
