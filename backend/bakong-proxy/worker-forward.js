/**
 * Cloudflare Worker — path relay to Bakong NBC (Cambodia edge egress).
 *
 * IMPORTANT: Do NOT forward the incoming Host header — CloudFront returns 403 if
 * Host is *.workers.dev instead of api-bakong.nbc.gov.kh.
 *
 * Render env:
 *   BAKONG_PROXY_URL=https://aged-hill-ac57.teamvcnh.workers.dev
 *   BAKONG_PROXY_STYLE=forward
 */

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = 'https://api-bakong.nbc.gov.kh' + url.pathname + url.search;

    const outHeaders = new Headers();
    for (const name of ['authorization', 'content-type', 'accept']) {
      const value = request.headers.get(name);
      if (value) {
        outHeaders.set(name, value);
      }
    }

    try {
      const body =
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined;

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: outHeaders,
        body,
      });

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
