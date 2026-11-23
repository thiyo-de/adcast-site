// Netlify Serverless Function: Dynamic Stream Resolver
// Extracts live, unexpired video stream URLs from hosting pages (e.g. Onestream)
export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const urlObj = new URL(req.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing target URL parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://play.onestream.today/'
      }
    });

    if (!pageRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Failed to fetch page: ${pageRes.status}` }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const html = await pageRes.text();
    const match = html.match(/<source[^>]+src=["']([^"']+)["']/i) ||
                  html.match(/src=["'](https?:\/\/[^"']+\/(?:download|open)\.php\?[^"']+)["']/i);

    if (match && match[1]) {
      return new Response(JSON.stringify({ ok: true, streamUrl: match[1] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=1800'
        }
      });
    }

    return new Response(JSON.stringify({ ok: false, error: 'No video stream tag found in page' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || 'Stream resolution failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
