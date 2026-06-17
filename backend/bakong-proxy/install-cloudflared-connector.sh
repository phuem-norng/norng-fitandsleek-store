#!/usr/bin/env bash
# Install / connect fitandsleek-bakong-proxy Cloudflare tunnel on this Mac.
set -euo pipefail

PROXY_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$HOME/.fitandsleek/cloudflared-tunnel.token"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
UID_NUM="$(id -u)"
GUI="gui/${UID_NUM}"

mkdir -p "$HOME/.fitandsleek" "$PROXY_DIR/.run-logs"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared..."
  brew install cloudflared
fi

normalize_token() {
  local raw="$1"
  raw="$(tr -d ' \n\r' <<< "$raw")"
  if [[ "$raw" == *eyJ* ]]; then
    raw="${raw#*eyJ}"
    raw="eyJ${raw}"
  fi
  printf '%s' "$raw"
}

TOKEN=""
if [[ "${1:-}" == --token && -n "${2:-}" ]]; then
  TOKEN="$(normalize_token "$2")"
elif [[ -f "$TOKEN_FILE" ]] && ! grep -q "PASTE_YOUR_TOKEN" "$TOKEN_FILE" 2>/dev/null; then
  TOKEN="$(normalize_token "$(cat "$TOKEN_FILE")")"
else
  TOKEN="$(osascript <<'APPLESCRIPT' 2>/dev/null || true
display dialog "Paste your Cloudflare tunnel token from:\nTunnels → fitandsleek-bakong-proxy → Install connector\n\n(Copy everything after --token, starts with eyJ...)" default answer "" with title "Fitandsleek Bakong Tunnel" buttons {"Cancel", "Connect"} default button "Connect"
text returned of result
APPLESCRIPT
)"
  TOKEN="$(normalize_token "${TOKEN:-}")"
fi

if [[ -z "$TOKEN" || "$TOKEN" == PASTE_YOUR_TOKEN* ]]; then
  echo "ERROR: No tunnel token. Paste it into: $TOKEN_FILE"
  echo "Or run: $0 --token eyJ..."
  exit 1
fi

printf '%s' "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

chmod +x "$PROXY_DIR/run-tunnel-token.sh"
chmod +x "$PROXY_DIR/start-php-proxy.sh" 2>/dev/null || true

PHP_BIN="$(command -v php)"
cat > "$LAUNCH_AGENTS/com.fitandsleek.bakong-proxy.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fitandsleek.bakong-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>set -a &amp;&amp; source \$HOME/.fitandsleek/bakong-proxy.env &amp;&amp; set +a &amp;&amp; exec ${PHP_BIN} -S 127.0.0.1:8787 -t "${PROXY_DIR}"</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${PROXY_DIR}/.run-logs/php-launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${PROXY_DIR}/.run-logs/php-launchd.err</string>
</dict>
</plist>
PLIST

cat > "$LAUNCH_AGENTS/com.fitandsleek.cloudflared-tunnel.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fitandsleek.cloudflared-tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PROXY_DIR}/run-tunnel-token.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${PROXY_DIR}/.run-logs/tunnel-launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${PROXY_DIR}/.run-logs/tunnel-launchd.err</string>
</dict>
</plist>
PLIST

# Stop old tunnel process (previous account / config.yml).
pkill -f "cloudflared tunnel run" 2>/dev/null || true
sleep 1

launchctl bootout "$GUI/com.fitandsleek.bakong-proxy" 2>/dev/null || true
launchctl bootout "$GUI/com.fitandsleek.cloudflared-tunnel" 2>/dev/null || true
launchctl bootstrap "$GUI" "$LAUNCH_AGENTS/com.fitandsleek.bakong-proxy.plist"
launchctl bootstrap "$GUI" "$LAUNCH_AGENTS/com.fitandsleek.cloudflared-tunnel.plist"
launchctl kickstart -k "$GUI/com.fitandsleek.bakong-proxy"
launchctl kickstart -k "$GUI/com.fitandsleek.cloudflared-tunnel"

echo "Waiting for tunnel..."
for _ in $(seq 1 15); do
  if pgrep -f "cloudflared tunnel run --token" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

sleep 3
echo ""
echo "============================================"
echo "Bakong proxy connector started"
echo "  PHP:    http://127.0.0.1:8787"
echo "  Public: https://proxyapp.fitandsleek.online/index.php"
echo ""
echo "Check Cloudflare → fitandsleek-bakong-proxy → Active (1 replica)"
echo "============================================"
