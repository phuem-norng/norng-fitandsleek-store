#!/usr/bin/env bash
# Install cloudflared + LaunchAgents for stable Bakong proxy tunnel.
set -euo pipefail

PROXY_DIR="$(cd "$(dirname "$0")" && pwd)"
BAKONG_HOST="proxyapp.fitandsleek.online"
TUNNEL_ID="c5ad8ac1-d927-4236-911d-aeac8efbfcab"
PROXY_URL="https://${BAKONG_HOST}/index.php"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"

mkdir -p "$HOME/.fitandsleek"
grep '^BAKONG_TOKEN=' "$PROXY_DIR/../.env" | head -1 | tr -d '\r' > "$HOME/.fitandsleek/bakong-proxy.env"
grep '^BAKONG_PROXY_SECRET=' "$PROXY_DIR/../.env" | head -1 | tr -d '\r' >> "$HOME/.fitandsleek/bakong-proxy.env"
chmod 600 "$HOME/.fitandsleek/bakong-proxy.env"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared via Homebrew..."
  brew install cloudflared
fi

echo "Registering DNS route (skip if already exists)..."
cloudflared tunnel route dns "$TUNNEL_ID" "$BAKONG_HOST" 2>/dev/null || \
  echo "NOTE: Add DNS manually in Cloudflare → CNAME ${BAKONG_HOST} → ${TUNNEL_ID}.cfargotunnel.com"

mkdir -p "$LAUNCH_AGENTS"

mkdir -p "$PROXY_DIR/.run-logs"
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
    <string>$(command -v cloudflared)</string>
    <string>tunnel</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/.cloudflared/tunnel-launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/.cloudflared/tunnel-launchd.err</string>
</dict>
</plist>
PLIST

mkdir -p "$PROXY_DIR/.run-logs"
launchctl bootout "gui/$(id -u)/com.fitandsleek.bakong-proxy" 2>/dev/null || true
launchctl bootout "gui/$(id -u)/com.fitandsleek.cloudflared-tunnel" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS/com.fitandsleek.bakong-proxy.plist"
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS/com.fitandsleek.cloudflared-tunnel.plist"
launchctl kickstart -k "gui/$(id -u)/com.fitandsleek.bakong-proxy"
launchctl kickstart -k "gui/$(id -u)/com.fitandsleek.cloudflared-tunnel"

sleep 5
echo ""
echo "============================================"
echo "Named tunnel Bakong proxy"
echo "Public URL:  ${PROXY_URL}"
echo ""
echo "Render env:"
echo "  BAKONG_PROXY_URL=${PROXY_URL}"
echo "  BAKONG_PROXY_STYLE=legacy"
echo "============================================"
echo ""
echo "Test:"
echo "  curl -X POST ${PROXY_URL} -H 'Content-Type: application/json' -d '{\"md5\":\"00000000000000000000000000000000\"}'"
