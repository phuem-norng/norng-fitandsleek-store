# FitAndSleek — Data Dictionary

> **System:** FitAndSleek E-Commerce System  
> **Stack:** Laravel 12 · PostgreSQL · React 18 · Flutter · Python FastAPI (CLIP / Qdrant)

---

## Table of Contents

1. [External Entities](#1-external-entities)
2. [Data Flows](#2-data-flows)
3. [Process Descriptions](#3-process-descriptions)
4. [Data Stores](#4-data-stores)
5. [Data Elements](#5-data-elements)
6. [Record Descriptions](#6-record-descriptions)

---

## 1. External Entities

---

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Customer</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Registered User, Shopper</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A registered person who browses products, manages a cart, places orders, makes payments, tracks deliveries, manages a wishlist, submits replacement requests, and interacts with the AI chatbot via web or mobile app.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Register / Login Request, OAuth Token, Browse / Filter / Search, Add / Update Cart Items, Checkout Request, Payment Info / Proof, Track Shipment Request, Replacement Request, Upload Query Image, Chat Message, Revoke Session</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Access Token / Session, Product Listings, Cart State / Totals, Order Confirmation, Payment QR Code / Status, Delivery Updates / Tracking Timeline, Case Status, Similar Product Results, AI Chat Reply, Push Notification</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Guest User</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Visitor, Anonymous User</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> An unauthenticated visitor who can browse the public product catalog, perform searches (including AI image search), submit contact forms, and interact with the AI chatbot — without needing to register or log in.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Browse / Filter, Upload Query Image, Chat Message, Contact Form Submission</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Public Catalog, Similar Product Results, AI Chat Reply</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Admin / Superadmin</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Administrator, Back-office Staff</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> An internal staff member with elevated privileges who manages the product catalog, processes orders and payments, creates shipments, resolves after-sale cases, runs POS sales, broadcasts messages, and accesses reports and analytics.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Create / Update / Delete Products, Verify / Reject Payment, Create Shipment, Add Tracking Event, Approve / Reject Replacement Case, POS Sale / Barcode Scan, Report Query, Settings Update, Compose Broadcast</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Analytics / Reports, Inventory Data, Invoices, Alerts, Broadcast Delivery Status</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Driver</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Delivery Personnel, Courier</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A delivery person who receives shipment assignments, scans delivery QR codes on-site, and updates the delivery status of shipments in the system.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Scan Delivery QR, Update Delivery Status</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Shipment Details, Delivery Receipt</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Facebook OAuth</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Facebook Identity Provider, Social Login Provider</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> An external identity platform (Meta) that provides OAuth 2.0 social authentication. The system redirects users to Facebook for consent and receives an OAuth token plus user profile data in return.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Auth Redirect Request</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> OAuth Token, User Profile (name, email, facebook_id)</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Bakong / KHQR Payment Gateway</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Bakong, KHQR Gateway, National Bank Payment Network</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The National Bank of Cambodia's interbank payment platform used to generate KHQR codes for customer payments. The system sends a QR generation request and receives QR payload and bill number; Bakong sends a payment webhook when the transaction is settled.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> KHQR Generate Request</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> QR Payload, Bill Number, Payment Webhook (settlement confirmation)</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Telegram Platform</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Telegram Bot API, Telegram Messenger</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The Telegram messaging service used by the system to send bot messages, broadcast promotions, and receive webhook updates or bot commands from users who have linked their Telegram accounts.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Bot Messages / Broadcasts</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Webhook Updates, Bot Commands, User Interaction Events</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> Dify AI Platform</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Dify, AI Chatbot Backend</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> An external AI platform (Dify) that powers the on-site chatbot. The system forwards user chat messages to Dify and receives AI-generated natural-language responses to relay back to customers or guests.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> User Chat Message</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> AI Chat Response</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>EXTERNAL ENTITY</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> CLIP FastAPI + Qdrant</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> AI Image Search Service, Vector Search Engine</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A Python FastAPI microservice running the OpenAI CLIP vision model paired with a Qdrant vector database. It accepts image uploads, converts them to 512-dimensional vectors, and performs nearest-neighbour search to return similar product IDs.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Image Vectorise Request (POST /vectorize), Vector Upsert (indexing)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> 512-dim CLIP Vector, Top-N Similar Product IDs + Similarity Scores</td></tr>
</table>

---

## 2. Data Flows

---

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF1</td><td colspan="2"><strong>NAME:</strong> Register / Login Request</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Credentials or OTP submitted by a customer to register a new account or log in to an existing one. Also includes device information for session tracking.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer</td><td colspan="2"><strong>DESTINATION:</strong> Process 1.0 Authentication & Security</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> High; occurs multiple times daily per user, peaks during flash sales or promotions.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Starting point of the authenticated user journey. OTP is sent via email during registration and password reset.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF2</td><td colspan="2"><strong>NAME:</strong> Access Token / Session</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A Laravel Sanctum bearer token issued to a successfully authenticated customer. Includes device session metadata (device name, browser, OS, IP).</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 1.0 Authentication & Security</td><td colspan="2"><strong>DESTINATION:</strong> Customer</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> One token per login event; refreshed when session expires.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Token is used in Authorization header for all subsequent authenticated API calls.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF3</td><td colspan="2"><strong>NAME:</strong> Browse / Filter / Search</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A request from a customer or guest to view the product catalog, apply filters (category, brand, gender, price range), or perform a keyword search.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer / Guest User</td><td colspan="2"><strong>DESTINATION:</strong> Process 2.0 Product Catalog Management</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Very high; continuous throughout the day from multiple users.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Guests receive only active/public products; authenticated customers may also see personalised recommendations.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF4</td><td colspan="2"><strong>NAME:</strong> Product Listings / Detail</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Response containing product records matching the browse or search request. Includes product name, images, price, discounted price, stock availability, sizes, colors, and category info.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 2.0 Product Catalog Management</td><td colspan="2"><strong>DESTINATION:</strong> Customer / Guest User</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Very high; returned for every catalog request.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Paginated response. Single-product detail includes full attributes, gallery, size guide, and delivery info.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF5</td><td colspan="2"><strong>NAME:</strong> Add / Update / Remove Cart Items</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A request from a customer to modify their shopping cart: add a new item (with selected color, size, quantity), update quantity, or remove an item.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer</td><td colspan="2"><strong>DESTINATION:</strong> Process 3.0 Cart Management</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> High; multiple times per shopping session.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Guest carts are tracked via a guest_token cookie; merged into user cart upon login.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF6</td><td colspan="2"><strong>NAME:</strong> Cart State / Totals</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The current state of the customer's cart returned after any modification, showing all line items (product, color, size, unit price, quantity, line total) and the cart subtotal.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 3.0 Cart Management</td><td colspan="2"><strong>DESTINATION:</strong> Customer</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Returned after every cart operation; also fetched on cart page load.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Real-time stock validation is applied; out-of-stock items are flagged before checkout.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF7</td><td colspan="2"><strong>NAME:</strong> Checkout Request</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A customer's intent to place an order, containing the selected shipping address, chosen payment method, and any applicable discount or coupon code.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer</td><td colspan="2"><strong>DESTINATION:</strong> Process 4.0 Order Processing</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Medium; once per purchase transaction per customer.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Triggers cart validation, stock deduction, and order creation atomically.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF8</td><td colspan="2"><strong>NAME:</strong> Order Confirmation</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Response to the customer after a successful order creation, containing the unique order number, itemised order summary, total amount, and next payment step.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 4.0 Order Processing</td><td colspan="2"><strong>DESTINATION:</strong> Customer</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Once per completed checkout.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Order number follows a unique sequential format (e.g., ORD-20260001).</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF9</td><td colspan="2"><strong>NAME:</strong> KHQR Payment Request</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A request sent from the payment processing module to the Bakong / KHQR gateway to generate a QR code for a specific order amount and bill reference.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 5.0 Payment Processing</td><td colspan="2"><strong>DESTINATION:</strong> Bakong / KHQR Payment Gateway</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Once per order that uses KHQR as the payment method.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Request includes amount in USD/KHR, merchant info, and a unique bill_number reference.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF10</td><td colspan="2"><strong>NAME:</strong> Payment QR Code / Status</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The KHQR payload and QR image returned to the customer for scanning, plus real-time payment status updates (pending, paid, failed, expired).</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 5.0 Payment Processing</td><td colspan="2"><strong>DESTINATION:</strong> Customer</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Once per payment initiation; status polled by the customer until settled.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> QR expires after a configurable timeout; customer must re-initiate if expired.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF11</td><td colspan="2"><strong>NAME:</strong> Delivery Updates / Tracking Timeline</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Shipment status and a chronological list of tracking events (location, status, timestamp, note) returned when a customer queries their shipment.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 6.0 Shipment & Delivery</td><td colspan="2"><strong>DESTINATION:</strong> Customer</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Medium; polled by customers after order is shipped.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Also sent proactively as push notifications when key milestones occur (dispatched, out for delivery, delivered).</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF12</td><td colspan="2"><strong>NAME:</strong> Replacement Request</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A post-delivery request submitted by a customer to return or replace a defective / incorrect item, containing the order reference, reason, and supporting notes.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer</td><td colspan="2"><strong>DESTINATION:</strong> Process 7.0 After-Sale / Replacement</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Low to medium; dependent on return rate of delivered orders.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Only eligible for orders with status = delivered.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF13</td><td colspan="2"><strong>NAME:</strong> Upload Query Image</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> An image file uploaded by a customer or guest to the AI Image Search feature for finding visually similar products in the catalog.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer / Guest User</td><td colspan="2"><strong>DESTINATION:</strong> Process 8.0 AI Image Search</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Medium; usage grows with feature adoption.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Supported formats: JPEG, PNG, WEBP. Max size enforced by the API gateway.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF14</td><td colspan="2"><strong>NAME:</strong> Similar Product Results</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A ranked list of products visually similar to the query image, returned by the AI Image Search process after vector similarity matching in Qdrant.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 8.0 AI Image Search</td><td colspan="2"><strong>DESTINATION:</strong> Customer / Guest User</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Once per image search query; returns top-N results (configurable, default 10).</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Each result includes product ID, name, image, price, and similarity score.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF15</td><td colspan="2"><strong>NAME:</strong> Analytics / Reports</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Aggregated business intelligence data returned to the admin, including sales reports, revenue summaries, inventory levels, order statistics, and customer analytics.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 9.0 Admin, POS & Reporting</td><td colspan="2"><strong>DESTINATION:</strong> Admin / Superadmin</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> On-demand; daily or real-time dashboard refresh.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Superadmin has access to all data; Admin may have scoped access depending on role configuration.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF16</td><td colspan="2"><strong>NAME:</strong> Chat Message</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A natural-language text message sent by a customer or guest to the on-site AI chatbot, seeking product recommendations, order help, or general inquiries.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Customer / Guest User</td><td colspan="2"><strong>DESTINATION:</strong> Process 11.0 AI Chatbot</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> Medium to high; continuous during site operating hours.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Multi-turn conversation context is maintained within the Dify platform session.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA FLOW</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> DF17</td><td colspan="2"><strong>NAME:</strong> AI Chat Response</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> An AI-generated natural-language reply to the user's chat message, produced by the Dify platform and relayed back through the AI Chatbot process.</td></tr>
<tr><td colspan="2"><strong>ORIGIN:</strong> Process 11.0 AI Chatbot</td><td colspan="2"><strong>DESTINATION:</strong> Customer / Guest User</td></tr>
<tr><td colspan="4"><strong>VOLUME AND FREQUENCY:</strong> One response per chat message received.</td></tr>
<tr><td colspan="4"><strong>COMMENTS:</strong> Supports streaming (token-by-token) and batch response modes depending on frontend implementation.</td></tr>
</table>

---

## 3. Process Descriptions

---

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 1.0</td><td colspan="2"><strong>NAME:</strong> Authentication & Security</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Register new users, verify identities via OTP or OAuth, issue Sanctum access tokens, manage device sessions, handle two-factor authentication, reset passwords, and log all security events.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Register / Login Request (DF1), OAuth Token from Facebook (DF external), OTP Code, 2FA Challenge Code, Revoke / View Sessions, Forgot Password Request</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Access Token / Session (DF2), OTP Email, Sanctum Token, Audit Record, Activated User Account</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> On registration, user credentials are stored and an OTP is emailed for verification. Upon correct OTP entry, the account is activated. For login, credentials are validated against the users table; a Sanctum token and device session record are created. Facebook OAuth upserts a user record and issues a token. 2FA challenges validate TOTP codes. All auth events are written to security_audit_logs.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 2.0</td><td colspan="2"><strong>NAME:</strong> Product Catalog Management</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Serve the public and authenticated product catalog with browsing, filtering, searching, and full product details. Allow admins to create, update, and delete products, categories, brands, discounts, collections, and banners.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Browse / Filter / Search (DF3), Create / Update / Delete Products (Admin), Manage Categories / Brands / Discounts / Banners / Menus (Admin)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Product Listings / Detail (DF4), Public Catalog (Guest), Updated Catalog Confirmation (Admin)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Reads and writes to the products, categories, brands, product_images, discounts, collections, banners, menus, and settings tables. Applies active/inactive filters for public-facing responses. Supports pagination, sorting, and multi-faceted filtering. Product price computation accounts for active discount records.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 3.0</td><td colspan="2"><strong>NAME:</strong> Cart Management</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Maintain a persistent shopping cart for each user (or guest), allowing items to be added, updated, and removed. Validate stock and compute line totals in real time.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Add / Update / Remove Cart Items (DF5), Product & Price Data (from Process 2.0)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Cart State / Totals (DF6), Cart Items Snapshot (to Process 4.0 on checkout)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Each authenticated user has one active cart record in the carts table. Guest carts are identified by a guest_token. Adding an item writes or updates a cart_items row with unit_price, color, size, and quantity. On user login, guest cart is merged. On checkout, the cart snapshot is passed to Order Processing and the cart is cleared.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 4.0</td><td colspan="2"><strong>NAME:</strong> Order Processing</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Validate the checkout request, create a permanent order record from the cart snapshot, deduct inventory stock, and pass the order to Payment Processing.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Checkout Request (DF7), Cart Items Snapshot (from Process 3.0)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Order Confirmation (DF8), Order Created → Trigger Payment (to Process 5.0), Order Data for Admin / POS (to Process 9.0)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Validates that all cart items are still in stock. Creates an orders record (with shipping_address, billing_address, totals, sale_channel) and corresponding order_items rows (snapshotting product name, SKU, price at time of purchase). Deducts stock from each product. Writes the order number and triggers the payment flow. Supports both storefront and POS sale channels.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 5.0</td><td colspan="2"><strong>NAME:</strong> Payment Processing</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Generate KHQR payment QR codes, track payment status, handle Bakong webhooks for automatic settlement confirmation, and allow admin to manually verify payment proofs.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> KHQR Payment Request (DF9), Payment Proof / Card Info (Customer), QR Payload / Payment Webhook (Bakong), Verify / Reject Payment (Admin)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Payment QR Code / Status (DF10), Payment Confirmed → Notify (to Process 10.0), Updated Order payment_status (to D4)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Creates a payments record linked to the order. For KHQR, calls the Bakong API, stores the returned qr_string, khqr_payload, and bill_number. Polls or waits for the payment webhook; on receipt, marks payment as paid and updates the parent order's payment_status. Admin can manually mark payment as verified after reviewing an uploaded proof image.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 6.0</td><td colspan="2"><strong>NAME:</strong> Shipment & Delivery</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Create shipment records for paid orders, assign drivers, generate delivery QR codes, record tracking events, and provide customers with a real-time delivery timeline.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Create Shipment (Admin), Add Tracking Event (Admin), Scan QR / Update Delivery Status (Driver), Track Shipment Request (Customer)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Delivery Updates / Tracking Timeline (DF11), Tracking Status / Receipt (Driver), Delivery Event → Notify (to Process 10.0)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Admin creates a shipments record for a paid order, linking to a provider and tracking_code, and generates a QR code for the driver. As the driver scans QR or admin adds events, shipment_tracking_events rows are written with status, location, and timestamp. Order and shipment statuses update accordingly. Customers query tracking data through a public-facing timeline view.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 7.0</td><td colspan="2"><strong>NAME:</strong> After-Sale / Replacement</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Accept post-delivery replacement or return requests from customers, record them in the system, and allow admins to review, approve, reject, or resolve each case.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Replacement Request (DF12), Approve / Reject / Resolve Case (Admin)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Case Status (Customer), Case Linked to Order (D4)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Customer submits a replacement request for a delivered order; a replacement_cases record is created with the order reference, reason, and status = pending. Admin reviews the case, updates the status (approved / rejected / resolved), and adds notes. The case is always linked to the originating order record.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 8.0</td><td colspan="2"><strong>NAME:</strong> AI Image Search</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Accept an image uploaded by a user, vectorise it using the CLIP model, perform nearest-neighbour search in Qdrant, and return a ranked list of visually similar products from the catalog.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Upload Query Image (DF13), Trigger Vector Indexing (Admin), 512-dim Vector / Similar Product IDs (from CLIP + Qdrant)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Similar Product Results (DF14), Image Vectorise Request (to CLIP FastAPI), Vector Upsert (to Qdrant)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Validates and forwards the uploaded image to the FastAPI /vectorize endpoint. Receives a 512-dimensional CLIP embedding, submits it to Qdrant for cosine similarity search, retrieves the top-N matching product IDs, fetches full product details from the products table, and returns the results. Admin can trigger batch re-indexing to sync new or updated product images into Qdrant.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 9.0</td><td colspan="2"><strong>NAME:</strong> Admin, POS & Reporting</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Provide the back-office with POS (point-of-sale) capabilities for in-store transactions, barcode scanning, and comprehensive reporting/analytics across all business data.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> POS Sale / Barcode Scan (Admin), Report Query (Admin), Settings Update (Admin), Order Data (from Process 4.0)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Analytics / Reports (DF15), POS Receipt / Invoice (Admin), Updated Settings</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> For POS sales, creates an order with sale_channel = pos and pos_meta JSON containing cashier and terminal info. Barcode scanning retrieves product by barcode_code or SKU. Reporting aggregates data across orders, order_items, payments, and shipments to produce sales summaries, revenue charts, and inventory reports. Settings are stored as key-value pairs in the settings table.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 10.0</td><td colspan="2"><strong>NAME:</strong> Notifications & Messaging</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Send in-app push notifications, create broadcast messages, and relay them to customers via the Telegram bot platform. Handle incoming webhook events and bot interactions from Telegram.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> System Events (payment confirmed, delivery update), Compose Broadcast / Message (Admin), Webhook Updates / Bot Commands (Telegram)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Push Notification (Customer), Broadcast Message (Telegram Platform), In-app Alert</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Triggered by system events (payment confirmed, order shipped, etc.) or by admin composing a broadcast. Writes a notifications record per customer for in-app alerts. For Telegram, creates a telegram_broadcasts batch and fans out telegram_broadcast_deliveries per recipient, tracking sent/failed status per message. Handles incoming Telegram webhooks for bot command responses.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>PROCESS DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> 11.0</td><td colspan="2"><strong>NAME:</strong> AI Chatbot</td></tr>
<tr><td colspan="4"><strong>PURPOSE:</strong> Provide an intelligent conversational assistant to customers and guests for product inquiries, order help, and general store questions by proxying messages to the Dify AI platform.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Chat Message (DF16), AI Response (from Dify AI Platform)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> User Query (to Dify AI Platform), AI Chat Response (DF17)</td></tr>
<tr><td colspan="4"><strong>PROCESS DESCRIPTION:</strong> Receives the user's chat message, attaches conversation context, and forwards the request to the Dify AI API. Receives the AI-generated response and streams or returns it to the originating user. Maintains session context within Dify for multi-turn conversations. No persistent data store is used within the FitAndSleek system for chat history.</td></tr>
</table>

---

## 4. Data Stores

---

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D1 — Auth & Security Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Authentication Store, User Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores all user account records, Sanctum API tokens, OTP codes, device sessions, trusted devices, and security audit logs.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Register / Login Request, OTP Verification, OAuth Token, 2FA Challenge, Create Device Session, Log Audit Event</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Verified Credentials, Access Token, Session Info, Audit History</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> users, personal_access_tokens, otp_codes, user_device_sessions, user_trusted_devices, security_audit_logs</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D2 — Product Catalog Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Catalog Store, Inventory Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores all product catalog data including brands, categories (hierarchical), products, product images, discounts, collections, banners, navigation menus, and system settings.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Create / Update / Delete Products (Admin), Manage Categories / Brands / Discounts / Banners / Menus (Admin), Mark Vector Indexed (Process 8.0)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Product Listings / Detail, Public Catalog, Product & Price Data (to Process 3.0), Vector-indexed Product List (to Process 8.0)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> brands, categories, products, product_images, discounts, collections, banners, menus, settings</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D3 — Cart Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Shopping Cart Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores active, abandoned, and merged shopping cart records and their associated line items for both authenticated users and guest visitors.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Add / Update / Remove Cart Items, Cart Merge (on login)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Cart State / Totals, Cart Items Snapshot (to Order Processing)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> carts, cart_items</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D4 — Orders Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Order Store, Transaction Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores all order records (both storefront and POS) and their itemised line items. Each order captures the customer, shipping/billing addresses, totals, and lifecycle status.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Write Order & Items (Process 4.0), Update Order payment_status (Process 5.0), Update Order Status (Process 6.0), Link Replacement Case (Process 7.0)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Order Confirmation, Order Data (for Admin / POS), Read Order (for Shipment), Read Order (for Replacement)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> orders, order_items</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D5 — Payments Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Payment Store, Transaction Payment Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores all payment records associated with orders, including KHQR payloads, QR strings, bill numbers, Bakong references, proof image paths, payment status lifecycle, and raw gateway responses.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Store Payment Record (Process 5.0), Mark Payment Paid (Bakong Webhook), Mark Verified (Admin), Payment Status Poll</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Payment Status, QR Code / Payload, Payment Verification Confirmation</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> payments</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D6 — Shipments Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Delivery Store, Logistics Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores shipment records (one per order) and a chronological log of tracking events describing the delivery journey from warehouse to customer.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Write Shipment Record (Admin), Write Tracking Event (Driver / Admin), Update Shipment Status</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Shipment Details (Driver), Tracking Timeline (Customer), Delivery Updates (for Notifications)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> shipments, shipment_tracking_events</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D7 — After-Sale Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Replacement Store, Returns Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores after-sale replacement and return case records, each linked to the originating order, with reason, status, admin notes, and the staff member handling the case.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Replacement Request (Customer), Approve / Reject / Resolve Case (Admin)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Case Status (Customer), Case Details (Admin)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> replacement_cases</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D8 — Wishlist & Addresses Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Favourites Store, Customer Addresses Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores customer wishlists with their saved products, and customer delivery/billing address book entries.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Add to Wishlist, Remove from Wishlist, Add / Update / Delete Address</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Wishlist Items (Customer), Saved Addresses (Customer, used in Checkout)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> wishlists, wishlist_items, addresses</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D9 — Notifications & Messages Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Inbox Store, Alert Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores in-app notifications per user, guest contact form submissions, and reusable broadcast message templates created by admins for marketing or operational communication.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> System-generated Notification Events (payment, delivery), Contact Form Submission (Guest), Compose Broadcast / Message (Admin)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Push Notification / In-app Alert (Customer), Contact Record (Admin), Message Content (to Process 10.0)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> notifications, contacts, messages</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA STORE</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="4"><strong>LABEL:</strong> D10 — Telegram Store</td></tr>
<tr><td colspan="4"><strong>ALIAS NAME:</strong> Telegram Bot Store, Bot Subscriber Store</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stores Telegram user profiles that have interacted with the FitAndSleek bot, broadcast batch records, and per-recipient delivery tracking rows to manage retry logic and delivery reporting.</td></tr>
<tr><td colspan="4"><strong>INPUT DATA FLOW:</strong> Webhook / Bot Interaction (Telegram), Create Broadcast (Admin), Fan-out Deliveries (Process 10.0)</td></tr>
<tr><td colspan="4"><strong>OUTPUT DATA FLOW:</strong> Telegram User List (for broadcasts), Delivery Status Report (Admin)</td></tr>
<tr><td colspan="4"><strong>RECORD:</strong> telegram_users, telegram_broadcasts, telegram_broadcast_deliveries</td></tr>
</table>

---

## 5. Data Elements

---

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> UserID</td><td colspan="2"><strong>LABEL:</strong> id</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> BigInt (8 bytes)</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> None</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> Auto-increment</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Positive integers</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> users table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Internal use only; not exposed directly to end users in API responses</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> System (auto-generated)</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Unique primary key identifier for each registered user account in the system.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> Email</td><td colspan="2"><strong>LABEL:</strong> email</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> String, max 255 characters</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> lowercase string</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> None</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Valid email format (RFC 5321); unique per user</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> users table (Database) — provided by user at registration or via OAuth</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Private; never displayed publicly; used for OTP delivery and login</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Customer / Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The unique email address of a registered user, used as the primary login identifier and for system communications including OTP codes and order notifications.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> Role</td><td colspan="2"><strong>LABEL:</strong> role</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> Enum String, max 20 characters</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Lowercase string</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> customer</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> customer, admin, superadmin, driver</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> users table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Editable by superadmin only; controls access permissions across the system</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Superadmin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Defines the system access level and permission set assigned to a user account. Determines which processes and data stores the user can interact with.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> ProductID</td><td colspan="2"><strong>LABEL:</strong> id</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> BigInt (8 bytes)</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> None</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> Auto-increment</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Positive integers</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> products table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Internal use only; not editable by users</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Unique primary key for each product record in the catalog. Referenced by cart_items, order_items, discounts, product_images, and wishlist_items.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> SKU</td><td colspan="2"><strong>LABEL:</strong> sku</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> String, max 100 characters, unique</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Alphanumeric, uppercase preferred</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> None</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Non-null, unique alphanumeric string</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> products table (Database) — set by Admin at product creation</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Visible to Admin; displayed to customers on order detail pages</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Stock Keeping Unit identifier — a unique code assigned to each product variant for inventory tracking, barcode scanning, and POS lookups.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> Price</td><td colspan="2"><strong>LABEL:</strong> price</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> Decimal(10, 2)</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> 2 decimal places (e.g., 29.99)</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> 0.00</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Non-negative decimal numbers</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> products table (Database) — set by Admin</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Publicly visible; editable by Admin only</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The regular selling price of a product in USD. The system computes a final_price by applying any active discount record.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> Stock</td><td colspan="2"><strong>LABEL:</strong> stock</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> Integer</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Whole number</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> 0</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Non-negative integers</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> products table (Database) — decremented automatically upon order placement</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Read-only for customers (shown as availability); editable by Admin</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Current available inventory quantity for a product. Decremented when an order is placed and optionally restored when an order is cancelled.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> OrderNumber</td><td colspan="2"><strong>LABEL:</strong> order_number</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> String, max 50 characters, unique</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Alphanumeric (e.g., ORD-20260001)</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> Auto-generated on order creation</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Unique, non-null string</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> orders table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Visible to customer who placed the order and to Admin</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> System (auto-generated)</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A human-readable unique reference number for each order, used in customer communications, invoices, and shipment labelling.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> OrderStatus</td><td colspan="2"><strong>LABEL:</strong> status</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> Enum String, max 20 characters</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Lowercase string</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> pending</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> pending, processing, shipped, delivered, cancelled</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> orders table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Read-only for customers; updatable by Admin and system events</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Admin / System</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Represents the current lifecycle stage of an order from creation to delivery or cancellation. Drives business logic for payment, shipment, and replacement eligibility.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> PaymentStatus</td><td colspan="2"><strong>LABEL:</strong> status</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> Enum String, max 20 characters</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Lowercase string</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> pending</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> pending, paid, failed, expired, cancelled</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> payments table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Read-only for customers; updatable by Bakong webhook and Admin</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> System (Bakong Webhook) / Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Tracks the current state of a payment transaction. Transitions from pending to paid upon successful Bakong webhook or admin verification; triggers order and notification updates.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> BillNumber</td><td colspan="2"><strong>LABEL:</strong> bill_number</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> String, max 100 characters, unique</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Alphanumeric string</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> Generated by Bakong API</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Unique, non-null string returned by Bakong</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> payments table (Database) — received from Bakong gateway response</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Internal use only; used to match Bakong webhook to the correct payment record</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> System (Bakong Integration)</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> A unique reference number issued by the Bakong / KHQR payment gateway for each generated QR payment request. Used to correlate incoming payment webhooks with the corresponding order payment.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> TrackingCode</td><td colspan="2"><strong>LABEL:</strong> tracking_code</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> String, max 100 characters</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> Alphanumeric string</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> None</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> Non-null string assigned at shipment creation</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> shipments table (Database) — entered by Admin at shipment creation</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Visible to customer, driver, and admin</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> Admin</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> The delivery tracking code assigned to a shipment, used to identify the parcel and generate a scannable QR code for the driver.</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>DATA ELEMENT</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>NAME:</strong> IsVectorIndexed</td><td colspan="2"><strong>LABEL:</strong> is_vector_indexed</td></tr>
<tr><td colspan="2"><strong>TYPE AND LENGTH:</strong> Boolean</td><td colspan="2"><strong>OUTPUT FORMAT:</strong> true / false</td></tr>
<tr><td colspan="2"><strong>DEFAULT VALUE:</strong> false</td><td colspan="2"><strong>ACCEPTABLE VALUE:</strong> true, false</td></tr>
<tr><td colspan="4"><strong>SOURCE:</strong> products table (Database)</td></tr>
<tr><td colspan="4"><strong>SECURITY:</strong> Internal use only; managed by the AI Image Search indexing process</td></tr>
<tr><td colspan="4"><strong>RESPONSIBLE USER:</strong> System (Process 8.0 — AI Image Search)</td></tr>
<tr><td colspan="4"><strong>DESCRIPTION:</strong> Flag indicating whether a product's image has been successfully vectorised and upserted into the Qdrant vector store. Used to identify products pending re-indexing after updates.</td></tr>
</table>

---

## 6. Record Descriptions

---

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R1</td><td colspan="2"><strong>NAME:</strong> users</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> User Account, Member</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores the core identity and profile information for every registered user of the system, regardless of their role. Supports both email/password and social (Facebook OAuth) authentication, and includes two-factor authentication fields.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, name, email, password, role, phone, address, profile_image_path, status, facebook_id, social_type, two_factor_secret, two_factor_confirmed_at, two_factor_preferred_method, created_at, updated_at</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R2</td><td colspan="2"><strong>NAME:</strong> products</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Product, Item, Merchandise</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores the full product record for every item available in the FitAndSleek catalog, including pricing, inventory, media assets, variant configuration (colors, sizes), audience targeting, vector indexing status, and SEO-friendly slug.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, category_id, brand_id, stock_label_id, sku, barcode_code, name, slug, description, price, compare_at_price, stock, is_active, is_vector_indexed, image_url, gallery, attributes, audience, colors, sizes, variant_matrix, size_guide, delivery_info</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R3</td><td colspan="2"><strong>NAME:</strong> orders</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Purchase Order, Transaction</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores the master record for every customer purchase (storefront or POS), capturing totals, shipping and billing addresses (as JSON snapshots), the lifecycle status, and payment status. Each order is composed of one or more order_items records.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, user_id, order_number, sale_channel, status, payment_status, payment_method, subtotal, shipping, discount, total, shipping_address, billing_address, pos_meta, created_at, updated_at</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R4</td><td colspan="2"><strong>NAME:</strong> order_items</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Order Line Item, Purchase Line</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores a snapshot of each individual product line within an order at the time of purchase. Product details (name, SKU, price) are denormalised to preserve historical accuracy even if the product is later modified or deleted.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, order_id, product_id, name, sku, size, color, price, qty, line_total</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R5</td><td colspan="2"><strong>NAME:</strong> payments</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Payment Transaction, Payment Record</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores all payment transaction records associated with orders. Holds KHQR-specific fields (khqr_payload, qr_string, bill_number, bakong_ref), manual proof image paths, payment lifecycle timestamps, and the raw API response from the Bakong gateway.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, order_id, verified_by, provider, method, amount, currency, bill_number, bakong_ref, khqr_payload, qr_string, proof_image_path, status, expires_at, paid_at, verified_at, raw_response</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R6</td><td colspan="2"><strong>NAME:</strong> shipments</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Delivery Record, Parcel Record</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores one shipment record per order, representing the physical delivery parcel. Links to the order, records the logistics provider, tracking code, current status, and timestamps for dispatch and delivery.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, order_id, provider, tracking_code, status, shipped_at, delivered_at</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R7</td><td colspan="2"><strong>NAME:</strong> shipment_tracking_events</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Tracking Event, Delivery Milestone</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores each individual tracking milestone in the delivery journey of a shipment. Each event records the status change, physical location, an optional note, the time the event occurred, and which user recorded it.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, shipment_id, updated_by, status, location, note, event_time, created_at</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R8</td><td colspan="2"><strong>NAME:</strong> replacement_cases</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Return Case, After-Sale Case</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores post-delivery replacement or return requests submitted by customers. Each case is linked to the originating order and tracks the reason for the request, current resolution status, admin notes, and the staff member handling the case.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, order_id, handled_by, reason, status, notes</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R9</td><td colspan="2"><strong>NAME:</strong> notifications</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Alert, In-App Notification</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores in-app notification records sent to individual users, triggered by system events such as payment confirmation, order status changes, or admin broadcasts. Each notification tracks whether the user has read it.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, user_id, type, title, message, data, is_read, created_at</td></tr>
</table>

<br>

<table border="1" cellpadding="6" cellspacing="0" width="100%">
<tr><th colspan="4" align="center">DATA DICTIONARY FORM<br><br>RECORD DESCRIPTION</th></tr>
<tr><td colspan="4" align="center">SYSTEM: FitAndSleek E-Commerce System</td></tr>
<tr><td colspan="2"><strong>ID:</strong> R10</td><td colspan="2"><strong>NAME:</strong> telegram_broadcasts</td></tr>
<tr><td colspan="4"><strong>ALTERNATE NAMES:</strong> Broadcast Job, Telegram Campaign</td></tr>
<tr><td colspan="4"><strong>DEFINITION:</strong> Stores batch broadcast records created by admins to send mass messages via the Telegram bot. Each record defines the target audience, message content, parse mode, dry-run flag, and tracks overall delivery progress (total recipients, sent count, failed count) and execution status.</td></tr>
<tr><td colspan="4"><strong>DATA ELEMENT CONTENT:</strong> id, created_by, batch_id, target, message, parse_mode, dry_run, status, total_recipients, sent_count, failed_count, started_at, completed_at</td></tr>
</table>
