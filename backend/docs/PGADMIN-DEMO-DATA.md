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
| **stock_inventory** | Master labels (Stock & Inventory) | `slug LIKE 'FS-STOCK-DEMO-M%'` |
| **stock_received** | Receive ledger (Stock Received) | `notes LIKE '%demo%'` or join `stock_inventory` |
| **categories** | Legacy mirror (same data, `type = barcode_qr`) | `slug LIKE 'FS-STOCK-DEMO-%'` |

### Stock Received admin page

Dedicated table **`stock_received`** (pgAdmin). The admin UI still reads from **categories** receive batches (`parent_id IS NOT NULL`, `type = barcode_qr`), kept in sync automatically.

```sql
SELECT sr.id, si.name, sr.quantity, sr.date_in, sr.received_at, sr.invoice_number
FROM stock_received sr
JOIN stock_inventory si ON si.id = sr.stock_inventory_id
ORDER BY sr.received_at DESC
LIMIT 50;
```

Legacy mirror in categories:

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
