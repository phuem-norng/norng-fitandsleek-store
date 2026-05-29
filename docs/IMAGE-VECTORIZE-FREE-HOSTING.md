# Free hosting for `IMAGE_VECTORIZE_URL` (CLIP vectorize)

Laravel calls this URL server-side (`POST /vectorize`). Qdrant stays on **Qdrant Cloud** — only the vectorize service moves here.

---

## Option 1 — Hugging Face Spaces (recommended, no Render card)

**Free CPU Basic:** ~2 vCPU, 16 GB RAM — enough for `clip-ViT-B-32`.

### A. Create the Space

1. [huggingface.co/new](https://huggingface.co/new) → **Docker** space  
2. Name e.g. `fitandsleek-vectorize` → **Public**  
3. Clone the empty Space repo Hugging Face gives you:

```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/fitandsleek-vectorize
cd fitandsleek-vectorize
```

4. Copy files from this repo (do **not** push the whole monorepo — HF needs these at Space root):

```bash
cp -R /path/to/norng-fitandsleek-store/huggingface/vectorize/* .
git add .
git commit -m "CLIP vectorize API for Fitandsleek"
git push
```

5. Wait for **Building → Running** (first build 5–15 min).

### B. Test

```bash
curl https://YOUR_USERNAME-fitandsleek-vectorize.hf.space/health
# {"ok":true,"model":"clip-ViT-B-32"}
```

### C. Render backend env

```env
IMAGE_VECTORIZE_URL=https://YOUR_USERNAME-fitandsleek-vectorize.hf.space/vectorize
QDRANT_URL=https://xxxx.aws.cloud.qdrant.io
QDRANT_API_KEY=...
IMAGE_SEARCH_AUTO_SYNC=true
```

Redeploy backend → Shell:

```bash
php artisan config:clear
php artisan qdrant:setup
php artisan qdrant:index-products --only-missing
```

**Notes**

- Space sleeps when idle; first request can take **1–3 minutes**.  
- Keep `IMAGE_SEARCH_TIMEOUT=180` on backend.  
- Do **not** use `host.docker.internal` on Render.

---

## Option 2 — Fly.io

From repo:

```bash
cd ai-service
fly auth login
fly launch    # name: fitandsleek-vectorize, region: sin (Singapore)
fly deploy
fly status
curl https://fitandsleek-vectorize.fly.dev/health
```

Backend:

```env
IMAGE_VECTORIZE_URL=https://fitandsleek-vectorize.fly.dev/vectorize
```

Uses `ai-service/fly.toml` (1 GB RAM). Fly may ask for payment verification on some accounts; check [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/).

---

## Option 3 — Mac + Cloudflare quick tunnel (dev / short demo)

**Not for 24/7 production** — URL changes each run unless you use a named Cloudflare tunnel.

```bash
chmod +x scripts/tunnel-vectorize-local.sh
./scripts/tunnel-vectorize-local.sh
```

Copy the `https://….trycloudflare.com` URL → temporarily on Render:

```env
IMAGE_VECTORIZE_URL=https://xxxx.trycloudflare.com/vectorize
```

Your Mac must stay on with Docker + tunnel running.

For a **stable** dev hostname, point your existing Cloudflare tunnel at `http://127.0.0.1:9000` (see `scripts/cloudflare-tunnel-app-hostname.env.example`).

---

## Compare

| Option | Cost | Stable URL | Production |
|--------|------|------------|------------|
| Hugging Face Spaces | Free | Yes | Good (cold start) |
| Fly.io | Free tier / low $ | Yes | Good |
| Cloudflare tunnel (Mac) | Free | No (quick) / Yes (named) | Dev only |

---

## Verify end-to-end

```bash
curl https://norng-fitandsleek-backend.onrender.com/api/image-search/status
```

Expect: `vectorize_ok: true`, `qdrant_ok: true`, `indexed_products` > 0, `ready: true`.
