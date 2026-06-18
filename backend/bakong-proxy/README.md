# Bakong NBC Proxy

NBC blocks `check_transaction_by_md5` from outside Cambodia (**errorCode 15**). Render (US) cannot poll status directly.

**Recommended without local proxy:** register NBC **webhook** → `https://fitandsleek-official-backend.onrender.com/api/payments/khqr/webhook` and set `BAKONG_WEBHOOK_SECRET` on Render. The app marks orders paid when NBC POSTs (polling is backup only).

| Option | When |
|--------|------|
| **NBC webhook → Render** | Best default (no proxy) |
| **Docker + Cloudflare tunnel** | Polling backup on Mac/VPS in Cambodia — see below |
| **Mac LaunchAgent** | Same as Docker without Docker Desktop — `install-cloudflared-connector.sh` |
| **PHP on Cambodia VPS** | 24/7 server; deploy [`index.php`](./index.php) manually |
| ~~Cloudflare Worker~~ | **Blocked by NBC** — do not use |

Webhook (`/api/payments/khqr/webhook`) does **not** need a Cambodia proxy.

---

## Option A — Docker + Cloudflare tunnel (recommended for Mac)

Runs PHP proxy and `cloudflared` together. Cloudflare route stays `http://127.0.0.1:8787` (connector shares the proxy container network).

### 1. Cloudflare (one-time)

1. **Tunnels** → `fitandsleek-bakong-proxy` → **Routes** → published app:
   - Hostname: `proxyapp.fitandsleek.online`
   - Service URL: `http://127.0.0.1:8787`
2. Copy **tunnel token** from **Install connector** (macOS).

### 2. Env file

```bash
cd backend/bakong-proxy
cp env.docker.example .env.docker
# Edit .env.docker — BAKONG_TOKEN, BAKONG_PROXY_SECRET, CLOUDFLARE_TUNNEL_TOKEN
```

### 3. Start / stop

```bash
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f cloudflared

# Stop
docker compose --env-file .env.docker down
```

**Do not** run LaunchAgent `com.fitandsleek.cloudflared-tunnel` at the same time (one connector only).

### 4. Render env

```ini
BAKONG_PROXY_URL=https://proxyapp.fitandsleek.online/index.php
BAKONG_PROXY_STYLE=legacy
BAKONG_PROXY_SECRET=your_shared_secret
```

Manual Deploy on Render after saving.

### 5. Test

Local:

```bash
curl -X POST "http://127.0.0.1:8787/index.php" \
  -H "Content-Type: application/json" \
  -H "X-Bakong-Proxy-Secret: YOUR_SECRET" \
  -d '{"md5":"00000000000000000000000000000000"}'
```

Public (tunnel up):

```bash
curl -X POST "https://proxyapp.fitandsleek.online/index.php" \
  -H "Content-Type: application/json" \
  -H "X-Bakong-Proxy-Secret: YOUR_SECRET" \
  -d '{"md5":"00000000000000000000000000000000"}'
```

Expect NBC JSON with `responseCode: 1` (transaction not found is OK for a fake md5).

---

## Option B — Mac LaunchAgent (no Docker)

```bash
./install-cloudflared-connector.sh --token eyJ...
# Stop: launchctl bootout gui/$(id -u)/com.fitandsleek.cloudflared-tunnel
```

See [`install-cloudflared-connector.sh`](./install-cloudflared-connector.sh).

---

## Option C — PHP on Cambodia VPS

Deploy [`index.php`](./index.php) on any Cambodia host (nginx/apache or `php -S`).

```ini
BAKONG_PROXY_URL=https://your-cambodia-host.example.com/bakong-proxy/index.php
BAKONG_PROXY_STYLE=legacy
```

---

## How Laravel uses it

`BakongApi::checkByMd5()` POSTs `{"md5":"..."}` to `BAKONG_PROXY_URL` with optional `X-Bakong-Proxy-Secret`. The proxy adds `Authorization: Bearer` and calls NBC from a Cambodia IP.

**Do not** use a generic Cloudflare Worker path relay — NBC returns **403** from Workers.
