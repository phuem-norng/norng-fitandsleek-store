# Demo data in pgAdmin (`fitandsleek6`)

All demo data is stored in normal PostgreSQL tables (schema `public`).  
There is no separate “seed database”.

**Connection:** host `127.0.0.1`, port `5433`, database `fitandsleek6`, user `postgres`

## Load / refresh data

```bash
cd backend
php artisan demo:import-historical --force
```

## Tables to open in pgAdmin

| Table | What you see | Filter (SQL) |
|-------|----------------|----------------|
| **products** | 100 demo catalog items | `sku LIKE 'FS-DEMO-%'` |
| **orders** | ~900+ sales 2023–2025 | `order_number LIKE 'DEMO-%'` |
| **order_items** | Line items for demo orders | `order_id IN (SELECT id FROM orders WHERE order_number LIKE 'DEMO-%')` |
| **users** | 20 demo customers | `email LIKE '%@fitandsleek.test'` |
| **categories** | Stock masters (30) + receive batches (1080) | `slug LIKE 'FS-STOCK-DEMO-%'` |
| **stock_received** | Ledger rows (same receives, own table) | `notes = 'Historical demo 2023–2025'` |

### Stock Received admin page

The UI reads receive events from **categories** rows where `parent_id IS NOT NULL` and `type = 'barcode_qr'`:

```sql
SELECT id, name, slug, date_in, stock_received, stock, created_at, parent_id
FROM categories
WHERE slug LIKE 'FS-STOCK-DEMO-%'
  AND parent_id IS NOT NULL
ORDER BY date_in DESC
LIMIT 50;
```

### Reports → Stock chart

Uses the same **categories** receive batches grouped by `date_in` year/month.

## Quick counts

```sql
SELECT 'products' AS t, COUNT(*) FROM products WHERE sku LIKE 'FS-DEMO-%'
UNION ALL
SELECT 'orders', COUNT(*) FROM orders WHERE order_number LIKE 'DEMO-%'
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
  WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'DEMO-%')
UNION ALL
SELECT 'stock_batches', COUNT(*) FROM categories
  WHERE slug LIKE 'FS-STOCK-DEMO-%' AND parent_id IS NOT NULL;
```
