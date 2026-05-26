@php
    /* ───────────────────────────────────────────────────────────────────────────
     *  BRAND — kept in sync with exports/table.blade.php and reports/*.blade.php
     * ─────────────────────────────────────────────────────────────────────── */
    $brandName      = 'FIT & SLEEK';
    $logoUrl        = 'https://pub-93085525881746c1a7b523e463cbfb35.r2.dev/uploads/Fitandsleek/2026-01-30%2003.05.05.jpg';

    $headerNavy     = '#0F1923';
    $headerNavySoft = '#1B2638';
    $textPrimary    = '#0F172A';
    $textMuted      = '#64748B';
    $borderSoft     = '#E5E9F0';
    $rowAlt         = '#F8FAFC';

    $generatedAt    = now()->format('M j, Y · g:i A');

    /* Fontsource CDN (TTF over HTTPS) — DomPDF reads these because the
     * controller sets isRemoteEnabled = true. */
    $synFont       = 'https://cdn.jsdelivr.net/fontsource/fonts/syne/files/syne-latin-700-normal.ttf';
    $synFontBlack  = 'https://cdn.jsdelivr.net/fontsource/fonts/syne/files/syne-latin-800-normal.ttf';
    $dmSans400     = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans/files/dm-sans-latin-400-normal.ttf';
    $dmSans500     = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans/files/dm-sans-latin-500-normal.ttf';
    $dmSans700     = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans/files/dm-sans-latin-700-normal.ttf';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ ($isBulk ?? false) ? 'Invoices' : 'Invoice' }}</title>
    <style>
        @font-face { font-family: 'Syne'; font-weight: 700; font-style: normal; src: url("{{ $synFont }}") format("truetype"); }
        @font-face { font-family: 'Syne'; font-weight: 800; font-style: normal; src: url("{{ $synFontBlack }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 400; font-style: normal; src: url("{{ $dmSans400 }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 500; font-style: normal; src: url("{{ $dmSans500 }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 700; font-style: normal; src: url("{{ $dmSans700 }}") format("truetype"); }

        /* Full-bleed page so the navy header touches the paper edge.
         * Each invoice carries its own header so multi-invoice bulk PDFs
         * still get a branded banner on every page. */
        @page { margin: 0; }

        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            font-family: 'DM Sans', 'DejaVu Sans', Arial, sans-serif;
            color: {{ $textPrimary }};
            font-size: 10px;
            line-height: 1.45;
        }
        h1, h2, h3, .display { font-family: 'Syne', 'DM Sans', 'DejaVu Sans', Arial, sans-serif; margin: 0; }

        /* ── Per-invoice page wrapper ─────────────────────────────────────── */
        .invoice-page {
            position: relative;
            page-break-inside: avoid;
        }
        .invoice-page.page-break { page-break-after: always; }
        .content { padding: 14px 24px 24px 24px; position: relative; z-index: 1; }

        /* ── Watermark (PAID / UNPAID) ────────────────────────────────────── */
        .watermark {
            position: absolute;
            top: 45%;
            left: 18%;
            transform: rotate(-28deg);
            font-family: 'Syne', 'DM Sans', sans-serif;
            font-size: 96px;
            font-weight: 800;
            letter-spacing: 6px;
            z-index: 0;
            pointer-events: none;
        }
        .watermark.paid   { color: rgba(22, 163, 74, 0.08); }
        .watermark.unpaid { color: rgba(220, 38, 38, 0.08); }

        /* ── Header bar (full-bleed) ───────────────────────────────────────── */
        .brand-header {
            background: {{ $headerNavy }};
            color: #ffffff;
            padding: 16px 24px;
            margin: 0 0 14px 0;
        }
        .brand-header table { width: 100%; border-collapse: collapse; }
        .brand-header td { vertical-align: middle; padding: 0; }
        .brand-header .logo-cell { width: 180px; }
        .brand-header .logo-cell img {
            display: block;
            width: 180px;
            height: auto;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.10);
        }
        .brand-header .text-cell { padding-left: 18px; }
        .brand-header .doc-title-h {
            font-family: 'Syne', 'DM Sans', 'DejaVu Sans', sans-serif;
            font-weight: 800;
            font-size: 22px;
            letter-spacing: 0.4px;
            margin: 0 0 4px 0;
            color: #ffffff;
        }
        .brand-header .doc-subtitle-h {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 10px;
            font-weight: 400;
            color: rgba(255,255,255,0.72);
            margin: 0;
            letter-spacing: 0.2px;
        }
        .brand-header .right-cell { text-align: right; }
        .brand-header .pill-doc {
            display: inline-block;
            background: {{ $headerNavySoft }};
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 14px;
            padding: 4px 12px;
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .brand-header .pill-doc.paid {
            background: #16A34A;
            border-color: rgba(255,255,255,0.18);
        }
        .brand-header .pill-doc.unpaid {
            background: #DC2626;
            border-color: rgba(255,255,255,0.18);
        }
        .brand-header .gen-line {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 9px;
            color: rgba(255,255,255,0.62);
            margin-top: 6px;
            letter-spacing: 0.2px;
        }

        /* ── Bill-to / Invoice details cards ───────────────────────────────── */
        .meta-grid { width: 100%; border-collapse: separate; border-spacing: 10px 0; margin-bottom: 12px; }
        .meta-grid td { vertical-align: top; width: 50%; padding: 0; }

        .info-card {
            border: 1px solid {{ $borderSoft }};
            border-radius: 8px;
            padding: 12px 14px;
            background: #FFFFFF;
        }
        .info-card.accent-blue   { border-top: 3px solid #2563EB; }
        .info-card.accent-amber  { border-top: 3px solid #F59E0B; }
        .eyebrow {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.1px;
            color: {{ $textMuted }};
            margin: 0 0 6px 0;
        }
        .bill-name {
            font-family: 'Syne', 'DM Sans', sans-serif;
            font-size: 15px;
            font-weight: 800;
            color: {{ $textPrimary }};
            margin: 0 0 4px 0;
        }
        .bill-line {
            font-size: 9.5px;
            color: {{ $textPrimary }};
            margin: 0 0 2px 0;
        }
        .bill-line.muted { color: {{ $textMuted }}; }

        table.meta-kv { width: 100%; border-collapse: collapse; }
        table.meta-kv td {
            padding: 3px 0;
            font-size: 9.5px;
            vertical-align: top;
        }
        table.meta-kv td.k { color: {{ $textMuted }}; width: 42%; }
        table.meta-kv td.v { color: {{ $textPrimary }}; font-weight: 700; text-align: right; }

        /* ── Items table ───────────────────────────────────────────────────── */
        table.report {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid {{ $borderSoft }};
            border-radius: 8px;
            overflow: hidden;
        }
        table.report thead { display: table-header-group; }
        table.report tr { page-break-inside: avoid; }
        table.report th {
            background: {{ $headerNavy }};
            color: #ffffff;
            font-family: 'Syne', 'DM Sans', sans-serif;
            font-weight: 700;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding: 9px 9px;
            text-align: left;
            border-right: 1px solid {{ $headerNavySoft }};
        }
        table.report th:last-child { border-right: 0; }
        table.report td {
            padding: 7px 9px;
            border-top: 1px solid {{ $borderSoft }};
            border-right: 1px solid {{ $borderSoft }};
            background: #ffffff;
            color: {{ $textPrimary }};
            vertical-align: middle;
            font-size: 10px;
        }
        table.report td:last-child { border-right: 0; }
        table.report tbody tr:nth-child(even) td { background: {{ $rowAlt }}; }
        table.report td.num,
        table.report th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        table.report .sku { color: {{ $textMuted }}; font-size: 9px; font-family: 'DM Sans', 'DejaVu Sans', sans-serif; }
        table.report td.empty {
            text-align: center;
            color: {{ $textMuted }};
            font-style: italic;
            padding: 14px 8px;
        }

        /* ── Totals + QR footer ────────────────────────────────────────────── */
        .footer-grid { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-top: 12px; }
        .footer-grid > tbody > tr > td { vertical-align: top; padding: 0; }
        .footer-grid .qr-cell { width: 170px; }

        .qr-card {
            border: 1px solid {{ $borderSoft }};
            border-radius: 8px;
            padding: 10px;
            background: #ffffff;
            text-align: center;
        }
        .qr-card img {
            display: block;
            width: 130px;
            height: 130px;
            margin: 0 auto 6px auto;
        }
        .qr-card .qr-empty {
            width: 130px;
            height: 130px;
            margin: 0 auto 6px auto;
            border: 1px dashed #CBD5E1;
            color: {{ $textMuted }};
            font-size: 9px;
            display: table-cell;
            vertical-align: middle;
            text-align: center;
        }
        .qr-card .qr-label {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 8px;
            color: {{ $textMuted }};
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin: 0;
        }
        .qr-card .qr-code {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 9px;
            color: {{ $textPrimary }};
            font-weight: 700;
            margin: 2px 0 0 0;
            word-break: break-all;
        }

        table.totals {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid {{ $borderSoft }};
            border-radius: 8px;
            overflow: hidden;
        }
        table.totals td {
            padding: 8px 12px;
            font-size: 10.5px;
            border-top: 1px solid {{ $borderSoft }};
            background: #ffffff;
        }
        table.totals tr:first-child td { border-top: 0; }
        table.totals td.k { color: {{ $textMuted }}; }
        table.totals td.v { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
        table.totals tr.grand td {
            background: {{ $headerNavy }};
            color: #ffffff;
            font-family: 'Syne', 'DM Sans', sans-serif;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.4px;
        }
        table.totals tr.grand td.k { color: rgba(255,255,255,0.72); }

        /* ── Footnote ──────────────────────────────────────────────────────── */
        .footnote {
            margin-top: 14px;
            font-size: 8.5px;
            color: {{ $textMuted }};
            text-align: center;
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            letter-spacing: 0.4px;
        }
        .footnote .brand {
            color: {{ $textPrimary }};
            font-weight: 800;
            font-family: 'Syne', 'DM Sans', sans-serif;
            letter-spacing: 1.2px;
        }

        .cut {
            margin-top: 10px;
            border-top: 2px dashed #94A3B8;
            text-align: center;
            color: {{ $textMuted }};
            font-size: 9px;
            padding-top: 4px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
@foreach ($invoices as $index => $invoice)
    @php
        $isPaid       = strcasecmp((string) ($invoice['payment_status'] ?? ''), 'PAID') === 0;
        $statusClass  = $isPaid ? 'paid' : 'unpaid';
        $pageBreak    = ($isBulk ?? false) && $index < count($invoices) - 1;
        $orderRef     = $invoice['order_number'] ?: $invoice['order_id'];
        $customer     = $invoice['customer'] ?? [];
        $items        = $invoice['items'] ?? [];
    @endphp
    <section class="invoice-page {{ $pageBreak ? 'page-break' : '' }}">

        <div class="watermark {{ $statusClass }}">{{ $invoice['payment_status'] ?? '' }}</div>

        <div class="brand-header">
            <table>
                <tr>
                    <td class="logo-cell"><img src="{{ $logoUrl }}" alt="{{ $brandName }}"></td>
                    <td class="text-cell">
                        <p class="doc-title-h">Invoice</p>
                        <p class="doc-subtitle-h">#{{ $invoice['invoice_number'] }} &nbsp;·&nbsp; {{ $invoice['invoice_date'] }}</p>
                    </td>
                    <td class="right-cell">
                        <span class="pill-doc {{ $statusClass }}">{{ $invoice['payment_status'] ?? '—' }}</span>
                        <div class="gen-line">Order #{{ $orderRef }}</div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="content">

            {{-- ── Bill to / Invoice details ─────────────────────────────────── --}}
            <table class="meta-grid">
                <tr>
                    <td>
                        <div class="info-card accent-blue">
                            <p class="eyebrow">Bill to</p>
                            <p class="bill-name">{{ $customer['name'] ?? '—' }}</p>
                            @if (!empty($customer['phone']) && $customer['phone'] !== '-')
                                <p class="bill-line">{{ $customer['phone'] }}</p>
                            @endif
                            @if (!empty($customer['email']))
                                <p class="bill-line muted">{{ $customer['email'] }}</p>
                            @endif
                            @if (!empty($customer['full_address']) && $customer['full_address'] !== '-')
                                <p class="bill-line">{{ $customer['full_address'] }}</p>
                            @endif
                        </div>
                    </td>
                    <td>
                        <div class="info-card accent-amber">
                            <p class="eyebrow">Invoice details</p>
                            <table class="meta-kv">
                                <tr>
                                    <td class="k">Invoice no.</td>
                                    <td class="v">{{ $invoice['invoice_number'] }}</td>
                                </tr>
                                <tr>
                                    <td class="k">Invoice date</td>
                                    <td class="v">{{ $invoice['invoice_date'] }}</td>
                                </tr>
                                <tr>
                                    <td class="k">Order reference</td>
                                    <td class="v">#{{ $orderRef }}</td>
                                </tr>
                                @if (!empty($invoice['tracking_code']))
                                    <tr>
                                        <td class="k">Tracking code</td>
                                        <td class="v">{{ $invoice['tracking_code'] }}</td>
                                    </tr>
                                @endif
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            {{-- ── Items table ─────────────────────────────────────────────── --}}
            <table class="report">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th class="num" style="width:7%;">Qty</th>
                        <th class="num" style="width:13%;">Unit price</th>
                        <th class="num" style="width:13%;">Discount</th>
                        <th class="num" style="width:13%;">Shipping</th>
                        <th class="num" style="width:16%;">Line total</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($items as $item)
                        <tr>
                            <td>
                                <div>{{ $item['product_name'] ?? '—' }}</div>
                                @if (!empty($item['sku']))
                                    <div class="sku">SKU · {{ $item['sku'] }}</div>
                                @endif
                            </td>
                            <td class="num">{{ number_format((int) ($item['quantity'] ?? 0)) }}</td>
                            <td class="num">${{ number_format((float) ($item['price'] ?? 0), 2) }}</td>
                            <td class="num">${{ number_format((float) ($item['discount'] ?? 0), 2) }}</td>
                            <td class="num">${{ number_format((float) ($item['shipping_fee'] ?? 0), 2) }}</td>
                            <td class="num">${{ number_format((float) ($item['grand_total'] ?? $item['line_total'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td class="empty" colspan="6">No line items on this invoice</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>

            {{-- ── Totals + QR footer ──────────────────────────────────────── --}}
            <table class="footer-grid">
                <tr>
                    <td class="qr-cell">
                        <div class="qr-card">
                            @if (!empty($invoice['qr_data_uri']))
                                <img src="{{ $invoice['qr_data_uri'] }}" alt="Driver QR">
                            @else
                                <div class="qr-empty">No tracking QR</div>
                            @endif
                            <p class="qr-label">Driver Smart QR</p>
                            @if (!empty($invoice['tracking_code']))
                                <p class="qr-code">{{ $invoice['tracking_code'] }}</p>
                            @endif
                        </div>
                    </td>
                    <td>
                        <table class="totals">
                            <tr>
                                <td class="k">Subtotal</td>
                                <td class="v">${{ number_format((float) $invoice['subtotal'], 2) }}</td>
                            </tr>
                            <tr>
                                <td class="k">Discount</td>
                                <td class="v">−${{ number_format((float) $invoice['discount'], 2) }}</td>
                            </tr>
                            <tr>
                                <td class="k">Shipping</td>
                                <td class="v">${{ number_format((float) $invoice['shipping_fee'], 2) }}</td>
                            </tr>
                            <tr class="grand">
                                <td class="k">Grand total</td>
                                <td class="v">${{ number_format((float) $invoice['grand_total'], 2) }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <div class="footnote">
                <span class="brand">{{ $brandName }}</span>
                &nbsp;·&nbsp; Thank you for shopping with us &nbsp;·&nbsp;
                Generated on {{ $generatedAt }}
            </div>

            @if ($isBulk ?? false)
                <div class="cut">— cut here —</div>
            @endif
        </div>
    </section>
@endforeach
</body>
</html>
