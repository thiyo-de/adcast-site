import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'resolve-stream-dev',
      configureServer(server) {
        server.middlewares.use('/api/resolve-stream', async (req, res) => {
          const urlObj = new URL(req.url, 'http://localhost');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Missing target URL' }));
            return;
          }
          try {
            const pageRes = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://play.onestream.today/'
              }
            });
            const html = await pageRes.text();
            const match = html.match(/<source[^>]+src=["']([^"']+)["']/i) ||
                          html.match(/src=["'](https?:\/\/[^"']+\/(?:download|open)\.php\?[^"']+)["']/i);
            res.setHeader('Content-Type', 'application/json');
            if (match && match[1]) {
              res.end(JSON.stringify({ ok: true, streamUrl: match[1] }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ ok: false, error: 'Stream not found' }));
            }
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      }
    }
  ],
  server: {
    port: 3000,
    open: true
  }
});
