@php
    /* ───────────────────────────────────────────────────────────────────────────
     *  BRAND — kept in sync with exports/table.blade.php (Stock & Inventory PDF)
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

    $synFont       = 'https://cdn.jsdelivr.net/fontsource/fonts/syne/files/syne-latin-700-normal.ttf';
    $synFontBlack  = 'https://cdn.jsdelivr.net/fontsource/fonts/syne/files/syne-latin-800-normal.ttf';
    $dmSans400     = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans/files/dm-sans-latin-400-normal.ttf';
    $dmSans500     = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans/files/dm-sans-latin-500-normal.ttf';
    $dmSans700     = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans/files/dm-sans-latin-700-normal.ttf';

    $title         = 'Sales Report';
    $subtitle      = 'Date From: ' . $from . '  |  Date To: ' . $to;

    // Effective span in days (inclusive); used as a denominator-safe metric card.
    $fromDate = \Illuminate\Support\Carbon::parse($from)->startOfDay();
    $toDate   = \Illuminate\Support\Carbon::parse($to)->startOfDay();
    $daysInRange = $fromDate->diffInDays($toDate) + 1;
    $avgPerDay   = $daysInRange > 0 ? ($summary['total_revenue'] / $daysInRange) : 0.0;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
    <style>
        @font-face { font-family: 'Syne'; font-weight: 700; font-style: normal; src: url("{{ $synFont }}") format("truetype"); }
        @font-face { font-family: 'Syne'; font-weight: 800; font-style: normal; src: url("{{ $synFontBlack }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 400; font-style: normal; src: url("{{ $dmSans400 }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 500; font-style: normal; src: url("{{ $dmSans500 }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 700; font-style: normal; src: url("{{ $dmSans700 }}") format("truetype"); }

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
        .content { padding: 14px 24px 24px 24px; }

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
            font-weight: 500;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        .brand-header .gen-line {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 9px;
            color: rgba(255,255,255,0.62);
            margin-top: 6px;
            letter-spacing: 0.2px;
        }

        /* ── Metric cards ──────────────────────────────────────────────────── */
        .metrics { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 12px; }
        .metrics td { vertical-align: top; width: 25%; }
        .metric-card {
            border: 1px solid {{ $borderSoft }};
            border-radius: 8px;
            padding: 10px 12px 12px 12px;
            background: #FFFFFF;
        }
        .metric-card .metric-label {
            font-family: 'DM Sans', 'DejaVu Sans', sans-serif;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.1px;
            color: {{ $textMuted }};
            margin: 0 0 6px 0;
        }
        .metric-card .metric-value {
            font-family: 'Syne', 'DM Sans', sans-serif;
            font-size: 22px;
            font-weight: 800;
            color: {{ $textPrimary }};
            margin: 0;
            letter-spacing: 0.2px;
        }
        .metric-card .metric-hint {
            font-size: 9px;
            color: {{ $textMuted }};
            margin: 4px 0 0 0;
        }
        .metric-card.accent-blue   { border-top: 3px solid #2563EB; }
        .metric-card.accent-green  { border-top: 3px solid #16A34A; }
        .metric-card.accent-amber  { border-top: 3px solid #F59E0B; }
        .metric-card.accent-purple { border-top: 3px solid #7C3AED; }

        /* ── Data table ────────────────────────────────────────────────────── */
        .section-title {
            font-family: 'Syne', 'DM Sans', sans-serif;
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            color: {{ $textPrimary }};
            margin: 14px 0 8px 0;
        }
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
        }
        table.report td:last-child { border-right: 0; }
        table.report tbody tr:nth-child(even) td { background: {{ $rowAlt }}; }
        table.report td.num,
        table.report th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        table.report td.empty {
            text-align: center;
            color: {{ $textMuted }};
            font-style: italic;
            padding: 14px 8px;
        }
        table.report tfoot td {
            background: {{ $headerNavy }};
            color: #ffffff;
            font-weight: 800;
            font-family: 'Syne', 'DM Sans', sans-serif;
            letter-spacing: 0.4px;
            border-right: 1px solid {{ $headerNavySoft }};
        }
        table.report tfoot td:last-child { border-right: 0; }

        /* ── Footer ───────────────────────────────────────────────────────── */
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
    </style>
</head>
<body>
    <div class="brand-header">
        <table>
            <tr>
                <td class="logo-cell"><img src="{{ $logoUrl }}" alt="{{ $brandName }}"></td>
                <td class="text-cell">
                    <p class="doc-title-h">{{ $title }}</p>
                    <p class="doc-subtitle-h">{{ $subtitle }}</p>
                </td>
                <td class="right-cell">
                    <span class="pill-doc">Sales</span>
                    <div class="gen-line">Generated {{ $generatedAt }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="content">

        {{-- ── Metric cards ─────────────────────────────────────────────────── --}}
        <table class="metrics">
            <tr>
                <td>
                    <div class="metric-card accent-green">
                        <p class="metric-label">Total Revenue</p>
                        <p class="metric-value">${{ number_format($summary['total_revenue'], 2) }}</p>
                        <p class="metric-hint">{{ $from }} → {{ $to }}</p>
                    </div>
                </td>
                <td>
                    <div class="metric-card accent-blue">
                        <p class="metric-label">Total Orders</p>
                        <p class="metric-value">{{ number_format($summary['total_orders']) }}</p>
                        <p class="metric-hint">across {{ $daysInRange }} day{{ $daysInRange === 1 ? '' : 's' }}</p>
                    </div>
                </td>
                <td>
                    <div class="metric-card accent-amber">
                        <p class="metric-label">Avg Revenue / Day</p>
                        <p class="metric-value">${{ number_format($avgPerDay, 2) }}</p>
                        <p class="metric-hint">range total ÷ days</p>
                    </div>
                </td>
                <td>
                    <div class="metric-card accent-purple">
                        <p class="metric-label">Range</p>
                        <p class="metric-value">{{ $daysInRange }}</p>
                        <p class="metric-hint">day{{ $daysInRange === 1 ? '' : 's' }} covered</p>
                    </div>
                </td>
            </tr>
        </table>

        <p class="section-title">Daily breakdown</p>

        <table class="report">
            <thead>
                <tr>
                    <th style="width:55%;">Date</th>
                    <th class="num" style="width:20%;">Orders</th>
                    <th class="num" style="width:25%;">Revenue</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($rows as $row)
                    <tr>
                        <td>{{ \Illuminate\Support\Carbon::parse($row->date)->format('D, M j, Y') }}</td>
                        <td class="num">{{ number_format((int) $row->orders) }}</td>
                        <td class="num">${{ number_format((float) $row->revenue, 2) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td class="empty" colspan="3">No sales in this range</td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td>Total</td>
                    <td class="num">{{ number_format((int) $summary['total_orders']) }}</td>
                    <td class="num">${{ number_format((float) $summary['total_revenue'], 2) }}</td>
                </tr>
            </tfoot>
        </table>

        <div class="footnote">
            <span class="brand">{{ $brandName }}</span>
            &nbsp;·&nbsp; Confidential internal document &nbsp;·&nbsp;
            Generated on {{ $generatedAt }}
        </div>
    </div>
</body>
</html>
