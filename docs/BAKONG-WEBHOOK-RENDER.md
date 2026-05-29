# Bakong KHQR on Render (Webhook — no proxy)

Use this when **Cloudflare Worker** returns CloudFront 403 or **local works** but **hosted checkout stays Waiting** after scan & pay.

Render (US) cannot call NBC `check_transaction_by_md5` directly. **Webhooks are inbound** — NBC calls your Render URL when payment succeeds. The storefront still polls `/api/payments/bakong/status/{id}`; once the webhook marks the payment `paid` in the database, polling returns `paid` and the success modal opens.

## 1. Render environment

**Service:** `norng-fitandsleek-backend` → **Environment**

| Key | Value |
|-----|--------|
| `BAKONG_TOKEN` | Same JWT as local |
| `BAKONG_RECEIVE_ACCOUNT` | e.g. `vanna_khat@bkrt` |
| `BAKONG_WEBHOOK_SECRET` | Secret from NBC Developer Dashboard (see step 2) |

You do **not** need `BAKONG_PROXY_URL` if webhooks are configured and NBC delivers them reliably.

Save → **Manual Deploy**.

## 2. NBC Bakong Developer Dashboard

1. Log in to [Bakong Developer](https://api-bakong.nbc.gov.kh) (or NBC merchant portal where webhooks are configured).
2. **Webhook URL** (use either):

   ```
   https://norng-fitandsleek-backend.onrender.com/api/payments/bakong/webhook
   ```

   or

   ```
   https://norng-fitandsleek-backend.onrender.com/api/payments/khqr/webhook
   ```

3. Copy the **webhook secret** NBC provides → paste into Render as `BAKONG_WEBHOOK_SECRET`.
4. Enable webhook for **payment success** / transaction notifications.

## 3. Verify webhook is reachable

```bash
curl -X POST "https://norng-fitandsleek-backend.onrender.com/api/payments/bakong/webhook" \
  -H "Content-Type: application/json" \
  -d '{"status":"test"}'
```

Expect `404 Payment not found` or `401 Invalid signature` — **not** connection timeout. That means Render receives POSTs.

## 4. Test checkout

1. Deploy frontend (Vercel) with latest KHQR fixes (`dynamic QR`, success modal).
2. New order → KHQR → scan & pay **new** QR (amount ≥ 1 KHR).
3. Within a few seconds after NBC webhook: **Payment Successful!**

## 5. Troubleshooting

| Symptom | Check |
|---------|--------|
| Still Waiting | Render **Logs** → search `Bakong KHQR webhook received` |
| 401 Invalid signature | `BAKONG_WEBHOOK_SECRET` must match NBC dashboard exactly |
| 404 Payment not found | Webhook payload md5/bill must match `payments` row; use new checkout QR |
| No webhook logs at all | URL wrong in NBC dashboard or webhook not enabled |

## Optional: proxy + webhook

You can use **both** webhook (primary) and `BAKONG_PROXY_URL` (fallback polling). See `backend/bakong-proxy/README.md`.
