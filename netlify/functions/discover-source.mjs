import dns from 'node:dns/promises';

// Checks whether an IP address is in a loopback, private, or cloud metadata range
function isPrivateIp(ip) {
  if (!ip) return true;
  // IPv4 validation
  if (ip.includes('.')) {
    const parts = ip.split('.').map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    if (parts[0] === 127) return true; // Loopback 127.0.0.0/8
    if (parts[0] === 10) return true;  // Private 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // Private 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // Private 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true; // Link-local / AWS metadata 169.254.0.0/16
    if (parts[0] === 0 || parts[0] >= 224) return true;    // Current / Multicast / Reserved
  }
  // IPv6 validation
  if (ip.includes(':')) {
    const clean = ip.toLowerCase().trim();
    if (clean === '::1' || clean === '::') return true;
    if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80')) return true;
    if (clean.includes(':ffff:')) {
      const v4 = clean.split(':ffff:')[1];
      if (v4 && isPrivateIp(v4)) return true;
    }
  }
  return false;
}

// Validates URL scheme and resolves DNS hostnames to verify absence of private IPs
async function validateUrlDns(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Malformed URL provided.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid protocol: ${parsed.protocol}. Only http: and https: are permitted.`);
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    throw new Error('Destination blocked by SSRF defense.');
  }

  // Pre-resolve hostname via DNS and check every returned IP address
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses || addresses.length === 0) {
    throw new Error(`DNS resolution failed for host: ${host}`);
  }

  for (const record of addresses) {
    if (isPrivateIp(record.address)) {
      throw new Error(`SSRF Blocked: ${host} resolved to internal/private IP ${record.address}`);
    }
  }

  return { parsed, host, ip: addresses[0].address };
}

// Netlify Serverless Function: Autonomous Source Discovery
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1. Authorization Verification (Strict Admin Role Required)
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!token) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'unauthorized',
      message: 'Missing authorization token.'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'server_configuration_error',
      message: 'Supabase credentials are not configured on server environment.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey
      }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({
        ok: false,
        status: 'unauthorized',
        message: 'Invalid or expired administrator session.'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = await userRes.json().catch(() => ({}));
    const isAdmin =
      userData.email === 'admin@hornyleaks.site' ||
      userData.app_metadata?.role === 'admin';

    if (!isAdmin) {
      return new Response(JSON.stringify({
        ok: false,
        status: 'forbidden',
        message: 'Administrator privileges required for crawler source discovery.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return new Response(JSON.stringify({
      ok: false,
      status: 'unauthorized',
      message: 'Authentication verification service error.'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Parse Target URL
  let targetUrl = '';
  try {
    const body = await req.json();
    targetUrl = body.targetUrl || '';
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: 'Invalid JSON request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!targetUrl || !targetUrl.trim()) {
    return new Response(JSON.stringify({ ok: false, message: 'Target URL is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let url = targetUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // 3. SSRF Defense: Validate URL and Resolve DNS
  try {
    await validateUrlDns(url);
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'ssrf_blocked',
      message: err.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 4. Probe Destination with Manual Redirect Validation (Max 3 Hops)
  let currentUrl = url;
  let res = null;
  let redirectCount = 0;
  const maxRedirects = 3;

  try {
    while (redirectCount <= maxRedirects) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeout);

      // Handle HTTP redirects: Validate target IP address before following hop
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).href;
        await validateUrlDns(nextUrl);
        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      break;
    }
  } catch (probeErr) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'probe_error',
      message: probeErr.message || 'Failed connecting to target destination.'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {

    // Check Cloudflare / Bot Protection
    const cfMitigated = res.headers.get('cf-mitigated') || '';
    if (cfMitigated.toLowerCase().includes('challenge') || res.status === 403 || res.status === 503) {
      const textSample = await res.text().catch(() => '');
      if (textSample.includes('cf-browser-verification') || textSample.includes('challenge-platform') || textSample.includes('Turnstile')) {
        return new Response(JSON.stringify({
          ok: false,
          status: 'blocked_challenge',
          message: 'Website is protected by Cloudflare bot protection / Turnstile challenge.'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const contentType = res.headers.get('content-type') || '';
    const textData = await res.text();

    // Check JSON API
    if (contentType.includes('application/json') || (textData.startsWith('{') && textData.endsWith('}'))) {
      try {
        const json = JSON.parse(textData);
        return new Response(JSON.stringify({
          ok: true,
          detectedType: 'json_api',
          recommendedUrl: url,
          confidence: 'high',
          details: { message: 'Direct JSON video API detected.' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {}
    }

    // Check XML / MRSS Feed
    if (contentType.includes('xml') || textData.includes('<rss') || textData.includes('<feed')) {
      return new Response(JSON.stringify({
        ok: true,
        detectedType: 'mrss_feed',
        recommendedUrl: url,
        confidence: 'high',
        details: { message: 'MRSS video feed detected.' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check Dedicated HornyLeak
    if (url.includes('hornyleak') || textData.includes('hornyleak.tv/embed')) {
      return new Response(JSON.stringify({
        ok: true,
        detectedType: 'hornyleak',
        recommendedUrl: url,
        confidence: 'high',
        details: { message: 'Matched dedicated HornyLeak video platform.' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check Linked Feed in HTML head
    const feedMatch = textData.match(/<link[^>]+(?:type=["']application\/(?:rss\+xml|atom\+xml)["'])[^>]+href=["']([^"']+)["']/i);
    if (feedMatch && feedMatch[1]) {
      const feedUrl = new URL(feedMatch[1], url).href;
      return new Response(JSON.stringify({
        ok: true,
        detectedType: 'mrss_feed',
        recommendedUrl: feedUrl,
        confidence: 'high',
        details: { message: `Discovered linked feed at ${feedUrl}` }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check Common Video HTML Card patterns
    if (textData.includes('class="video') || textData.includes('thumb') || textData.includes('/embed/')) {
      return new Response(JSON.stringify({
        ok: true,
        detectedType: 'html_scrape',
        recommendedUrl: url,
        confidence: 'medium',
        details: { message: 'HTML video catalog cards detected.' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ok: false,
      status: 'unsupported',
      message: 'Could not automatically identify standard video catalog cards or feeds. Please specify source type manually.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'error',
      message: err.message || 'Error occurred while probing destination.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
