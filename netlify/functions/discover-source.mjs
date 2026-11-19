// Netlify Serverless Function: Autonomous Source Discovery
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1. Authorization Verification
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

  if (supabaseUrl && supabaseKey) {
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
    } catch (err) {
      console.error('[AUTH ERROR]', err);
    }
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

  // 3. SSRF Defense: Disallow localhost & private IP spaces
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host === '169.254.169.254' ||
      host === '::1'
    ) {
      return new Response(JSON.stringify({
        ok: false,
        status: 'ssrf_blocked',
        message: 'Destination blocked by SSRF defense.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, message: 'Malformed URL provided.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 4. Probe Destination
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

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
