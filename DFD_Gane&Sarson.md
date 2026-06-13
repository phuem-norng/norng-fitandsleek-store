# FitAndSleek — Data Flow Diagram (Gane & Sarson Notation)

> **Stack:** Laravel 12 · PostgreSQL · React 18 · Flutter · Python FastAPI (CLIP / Qdrant)

---

## Notation Key (Gane & Sarson)

| Symbol | Shape in Diagram | Meaning |
|--------|-----------------|---------|
| Rectangle (bold border) | `[ Name ]` | **External Entity** — a person, system, or organisation that is outside the system boundary but sends or receives data |
| Rounded rectangle (blue) | `([ P# · Name ])` | **Process** — transforms or acts on data (top = ID, bottom = name) |
| Open-ended rectangle (yellow) | `[( D# · Name )]` | **Data Store** — a repository of data at rest (files, tables, queues) |
| Labelled arrow | `-->|label|` | **Data Flow** — named movement of data between elements |

---

## Level 0 — Context Diagram

> The whole FitAndSleek system is represented as a **single process bubble**. All external entities and their high-level data exchanges are shown.

```mermaid
flowchart TD
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000,font-weight:bold
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    %% ── External Entities ──────────────────────────────────────────────
    E1["Customer\n(Web / Mobile App)"]:::entity
    E2["Guest User"]:::entity
    E3["Admin / Superadmin"]:::entity
    E4["Driver"]:::entity
    E5["Facebook OAuth"]:::entity
    E6["Bakong / KHQR\nPayment Gateway"]:::entity
    E7["Telegram Platform"]:::entity
    E8["Dify AI Platform"]:::entity
    E9["CLIP FastAPI +\nQdrant"]:::entity

    %% ── Central Process ─────────────────────────────────────────────────
    P0(["0.0\nFitAndSleek\nE-Commerce System"]):::process

    %% ── Customer ────────────────────────────────────────────────────────
    E1 -->|"Register · Login · Browse\nCart · Checkout · Track order\nWishlist · Profile · Chat"| P0
    P0 -->|"Product listings · Order status\nPayment QR · Notifications\nDelivery tracking"| E1

    %% ── Guest ───────────────────────────────────────────────────────────
    E2 -->|"Browse products · Search\nContact form · Chatbot"| P0
    P0 -->|"Public catalog · AI chat reply"| E2

    %% ── Admin ───────────────────────────────────────────────────────────
    E3 -->|"Manage catalog · Orders\nPayments · Shipments\nReports · Settings · POS"| P0
    P0 -->|"Analytics · Reports · Invoices\nInventory status · Alerts"| E3

    %% ── Driver ──────────────────────────────────────────────────────────
    E4 -->|"Scan delivery QR\nUpdate delivery status"| P0
    P0 -->|"Shipment details · Receipt"| E4

    %% ── External services ────────────────────────────────────────────────
    E5 -->|"OAuth token · User profile"| P0
    P0 -->|"Auth redirect request"| E5

    P0 -->|"KHQR generate request"| E6
    E6 -->|"QR payload · Payment webhook"| P0

    P0 -->|"Bot messages · Broadcast"| E7
    E7 -->|"Webhook updates · Bot commands"| P0

    P0 -->|"User chat message"| E8
    E8 -->|"AI response"| P0

    P0 -->|"Image vectorise request"| E9
    E9 -->|"512-dim vector · Similar product IDs"| P0
```

---

## Level 1 — Main DFD

> The central process is exploded into **11 functional processes**. Data flows between processes, all external entities, and the main data stores are shown.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    %% ═══════════════════════════════
    %% EXTERNAL ENTITIES
    %% ═══════════════════════════════
    E1["Customer\n(Web / Mobile)"]:::entity
    E2["Guest User"]:::entity
    E3["Admin /\nSuperadmin"]:::entity
    E4["Driver"]:::entity
    E5["Facebook OAuth"]:::entity
    E6["Bakong / KHQR"]:::entity
    E7["Telegram"]:::entity
    E8["Dify AI"]:::entity
    E9["CLIP FastAPI\n+ Qdrant"]:::entity

    %% ═══════════════════════════════
    %% PROCESSES
    %% ═══════════════════════════════
    P1(["1.0\nAuthentication\n& Security"]):::process
    P2(["2.0\nProduct Catalog\nManagement"]):::process
    P3(["3.0\nCart\nManagement"]):::process
    P4(["4.0\nOrder\nProcessing"]):::process
    P5(["5.0\nPayment\nProcessing"]):::process
    P6(["6.0\nShipment &\nDelivery"]):::process
    P7(["7.0\nAfter-Sale /\nReplacement"]):::process
    P8(["8.0\nAI Image\nSearch"]):::process
    P9(["9.0\nAdmin, POS\n& Reporting"]):::process
    P10(["10.0\nNotifications\n& Messaging"]):::process
    P11(["11.0\nAI Chatbot"]):::process

    %% ═══════════════════════════════
    %% DATA STORES
    %% ═══════════════════════════════
    D1[("D1 · Users &\nSecurity")]:::store
    D2[("D2 · Product\nCatalog")]:::store
    D3[("D3 · Carts")]:::store
    D4[("D4 · Orders")]:::store
    D5[("D5 · Payments")]:::store
    D6[("D6 · Shipments")]:::store
    D7[("D7 · Replacement\nCases")]:::store
    D8[("D8 · Wishlist &\nAddresses")]:::store
    D9[("D9 · Notifications\n& Messages")]:::store
    D10[("D10 · Telegram\nUsers & Broadcasts")]:::store

    %% ═══════════════════════════════
    %% P1 — Authentication & Security
    %% ═══════════════════════════════
    E1 -->|"credentials / OTP\ndevice info"| P1
    E5 -->|"OAuth token + profile"| P1
    P1 -->|"access token / session"| E1
    P1 <-->|"user records,\ntokens, audit logs"| D1

    %% ═══════════════════════════════
    %% P2 — Product Catalog
    %% ═══════════════════════════════
    E1 -->|"browse / filter / search"| P2
    E2 -->|"browse / filter"| P2
    E3 -->|"create / update / delete\nproducts & categories"| P2
    P2 -->|"product list / detail"| E1
    P2 -->|"public catalog"| E2
    P2 <-->|"catalog records"| D2

    %% ═══════════════════════════════
    %% P3 — Cart
    %% ═══════════════════════════════
    E1 -->|"add / update / remove\ncart items"| P3
    P3 -->|"cart state / totals"| E1
    P2 -->|"product & price data"| P3
    P3 <-->|"cart records"| D3

    %% ═══════════════════════════════
    %% P4 — Order Processing
    %% ═══════════════════════════════
    E1 -->|"checkout request\nshipping address"| P4
    P3 -->|"cart items snapshot"| P4
    P4 -->|"order confirmation\norder number"| E1
    P4 <-->|"order & item records"| D4
    P4 -->|"order created"| P5

    %% ═══════════════════════════════
    %% P5 — Payment
    %% ═══════════════════════════════
    E1 -->|"payment proof /\ncard info"| P5
    P5 -->|"KHQR generate request"| E6
    E6 -->|"QR payload /\npayment webhook"| P5
    E3 -->|"verify / reject payment"| P5
    P5 -->|"payment status / QR"| E1
    P5 <-->|"payment records"| D5
    P5 -->|"payment confirmed"| P10

    %% ═══════════════════════════════
    %% P6 — Shipment & Delivery
    %% ═══════════════════════════════
    E3 -->|"create shipment /\nadd tracking events"| P6
    E4 -->|"scan QR /\nupdate status"| P6
    E1 -->|"track shipment"| P6
    P6 -->|"shipment details / receipt"| E4
    P6 -->|"delivery updates"| E1
    P6 <-->|"shipment records"| D6
    P6 -->|"delivery event"| P10

    %% ═══════════════════════════════
    %% P7 — After-Sale
    %% ═══════════════════════════════
    E1 -->|"submit replacement\nrequest"| P7
    E3 -->|"approve / reject / resolve"| P7
    P7 -->|"case status"| E1
    P7 <-->|"replacement case records"| D7
    P7 -->|"linked order ref"| D4

    %% ═══════════════════════════════
    %% P8 — AI Image Search
    %% ═══════════════════════════════
    E1 -->|"query image upload"| P8
    E2 -->|"query image upload"| P8
    P8 -->|"POST /vectorize"| E9
    E9 -->|"512-dim vector /\nsimilar product IDs"| P8
    P8 <-->|"vector-indexed products"| D2
    P8 -->|"similar products"| E1
    P8 -->|"similar products"| E2

    %% ═══════════════════════════════
    %% P9 — Admin, POS & Reporting
    %% ═══════════════════════════════
    E3 -->|"POS sale / barcode scan\nreport query / settings"| P9
    P9 -->|"analytics / invoices /\nPOS receipt"| E3
    P9 <-->|"catalog data"| D2
    P9 <-->|"order data"| D4
    P9 <-->|"payment data"| D5
    P9 <-->|"shipment data"| D6

    %% ═══════════════════════════════
    %% P10 — Notifications & Messaging
    %% ═══════════════════════════════
    E3 -->|"compose broadcast /\nmessage"| P10
    P10 -->|"push notification /\nin-app alert"| E1
    P10 -->|"broadcast message"| E7
    E7 -->|"webhook / bot interaction"| P10
    P10 <-->|"notifications & messages"| D9
    P10 <-->|"telegram records"| D10

    %% ═══════════════════════════════
    %% P11 — AI Chatbot
    %% ═══════════════════════════════
    E1 -->|"chat message"| P11
    E2 -->|"chat message"| P11
    P11 -->|"user message"| E8
    E8 -->|"AI response"| P11
    P11 -->|"chat reply"| E1
    P11 -->|"chat reply"| E2
```

---

## Level 2 — Process 1.0: Authentication & Security

> Decomposition of the **Authentication & Security** process into six sub-processes.

```mermaid
flowchart TD
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    %% External Entities
    E1["Customer / User"]:::entity
    E5["Facebook OAuth"]:::entity
    EMAIL["Email Service"]:::entity

    %% Data Stores
    D1A[("D1.1 · users")]:::store
    D1B[("D1.2 · personal_access_tokens")]:::store
    D1C[("D1.3 · otp_codes")]:::store
    D1D[("D1.4 · user_device_sessions")]:::store
    D1E[("D1.5 · user_trusted_devices")]:::store
    D1F[("D1.6 · security_audit_logs")]:::store

    %% Sub-Processes
    P11(["1.1\nRegister\n(Email Sign-up)"]):::process
    P12(["1.2\nOTP\nVerification"]):::process
    P13(["1.3\nLogin\n(Password / OTP)"]):::process
    P14(["1.4\nSocial Login\n(Facebook)"]):::process
    P15(["1.5\nTwo-Factor\nAuthentication"]):::process
    P16(["1.6\nSession & Device\nManagement"]):::process
    P17(["1.7\nPassword\nReset"]):::process
    P18(["1.8\nSecurity Audit\nLogging"]):::process

    %% 1.1 Register
    E1 -->|"name / email / password"| P11
    P11 -->|"send OTP email"| EMAIL
    P11 -->|"store pending user"| D1A
    P11 -->|"store OTP hash"| D1C

    %% 1.2 OTP Verification
    E1 -->|"OTP code"| P12
    P12 <-->|"verify & consume OTP"| D1C
    P12 -->|"activate user"| D1A
    P12 -->|"email verified"| E1

    %% 1.3 Login
    E1 -->|"email + password"| P13
    P13 <-->|"verify credentials"| D1A
    P13 -->|"issue Sanctum token"| D1B
    P13 -->|"create device session"| D1D
    P13 -->|"access token"| E1
    P13 -->|"auth event"| P18

    %% 1.4 Social Login
    E5 -->|"OAuth token + user profile"| P14
    P14 <-->|"upsert user"| D1A
    P14 -->|"issue Sanctum token"| D1B
    P14 -->|"create device session"| D1D
    P14 -->|"access token"| E1
    P14 -->|"social login event"| P18

    %% 1.5 Two-Factor Auth
    E1 -->|"2FA challenge code"| P15
    P15 <-->|"verify TOTP / recovery code"| D1A
    P15 -->|"grant full session token"| D1B
    P15 -->|"2FA event"| P18

    %% 1.6 Session Management
    E1 -->|"view / revoke sessions"| P16
    P16 <-->|"read/write sessions"| D1D
    P16 <-->|"read/write trusted devices"| D1E
    P16 -->|"revoke token"| D1B
    P16 -->|"session list"| E1

    %% 1.7 Password Reset
    E1 -->|"forgot password request"| P17
    P17 -->|"send reset OTP"| EMAIL
    P17 <-->|"update password"| D1A
    P17 -->|"password reset event"| P18

    %% 1.8 Security Audit Logging
    P18 -->|"write audit record"| D1F
```

---

## Level 2 — Process 3.0 · 4.0 · 5.0: Shopping, Order & Payment

> Decomposition of the **Cart → Checkout → Payment** flow.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer"]:::entity
    E3["Admin"]:::entity
    E6["Bakong / KHQR"]:::entity

    D2[("D2 · Products")]:::store
    D3[("D3 · Carts\ncart_items")]:::store
    D4[("D4 · Orders\norder_items")]:::store
    D5[("D5 · Payments")]:::store
    D9[("D9 · Notifications")]:::store

    %% 3.0 Cart
    P31(["3.1\nAdd / Update\nCart Item"]):::process
    P32(["3.2\nRemove\nCart Item"]):::process
    P33(["3.3\nView Cart\n& Totals"]):::process

    %% 4.0 Order
    P41(["4.1\nCheckout\nValidation"]):::process
    P42(["4.2\nCreate Order\n& Line Items"]):::process
    P43(["4.3\nDeduct\nProduct Stock"]):::process

    %% 5.0 Payment
    P51(["5.1\nGenerate\nKHQR / QR"]):::process
    P52(["5.2\nPoll Payment\nStatus"]):::process
    P53(["5.3\nAdmin Payment\nVerification"]):::process
    P54(["5.4\nPayment Webhook\nHandler"]):::process

    %% Cart flows
    E1 -->|"product + qty + size + color"| P31
    D2 -->|"price / stock lookup"| P31
    P31 -->|"write cart item"| D3
    P31 -->|"updated cart"| E1

    E1 -->|"item ID to remove"| P32
    P32 -->|"delete cart item"| D3

    E1 -->|"view cart"| P33
    P33 <-->|"read cart & items"| D3
    P33 -->|"cart summary / totals"| E1

    %% Checkout → Order flows
    E1 -->|"checkout request\n(address, method)"| P41
    P41 <-->|"validate cart items"| D3
    P41 -->|"validated cart data"| P42
    P42 -->|"write order"| D4
    P42 -->|"stock deduction request"| P43
    P43 -->|"update product stock"| D2
    P42 -->|"order confirmed"| E1
    P42 -->|"order record"| P51

    %% Payment flows
    E1 -->|"request KHQR / Bakong"| P51
    P51 -->|"generate QR request"| E6
    E6 -->|"QR payload + bill number"| P51
    P51 -->|"store payment record"| D5
    P51 -->|"QR code / payment URL"| E1

    E1 -->|"poll status"| P52
    P52 <-->|"read payment status"| D5
    P52 -->|"current status"| E1

    E6 -->|"payment webhook"| P54
    P54 -->|"mark payment paid"| D5
    P54 -->|"update order payment_status"| D4
    P54 -->|"push notification"| D9

    E3 -->|"manual verify proof"| P53
    P53 -->|"mark verified"| D5
    P53 -->|"update order"| D4
    P53 -->|"alert customer"| D9
```

---

## Level 2 — Process 6.0: Shipment & Delivery

> Decomposition of the **Shipment & Delivery** process.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E3["Admin"]:::entity
    E4["Driver"]:::entity
    E1["Customer"]:::entity

    D4[("D4 · Orders")]:::store
    D6A[("D6.1 · shipments")]:::store
    D6B[("D6.2 · shipment_\ntracking_events")]:::store
    D9[("D9 · Notifications")]:::store

    P61(["6.1\nCreate\nShipment"]):::process
    P62(["6.2\nGenerate\nShipment QR"]):::process
    P63(["6.3\nDriver Scan &\nStatus Update"]):::process
    P64(["6.4\nAdd Manual\nTracking Event"]):::process
    P65(["6.5\nCustomer\nOrder Tracking"]):::process

    %% Create shipment
    E3 -->|"order ID + provider\n+ tracking code"| P61
    P61 <-->|"read order"| D4
    P61 -->|"write shipment record"| D6A
    P61 -->|"shipment record"| P62
    P62 -->|"QR code label"| E4

    %% Driver scans
    E4 -->|"scan QR /\nmark status"| P63
    P63 -->|"write tracking event"| D6B
    P63 -->|"update shipment status"| D6A
    P63 -->|"delivery receipt"| E4
    P63 -->|"delivery notification"| D9

    %% Manual tracking event
    E3 -->|"event details\n(status, note, location)"| P64
    P64 -->|"write event"| D6B
    P64 -->|"update shipment"| D6A

    %% Customer tracking
    E1 -->|"tracking request\n(order number)"| P65
    P65 <-->|"read shipment"| D6A
    P65 <-->|"read tracking events"| D6B
    P65 -->|"tracking timeline"| E1
```

---

## Level 2 — Process 8.0: AI Image Search

> Decomposition of the **AI-powered visual product search** process.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer / Guest"]:::entity
    E3["Admin"]:::entity
    FASTAPI["CLIP FastAPI\nService"]:::entity
    QDRANT["Qdrant\nVector Store"]:::entity

    D2[("D2 · Products\n(is_vector_indexed)")]:::store

    P81(["8.1\nReceive &\nValidate Image"]):::process
    P82(["8.2\nVectorise Image\nvia CLIP"]):::process
    P83(["8.3\nVector Similarity\nSearch"]):::process
    P84(["8.4\nFetch &\nReturn Products"]):::process
    P85(["8.5\nProduct Vector\nIndexing (Sync)"]):::process

    %% Search flow
    E1 -->|"upload query image"| P81
    P81 -->|"validated image file"| P82
    P82 -->|"POST /vectorize"| FASTAPI
    FASTAPI -->|"512-dim CLIP vector"| P82
    P82 -->|"query vector"| P83
    P83 -->|"nearest-neighbour query"| QDRANT
    QDRANT -->|"top-N product IDs\n+ similarity scores"| P83
    P83 -->|"matched product IDs"| P84
    P84 <-->|"read product details"| D2
    P84 -->|"similar product results"| E1

    %% Admin indexing flow
    E3 -->|"trigger vector re-index"| P85
    P85 <-->|"read unindexed products"| D2
    P85 -->|"vectorise each product image"| FASTAPI
    FASTAPI -->|"product vector"| P85
    P85 -->|"upsert vectors"| QDRANT
    P85 -->|"mark is_vector_indexed = true"| D2
```

---

## Level 2 — Process 10.0: Notifications & Messaging

> Decomposition of the **Notifications & Messaging** process.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer"]:::entity
    E3["Admin"]:::entity
    E7["Telegram Platform"]:::entity
    SYS["Internal System\n(Orders / Payments / Shipments)"]:::entity

    D9A[("D9.1 · notifications")]:::store
    D9B[("D9.2 · messages")]:::store
    D10A[("D10.1 · telegram_users")]:::store
    D10B[("D10.2 · telegram_broadcasts\n& deliveries")]:::store

    P101(["10.1\nSystem Event\nNotification"]):::process
    P102(["10.2\nIn-App\nNotification"]):::process
    P103(["10.3\nAdmin Broadcast\nMessage"]):::process
    P104(["10.4\nTelegram Bot\nHandler"]):::process
    P105(["10.5\nTelegram\nBroadcast Fanout"]):::process

    %% System → Customer notification
    SYS -->|"order/payment/delivery event"| P101
    P101 -->|"write notification record"| D9A
    P101 -->|"push to customer"| P102
    P102 -->|"in-app alert"| E1
    E1 -->|"mark read / delete"| P102
    P102 <-->|"read/write notifications"| D9A

    %% Admin broadcast
    E3 -->|"compose broadcast /\nschedule message"| P103
    P103 -->|"write message record"| D9B
    P103 -->|"fan-out to Telegram"| P105

    %% Telegram bot handler
    E7 -->|"webhook update /\nbot command"| P104
    P104 <-->|"upsert telegram user"| D10A
    P104 -->|"link Telegram to account"| D10A
    P104 -->|"bot reply"| E7

    %% Telegram broadcast fanout
    P105 <-->|"read telegram users"| D10A
    P105 -->|"write broadcast + deliveries"| D10B
    P105 -->|"send messages"| E7
    E7 -->|"delivery status"| P105
    P105 -->|"update delivery status"| D10B
```

---

## Data Store Reference

| ID | Data Store | Main Tables |
|----|-----------|-------------|
| D1 | Users & Security | `users`, `personal_access_tokens`, `otp_codes`, `user_device_sessions`, `user_trusted_devices`, `security_audit_logs` |
| D2 | Product Catalog | `products`, `categories`, `brands`, `product_images`, `discounts`, `collections`, `banners`, `menus`, `settings` |
| D3 | Carts | `carts`, `cart_items` |
| D4 | Orders | `orders`, `order_items` |
| D5 | Payments | `payments` |
| D6 | Shipments | `shipments`, `shipment_tracking_events` |
| D7 | Replacement Cases | `replacement_cases` |
| D8 | Wishlist & Addresses | `wishlists`, `wishlist_items`, `addresses` |
| D9 | Notifications & Messages | `notifications`, `contacts`, `messages` |
| D10 | Telegram | `telegram_users`, `telegram_broadcasts`, `telegram_broadcast_deliveries` |

---

## External Entity Reference

| ID | Entity | Direction | Role |
|----|--------|-----------|------|
| E1 | Customer (Web / Mobile) | Bidirectional | Shops, pays, tracks, chats |
| E2 | Guest User | Bidirectional | Browses, searches, chats (unauthenticated) |
| E3 | Admin / Superadmin | Bidirectional | Manages all system data, views reports |
| E4 | Driver | Bidirectional | Delivers orders, scans QR, updates status |
| E5 | Facebook OAuth | Bidirectional | Provides identity for social sign-in |
| E6 | Bakong / KHQR Gateway | Bidirectional | Generates QR, sends payment webhooks |
| E7 | Telegram Platform | Bidirectional | Receives broadcasts, sends bot webhooks |
| E8 | Dify AI Platform | Bidirectional | Receives queries, returns AI chat responses |
| E9 | CLIP FastAPI + Qdrant | Bidirectional | Vectorises images, returns similar products |
