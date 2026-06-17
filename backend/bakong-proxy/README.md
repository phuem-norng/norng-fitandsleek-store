# Bakong NBC Proxy

NBC blocks `check_transaction_by_md5` from outside Cambodia (**errorCode 15**). Render (US) cannot poll status directly.

**Recommended without local Mac proxy:** register NBC **webhook** → `https://fitandsleek-official-backend.onrender.com/api/payments/khqr/webhook` and set `BAKONG_WEBHOOK_SECRET` on Render. The app marks orders paid when NBC POSTs (polling is backup only).

| Option | File | When |
|--------|------|------|
| **NBC webhook → Render** | — | Best default (no proxy) |
| **PHP on Cambodia VPS** | [`index.php`](./index.php) | Faster polling backup; `BAKONG_PROXY_STYLE=legacy` |
| ~~Cloudflare Worker~~ | — | **Blocked by NBC** — do not use |

Webhook (`/api/payments/khqr/webhook`) does **not** need a Cambodia proxy.

---

## Option A — Cloudflare Worker (path relay)

### Step 1 — Paste & Deploy

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Worker**
2. **Edit code** → paste [`worker-forward.js`](./worker-forward.js) → **Deploy**
3. Copy Worker URL (e.g. `https://aged-hill-ac57.teamvcnh.workers.dev`)

No Worker secrets needed — `BAKONG_TOKEN` stays on Render.

### Step 2 — Render env

```ini
BAKONG_PROXY_URL=https://aged-hill-ac57.teamvcnh.workers.dev
BAKONG_PROXY_STYLE=forward
```

Save → **Manual Deploy**.

### Test

```bash
curl -X POST "https://aged-hill-ac57.teamvcnh.workers.dev/v1/check_transaction_by_md5" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BAKONG_TOKEN" \
  -d '{"md5":"known_md5_here"}'
```

Expect NBC JSON — not errorCode 15.

---

## Option B — PHP on Cambodia VPS

See [`index.php`](./index.php) header comments.

```ini
BAKONG_PROXY_URL=https://your-cambodia-host.example.com/bakong-proxy/index.php
```

---

## How Laravel uses it

`BakongApi::checkByMd5()` POSTs `{"md5":"..."}` to `BAKONG_PROXY_URL` with optional `X-Bakong-Proxy-Secret`. The proxy adds `Authorization: Bearer` and calls NBC from a Cambodia IP.

**Do not** use a generic path-forwarding worker — the backend expects this dedicated MD5 proxy API.
