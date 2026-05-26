@php
    /* ───────────────────────────────────────────────────────────────────────────
     *  COLUMN INTENT DETECTION
     *  Use header names so we can pick the right cells for metric cards, badges,
     *  dots, pills, etc. Falls back gracefully for arbitrary tables.
     * ─────────────────────────────────────────────────────────────────────── */
    $headerLowers = array_map(fn ($h) => strtolower(trim((string) $h)), $headers);
    $findCol = static function (array $candidates) use ($headerLowers): ?int {
        foreach ($headerLowers as $i => $h) {
            foreach ($candidates as $c) {
                if ($h === $c || str_contains($h, $c)) return $i;
            }
        }
        return null;
    };

    $colCategory   = $findCol(['category']);
    $colOrigin     = $findCol(['origin', 'country']);
    $colStock      = $findCol(['stock', 'quantity', 'qty']);
    $colStatus     = $findCol(['status']);
    $colTotalPrice = $findCol(['total price', 'total value', 'total amount', 'amount']);
    $colUnitPrice  = $findCol(['price unit', 'unit price', 'price/unit']);

    $cell = static function (array $row, ?int $i): string {
        return $i === null ? '' : (string) ($row[$i] ?? '');
    };

    /* ───────────────────────────────────────────────────────────────────────────
     *  CELL PARSERS  →  numbers from labelled text
     * ─────────────────────────────────────────────────────────────────────── */
    $parseUnits = static function (string $v): ?int {
        $v = trim($v);
        if ($v === '' || $v === '-') return null;
        $lower = strtolower($v);
        if (in_array($lower, ['untracked', 'out of stock', 'low stock', 'oos'], true)) return null;
        if (preg_match('/(-?\\d[\\d,]*)\\s*units?/i', $v, $m)) return (int) str_replace(',', '', $m[1]);
        if (preg_match('/^-?\\d[\\d,]*$/', $v)) return (int) str_replace(',', '', $v);
        return null;
    };

    $parseMoney = static function (string $v): ?float {
        $v = trim($v);
        if ($v === '' || $v === '-') return null;
        if (preg_match('/\\$\\s*(-?\\d[\\d,]*(?:\\.\\d+)?)/', $v, $m)) return (float) str_replace(',', '', $m[1]);
        if (preg_match('/^-?\\d[\\d,]*(?:\\.\\d+)?$/', $v)) return (float) str_replace(',', '', $v);
        return null;
    };

    /* ───────────────────────────────────────────────────────────────────────────
     *  METRICS
     * ─────────────────────────────────────────────────────────────────────── */
    $totalItems = count($rows);
    $totalStock = 0;
    $totalValue = 0.0;
    $originSet  = [];
    foreach ($rows as $r) {
        $u = $parseUnits($cell($r, $colStock));
        if ($u !== null) $totalStock += $u;
        $m = $parseMoney($cell($r, $colTotalPrice));
        if ($m !== null) $totalValue += $m;
        if ($colOrigin !== null) {
            $o = trim($cell($r, $colOrigin));
            if ($o !== '' && $o !== '-') {
                foreach (preg_split('/[,;|]+/', $o) as $piece) {
                    // Defer to $stripEmoji declared below; it's a closure so just inline here.
                    $clean = preg_replace([
                        '/[\\x{1F1E6}-\\x{1F1FF}]/u',
                        '/[\\x{1F300}-\\x{1FAFF}]/u',
                        '/[\\x{2600}-\\x{27BF}]/u',
                        '/[\\x{FE0F}\\x{200D}]/u',
                    ], '', (string) $piece) ?? $piece;
                    $clean = trim(preg_replace('/\\s{2,}/u', ' ', $clean));
                    if ($clean !== '') $originSet[strtolower($clean)] = true;
                }
            }
        }
    }
    $totalOrigins = count($originSet);

    /* ───────────────────────────────────────────────────────────────────────────
     *  COLOUR PALETTES
     * ─────────────────────────────────────────────────────────────────────── */
    $originColors = [
        'australia'      => '#16A34A', // green
        'united states'  => '#2563EB', // blue
        'usa'            => '#2563EB',
        'united kingdom' => '#EA580C', // orange
        'uk'             => '#EA580C',
        'cambodia'       => '#DC2626', // red
        'thailand'       => '#9333EA', // purple
        'vietnam'        => '#0891B2', // teal
        'china'          => '#D946EF', // magenta
        'japan'          => '#0D9488', // emerald-teal
        'korea'          => '#7C3AED',
        'south korea'    => '#7C3AED',
    ];

    /**
     * Country name → ISO-3166 alpha-2 code. Used to render real flag PNGs via
     * flagcdn.com (rock-solid for DomPDF; SVGs with gradients can fail in DomPDF).
     * Falls back to a colour dot when the country isn't in this table.
     */
    $countryToIso = [
        'australia' => 'au',
        'united states' => 'us', 'usa' => 'us', 'us' => 'us',
        'united kingdom' => 'gb', 'uk' => 'gb', 'great britain' => 'gb', 'england' => 'gb',
        'cambodia' => 'kh', 'khmer' => 'kh',
        'thailand' => 'th',
        'vietnam' => 'vn', 'viet nam' => 'vn',
        'china' => 'cn',
        'japan' => 'jp',
        'korea' => 'kr', 'south korea' => 'kr',
        'india' => 'in',
        'indonesia' => 'id',
        'malaysia' => 'my',
        'singapore' => 'sg',
        'philippines' => 'ph',
        'taiwan' => 'tw',
        'hong kong' => 'hk',
        'canada' => 'ca',
        'mexico' => 'mx',
        'brazil' => 'br',
        'germany' => 'de',
        'france' => 'fr',
        'italy' => 'it',
        'spain' => 'es',
        'netherlands' => 'nl',
        'turkey' => 'tr',
        'russia' => 'ru',
        'bangladesh' => 'bd',
        'pakistan' => 'pk',
        'new zealand' => 'nz',
    ];

    $categoryStyles = [
        'men'           => ['bg' => '#DBEAFE', 'fg' => '#1D4ED8'], // blue
        'men-clothes'   => ['bg' => '#DCFCE7', 'fg' => '#15803D'], // green
        'men clothes'   => ['bg' => '#DCFCE7', 'fg' => '#15803D'],
        'women'         => ['bg' => '#FCE7F3', 'fg' => '#BE185D'],
        'women-clothes' => ['bg' => '#FAE8FF', 'fg' => '#86198F'],
        'kids'          => ['bg' => '#FEF3C7', 'fg' => '#B45309'],
        'accessories'   => ['bg' => '#E0E7FF', 'fg' => '#4338CA'],
    ];

    /**
     * Strip characters DomPDF cannot render (flag emojis, misc emoji) so:
     *   1. The text doesn't become "□□□□"
     *   2. The colour lookup keys match (`australia` not `🇦🇺 australia`)
     * The brand uses the coloured dot itself as the visual country marker.
     */
    $stripEmoji = static function (string $v): string {
        // Regional Indicator Symbols (flag pairs) + common emoji blocks.
        $patterns = [
            '/[\x{1F1E6}-\x{1F1FF}]/u',   // 🇦-🇿 (flag halves)
            '/[\x{1F300}-\x{1FAFF}]/u',   // misc symbols & pictographs / emoticons
            '/[\x{2600}-\x{27BF}]/u',     // misc symbols + dingbats
            '/[\x{FE0F}\x{200D}]/u',      // variation selectors / ZWJ
        ];
        $v = preg_replace($patterns, '', $v) ?? $v;
        // Collapse double spaces left over after stripping the flag + its space.
        return trim(preg_replace('/\\s{2,}/u', ' ', $v));
    };

    $renderOriginCell = static function (string $value) use ($originColors, $countryToIso, $stripEmoji): string {
        $value = trim($value);
        if ($value === '' || $value === '-') return '<span style="color:#94A3B8">—</span>';
        $parts = preg_split('/[,;|]+/', $value);
        $out = [];
        foreach ($parts as $p) {
            $p = $stripEmoji((string) $p);
            if ($p === '') continue;
            $key = strtolower($p);
            $iso = $countryToIso[$key] ?? null;
            if ($iso !== null) {
                // 24×18 px PNG fetched once per PDF; DomPDF caches it during render.
                $flag = '<img class="origin-flag" src="https://flagcdn.com/24x18/'.$iso.'.png" alt="">';
                $out[] = '<span class="origin-pill">'.$flag.'<span class="origin-name">'.e($p).'</span></span>';
            } else {
                $colour = $originColors[$key] ?? '#64748B';
                $out[] = '<span class="origin-pill"><span class="origin-dot" style="background:'.$colour.'"></span>'.e($p).'</span>';
            }
        }
        return implode('<br>', $out);
    };

    $renderCategoryCell = static function (string $value) use ($categoryStyles): string {
        $value = trim($value);
        if ($value === '' || $value === '-') return '<span style="color:#94A3B8">—</span>';
        $key = strtolower($value);
        $style = $categoryStyles[$key] ?? ['bg' => '#E2E8F0', 'fg' => '#334155'];
        return '<span class="badge" style="background:'.$style['bg'].';color:'.$style['fg'].'">'.e($value).'</span>';
    };

    $renderStockCell = static function (string $value): string {
        $value = trim($value);
        $lower = strtolower($value);
        if ($value === '' || $value === '-') return '<span style="color:#94A3B8">—</span>';
        if ($lower === 'untracked')  return '<span class="pill pill-gray">Untracked</span>';
        if ($lower === 'out of stock') return '<span class="pill pill-red">Out of stock</span>';
        if ($lower === 'low stock') return '<span class="pill pill-amber">Low Stock</span>';
        if (preg_match('/^(-?\\d[\\d,]*)\\s*units?$/i', $value, $m)) {
            return '<span class="pill pill-green">'.e($m[1]).' units</span>';
        }
        return e($value);
    };

    $renderStatusCell = static function (string $value): string {
        $value = trim($value);
        if ($value === '' || $value === '-') return '<span style="color:#94A3B8">—</span>';
        $key = strtolower($value);
        $dot = '#64748B';
        if (str_contains($key, 'new'))     $dot = '#16A34A';
        elseif (str_contains($key, 'low')) $dot = '#F59E0B';
        elseif (str_contains($key, 'old') || str_contains($key, 'aged')) $dot = '#DC2626';
        elseif (str_contains($key, 'pending')) $dot = '#0891B2';
        elseif (str_contains($key, 'received')) $dot = '#16A34A';
        return '<span class="status-cell"><span class="status-dot" style="background:'.$dot.'"></span>'.e($value).'</span>';
    };

    $isNumericLikeColumn = static function (int $idx) use ($colTotalPrice, $colUnitPrice): bool {
        return $idx === $colTotalPrice || $idx === $colUnitPrice;
    };

    /* ───────────────────────────────────────────────────────────────────────────
     *  BRAND
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

    /* Fontsource CDN serves TTF (DomPDF reads TTF over HTTPS when isRemoteEnabled=true). */
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
    <title>{{ $title }}</title>
    <style>
        @font-face { font-family: 'Syne'; font-weight: 700; font-style: normal; src: url("{{ $synFont }}") format("truetype"); }
        @font-face { font-family: 'Syne'; font-weight: 800; font-style: normal; src: url("{{ $synFontBlack }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 400; font-style: normal; src: url("{{ $dmSans400 }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 500; font-style: normal; src: url("{{ $dmSans500 }}") format("truetype"); }
        @font-face { font-family: 'DM Sans'; font-weight: 700; font-style: normal; src: url("{{ $dmSans700 }}") format("truetype"); }

        /* Full-bleed page: 0 margin so the header touches the paper edge.
         * The .content wrapper restores normal inner padding for everything else. */
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

        /* ── Cell chrome ───────────────────────────────────────────────────── */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.4px;
            white-space: nowrap;
        }
        .pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.2px;
            white-space: nowrap;
        }
        .pill-green { background: #DCFCE7; color: #166534; }
        .pill-amber { background: #FEF3C7; color: #B45309; }
        .pill-red   { background: #FEE2E2; color: #B91C1C; }
        .pill-gray  { background: #E2E8F0; color: #475569; }
        .origin-pill {
            display: inline-block;
            padding: 1px 0;
            font-size: 9.5px;
            font-weight: 500;
            color: {{ $textPrimary }};
            white-space: nowrap;
        }
        .origin-dot {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 999px;
            margin-right: 5px;
        }
        .origin-flag {
            display: inline-block;
            width: 16px;
            height: 12px;
            margin-right: 6px;
            vertical-align: middle;
            border: 1px solid #E5E9F0;
        }
        .origin-name { vertical-align: middle; }
        .status-cell {
            font-size: 9.5px;
            font-weight: 600;
            color: {{ $textPrimary }};
            white-space: nowrap;
        }
        .status-dot {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 999px;
            margin-right: 5px;
        }

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
                    @if (!empty($subtitle))
                        <p class="doc-subtitle-h">{{ $subtitle }}</p>
                    @endif
                </td>
                <td class="right-cell">
                    <span class="pill-doc">{{ strtoupper(str_contains(strtolower($title), 'received') ? 'Stock Received' : (str_contains(strtolower($title), 'inventory') ? 'Inventory Report' : 'Report')) }}</span>
                    <div class="gen-line">Generated {{ $generatedAt }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="content">
    <table class="metrics">
        <tr>
            <td>
                <div class="metric-card accent-blue">
                    <p class="metric-label">Total Items</p>
                    <p class="metric-value">{{ number_format($totalItems) }}</p>
                    <p class="metric-hint">products in this report</p>
                </div>
            </td>
            <td>
                <div class="metric-card accent-green">
                    <p class="metric-label">Total Stock</p>
                    <p class="metric-value">{{ number_format($totalStock) }}</p>
                    <p class="metric-hint">units across all items</p>
                </div>
            </td>
            <td>
                <div class="metric-card accent-amber">
                    <p class="metric-label">Total Value</p>
                    <p class="metric-value">${{ number_format($totalValue, 2) }}</p>
                    <p class="metric-hint">sum of total prices</p>
                </div>
            </td>
            <td>
                <div class="metric-card accent-purple">
                    <p class="metric-label">Origins</p>
                    <p class="metric-value">{{ number_format($totalOrigins) }}</p>
                    <p class="metric-hint">unique countries / regions</p>
                </div>
            </td>
        </tr>
    </table>

    <table class="report">
        <thead>
            <tr>
                @foreach ($headers as $idx => $header)
                    <th class="{{ $isNumericLikeColumn($idx) ? 'num' : '' }}">{{ $header }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($row as $idx => $cellValue)
                        @php $value = (string) $cellValue; @endphp
                        <td class="{{ $isNumericLikeColumn($idx) ? 'num' : '' }}">
                            @if ($idx === $colCategory)
                                {!! $renderCategoryCell($value) !!}
                            @elseif ($idx === $colOrigin)
                                {!! $renderOriginCell($value) !!}
                            @elseif ($idx === $colStock)
                                {!! $renderStockCell($value) !!}
                            @elseif ($idx === $colStatus)
                                {!! $renderStatusCell($value) !!}
                            @else
                                {{ $value === '' ? '—' : $value }}
                            @endif
                        </td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td class="empty" colspan="{{ max(count($headers), 1) }}">No data to display</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footnote">
        <span class="brand">{{ $brandName }}</span>
        &nbsp;·&nbsp; Confidential internal document &nbsp;·&nbsp;
        Generated on {{ $generatedAt }}
    </div>
    </div>
</body>
</html>
