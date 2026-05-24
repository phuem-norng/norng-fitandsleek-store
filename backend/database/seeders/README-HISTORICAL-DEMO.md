# Historical demo data (2023–2025)

Loads **100 products** and **~920 orders** (POS + online) spread across **every month** from Jan 2023 through Dec 2025.

## Run (recommended)

From `backend/`:

```bash
php artisan db:seed --class=HistoricalAllDemoSeeder
```

Or separately: `HistoricalDemoDataSeeder` then `HistoricalStockInventorySeeder`. Stock Received details: `README-STOCK-DEMO.md`.

Uses the same PostgreSQL database as pgAdmin (`DB_*` in `.env`). Re-running removes previous demo rows (`FS-DEMO-*` SKUs, `DEMO-*` orders) and rebuilds.

## What gets created

| Data | Details |
|------|---------|
| **Products** | 100 items — SKUs `FS-DEMO-2023-001` … `FS-DEMO-2025-033`, names like `2024 Urban Tech Hoodie — Navy` |
| **POS sales** | ~6–14/month, `sale_channel=pos`, visible on **Payments → Sale history** |
| **Online orders** | ~10–22/month, `storefront`, for **Reports → Revenue** (pick year 2023/2024/2025) |
| **Sellers** | Uses existing admins + `sokha.seller@`, `dara.seller@`, `malis.seller@` (password `seller12345`) |
| **Customers** | 20 demo customers `@fitandsleek.test` (password `password123`) |

## Test on the site

- **Admin → Reports → Revenue** — set year to 2023, 2024, or 2025; monthly charts should show data each month.
- **Admin → Payments → Sale history** — Filter → custom dates `2023-01-01` … `2025-12-31`, or period presets.
- **Admin → Stock Received** — Filter → Year **2023** / **2024** / **2025** (30 receives per month).
- **Admin → Products** — search `FS-DEMO` or filter by name starting with `2023` / `2024` / `2025`.
