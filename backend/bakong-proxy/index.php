<?php
/**
 * Minimal Bakong NBC API proxy — deploy on a Cambodia-hosted server/VPS.
 *
 * NBC blocks check_transaction_by_md5 from outside Cambodia (errorCode 15 on Render/US hosts).
 * Point Render BAKONG_PROXY_URL to this script, e.g.:
 *   BAKONG_PROXY_URL=https://your-cambodia-host.example.com/bakong-proxy
 *
 * Required env on the Cambodia host:
 *   BAKONG_TOKEN=your_nbc_api_token
 * Optional:
 *   BAKONG_PROXY_SECRET=shared_secret   (must match Render BAKONG_PROXY_SECRET)
 *   BAKONG_BASE_URL=https://api-bakong.nbc.gov.kh
 */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}

$secret = getenv('BAKONG_PROXY_SECRET') ?: '';
if ($secret !== '') {
    $provided = $_SERVER['HTTP_X_BAKONG_PROXY_SECRET'] ?? '';
    if (! hash_equals($secret, (string) $provided)) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        exit;
    }
}

$token = getenv('BAKONG_TOKEN') ?: '';
if ($token === '') {
    http_response_code(500);
    echo json_encode(['message' => 'BAKONG_TOKEN not configured on proxy host']);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (! is_array($payload)) {
    http_response_code(400);
    echo json_encode(['message' => 'Invalid JSON body']);
    exit;
}

$md5 = strtolower(trim((string) ($payload['md5'] ?? '')));
if ($md5 === '') {
    http_response_code(422);
    echo json_encode(['message' => 'md5 is required']);
    exit;
}

$baseUrl = rtrim(getenv('BAKONG_BASE_URL') ?: 'https://api-bakong.nbc.gov.kh', '/');
$url = $baseUrl . '/v1/check_transaction_by_md5';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 25,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['md5' => $md5], JSON_UNESCAPED_UNICODE),
]);

$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($body === false) {
    http_response_code(502);
    echo json_encode(['message' => 'Proxy curl failed', 'error' => $error]);
    exit;
}

http_response_code($status > 0 ? $status : 502);
echo $body;
