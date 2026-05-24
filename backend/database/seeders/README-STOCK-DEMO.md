# Stock & Inventory demo data (2023–2025)

Loads **30 master inventory labels** and **30 stock-in receipts per month** from January 2023 through December 2025 (1,080 receive batches total).

## Run

From `backend/`:

```bash
# Everything for 2023–2025 (orders + products + stock receives)
php artisan db:seed --class=HistoricalAllDemoSeeder
```

Stock only (re-run safe):

```bash
php artisan db:seed --class=HistoricalStockInventorySeeder
```

Re-running removes previous demo stock rows (`FS-STOCK-DEMO-*` slugs) and rebuilds.

## What gets created

| Data | Details |
|------|---------|
| **Master labels** | 30 items — slugs `FS-STOCK-DEMO-M01` … `M30`, origins KH/US/CN/TH/VN/SG/JP/IT |
| **Monthly receives** | Each master receives once per month; `date_in` set to a day in that month |
| **Units** | 12–240 pcs by product type (socks bulk higher, jackets lower), slight season boost Nov–Feb and Jun–Aug |
| **On-hand stock** | Master `stock` = sum of all receive batches (for donut chart) |
| **Catalog link** | `FS-DEMO-*` products get `stock_label_id` when that seeder has been run |

## Test on the site

- **Admin → Stock Received** (`/admin/stock-received`) — **1,080 receive rows** (30/month). Filter → Year **2024** (or 2023/2025) → **Filter**. Each row has `date_in`, units, and receipt time.
- **Admin → Stock & Inventory** — master labels with on-hand totals.
- **Admin → Reports → Stock** — year range **2023–2025**; “Stock in by month” chart.
- **Admin → Reports → Product analysis → Products by country** — when `FS-DEMO-*` products are linked to batches.
