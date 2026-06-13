# FitAndSleek — Data Flow Diagram (Gane & Sarson Notation)

> **Stack:** Laravel 12 · PostgreSQL · React 18 · Flutter · Python FastAPI (CLIP / Qdrant)

---

## Design Principles

A DFD shows **how important data moves** through the system — not every screen, click, or background job.

| Area | Include | Leave out |
|------|---------|-----------|
| **External entities** | Roles or systems that **directly** send/receive data across the boundary (*Customer*, *Admin*, *Payment Gateway*) | Internal hand-offs between staff; duplicate roles for the same actor |
| **Data flows** | Major data payloads needed to complete a process (*Credentials*, *Order details*, *Payment receipt*) | Control triggers ("Click Submit"), trivial UI confirmations, audit/device metadata |
| **Processes** | Functional modules that **transform** data | One bubble per API endpoint or screen |
| **Levelling** | Level 0 = boundary · Level 1 = main modules · Level 2 = drill-down **only for complex flows** | Cramming all detail into one diagram |

> **គោលការណ៍:** បង្ហាញតែ entity និង data flow **សំខាន់** — ស្លាក arrow ប្រើ **noun / noun phrase** (ទិន្នន័យអ្វីហូរចូល·ចេញ) មិនប្រើ verb ឬ action របស់ user។

---

## Notation Key (Gane & Sarson)

| Symbol | Shape in Diagram | Meaning |
|--------|-----------------|---------|
| Rectangle (bold border) | `[ Name ]` | **External Entity** — outside the system boundary |
| Rounded rectangle (blue) | `([ P# · Name ])` | **Process** — transforms data (ID on top, name below) |
| Open-ended rectangle (yellow) | `[( D# · Name )]` | **Data Store** — data at rest |
| Labelled arrow | `-->|label|` | **Data Flow** — noun / noun phrase naming the **data** moved |

**Label format on diagrams:** put **one data item per line** in the arrow label (use `\n`). Do not use `·` — it is hard to read when rendered. At Level 0, multiple items on one arrow are **grouped for overview**; count each line as one data type.

| ✅ Use (data) | ❌ Avoid (action / trivial) |
|--------------|------------------------------|
| Credentials, Order details | Login, Browse, Click Submit |
| Payment receipt, QR payload | Display success message |
| Product catalog, Shipment data | Device info, Audit log entry |

---

## Level 0 — Context Diagram

> Single process bubble for the whole system. **All main external entities** are shown. Arrow labels use **one data item per line** so each type is easy to count.

```mermaid
flowchart TD
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000,font-weight:bold

    E1["Customer\n(Web / Mobile App)"]:::entity
    E2["Guest User"]:::entity
    E3["Admin"]:::entity
    E10["Superadmin"]:::entity
    E4["Driver"]:::entity
    E5["Facebook OAuth"]:::entity
    E6["Bakong / KHQR\nPayment Gateway"]:::entity
    E7["Telegram Platform"]:::entity
    E8["Dify AI Platform"]:::entity
    E9["CLIP FastAPI +\nQdrant"]:::entity

    P0(["0.0\nFitAndSleek\nE-Commerce System"]):::process

    E1 -->|"Account data\nCart and order details\nPayment info\nTracking query"| P0
    P0 -->|"Product catalog\nOrder status\nPayment QR\nNotifications\nDelivery updates"| E1

    E2 -->|"Search criteria\nContact form data\nChat message\nQuery image"| P0
    P0 -->|"Public catalog\nAI chat reply\nSimilar product results"| E2

    E3 -->|"Catalog and order records\nPayment verification\nShipment data\nReport filters\nPOS sale data"| P0
    P0 -->|"Operational reports\nInvoices\nInventory status\nAlerts"| E3

    E10 -->|"User and role records\nAdmin account data\nPayment settings\nSecurity audit query"| P0
    P0 -->|"User list\nSystem statistics\nAudit reports\nSettings confirmation"| E10

    E4 -->|"QR scan data\nDelivery status"| P0
    P0 -->|"Shipment details\nDelivery receipt"| E4

    P0 -->|"Redirect URL"| E5
    E5 -->|"OAuth token\nUser profile"| P0

    P0 -->|"Payment amount\nBill details"| E6
    E6 -->|"QR payload\nPayment webhook"| P0

    P0 -->|"Broadcast content\nBot reply"| E7
    E7 -->|"Webhook payload"| P0

    P0 -->|"Chat message"| E8
    E8 -->|"AI response"| P0

    P0 -->|"Query image file"| E9
    E9 -->|"Product vector\nSimilar product IDs"| P0
```

**Customer ← System (P0 → E1):** **5 data types** on one grouped arrow — Product catalog, Order status, Payment QR, Notifications, Delivery updates (one per line in the label).

---

## Level 1 — Main DFD

> **10 core processes** and **8 primary data stores**. External-entity labels **match Level 0** (same names, same data items per arrow). Flows split across processes are a decomposition of the grouped Level 0 arrows. Internal hand-offs and Level 2-only detail (after-sale, audit) are shown where needed.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    %% External Entities (names match Level 0)
    E1["Customer\n(Web / Mobile App)"]:::entity
    E2["Guest User"]:::entity
    E3["Admin"]:::entity
    E10["Superadmin"]:::entity
    E4["Driver"]:::entity
    E5["Facebook OAuth"]:::entity
    E6["Bakong / KHQR\nPayment Gateway"]:::entity
    E7["Telegram Platform"]:::entity
    E8["Dify AI Platform"]:::entity
    E9["CLIP FastAPI +\nQdrant"]:::entity

    %% Processes
    P1(["1.0\nAuthentication"]):::process
    P2(["2.0\nProduct Catalog"]):::process
    P3(["3.0\nCart\nManagement"]):::process
    P4(["4.0\nOrder\nProcessing"]):::process
    P5(["5.0\nPayment\nProcessing"]):::process
    P6(["6.0\nShipment &\nDelivery"]):::process
    P7(["7.0\nAfter-Sale"]):::process
    P8(["8.0\nAdmin, POS\n& Reporting"]):::process
    P9(["9.0\nNotifications\n& Messaging"]):::process
    P10(["10.0\nAI Services\n(Search & Chat)"]):::process

    %% Data Stores
    D1[("D1 · Users")]:::store
    D2[("D2 · Product\nCatalog")]:::store
    D3[("D3 · Carts")]:::store
    D4[("D4 · Orders")]:::store
    D5[("D5 · Payments")]:::store
    D6[("D6 · Shipments")]:::store
    D7[("D7 · Replacement\nCases")]:::store
    D8[("D8 · Notifications\n& Telegram")]:::store

    %% E1 — Customer (Level 0 labels)
    E1 -->|"Account data"| P1
    E1 -->|"Cart and order details"| P3
    E1 -->|"Cart and order details"| P4
    E1 -->|"Payment info"| P5
    E1 -->|"Tracking query"| P6
    P2 -->|"Product catalog"| E1
    P4 -->|"Order status"| E1
    P5 -->|"Payment QR"| E1
    P9 -->|"Notifications"| E1
    P6 -->|"Delivery updates"| E1

    %% E2 — Guest User (Level 0 labels)
    E2 -->|"Search criteria"| P2
    E2 -->|"Contact form data"| P9
    E2 -->|"Chat message"| P10
    E2 -->|"Query image"| P10
    P2 -->|"Public catalog"| E2
    P10 -->|"AI chat reply"| E2
    P10 -->|"Similar product results"| E2

    %% E3 — Admin (Level 0 labels)
    E3 -->|"Catalog and order records"| P2
    E3 -->|"Catalog and order records"| P4
    E3 -->|"Payment verification"| P5
    E3 -->|"Shipment data"| P6
    E3 -->|"Report filters"| P8
    E3 -->|"POS sale data"| P8
    P8 -->|"Operational reports"| E3
    P8 -->|"Invoices"| E3
    P8 -->|"Inventory status"| E3
    P9 -->|"Alerts"| E3

    %% E10 — Superadmin (Level 0 labels)
    E10 -->|"User and role records"| P8
    E10 -->|"Admin account data"| P8
    E10 -->|"Payment settings"| P8
    E10 -->|"Security audit query"| P8
    P8 -->|"User list"| E10
    P8 -->|"System statistics"| E10
    P8 -->|"Audit reports"| E10
    P8 -->|"Settings confirmation"| E10

    %% E4 — Driver (Level 0 labels)
    E4 -->|"QR scan data"| P6
    E4 -->|"Delivery status"| P6
    P6 -->|"Shipment details"| E4
    P6 -->|"Delivery receipt"| E4

    %% E5 — Facebook OAuth (Level 0 labels)
    P1 -->|"Redirect URL"| E5
    E5 -->|"OAuth token\nUser profile"| P1

    %% E6 — Bakong / KHQR (Level 0 labels)
    P5 -->|"Payment amount\nBill details"| E6
    E6 -->|"QR payload\nPayment webhook"| P5

    %% E7 — Telegram Platform (Level 0 labels)
    P9 -->|"Broadcast content\nBot reply"| E7
    E7 -->|"Webhook payload"| P9

    %% E8 — Dify AI Platform (Level 0 labels)
    P10 -->|"Chat message"| E8
    E8 -->|"AI response"| P10

    %% E9 — CLIP FastAPI + Qdrant (Level 0 labels)
    P10 -->|"Query image file"| E9
    E9 -->|"Product vector\nSimilar product IDs"| P10

    %% Internal — P1 Authentication
    P1 <-->|"User and token records"| D1

    %% Internal — P2 Product Catalog
    P2 <-->|"Catalog records"| D2

    %% Internal — P3 Cart
    P2 -->|"Product and price data"| P3
    P3 <-->|"Cart records"| D3

    %% Internal — P4 Order
    P3 -->|"Cart items snapshot"| P4
    P4 <-->|"Order and line-item records"| D4
    P4 -->|"New order record"| P5
    P4 -->|"Stock update"| D2

    %% Internal — P5 Payment
    P5 <-->|"Payment records"| D5
    P5 -->|"Payment confirmation"| P9

    %% Internal — P6 Shipment
    P6 <-->|"Shipment records"| D6
    P6 -->|"Delivery event data"| P9

    %% Internal — P7 After-Sale (Level 2 detail; not on Level 0 boundary)
    E1 -->|"Replacement request details"| P7
    E3 -->|"Case decision\nResolution notes"| P7
    P7 -->|"Case status data"| E1
    P7 <-->|"Replacement case records"| D7
    P7 -->|"Linked order reference"| D4

    %% Internal — P8 Admin stores
    P8 <-->|"Catalog data"| D2
    P8 <-->|"Order data"| D4
    P8 <-->|"Payment data"| D5
    P8 <-->|"Shipment data"| D6
    P8 <-->|"User and role records"| D1

    %% Internal — P9 Notifications store
    P9 <-->|"Notification and telegram records"| D8

    %% Internal — P10 AI catalog lookup
    P10 <-->|"Product records"| D2
```

---

## Level 2 — Process 1.0: Authentication

> Auth is multi-path (email, OTP, social, 2FA). Five sub-processes cover the main flows; audit logging, trusted-device detail, and **Email Service** (transport only — not on Level 0) are omitted. **E1 and E5** are the only external entities; boundary labels match Level 0.

**Data stores — why all are “D1”:** At Level 1, authentication uses a single store **D1 · Users**. Level 2 **decomposes** that one store into its tables (standard DFD levelling — same parent ID, letter suffix for clarity in the diagram):

| Diagram node | Parent | Database table |
|--------------|--------|----------------|
| D1 · users | D1 | `users` |
| D1 · access_tokens | D1 | `personal_access_tokens` |
| D1 · otp_codes | D1 | `otp_codes` |
| D1 · device_sessions | D1 | `user_device_sessions` |

They are **not** D2–D8. Those IDs belong to other domains (catalog, orders, payments, etc.). `user_trusted_devices` is omitted here as session sub-detail (see *Omitted from Diagrams*).

```mermaid
flowchart TD
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer\n(Web / Mobile App)"]:::entity
    E5["Facebook OAuth"]:::entity

    D1A[("D1 · users")]:::store
    D1B[("D1 · access_tokens")]:::store
    D1C[("D1 · otp_codes")]:::store
    D1D[("D1 · device_sessions")]:::store

    P11(["1.1\nRegister &\nOTP Verification"]):::process
    P12(["1.2\nLogin\n(Password / Social)"]):::process
    P13(["1.3\nTwo-Factor\nAuthentication"]):::process
    P14(["1.4\nSession\nManagement"]):::process
    P15(["1.5\nPassword\nReset"]):::process

    E1 -->|"Account data"| P11
    P11 -->|"Pending user record\nOTP hash"| D1A
    P11 -->|"OTP hash"| D1C
    E1 -->|"Account data"| P11
    P11 -->|"Verified user record"| D1A
    P11 -->|"Verification confirmation"| E1

    E1 -->|"Account data"| P12
    E5 -->|"OAuth token\nUser profile"| P12
    P12 -->|"Redirect URL"| E5
    P12 <-->|"User credentials record"| D1A
    P12 -->|"Access token record"| D1B
    P12 -->|"Device session record"| D1D

    E1 -->|"Account data"| P13
    P13 <-->|"TOTP secret\nRecovery codes"| D1A
    P13 -->|"Full session token record"| D1B

    E1 -->|"Account data"| P14
    P14 <-->|"Session records"| D1D
    P14 -->|"Revoked token ID"| D1B
    P14 -->|"Session list data"| E1

    E1 -->|"Account data"| P15
    P15 -->|"Reset OTP hash"| D1C
    P15 <-->|"New password hash"| D1A
```

---

## Level 2 — Process 3.0 · 4.0 · 5.0: Cart, Order & Payment

> Core purchase path — the most business-critical flow. Cart operations are grouped; payment confirmation covers both webhook and admin verification. **Boundary labels match Level 0** (*Cart and order details*, *Payment info*, *Payment QR*, E6 exchange, *Payment verification*).

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer\n(Web / Mobile App)"]:::entity
    E3["Admin"]:::entity
    E6["Bakong / KHQR\nPayment Gateway"]:::entity

    D2[("D2 · Products")]:::store
    D3[("D3 · Carts")]:::store
    D4[("D4 · Orders")]:::store
    D5[("D5 · Payments")]:::store
    D8[("D8 · Notifications")]:::store

    P31(["3.1\nManage Cart"]):::process
    P32(["3.2\nCreate Order\n& Deduct Stock"]):::process
    P41(["4.1\nGenerate\nPayment QR"]):::process
    P42(["4.2\nConfirm\nPayment"]):::process

    E1 -->|"Cart and order details"| P31
    D2 -->|"Product price\nStock qty"| P31
    P31 <-->|"Cart records"| D3

    E1 -->|"Cart and order details"| P32
    P32 <-->|"Cart item records"| D3
    P32 -->|"Order record"| D4
    P32 -->|"Updated stock quantity"| D2
    P32 -->|"Order status"| E1
    P32 -->|"New order record"| P41

    P41 -->|"Payment amount\nBill details"| E6
    E6 -->|"QR payload"| P41
    P41 -->|"Payment record"| D5
    P41 -->|"Payment QR"| E1

    E6 -->|"Payment webhook"| P42
    E1 -->|"Payment info"| P42
    E3 -->|"Payment verification"| P42
    P42 -->|"Payment status update"| D5
    P42 -->|"Order payment status"| D4
    P42 -->|"Payment QR"| E1
    P42 -->|"Notifications"| D8
```

---

## Level 2 — Process 6.0: Shipment & Delivery

> Three sub-processes cover create → deliver → track. Manual admin tracking events follow the same data path as driver updates and are not shown separately. **Boundary labels match Level 0** (*Shipment data*, *QR scan data*, *Delivery status*, *Shipment details*, *Delivery receipt*, *Tracking query*, *Delivery updates*).

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer\n(Web / Mobile App)"]:::entity
    E3["Admin"]:::entity
    E4["Driver"]:::entity

    D4[("D4 · Orders")]:::store
    D6[("D6 · Shipments\n& Tracking Events")]:::store
    D8[("D8 · Notifications")]:::store

    P61(["6.1\nCreate Shipment\n& QR Label"]):::process
    P62(["6.2\nDelivery\nStatus Update"]):::process
    P63(["6.3\nCustomer\nTracking"]):::process

    E3 -->|"Shipment data"| P61
    P61 <-->|"Order record"| D4
    P61 -->|"Shipment record"| D6
    P61 -->|"Shipment details"| E4

    E4 -->|"QR scan data"| P62
    E4 -->|"Delivery status"| P62
    E3 -->|"Shipment data"| P62
    P62 -->|"Tracking event\nShipment status"| D6
    P62 -->|"Delivery receipt"| E4
    P62 -->|"Delivery updates"| D8

    E1 -->|"Tracking query"| P63
    P63 <-->|"Shipment and event records"| D6
    P63 -->|"Delivery updates"| E1
```

---

## Level 2 — Process 10.0: AI Services

> Image search and chatbot share product catalog access. CLIP/Qdrant and Dify remain external; internal steps are grouped to avoid over-splitting. **Boundary labels match Level 0** (*Query image*, *Chat message*, *Similar product results*, *AI chat reply*, E8/E9 exchanges). E1/E2 are shown as separate entities where the Level 0 boundary splits them.

```mermaid
flowchart LR
    classDef entity  fill:#f0f0f0,stroke:#222,stroke-width:3px,color:#000,font-weight:bold
    classDef process fill:#cce5ff,stroke:#0056b3,stroke-width:2px,color:#000
    classDef store   fill:#fff9c4,stroke:#b8860b,stroke-width:2px,color:#000

    E1["Customer\n(Web / Mobile App)"]:::entity
    E2["Guest User"]:::entity
    E10["Superadmin"]:::entity
    E8["Dify AI Platform"]:::entity
    E9["CLIP FastAPI +\nQdrant"]:::entity

    D2[("D2 · Products")]:::store

    P101(["10.1\nImage Search"]):::process
    P102(["10.2\nAI Chatbot"]):::process
    P103(["10.3\nProduct Vector\nIndexing"]):::process

    E1 -->|"Query image"| P101
    E2 -->|"Query image"| P101
    P101 -->|"Query image file"| E9
    E9 -->|"Product vector\nSimilar product IDs"| P101
    P101 <-->|"Product detail records"| D2
    P101 -->|"Similar product results"| E1
    P101 -->|"Similar product results"| E2

    E1 -->|"Chat message"| P102
    E2 -->|"Chat message"| P102
    P102 -->|"Chat message"| E8
    E8 -->|"AI response"| P102
    P102 -->|"AI chat reply"| E1
    P102 -->|"AI chat reply"| E2

    E10 -->|"Admin account data"| P103
    P103 <-->|"Product image records"| D2
    P103 -->|"Query image file"| E9
    E9 -->|"Product vector"| P103
    P103 -->|"Indexing flag update"| D2
```

---

## Omitted from Diagrams *(documented here)*

These exist in the system but are **background or trivial** — they do not change how core data moves and are excluded to keep diagrams readable.

| Item | Reason omitted |
|------|----------------|
| Security audit logs | Background write on every auth event; no external data boundary |
| Trusted device records | Session sub-detail; covered under Session Management at L2 |
| Payment status polling | Repeated read of same payment record; outcome same as webhook |
| Wishlist & addresses | Customer profile feature; flows mirror catalog + user store pattern |
| Separate Telegram bot vs broadcast | Both are message payloads to/from E7; merged at Level 1 |
| Email Service entity | Transport only (SMTP/mail provider); OTP and reset codes are stored in **D1 · otp_codes** — no separate external entity at any level |
| Admin / Superadmin login | Same *Account data* path as Customer at L0; not repeated on E3/E10 boundary |
| After-sale replacement | Operational sub-flow under 7.0; not on Level 0 context boundary |

---

## Data Store Reference

| ID | Data Store | Main Tables |
|----|-----------|-------------|
| D1 | Users | `users`, `personal_access_tokens`, `otp_codes`, `user_device_sessions`, `user_trusted_devices` |

**D1 at Level 2 (Authentication drill-down):** one logical store split by table — D1 · users, D1 · access_tokens, D1 · otp_codes, D1 · device_sessions. All remain **D1**; only the suffix/name changes in the diagram.
| D2 | Product Catalog | `products`, `categories`, `brands`, `product_images`, `discounts`, `collections`, `banners` |
| D3 | Carts | `carts`, `cart_items` |
| D4 | Orders | `orders`, `order_items` |
| D5 | Payments | `payments` |
| D6 | Shipments | `shipments`, `shipment_tracking_events` |
| D7 | Replacement Cases | `replacement_cases` |
| D8 | Notifications & Telegram | `notifications`, `messages`, `telegram_users`, `telegram_broadcasts`, `telegram_broadcast_deliveries` |

> **Also in database (not on DFD):** `wishlists`, `wishlist_items`, `addresses`, `contacts`, `security_audit_logs`, `settings`, `menus`

---

## External Entity Reference

| ID | Entity | Core data exchanged |
|----|--------|---------------------|
| E1 | Customer (Web / Mobile) | Account data, cart/order details, payment info, tracking queries |
| E2 | Guest User | Search criteria, contact form, chat message, query image |
| E3 | Admin | Catalog/order records, payment verification, shipments, POS, operational reports |
| E10 | Superadmin | User & role records, admin accounts, payment settings, security audit, system statistics |
| E4 | Driver | QR scan data, delivery status; receives shipment details & receipt |
| E5 | Facebook OAuth | OAuth token, user profile, redirect URL |
| E6 | Bakong / KHQR Gateway | Payment amount, QR payload, payment webhook |
| E7 | Telegram Platform | Broadcast content, webhook payload, bot reply |
| E8 | Dify AI Platform | Chat message, AI response |
| E9 | CLIP FastAPI + Qdrant | Query image, product vectors, similar product IDs |

### Admin vs Superadmin — data scope

| Data domain | Admin (E3) | Superadmin (E10) |
|-------------|------------|------------------|
| Product catalog, orders, payments, shipments | Operational CRUD & verification | Full access *(same flows shown via E3)* |
| POS sales & operational reports | ✅ | ✅ *(via E3 flows)* |
| User & role management, admin accounts | — | ✅ |
| Payment gateway settings | — | ✅ |
| Security audit logs & system statistics | — | ✅ |
| Product vector re-indexing | — | ✅ |

> Superadmin can perform all Admin operations; operational flows are attributed to **E3** to avoid duplicate arrows. **E10** shows data flows unique to superadmin governance.

---

## Levelling Summary

| Level | Scope | FitAndSleek coverage |
|-------|-------|---------------------|
| **0** | System boundary | 1 process · 10 external entities · grouped critical flows |
| **1** | Main modules | 10 processes · 8 data stores · **external labels identical to Level 0** |
| **2** | Complex drill-down | Auth · Cart/Order/Payment · Delivery · AI Services (4 diagrams) · **boundary labels match Level 0** |
| **3+** | Not used | Detail covered by ERD / Data Dictionary instead |

### Level 0 → Level 1 reconciliation

| Level 0 entity | Level 0 data (→ system) | Decomposed to |
|----------------|---------------------------|---------------|
| E1 Customer | Account data | 1.0 Authentication |
| E1 Customer | Cart and order details | 3.0 Cart · 4.0 Order |
| E1 Customer | Payment info | 5.0 Payment |
| E1 Customer | Tracking query | 6.0 Shipment |
| E2 Guest | Search criteria | 2.0 Product Catalog |
| E2 Guest | Contact form data | 9.0 Notifications |
| E2 Guest | Chat message · Query image | 10.0 AI Services |
| E3 Admin | Catalog and order records | 2.0 · 4.0 |
| E3 Admin | Payment verification | 5.0 |
| E3 Admin | Shipment data | 6.0 |
| E3 Admin | Report filters · POS sale data | 8.0 Admin & Reporting |
| E10 Superadmin | User/role · Admin account · Payment settings · Audit query | 8.0 Admin & Reporting |
| E4 Driver | QR scan data · Delivery status | 6.0 Shipment |
| E5–E9 | *(same labels as Level 0)* | 1.0 · 5.0 · 9.0 · 10.0 respectively |

| Level 0 entity | Level 0 data (system →) | Decomposed from |
|----------------|---------------------------|---------------|
| E1 Customer | Product catalog | 2.0 Product Catalog |
| E1 Customer | Order status | 4.0 Order |
| E1 Customer | Payment QR | 5.0 Payment |
| E1 Customer | Notifications | 9.0 Notifications |
| E1 Customer | Delivery updates | 6.0 Shipment |
| E2 Guest | Public catalog | 2.0 Product Catalog |
| E2 Guest | AI chat reply · Similar product results | 10.0 AI Services |
| E3 Admin | Operational reports · Invoices · Inventory status | 8.0 Admin & Reporting |
| E3 Admin | Alerts | 9.0 Notifications |
| E10 Superadmin | User list · System statistics · Audit reports · Settings confirmation | 8.0 Admin & Reporting |
| E4 Driver | Shipment details · Delivery receipt | 6.0 Shipment |

---

## Level 1 — Entity & Process Reference (Text)

> Plain-text map of **who talks to which process** at Level 1. Labels match the diagram above.

### By entity

**E1 — Customer (Web / Mobile App)**
- → **1.0 Authentication** — Account data
- → **3.0 Cart Management** — Cart and order details
- → **4.0 Order Processing** — Cart and order details
- → **5.0 Payment Processing** — Payment info
- → **6.0 Shipment & Delivery** — Tracking query
- → **7.0 After-Sale** — Replacement request details
- ← **2.0 Product Catalog** — Product catalog
- ← **4.0 Order Processing** — Order status
- ← **5.0 Payment Processing** — Payment QR
- ← **9.0 Notifications & Messaging** — Notifications
- ← **6.0 Shipment & Delivery** — Delivery updates
- ← **7.0 After-Sale** — Case status data

**E2 — Guest User**
- → **2.0 Product Catalog** — Search criteria
- → **9.0 Notifications & Messaging** — Contact form data
- → **10.0 AI Services** — Chat message, Query image
- ← **2.0 Product Catalog** — Public catalog
- ← **10.0 AI Services** — AI chat reply, Similar product results

**E3 — Admin**
- → **2.0 Product Catalog** — Catalog and order records
- → **4.0 Order Processing** — Catalog and order records
- → **5.0 Payment Processing** — Payment verification
- → **6.0 Shipment & Delivery** — Shipment data
- → **8.0 Admin, POS & Reporting** — Report filters, POS sale data
- → **7.0 After-Sale** — Case decision, Resolution notes
- ← **8.0 Admin, POS & Reporting** — Operational reports, Invoices, Inventory status
- ← **9.0 Notifications & Messaging** — Alerts

**E10 — Superadmin**
- → **8.0 Admin, POS & Reporting** — User and role records, Admin account data, Payment settings, Security audit query
- ← **8.0 Admin, POS & Reporting** — User list, System statistics, Audit reports, Settings confirmation

**E4 — Driver**
- → **6.0 Shipment & Delivery** — QR scan data, Delivery status
- ← **6.0 Shipment & Delivery** — Shipment details, Delivery receipt

**E5 — Facebook OAuth**
- ↔ **1.0 Authentication** — Redirect URL / OAuth token, User profile

**E6 — Bakong / KHQR Payment Gateway**
- ↔ **5.0 Payment Processing** — Payment amount, Bill details / QR payload, Payment webhook

**E7 — Telegram Platform**
- ↔ **9.0 Notifications & Messaging** — Broadcast content, Bot reply / Webhook payload

**E8 — Dify AI Platform**
- ↔ **10.0 AI Services** — Chat message / AI response

**E9 — CLIP FastAPI + Qdrant**
- ↔ **10.0 AI Services** — Query image file / Product vector, Similar product IDs

### By process

| Process | Related entities |
|---------|------------------|
| **1.0 Authentication** | E1, E5 |
| **2.0 Product Catalog** | E1, E2, E3 |
| **3.0 Cart Management** | E1 |
| **4.0 Order Processing** | E1, E3 |
| **5.0 Payment Processing** | E1, E3, E6 |
| **6.0 Shipment & Delivery** | E1, E3, E4 |
| **7.0 After-Sale** | E1, E3 |
| **8.0 Admin, POS & Reporting** | E3, E10 |
| **9.0 Notifications & Messaging** | E1, E2, E3, E7 |
| **10.0 AI Services** | E2, E8, E9 |

### Process ↔ process (internal)

| From | To | Data |
|------|-----|------|
| 2.0 Product Catalog | 3.0 Cart Management | Product and price data |
| 3.0 Cart Management | 4.0 Order Processing | Cart items snapshot |
| 4.0 Order Processing | 5.0 Payment Processing | New order record |
| 5.0 Payment Processing | 9.0 Notifications & Messaging | Payment confirmation |
| 6.0 Shipment & Delivery | 9.0 Notifications & Messaging | Delivery event data |
