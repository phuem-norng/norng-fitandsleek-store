# FitAndSleek — Entity Relationship Diagram (Chen Notation)

> **Stack:** Laravel 12 · PostgreSQL · React 18 · Flutter · Python FastAPI (CLIP / Qdrant)

---

## Legend

| Symbol | Shape | Meaning |
|--------|-------|---------|
| Rectangle | `[ ]` | **Entity** (Teal) |
| Diamond   | `{ }` | **Relationship / Action** (Dark Pink) |
| Oval      | `([ ])` | **Attribute** (Pink) |
| `1`, `N`, `0..1` | line label | **Cardinality** |

---

## Full Chen ERD

```mermaid
flowchart TB
    classDef entity   fill:#00ACC1,stroke:#006064,color:#fff,font-weight:bold,stroke-width:2px
    classDef relation fill:#AD1457,stroke:#880E4F,color:#fff,font-weight:bold
    classDef attr     fill:#EC407A,stroke:#C2185B,color:#fff

    %% ═══════════════════════════════════════════════════════════════
    %% ENTITIES
    %% ═══════════════════════════════════════════════════════════════
    USER[User]:::entity
    ADDR[Address]:::entity
    NOTI[Notification]:::entity

    BRAND[Brand]:::entity
    CAT[Category]:::entity
    PROD[Product]:::entity
    DISC[Discount]:::entity

    CART[Cart]:::entity
    CI[Cart Item]:::entity
    WISH[Wishlist]:::entity
    WI[Wishlist Item]:::entity

    ORD[Order]:::entity
    OI[Order Item]:::entity
    PAY[Payment]:::entity
    SHIP[Shipment]:::entity
    TRACK[Tracking Event]:::entity
    REP[Replacement Case]:::entity

    TGU[Telegram User]:::entity
    BCAST[Broadcast]:::entity

    %% ═══════════════════════════════════════════════════════════════
    %% RELATIONSHIPS
    %% ═══════════════════════════════════════════════════════════════
    R1{Has Address}:::relation
    R2{Receives}:::relation
    R3{Classifies}:::relation
    R4{Produces}:::relation
    R5{Categorizes}:::relation
    R6{Discounted}:::relation
    R7{Owns}:::relation
    R8{Holds}:::relation
    R9{In Cart}:::relation
    R10{Wishes}:::relation
    R11{Saves}:::relation
    R12{Wished}:::relation
    R13{Places}:::relation
    R14{Contains}:::relation
    R15{Refers}:::relation
    R16{Paid By}:::relation
    R17{Shipped As}:::relation
    R18{Tracked By}:::relation
    R19{Replaces}:::relation
    R20{Linked To}:::relation
    R21{Creates}:::relation
    R22{Sent To}:::relation

    %% ═══════════════════════════════════════════════════════════════
    %% ATTRIBUTES (only the essential ones — Chen-style minimal)
    %% ═══════════════════════════════════════════════════════════════
    u_name([name]):::attr
    u_email([email]):::attr
    u_role([role]):::attr

    a_recv([receiver_name]):::attr
    a_prov([province]):::attr

    b_name([name]):::attr
    c_name([name]):::attr
    c_gender([gender]):::attr

    p_sku([sku]):::attr
    p_name([name]):::attr
    p_price([price]):::attr

    d_value([value]):::attr

    o_num([order_number]):::attr
    o_total([total]):::attr
    o_status([status]):::attr

    pa_amt([amount]):::attr
    pa_method([method]):::attr

    s_track([tracking_code]):::attr

    n_title([title]):::attr

    t_user([username]):::attr

    %% ═══════════════════════════════════════════════════════════════
    %% ATTRIBUTE LINKS
    %% ═══════════════════════════════════════════════════════════════
    USER --- u_name
    USER --- u_email
    USER --- u_role

    ADDR --- a_recv
    ADDR --- a_prov

    BRAND --- b_name
    CAT --- c_name
    CAT --- c_gender

    PROD --- p_sku
    PROD --- p_name
    PROD --- p_price

    DISC --- d_value

    ORD --- o_num
    ORD --- o_total
    ORD --- o_status

    PAY --- pa_amt
    PAY --- pa_method

    SHIP --- s_track

    NOTI --- n_title
    TGU  --- t_user

    %% ═══════════════════════════════════════════════════════════════
    %% ENTITY → RELATIONSHIP → ENTITY  (with cardinality)
    %% ═══════════════════════════════════════════════════════════════

    %% Catalog hierarchy
    BRAND ---|"1"| R3 ---|"N"| CAT
    BRAND ---|"1"| R4 ---|"N"| PROD
    CAT   ---|"1"| R5 ---|"N"| PROD
    PROD  ---|"1"| R6 ---|"N"| DISC

    %% User profile
    USER ---|"1"| R1 ---|"N"| ADDR
    USER ---|"1"| R2 ---|"N"| NOTI

    %% Cart
    USER ---|"1"| R7 ---|"N"| CART
    CART ---|"1"| R8 ---|"N"| CI
    CI   ---|"N"| R9 ---|"1"| PROD

    %% Wishlist
    USER ---|"1"| R10 ---|"N"| WISH
    WISH ---|"1"| R11 ---|"N"| WI
    WI   ---|"N"| R12 ---|"1"| PROD

    %% Order
    USER ---|"1"| R13 ---|"N"| ORD
    ORD  ---|"1"| R14 ---|"N"| OI
    OI   ---|"N"| R15 ---|"1"| PROD

    %% Fulfilment
    ORD  ---|"1"| R16 ---|"N"| PAY
    ORD  ---|"1"| R17 ---|"1"| SHIP
    SHIP ---|"1"| R18 ---|"N"| TRACK
    ORD  ---|"1"| R19 ---|"N"| REP

    %% Telegram
    USER  ---|"1"| R20 ---|"0..1"| TGU
    USER  ---|"1"| R21 ---|"N"| BCAST
    BCAST ---|"1"| R22 ---|"N"| TGU
```

---

## Entity Groups at a Glance

| Group | Entities |
|-------|----------|
| **User & Profile** | `User`, `Address`, `Notification` |
| **Catalog**        | `Brand`, `Category`, `Product`, `Discount` |
| **Shopping**       | `Cart`, `Cart Item`, `Wishlist`, `Wishlist Item` |
| **Orders**         | `Order`, `Order Item` |
| **Fulfilment**     | `Payment`, `Shipment`, `Tracking Event`, `Replacement Case` |
| **Telegram**       | `Telegram User`, `Broadcast` |

---

## Cardinality Summary

| # | Relationship | Left | Cardinality | Right |
|---|---|---|:---:|---|
| R1 | Has Address  | User     | 1 → N | Address |
| R2 | Receives     | User     | 1 → N | Notification |
| R3 | Classifies   | Brand    | 1 → N | Category |
| R4 | Produces     | Brand    | 1 → N | Product |
| R5 | Categorizes  | Category | 1 → N | Product |
| R6 | Discounted   | Product  | 1 → N | Discount |
| R7 | Owns         | User     | 1 → N | Cart |
| R8 | Holds        | Cart     | 1 → N | Cart Item |
| R9 | In Cart      | Cart Item| N → 1 | Product |
| R10 | Wishes      | User     | 1 → N | Wishlist |
| R11 | Saves       | Wishlist | 1 → N | Wishlist Item |
| R12 | Wished      | Wishlist Item | N → 1 | Product |
| R13 | Places      | User     | 1 → N | Order |
| R14 | Contains    | Order    | 1 → N | Order Item |
| R15 | Refers      | Order Item | N → 1 | Product |
| R16 | Paid By     | Order    | 1 → N | Payment |
| R17 | Shipped As  | Order    | 1 → 1 | Shipment |
| R18 | Tracked By  | Shipment | 1 → N | Tracking Event |
| R19 | Replaces    | Order    | 1 → N | Replacement Case |
| R20 | Linked To   | User     | 1 → 0..1 | Telegram User |
| R21 | Creates     | User     | 1 → N | Broadcast |
| R22 | Sent To     | Broadcast | 1 → N | Telegram User |
