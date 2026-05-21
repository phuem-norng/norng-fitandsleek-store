# FitandSleek Mobile (Flutter)

Flutter storefront for **FitandSleek Pro**, using the same Laravel API as `backend/` and the React app in `frontend/`.

## Prerequisites

- Flutter 3.9+ ([install](https://docs.flutter.dev/get-started/install))
- Laravel API running (see project root `README.md`), typically `http://127.0.0.1:8001`

## Quick start

```bash
cd mobile
flutter pub get
flutter run
```

### API URL (important)

| Environment | `API_BASE_URL` | `BACKEND_ORIGIN` (images) |
|-------------|----------------|---------------------------|
| Android emulator | `http://10.0.2.2:8001/api` (default) | `http://10.0.2.2:8001` |
| iOS simulator / desktop | `http://127.0.0.1:8001/api` (default) | `http://127.0.0.1:8001` |
| Physical phone (same Wi‑Fi) | `http://<your-pc-ip>:8001/api` | `http://<your-pc-ip>:8001` |

Override defaults:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.42:8001/api --dart-define=BACKEND_ORIGIN=http://192.168.1.42:8001
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
