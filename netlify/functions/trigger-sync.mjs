// Netlify Serverless Function: Trigger GitHub Actions crawler auto-sync
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

  // 2. Check for GitHub PAT in server environment
  const githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!githubToken) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'unconfigured',
      message: 'GITHUB_TOKEN is not configured on Netlify. Trigger the workflow manually from GitHub Actions or set GITHUB_TOKEN.'
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. Dispatch GitHub Actions workflow
  try {
    const ghRes = await fetch('https://api.github.com/repos/thiyo-de/adcast-site/actions/workflows/auto-sync.yml/dispatches', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'AdCast-Admin-Sync-Dispatcher'
      },
      body: JSON.stringify({
        ref: 'main'
      })
    });

    if (ghRes.status === 204 || ghRes.ok) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'dispatched',
        jobId: `gha-${Date.now()}`,
        message: 'GitHub Actions workflow auto-sync.yml dispatched successfully.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ghData = await ghRes.json().catch(() => ({}));
    return new Response(JSON.stringify({
      ok: false,
      status: 'error',
      message: ghData.message || `GitHub API returned ${ghRes.status}`
    }), {
      status: ghRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      status: 'error',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
