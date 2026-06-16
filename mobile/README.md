# FitandSleek Mobile (Flutter)

Flutter storefront for **FitandSleek Pro**, using the same Laravel API as `backend/` and the React app in `frontend/`.

## Prerequisites

- Flutter 3.9+ ([install](https://docs.flutter.dev/get-started/install))
- Network access to the live API at [https://www.fitandsleek.online](https://www.fitandsleek.online/)

## Quick start

```bash
cd mobile
flutter pub get
flutter run
```

### API URL

**Default API** (paired with [fitandsleek.online](https://www.fitandsleek.online/) storefront):

| Setting | Value |
|---------|--------|
| Storefront | `https://www.fitandsleek.online` |
| `API_BASE_URL` | `https://fitandsleek-official-backend.onrender.com/api` |
| `BACKEND_ORIGIN` | `https://fitandsleek-official-backend.onrender.com` |

The web shop hostname serves React only — do not call `/api` on `www.fitandsleek.online` (returns HTML).

Override for local backend:

```bash
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8001/api --dart-define=BACKEND_ORIGIN=http://127.0.0.1:8001
```

## Features (v1)

- Browse & search products (`GET /products`)
- Product detail (`GET /products/{slug}`)
- Login / register with email OTP (same flow as web)
- Cart: view, add, remove (`/cart` — requires sign-in)
- Device headers (`X-Device-ID`, etc.) for Sanctum `device.bound` routes

Checkout and admin are not included yet; use the web app for full checkout.

## Project layout

```
lib/
  config/       # API base URL
  core/         # Dio client, device headers, token storage
  models/
  services/     # auth, products, cart
  providers/
  screens/
  widgets/
```

## Auth

Uses Laravel Sanctum bearer tokens (stored in secure storage, key `fs_token` — same as web `VITE_TOKEN_KEY`).

After login/register the API sends an OTP to email; enter it on the OTP screen to receive the token.

## Troubleshooting

- **Connection refused**: Laravel not running, wrong port, or on a real device you used `127.0.0.1` instead of your PC’s LAN IP.
- **401 on cart**: Sign in again; token may have expired.
- **Images broken**: Set `BACKEND_ORIGIN` to the host that serves `/storage/...`.
