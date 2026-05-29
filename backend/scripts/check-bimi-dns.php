#!/usr/bin/env php
<?php

/**
 * Check DMARC + BIMI DNS for Gmail sender avatar (circle next to sender name).
 *
 * Usage: php scripts/check-bimi-dns.php [domain]
 * Example: php scripts/check-bimi-dns.php phuemnorng-kalapakteam.space
 */

$domain = $argv[1] ?? getenv('MAIL_FROM_DOMAIN') ?: 'phuemnorng-kalapakteam.space';
$domain = strtolower(trim($domain, " \t\n\r\0\x0B."));

echo "Checking sender avatar DNS for: {$domain}\n\n";

$dmarcHost = "_dmarc.{$domain}";
$dmarcRecords = @dns_get_record($dmarcHost, DNS_TXT) ?: [];
$dmarcFound = false;
$dmarcPolicy = null;

foreach ($dmarcRecords as $record) {
    $txt = $record['txt'] ?? '';
    if (! str_starts_with($txt, 'v=DMARC1')) {
        continue;
    }
    $dmarcFound = true;
    if (preg_match('/;\s*p=([^;]+)/', $txt, $m)) {
        $dmarcPolicy = strtolower(trim($m[1]));
    }
    echo "DMARC ({$dmarcHost}):\n  {$txt}\n";
}

if (! $dmarcFound) {
    echo "DMARC ({$dmarcHost}): MISSING\n";
    echo "  Add TXT: v=DMARC1; p=quarantine; pct=100; rua=mailto:teamkalapak@gmail.com\n";
}

$bimiHost = "default._bimi.{$domain}";
$bimiRecords = @dns_get_record($bimiHost, DNS_TXT) ?: [];
$bimiFound = false;
$logoUrl = null;

foreach ($bimiRecords as $record) {
    $txt = $record['txt'] ?? '';
    if (! str_starts_with($txt, 'v=BIMI1')) {
        continue;
    }
    $bimiFound = true;
    if (preg_match('/;\s*l=([^;]+)/', $txt, $m)) {
        $logoUrl = trim($m[1]);
    }
    echo "\nBIMI ({$bimiHost}):\n  {$txt}\n";
}

if (! $bimiFound) {
    echo "\nBIMI ({$bimiHost}): MISSING\n";
    echo "  Host logo.svg on https://{$domain}/bimi/logo.svg (or R2 custom domain on this domain)\n";
    echo "  Add TXT: v=BIMI1; l=https://{$domain}/bimi/logo.svg;\n";
}

if ($logoUrl) {
    echo "\nLogo URL check: {$logoUrl}\n";
    $context = stream_context_create(['http' => ['timeout' => 10, 'follow_location' => 1]]);
    $body = @file_get_contents($logoUrl, false, $context);
    if ($body === false) {
        echo "  FAIL — logo URL is not reachable over HTTPS\n";
    } else {
        $size = strlen($body);
        echo "  OK — fetched {$size} bytes\n";
        if ($size > 32768) {
            echo "  WARN — BIMI SVG should stay under 32 KB\n";
        }
    }
}

echo "\nGmail sender avatar requirements:\n";
echo "  1. DMARC policy p=quarantine or p=reject (not p=none)\n";
echo "  2. BIMI TXT record with HTTPS logo on the same domain\n";
echo "  3. CMC or VMC certificate linked in BIMI (required for Gmail)\n";
echo "  4. SPF + DKIM already verified in Resend\n";

$senderLogo = readEnvValue('APP_MAIL_SENDER_LOGO_URL');
if ($senderLogo !== '') {
    echo "\nConfigured sender logo (APP_MAIL_SENDER_LOGO_URL):\n  {$senderLogo}\n";
    echo "  Convert this circular PNG to SVG and host on https://{$domain}/bimi/logo.svg\n";
}

echo "\nLogo file in repo: backend/public/bimi/logo.svg\n";
echo "Resend guide: https://resend.com/docs/dashboard/domains/bimi\n";

$ok = $dmarcFound && in_array($dmarcPolicy, ['quarantine', 'reject'], true) && $bimiFound;
exit($ok ? 0 : 1);

function readEnvValue(string $key): string
{
    $envFile = dirname(__DIR__).'/.env';
    if (! is_readable($envFile)) {
        return '';
    }
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (preg_match('/^'.preg_quote($key, '/').'=(.*)$/', $line, $m)) {
            return trim($m[1], " \t\"'");
        }
    }

    return '';
}
