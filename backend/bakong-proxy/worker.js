/**
 * Cloudflare Worker — Bakong NBC MD5 check proxy (Cambodia edge egress).
 *
 * Drop-in replacement for index.php. Works with Laravel BakongApi via:
 *   BAKONG_PROXY_URL=https://bakong-proxy.<account>.workers.dev
 *   BAKONG_PROXY_SECRET=<optional shared secret>
 *
 * Cloudflare dashboard → Worker → Settings → Variables:
 *   BAKONG_TOKEN          (Secret) — same JWT as Render
 *   BAKONG_PROXY_SECRET   (Secret, optional) — must match Render if set
 *   BAKONG_BASE_URL       (Text, optional) — default https://api-bakong.nbc.gov.kh
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (request.method !== 'POST') {
      return json(405, { message: 'Method not allowed' });
    }

    const proxySecret = (env.BAKONG_PROXY_SECRET || '').trim();
    if (proxySecret !== '') {
      const provided = request.headers.get('X-Bakong-Proxy-Secret') || '';
      if (provided !== proxySecret) {
        return json(401, { message: 'Unauthorized' });
      }
    }

    const token = (env.BAKONG_TOKEN || '').trim();
    if (token === '') {
      return json(500, { message: 'BAKONG_TOKEN not configured on worker' });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { message: 'Invalid JSON body' });
    }

    const md5 = String(payload?.md5 || '')
      .trim()
      .toLowerCase();
    if (md5 === '') {
      return json(422, { message: 'md5 is required' });
    }

    const baseUrl = (env.BAKONG_BASE_URL || 'https://api-bakong.nbc.gov.kh').replace(/\/$/, '');
    const targetUrl = `${baseUrl}/v1/check_transaction_by_md5`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ md5 }),
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: JSON_HEADERS,
      });
    } catch (error) {
      return json(502, {
        message: 'Proxy fetch failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}
