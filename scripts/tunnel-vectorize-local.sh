#!/usr/bin/env sh
# Expose local ai-service (port 9000) via Cloudflare quick tunnel — dev / demo only.
# Requires: docker compose, cloudflared (brew install cloudflared)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting Qdrant + ai-service (Docker)..."
docker compose --profile ai up -d qdrant ai-service

echo "Waiting for /health on http://127.0.0.1:9000 ..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:9000/health >/dev/null 2>&1; then
    echo "ai-service OK"
    break
  fi
  sleep 3
done

echo ""
echo "Public HTTPS URL (copy for IMAGE_VECTORIZE_URL on Render — temporary):"
echo "  https://xxxx.trycloudflare.com/vectorize"
echo ""
exec cloudflared tunnel --url http://127.0.0.1:9000
