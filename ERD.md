# FitAndSleek — Entity Relationship Diagram

> **Stack:** Laravel 12 · PostgreSQL · React 18 · Flutter · Python FastAPI (CLIP/Qdrant)

```mermaid
erDiagram

    %% ─── AUTH & USERS ─────────────────────────────────────────────────────────

    users {
        bigint id PK
        string name
        string email UK
        string password "nullable (social login)"
        string role "customer | admin | superadmin | driver"
        string phone
        string address
        string profile_image_path
        string status "active | banned"
        string facebook_id
        string social_type
        text two_factor_secret
        timestamp two_factor_confirmed_at
        string two_factor_preferred_method
        timestamp created_at
        timestamp updated_at
    }

    personal_access_tokens {
        bigint id PK
        string tokenable_type
        bigint tokenable_id
        string name
        string token UK
        text abilities
        timestamp last_used_at
        timestamp expires_at
    }

    otp_codes {
        bigint id PK
        string email
        string purpose "register | login"
        string code_hash
        int attempts
        timestamp expires_at
        timestamp consumed_at
    }

    user_device_sessions {
        bigint id PK
        bigint user_id FK
        bigint personal_access_token_id FK
        string device_id
        string device_name
        string browser
        string os
        string ip_address
        string ip_country
        timestamp last_login_at
        timestamp last_used_at
        timestamp device_verified_at
    }

    user_trusted_devices {
        bigint id PK
        bigint user_id FK
        string device_id
        string device_name
        string browser
        string os
        timestamp verified_at
        timestamp last_seen_at
    }

    security_audit_logs {
        bigint id PK
        bigint user_id FK "nullable"
        string event_type
        string ip_address
        string ip_country
        string device_id
        json metadata
        timestamp created_at
    }

    %% ─── CATALOG ───────────────────────────────────────────────────────────────

    brands {
        bigint id PK
        string name
        string slug UK
        string logo_path
        int sort_order
        boolean is_active
    }

    categories {
        bigint id PK
        bigint parent_id FK "nullable → categories"
        bigint brand_id FK "nullable → brands"
        bigint label_category_id FK "nullable → categories"
        string name
        string slug UK
        string gender
        string type "null | barcode_qr (stock label)"
        string image_path
        boolean is_active
        int sort_order
        decimal price
        decimal compare_at_price
        string label_color
        string sku
        decimal cost
        boolean manage_stock
        int stock
        int min_stock
        boolean has_variation
        json variation_sizes
    }

    products {
        bigint id PK
        bigint category_id FK
        bigint brand_id FK "nullable"
        bigint stock_label_id FK "nullable → categories"
        string sku UK
        string barcode_code
        string name
        string slug UK
        text description
        decimal price
        decimal compare_at_price
        int stock
        boolean is_active
        boolean is_vector_indexed
        text image_url
        jsonb gallery
        jsonb attributes
        string audience "unisex | men | women"
        json colors
        json sizes
        json variant_matrix
        text size_guide
        text delivery_info
    }

    product_images {
        bigint id PK
        bigint product_id FK
        text path
        boolean is_primary
        int sort_order
        timestamp created_at
    }

    discounts {
        bigint id PK
        bigint product_id FK
        string discount_type "percentage | fixed"
        decimal discount_value
        decimal sale_price
        datetime start_date
        datetime end_date
        boolean is_active
        text description
    }

    collections {
        bigint id PK
        string name
        string slug UK
        string gender
        text description
        text image_url
        jsonb category_ids
        boolean is_active
        int sort_order
    }

    banners {
        bigint id PK
        string page
        string position
        string title
        string subtitle
        text image_url
        string link_url
        boolean is_active
        int sort_order
    }

    menus {
        bigint id PK
        string title
        string slug UK
        json groups
        string promo_title
        string promo_image_path
        string promo_link
        int sort_order
        boolean is_active
    }

    settings {
        bigint id PK
        string key UK
        text value
        string type
        string group
    }

    %% ─── CART ──────────────────────────────────────────────────────────────────

    carts {
        bigint id PK
        bigint user_id FK "nullable (guest)"
        string guest_token UK "nullable"
        string status "active | merged | abandoned"
        timestamp created_at
        timestamp updated_at
    }

    cart_items {
        bigint id PK
        bigint cart_id FK
        bigint product_id FK
        string color
        string size
        int quantity
        decimal unit_price
        timestamp created_at
        timestamp updated_at
    }

    %% ─── ORDERS ────────────────────────────────────────────────────────────────

    orders {
        bigint id PK
        bigint user_id FK
        string order_number UK
        string sale_channel "storefront | pos"
        string status "pending | processing | shipped | delivered | cancelled"
        string payment_status "unpaid | paid | refunded"
        string payment_method
        decimal subtotal
        decimal shipping
        decimal discount
        decimal total
        jsonb shipping_address
        jsonb billing_address
        json pos_meta
        timestamp created_at
        timestamp updated_at
    }

    order_items {
        bigint id PK
        bigint order_id FK
        bigint product_id FK "nullable (deleted product)"
        string name
        string sku
        string size
        string color
        decimal price
        int qty
        decimal line_total
    }

    %% ─── PAYMENTS ──────────────────────────────────────────────────────────────

    payments {
        bigint id PK
        bigint order_id FK
        bigint verified_by FK "nullable → users"
        string provider
        string method
        decimal amount
        string currency
        string bill_number UK
        string bakong_ref
        longtext khqr_payload
        longtext qr_string
        text proof_image_path
        string status "pending | paid | failed | expired | cancelled"
        timestamp expires_at
        timestamp paid_at
        timestamp verified_at
        json raw_response
    }

    %% ─── SHIPMENTS ─────────────────────────────────────────────────────────────

    shipments {
        bigint id PK
        bigint order_id FK UK
        string provider
        string tracking_code
        string status "pending | processing | in_transit | delivered"
        timestamp shipped_at
        timestamp delivered_at
    }

    shipment_tracking_events {
        bigint id PK
        bigint shipment_id FK
        bigint updated_by FK "nullable → users"
        string status
        string location
        text note
        timestamp event_time
        timestamp created_at
    }

    %% ─── AFTER-SALE ────────────────────────────────────────────────────────────

    replacement_cases {
        bigint id PK
        bigint order_id FK
        bigint handled_by FK "nullable → users"
        string reason
        string status "pending | approved | rejected | resolved"
        text notes
    }

    %% ─── WISHLIST ──────────────────────────────────────────────────────────────

    wishlists {
        bigint id PK
        bigint user_id FK
        string name
        boolean is_default
    }

    wishlist_items {
        bigint id PK
        bigint wishlist_id FK
        bigint product_id FK
        timestamp created_at
    }

    %% ─── ADDRESSES ─────────────────────────────────────────────────────────────

    addresses {
        bigint id PK
        bigint user_id FK
        string label
        string receiver_name
        string receiver_phone
        string house_no
        string street_no
        string sangkat
        string khan
        string province
        text landmark
        string city
        string country
        decimal latitude
        decimal longitude
        boolean is_default
    }

    %% ─── MESSAGING & NOTIFICATIONS ─────────────────────────────────────────────

    notifications {
        bigint id PK
        bigint user_id FK
        string type
        string title
        text message
        json data
        boolean is_read
        timestamp created_at
    }

    contacts {
        bigint id PK
        string name
        string email
        string phone
        string subject
        text message
        string status "new | read | replied | closed"
        text admin_note
    }

    messages {
        bigint id PK
        bigint created_by FK "→ users"
        string title
        text content
        string link_url
        string media_url
        string media_type "image | video"
        string language "en | km"
        string target_audience "all | customers | guests"
        boolean is_active
        timestamp scheduled_at
        timestamp expires_at
    }

    %% ─── TELEGRAM ──────────────────────────────────────────────────────────────

    telegram_users {
        bigint id PK
        bigint telegram_user_id UK
        bigint user_id FK "nullable"
        bigint chat_id
        string username
        string first_name
        string last_name
        string language_code
        boolean is_bot
        timestamp last_interacted_at
        json raw_update
    }

    telegram_broadcasts {
        bigint id PK
        bigint created_by FK "nullable → users"
        string batch_id
        string target "all | linked | unlinked"
        text message
        string parse_mode
        boolean dry_run
        string status "pending | running | completed | cancelled"
        int total_recipients
        int sent_count
        int failed_count
        timestamp started_at
        timestamp completed_at
    }

    telegram_broadcast_deliveries {
        bigint id PK
        bigint broadcast_id FK
        bigint telegram_user_id FK
        bigint chat_id
        string status "pending | sent | failed"
        int attempt_count
        text last_error
        timestamp sent_at
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% RELATIONSHIPS
    %% ═══════════════════════════════════════════════════════════════════════════

    %% Auth & security
    users ||--o{ user_device_sessions : "has sessions"
    users ||--o{ user_trusted_devices : "trusts devices"
    users ||--o{ security_audit_logs : "audited in"
    users ||--o| telegram_users : "linked to"
    user_device_sessions }o--o| personal_access_tokens : "uses token"

    %% Catalog hierarchy
    brands ||--o{ categories : "brand"
    brands ||--o{ products : "brand"
    categories ||--o{ categories : "parent → children"
    categories ||--o{ products : "category"
    categories ||--o{ products : "stock_label_id"
    products ||--o{ product_images : "images"
    products ||--o{ discounts : "discounts"

    %% Cart
    users ||--o{ carts : "owns"
    carts ||--o{ cart_items : "contains"
    products ||--o{ cart_items : "in cart"

    %% Orders
    users ||--o{ orders : "places"
    orders ||--o{ order_items : "contains"
    products ||--o{ order_items : "ordered as"

    %% Payments
    orders ||--o{ payments : "paid via"
    users ||--o{ payments : "verified by"

    %% Shipments
    orders ||--o| shipments : "shipped as"
    shipments ||--o{ shipment_tracking_events : "tracked by"
    users ||--o{ shipment_tracking_events : "updated by"

    %% After-sale
    orders ||--o{ replacement_cases : "has replacements"
    users ||--o{ replacement_cases : "handled by"

    %% Wishlist
    users ||--o{ wishlists : "has"
    wishlists ||--o{ wishlist_items : "contains"
    products ||--o{ wishlist_items : "wishlisted"

    %% Addresses & notifications
    users ||--o{ addresses : "has"
    users ||--o{ notifications : "receives"

    %% Messages
    users ||--o{ messages : "created"

    %% Telegram broadcasts
    users ||--o{ telegram_broadcasts : "created"
    telegram_broadcasts ||--o{ telegram_broadcast_deliveries : "sent via"
    telegram_users ||--o{ telegram_broadcast_deliveries : "received by"
```

---

## Entity Groups at a Glance

| Group | Tables |
|-------|--------|
| **Auth & Security** | `users`, `personal_access_tokens`, `otp_codes`, `user_device_sessions`, `user_trusted_devices`, `security_audit_logs` |
| **Catalog** | `brands`, `categories`, `products`, `product_images`, `discounts`, `collections`, `banners`, `menus`, `settings` |
| **Cart** | `carts`, `cart_items` |
| **Orders** | `orders`, `order_items` |
| **Payments** | `payments` (KHQR / Bakong / card) |
| **Shipments** | `shipments`, `shipment_tracking_events` |
| **After-sale** | `replacement_cases` |
| **Wishlist** | `wishlists`, `wishlist_items` |
| **Addresses** | `addresses` |
| **Messaging** | `notifications`, `contacts`, `messages` |
| **Telegram** | `telegram_users`, `telegram_broadcasts`, `telegram_broadcast_deliveries` |
| **Infrastructure** | `sessions`, `cache`, `jobs`, `job_batches`, `failed_jobs` (Laravel internals) |

---

## Key Design Notes

1. **`categories` is dual-purpose** — catalog tree nodes *and* stock/barcode labels (`type = 'barcode_qr'`). `products.stock_label_id` references this table for inventory labelling.
2. **`discounts`** (originally `sales`) hold time-boxed promotions per product; the product model exposes `final_price` / `has_discount` as computed attributes.
3. **POS mode** — `orders.sale_channel = 'pos'` with `pos_meta` JSON; `order_items.product_id` is **nullable** to allow off-catalog line items.
4. **Vector image search** — `products.is_vector_indexed` / `vector_indexed_at` track CLIP-vector sync status with the external Qdrant service.
5. **KHQR / Bakong payments** — `payments` stores full QR payloads (`khqr_payload`, `qr_string`, `qr_image_base64`) and Bakong webhook data alongside the standard status lifecycle.
6. **Multi-device security** — every login creates a `user_device_sessions` row (linked to its Sanctum token) and optionally a `user_trusted_devices` record; all auth events are recorded in `security_audit_logs`.
7. **Telegram broadcast pipeline** — `telegram_broadcasts` (batch job) → fan-out into `telegram_broadcast_deliveries` (one row per recipient), allowing per-message retry tracking.
