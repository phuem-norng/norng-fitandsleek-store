# FitandSleek Pro

Full-stack eCommerce platform: **Laravel API**, **React admin & storefront**, and **Flutter mobile** app.

| Layer | Stack |
| --- | --- |
| Backend | Laravel 12, PHP, PostgreSQL, Sanctum |
| Web | React 18, Vite, Tailwind CSS |
| Mobile | Flutter (same Laravel API) |
| AI / extras | Python services in `fastapi/` and `ai-service/` |
| DevOps | Docker Compose, Composer, npm |

---

## Table of Contents

- [FitandSleek Pro](#fitandsleek-pro)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Repository structure](#repository-structure)
  - [Prerequisites](#prerequisites)
  - [Quick start](#quick-start)
  - [Manual setup](#manual-setup)
    - [Backend](#backend)
    - [Frontend](#frontend)
    - [Mobile (optional)](#mobile-optional)
  - [Environment variables](#environment-variables)
    - [Backend — `backend/.env`](#backend--backendenv)
    - [Frontend — `frontend/.env`](#frontend--frontendenv)
  - [Docker](#docker)
  - [API overview](#api-overview)
  - [Database](#database)
  - [Development commands](#development-commands)
  - [Troubleshooting](#troubleshooting)
  - [Contributing](#contributing)
  - [License](#license)

---

## Features

- **Storefront** — product listings, detail pages, cart, checkout
- **Admin** — products, categories, orders, stock & inventory, discounts, customers
- **Auth** — Laravel Sanctum (register, login, session/token)
- **Stock & labels** — barcode/QR inventory labels linked to catalog products
- **Media** — product images and static assets
- **Multi-service** — Laravel + React + Flutter + optional AI services

---

## Repository structure

```
fitandsleek/
├── backend/          # Laravel API, migrations, seeders
├── frontend/         # React (Vite + Tailwind) — admin + storefront
├── mobile/           # Flutter mobile storefront
├── fastapi/          # Python API helpers
├── ai-service/       # AI integration utilities
├── docker-compose.yml
├── docker-compose.fullstack.yml
├── setup.bat         # Windows bootstrap
└── setup.sh          # macOS / Linux bootstrap
```

---

## Prerequisites

- PHP 8.1+ and [Composer](https://getcomposer.org/)
- Node.js 18+ and npm
- PostgreSQL 13+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- Flutter SDK (only if you run the mobile app)

---

## Quick start

Run from the **project root**.

**Windows**

```bat
setup.bat
```

**macOS / Linux**

```bash
sh setup.sh
```

The setup scripts will:

1. Create `backend/.env` from `backend/.env.example` if missing
2. Run `composer install` and `npm install`
3. Run Laravel migrations
4. Start services via Docker Compose (when configured)

**Default URLs**

| Service | URL |
| --- | --- |
| API | http://127.0.0.1:8001 |
| Web (Vite) | http://127.0.0.1:5173 |
| Flutter web (optional) | http://127.0.0.1:3000 |

---

## Manual setup

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Mobile (optional)

```bash
cd mobile
flutter pub get
flutter run -d web-server --web-port=3000 --web-hostname=0.0.0.0
```

---

## Environment variables

### Backend — `backend/.env`

Set database credentials, `APP_URL`, mail, and any third-party keys. **Do not commit secrets.**

### Frontend — `frontend/.env`

```env
VITE_API_BASE_URL=http://127.0.0.1:8001/api
VITE_BACKEND_ORIGIN=http://127.0.0.1:8001
```

---

## Docker

**Light dev stack** (Postgres + API + frontend):

```powershell
pwsh scripts/docker-up.ps1
```

**Full stack** (queue, scheduler, Qdrant, AI, pgAdmin):

```powershell
pwsh scripts/docker-up.ps1 -Mode full
```

Or with Compose directly:

```bash
docker compose up -d --build --remove-orphans
docker compose --profile full up -d --build
```

Stop:

```bash
docker compose down
```

---

## API overview

| Area | Examples |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me` |
| Catalog | `GET /api/categories`, `GET /api/products`, `GET /api/products/{slug}` |
| Cart | `GET /api/cart`, `POST /api/cart/items` |
| Orders | `POST /api/checkout`, `GET /api/orders` |
| Admin | `/api/admin/categories`, `/api/admin/products`, `/api/admin/orders` |

---

## Database

- Migrations: `backend/database/migrations/`
- Seeders: `backend/database/seeders/`
- Optional SQL dump: `fitandsleekpro.sql` (if present locally)

---

## Development commands

**Backend**

```bash
cd backend
php artisan serve
php artisan migrate
php artisan test
```

**Frontend**

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

---

## Troubleshooting

| Issue | What to check |
| --- | --- |
| README or repo looks broken on GitHub | Ensure `README.md` is UTF-8 with normal line breaks (no binary/null bytes at end of file). |
| `frontend/` shows as a submodule | Remove nested `frontend/.git` and recommit frontend as normal files. |
| `npm install` / `composer install` fails | Verify Node, npm, PHP, and Composer versions. |
| Database connection error | `DB_*` settings in `backend/.env`. |
| CORS / API errors | `VITE_API_BASE_URL` and `VITE_BACKEND_ORIGIN` in `frontend/.env`. |

---

## Contributing

1. Branch from `main`
2. Keep commits focused
3. Run tests/build before opening a PR
4. Request review before merge

---

## License

All rights reserved unless stated otherwise by the repository owner.
