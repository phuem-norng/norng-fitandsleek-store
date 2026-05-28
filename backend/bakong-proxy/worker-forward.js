/**
 * Cloudflare Worker — generic path relay to Bakong NBC (Cambodia edge egress).
 *
 * Render POSTs to /v1/check_transaction_by_md5 with Authorization header;
 * this worker forwards the path + headers + body to api-bakong.nbc.gov.kh.
 *
 * No Worker secrets required — BAKONG_TOKEN stays on Render only.
 *
 * Render env:
 *   BAKONG_PROXY_URL=https://aged-hill-ac57.teamvcnh.workers.dev
 *   BAKONG_PROXY_STYLE=forward   (default)
 */

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Secret',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = 'https://api-bakong.nbc.gov.kh' + url.pathname + url.search;

    try {
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
      });

      const response = await fetch(modifiedRequest);

      const responseHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach((key) => responseHeaders.set(key, corsHeaders[key]));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
