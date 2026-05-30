# KHQR manual verification (hosted / Render)

Use when automatic Bakong polling does not work (US hosting, Cloudflare Worker 4xx).

## Enable

**Render** (backend):

```ini
BAKONG_MANUAL_VERIFY=true
```

**Vercel** (frontend build):

```ini
VITE_KHQR_MANUAL_VERIFY=1
```

Redeploy both services.

## Customer flow

1. Checkout → scan KHQR → pay in banking app  
2. Tap **I've paid — submit for confirmation**  
3. **Payment submitted** modal — page polls every ~8s  
4. When admin verifies → **Payment Successful!** auto

## Admin flow

1. Open **Admin → Payments**  
2. Filter **Pending**  
3. Match order / bill / amount with Bakong app  
4. Click **Verify**

API: `POST /api/admin/payments/{id}/verify`

## Local development

Leave `BAKONG_MANUAL_VERIFY=false` — auto NBC polling still works from Cambodia/local.
