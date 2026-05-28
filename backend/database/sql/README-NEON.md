# Neon hosting — simple seed data

Use this when the Laravel API points at a **Neon** PostgreSQL database (production or staging).  
Media uploads in admin go to **Cloudflare R2** when `MEDIA_DISK=s3` is set on the backend.

## 1. Connect Laravel to Neon

In `backend/.env` (from the Neon dashboard connection details):

```env
DB_CONNECTION=pgsql
DB_HOST=ep-xxxx.region.aws.neon.tech
DB_PORT=5432
DB_DATABASE=neondb
DB_USERNAME=your_user
DB_PASSWORD=your_password
DB_SSLMODE=require
```

## 2. Render (automatic on deploy)

The backend **Dockerfile** / `docker/entrypoint.sh` already runs on each container start:

1. `php artisan migrate --force`
2. `php artisan hosting:ensure-sample-data` — seeds **only if** the catalog has **0** categories

**Required on Render → Environment** (from Neon dashboard):

```env
DB_CONNECTION=pgsql
DB_HOST=ep-xxxx.region.aws.neon.tech
DB_PORT=5432
DB_DATABASE=neondb
DB_USERNAME=...
DB_PASSWORD=...
DB_SSLMODE=require
```

After deploy, open **Render → Logs** and look for `Hosting sample data ensured` or `Catalog already has N categories`.

To **force** re-seed once: set `SEED_NEON_HOSTING=true`, redeploy, then remove the variable.

**Cloudflare R2:** seed does **not** upload images to R2 (product URLs use picsum.photos). You will see data in **Neon**, not files in the R2 bucket until you upload from admin.

## 3. Manual seed (local or Render Shell)

From `backend/`:

```bash
php artisan migrate --force
php artisan hosting:ensure-sample-data
# or
php artisan db:seed --class=NeonHostingSeeder
```

This creates:

| What | Count | Notes |
| --- | --- | --- |
| Catalog categories | **17** | Clothes, Shoes, Belts + MEN / WOMEN / BOY / GIRL subcategories |
| Brands | **6** | Nike, Adidas, Uniqlo, Zara, Puma, H&M |
| Products | **17** | One per category (`NH-*` SKU) |
| Discounts | **6** | On the first six sample products |
| Stock labels | **8** | `barcode_qr` masters + one receive batch each |
| Admin accounts | **2** | superadmin + admin (see passwords below) |

**Admin logins** (change after first deploy):

| Email | Password |
| --- | --- |
| `superadmin@fitandsleek.com` | `SuperAdmin@123` |
| `admin@fitandsleek.com` | `Admin@123` |

Sample product images use **picsum.photos** URLs (no R2 upload during seed). Replace images from admin when you have real assets on R2.

**SQL only** (categories in Neon SQL Editor, no users/products):

1. Open Neon → **SQL Editor**
2. Paste and run `neon-hosting-simple.sql`
3. Still run `php artisan db:seed --class=NeonHostingSeeder` for admins, products, brands, discounts, and stock labels

## 4. Verify

```bash
php artisan tinker --execute="
echo 'categories: '.App\Models\Category::catalogOnly()->count().PHP_EOL;
echo 'products: '.App\Models\Product::where('sku','like','NH-%')->count().PHP_EOL;
echo 'brands: '.App\Models\Brand::count().PHP_EOL;
echo 'discounts: '.App\Models\Discount::count().PHP_EOL;
echo 'stock labels: '.App\Models\Category::where('type','barcode_qr')->whereNull('parent_id')->where('slug','like','nh-stock-m%')->count().PHP_EOL;
"
```

Expected: **17** categories, **17** `NH-*` products, **6** brands, **6** discounts, **8** stock masters.

Storefront: `GET /api/categories` should list all catalog categories.

## 5. Cloudflare R2 (production media)

On Render / hosted backend:

```env
FILESYSTEM_DISK=s3
MEDIA_DISK=s3
AWS_BUCKET=fitandsleek
AWS_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
AWS_URL=https://pub-xxxx.r2.dev
```

On Vercel (frontend build):

```env
VITE_STORAGE_MEDIA_ORIGIN=https://pub-xxxx.r2.dev
```

Test R2 from backend: `php artisan storage:test-r2`

## Image search (Qdrant + CLIP)

Local / Docker with AI profile:

```bash
docker compose --profile ai up -d
php artisan qdrant:setup
php artisan qdrant:index-products --only-missing
```

Check status: `GET /api/image-search/status`  
Storefront page: `/image-search`

`NeonHostingSeeder` tries to index products automatically when vectorize + Qdrant are up.

## Not included (keeps hosting DB small)

- Full `ProductSeeder` / `MoreProductsSeeder` (100+ products)
- `HistoricalStockInventorySeeder` (2023–2025 demo receives)

Run those **locally only** if you need a large demo dataset.
