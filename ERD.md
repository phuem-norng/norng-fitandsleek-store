# FitAndSleek — Entity Relationship Diagram

> **Stack:** Laravel 12 · PostgreSQL · React 18 · Flutter · Python FastAPI (CLIP/Qdrant)

Single diagram — **key fields only** (see migrations / pgAdmin for full columns).

```mermaid
erDiagram

    users {
        bigint id PK
        string email UK
        string role
        string status
    }
    personal_access_tokens {
        bigint id PK
        bigint tokenable_id FK
        string token UK
    }
    otp_codes {
        bigint id PK
        string email
        string purpose
    }
    user_device_sessions {
        bigint id PK
        bigint user_id FK
        bigint personal_access_token_id FK
    }
    user_trusted_devices {
        bigint id PK
        bigint user_id FK
        string device_id
    }
    security_audit_logs {
        bigint id PK
        bigint user_id FK
        string event_type
    }

    brands {
        bigint id PK
        string name
        string slug UK
    }
    categories {
        bigint id PK
        bigint parent_id FK
        bigint brand_id FK
        string type
        string slug UK
        int stock
    }
    stock_inventory {
        bigint id PK
        bigint category_id FK UK
        string slug UK
        int stock
    }
    stock_received {
        bigint id PK
        bigint stock_inventory_id FK
        bigint category_id FK UK
        bigint product_id FK
        bigint created_by FK
        string entry_type
        int quantity
        date date_in
    }
    suppliers {
        bigint id PK
        string supplier_code UK
        string name
        string country
        boolean is_active
    }
    products {
        bigint id PK
        bigint category_id FK
        bigint brand_id FK
        bigint supplier_id FK
        bigint stock_label_id FK
        string sku UK
        decimal price
        decimal cost_price
        int stock
    }
    product_images {
        bigint id PK
        bigint product_id FK
        boolean is_primary
    }
    discounts {
        bigint id PK
        bigint product_id FK
        string discount_type
    }
    collections {
        bigint id PK
        string slug UK
        jsonb category_ids
    }
    banners {
        bigint id PK
        string page
        string position
        json audience_targets
    }
    menus {
        bigint id PK
        string slug UK
    }
    settings {
        bigint id PK
        string key UK
    }

    purchase_orders {
        bigint id PK
        bigint supplier_id FK
        string po_number UK
        string status
        date order_date
    }
    purchase_order_items {
        bigint id PK
        bigint purchase_order_id FK
        bigint product_id FK
        int qty
        decimal cost_per_unit
    }

    carts {
        bigint id PK
        bigint user_id FK
        string guest_token UK
        string status
    }
    cart_items {
        bigint id PK
        bigint cart_id FK
        bigint product_id FK
        int quantity
    }

    orders {
        bigint id PK
        bigint user_id FK
        string order_number UK
        string sale_channel
        string status
        decimal total
    }
    order_items {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        int qty
    }
    payments {
        bigint id PK
        bigint order_id FK
        bigint verified_by FK
        string status
        decimal amount
    }

    shipments {
        bigint id PK
        bigint order_id FK UK
        string tracking_code
        string status
    }
    shipment_tracking_events {
        bigint id PK
        bigint shipment_id FK
        bigint updated_by FK
        string status
    }
    replacement_cases {
        bigint id PK
        bigint order_id FK
        bigint handled_by FK
        string status
    }
    replacement_case_items {
        bigint id PK
        bigint replacement_case_id FK
        bigint order_item_id FK
        int quantity
    }

    wishlists {
        bigint id PK
        bigint user_id FK
        boolean is_default
    }
    wishlist_items {
        bigint id PK
        bigint wishlist_id FK
        bigint product_id FK
    }
    addresses {
        bigint id PK
        bigint user_id FK
        string province
        boolean is_default
    }

    loyalty_profiles {
        bigint id PK
        bigint user_id FK UK
        int points
        string tier
    }
    loyalty_events {
        bigint id PK
        bigint user_id FK
        bigint order_id FK
        string event_type
        int points_delta
    }
    storefront_events {
        bigint id PK
        bigint user_id FK
        string session_id
        string event_type
        bigint product_id FK
        bigint order_id FK
        timestamp occurred_at
    }

    notifications {
        bigint id PK
        bigint user_id FK
        string type
        boolean is_read
    }
    contacts {
        bigint id PK
        string email
        string status
    }
    messages {
        bigint id PK
        bigint created_by FK
        string target_audience
    }

    users ||--o{ user_device_sessions : sessions
    users ||--o{ user_trusted_devices : trusted
    users ||--o{ security_audit_logs : audit
    user_device_sessions }o--o| personal_access_tokens : token

    brands ||--o{ categories : brand
    brands ||--o{ products : brand
    brands ||--o{ stock_inventory : brand
    categories ||--o{ categories : parent
    categories ||--o{ products : category
    categories ||--o{ products : stock_label
    categories ||--o| stock_inventory : master
    categories ||--o| stock_received : batch
    stock_inventory ||--o{ stock_received : ledger
    suppliers ||--o{ products : supplies
    suppliers ||--o{ purchase_orders : po
    purchase_orders ||--o{ purchase_order_items : lines
    products ||--o{ purchase_order_items : on_po
    products ||--o{ product_images : images
    products ||--o{ discounts : promo
    products ||--o{ stock_received : linked

    users ||--o{ carts : owns
    carts ||--o{ cart_items : items
    products ||--o{ cart_items : in_cart

    users ||--o{ orders : places
    orders ||--o{ order_items : lines
    products ||--o{ order_items : sold
    orders ||--o{ payments : paid
    users ||--o{ payments : verifies

    orders ||--o| shipments : shipped
    shipments ||--o{ shipment_tracking_events : events
    users ||--o{ shipment_tracking_events : updates
    orders ||--o{ replacement_cases : cases
    users ||--o{ replacement_cases : handles
    replacement_cases ||--o{ replacement_case_items : items
    order_items ||--o{ replacement_case_items : line

    users ||--o{ wishlists : has
    wishlists ||--o{ wishlist_items : items
    products ||--o{ wishlist_items : saved
    users ||--o{ addresses : has
    users ||--o| loyalty_profiles : loyalty
    users ||--o{ loyalty_events : points
    orders ||--o{ loyalty_events : earns
    users ||--o{ storefront_events : tracks
    products ||--o{ storefront_events : viewed
    orders ||--o{ storefront_events : purchase_evt
    users ||--o{ notifications : receives
    users ||--o{ messages : creates
    users ||--o{ stock_received : created_by
```

---

## Entity groups

| Domain | Tables |
|--------|--------|
| **Auth** | `users`, `personal_access_tokens`, `otp_codes`, `user_device_sessions`, `user_trusted_devices`, `security_audit_logs` |
| **Catalog** | `brands`, `categories`, `products`, `product_images`, `discounts`, `collections`, `banners`, `menus`, `settings` |
| **Procurement** | `suppliers`, `purchase_orders`, `purchase_order_items` |
| **Inventory** | `stock_inventory`, `stock_received` |
| **Commerce** | `carts`, `cart_items`, `orders`, `order_items`, `payments` |
| **Fulfillment** | `shipments`, `shipment_tracking_events`, `replacement_cases`, `replacement_case_items` |
| **Customer** | `wishlists`, `wishlist_items`, `addresses`, `notifications`, `contacts`, `messages` |
| **Engagement** | `loyalty_profiles`, `loyalty_events`, `storefront_events` |

## Key notes

| Topic | Summary |
|-------|---------|
| **Dual `categories`** | Catalog tree + stock labels (`type = barcode_qr`). Masters: `parent_id IS NULL`; batches: `parent_id → master`. |
| **Inventory tables** | `stock_inventory` / `stock_received` mirror barcode_qr rows; synced via `StockTableSyncService`. PO receive can post `stock_received` with `entry_type`. |
| **Procurement** | `products.supplier_id` optional default vendor; `purchase_orders` (`draft` → `received`) with line-level `cost_per_unit` / variant `size`/`color`. |
| **POS** | `orders.sale_channel = pos`; `order_items.product_id` nullable for off-catalog lines. |
| **Payments** | KHQR / Bakong on `payments`; status `pending → paid`. |
| **Loyalty** | One `loyalty_profiles` row per user; `loyalty_events` ledger (`earn_purchase`, `adjustment`, `redeem`) tied to orders when applicable. |
| **Personalization** | `storefront_events` (product_view, add_to_cart, purchase) keyed by `user_id` and/or `session_id` for recommendations and banner targeting. |
| **Banners** | `audience_targets` + `audience_priority_map` JSON for segment-specific homepage promos. |
| **Replacements** | `replacement_case_items` links each case to specific `order_items` with requested size/color. |
| **Security** | Login → `user_device_sessions` + `user_trusted_devices`; audit in `security_audit_logs`. |
| **Removed** | Telegram tables (`telegram_users`, `telegram_broadcasts`, `telegram_broadcast_deliveries`) dropped in migration `2026_06_01_200000`. |
