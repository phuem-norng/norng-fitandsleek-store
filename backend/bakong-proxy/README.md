# Bakong NBC Proxy & Hosted Checkout

NBC blocks `check_transaction_by_md5` from outside Cambodia (**errorCode 15**). Render (US) cannot poll NBC directly.

## Recommended for Render: Webhook (no proxy)

See **[docs/BAKONG-WEBHOOK-RENDER.md](../docs/BAKONG-WEBHOOK-RENDER.md)** — NBC POSTs to Render when paid; checkout polling reads `paid` from the database.

```
https://norng-fitandsleek-backend.onrender.com/api/payments/bakong/webhook
```

Set `BAKONG_WEBHOOK_SECRET` on Render to match NBC Developer Dashboard.

---

## Optional: proxy for status polling

| Option | File | Render env |
|--------|------|------------|
| **Cloudflare Worker (token on worker)** | [`worker.js`](./worker.js) | `BAKONG_PROXY_STYLE=legacy` |
| **Cloudflare Worker (token on Render)** | [`worker-forward.js`](./worker-forward.js) | `BAKONG_PROXY_STYLE=forward` |
| **PHP on Cambodia VPS** | [`index.php`](./index.php) | `BAKONG_PROXY_STYLE=legacy` |

If Worker returns **CloudFront 403 HTML**, use **webhook** or **Cambodia VPS** instead.

---

## Option A — Cloudflare Worker (`worker.js` + legacy)

### Step 1 — Paste & Deploy

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers** → **fitandsleek-bakong-proxy** → **Edit code**
2. Paste [`worker.js`](./worker.js) (not Hello World)
3. **Settings → Variables → Secrets:** `BAKONG_TOKEN` = same JWT as Render
4. **Deploy**

### Step 2 — Render env

```ini
BAKONG_PROXY_URL=https://fitandsleek-bakong-proxy.po29112001.workers.dev
BAKONG_PROXY_STYLE=legacy
```

### Test (must be JSON, not HTML)

```bash
curl -X POST "https://fitandsleek-bakong-proxy.po29112001.workers.dev" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expect: `{"message":"md5 is required"}` (422)

```bash
curl -X POST "https://fitandsleek-bakong-proxy.po29112001.workers.dev" \
  -H "Content-Type: application/json" \
  -d '{"md5":"test"}'
```

Expect: NBC JSON (`responseCode`, etc.) — not CloudFront 403 HTML.

---

## Option B — Cloudflare Worker (path relay / forward)

1. Paste [`worker-forward.js`](./worker-forward.js) → Deploy
2. Render:

```ini
BAKONG_PROXY_URL=https://your-worker.workers.dev
BAKONG_PROXY_STYLE=forward
```

Token stays on Render (`Authorization` header forwarded).

Test:

```bash
curl -X POST "https://your-worker.workers.dev/v1/check_transaction_by_md5" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BAKONG_TOKEN" \
  -d '{"md5":"test"}'
```

---

## Option C — PHP on Cambodia VPS

See [`index.php`](./index.php) header comments.

```ini
BAKONG_PROXY_URL=https://your-cambodia-host.example.com/bakong-proxy/index.php
BAKONG_PROXY_STYLE=legacy
```

---

## How Laravel uses the proxy

- **legacy:** POST `{"md5":"..."}` to `BAKONG_PROXY_URL` root; proxy adds Bearer token.
- **forward:** POST to `BAKONG_PROXY_URL/v1/check_transaction_by_md5` with Render’s Bearer token.

Webhook (`/api/payments/bakong/webhook`) does **not** use the proxy.

