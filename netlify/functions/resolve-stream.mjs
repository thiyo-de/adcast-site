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
    // 1. MyDesi blog URL resolver
    if (targetUrl.includes('mydesi.fun')) {
      const MYDESI_STREAM_MAP = {
        'horny-gf-eye-rolling-orgasm-fuck-update': 'https://vidserv.cc/sdfsd.mp4',
        'sexy-desi-babe-hard-fucking-collection': 'https://vidserv.cc/sdxasD.mp4',
        'hot-air-hostress-hard-fucking-with-lover': 'https://vidserv.cc/3WWLsfAs-asdxas.mp4',
        'sexy-hot-dusky-babe-fucking-collection-40-videos': 'https://vidserv.cc/sadsdx.mp4',
        'desi-guy-smashing-multiple-cheater-wifes': 'https://vidserv.cc/dxazsd.mp4',
        'beautiful-sexy-gf-bj-anal-play-hard-fuck-taking-cum-on-boobs': 'https://vidserv.cc/fcszdf.mp4',
        'sexy-hot-gf-blowjob-riding-hard-fuck-collection': 'https://vidserv.cc/dazscsd.mp4',
        'horny-babe-blowjob-hard-fucking-with-lover': 'https://vidserv.cc/sdazsd.mp4',
        'cute-bigboob-gf-blowjob-hard-fuck-riding': 'https://vidserv.cc/SDSAD.mp4',
        'milf-bhabhi-hard-fucking-full-video': 'https://vidserv.cc/scszdvc.mp4',
        'sexy-babe-hard-vacation-fuck-6-videos-collaction': 'https://vidserv.cc/aDASZ.mp4',
        'hot-babe-sexy-big-ass-fucking-update': 'https://vidserv.cc/dasdasd.mp4',
        'horny-gf-blowjob-passionately-riding': 'https://vidserv.cc/csdcxazs.mp4',
        'horny-big-boobs-babe-hard-fucking': 'https://vidserv.cc/cxdcwqd.mp4',
        'busty-wife-hard-fucking-riding-on-husband': 'https://vidserv.cc/sdfcsd.mp4',
        'submissive-horny-desi-babe-bdsm-fucking-20clips': 'https://vidserv.cc/sADSXDSA.mp4',
        'sexy-babe-teasing-fingering-hard-fucking-collection': 'https://vidserv.cc/ADXSS.mp4',
        'horny-hot-figure-gf-riding-moaning': 'https://vidserv.cc/adxasfc.mp4',
        'beautiful-babe-getting-threesome-fucked-update': 'https://vidserv.cc/adsczc.mp4',
        'busty-base-showing-hot-figure-pussy-fucking-collection': 'https://vidserv.cc/fzsdfd.mp4',
        'horny-freaky-gf-hard-fucking-collection-2': 'https://vidserv.cc/sadsdx.mp4',
        'sexy-hot-baddie-fucking-with-bf-2': 'https://vidserv.cc/aDASZ.mp4',
        'cute-horny-gf-fucking-cum-shower-collection-3': 'https://vidserv.cc/SDSAD.mp4'
      };
      const slugMatch = targetUrl.match(/mydesi\.fun\/([^\/\?#]+)/);
      const slug = slugMatch ? slugMatch[1] : '';
      if (slug && MYDESI_STREAM_MAP[slug]) {
        return new Response(JSON.stringify({ ok: true, streamUrl: MYDESI_STREAM_MAP[slug] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
    }

    // 2. HornyLeak embed resolver (extracts pure inner hdplayer without wrapper/scrollbar)
    if (targetUrl.includes('hornyleak.tv/embed/')) {
      try {
        const pageRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
          if (iframeMatch && iframeMatch[1]) {
            return new Response(JSON.stringify({ ok: true, embedUrl: iframeMatch[1] }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          }
        }
      } catch (err) {
        console.warn('HornyLeak resolver error:', err);
      }
      return new Response(JSON.stringify({ ok: true, embedUrl: targetUrl }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 3. Onestream / Fastbytes dynamic stream resolver
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
          'Cache-Control': 'no-cache, no-store, must-revalidate'
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
