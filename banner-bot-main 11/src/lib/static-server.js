/**
 * Public static asset server.
 *
 * Slack `image` blocks need a public HTTPS URL. Since this app runs in
 * Socket Mode (no HTTP listener for Slack itself), we run a small HTTP
 * server in parallel that exposes:
 *
 *   GET /previews/template-N.png   → docs/previews/*.png
 *   GET /logos/<filename>.png      → output/logo-previews/*.png  (lazy-rasterized)
 *   GET /healthz                   → 200 OK   (Railway/uptime checks)
 *
 * The public origin is taken from PUBLIC_BASE_URL, falling back to
 * RAILWAY_PUBLIC_DOMAIN (provided automatically by Railway).
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { getLogoPreviewPath } = require('./logo-previews');

const PREVIEWS_DIR = path.resolve(__dirname, '../../docs/previews');
const LOGOS_DIR = path.resolve(__dirname, '../../assets/logos');

function publicBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return null;
}

function templatePreviewUrl(num) {
  const base = publicBaseUrl();
  if (!base) return null;
  return `${base}/previews/template-${num}.png`;
}

function logoPreviewUrl(logoFilename) {
  const base = publicBaseUrl();
  if (!base) return null;
  // Strip extension; the server always serves PNG.
  const stem = logoFilename.replace(/\.[^.]+$/, '');
  return `${base}/logos/${encodeURIComponent(stem)}.png`;
}

function send404(res) {
  res.statusCode = 404;
  res.end('Not Found');
}

function streamFile(res, filepath, contentType = 'image/png') {
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  // Aggressive caching: previews are content-addressed by filename.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(filepath).pipe(res);
}

async function handleRequest(req, res) {
  // Strip query string.
  const url = (req.url || '/').split('?')[0];

  if (url === '/healthz' || url === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
    return;
  }

  // Template preview: /previews/template-N.png
  if (url.startsWith('/previews/')) {
    const file = url.slice('/previews/'.length);
    if (!/^template-\d+\.png$/.test(file)) return send404(res);
    const filepath = path.join(PREVIEWS_DIR, file);
    if (!fs.existsSync(filepath)) return send404(res);
    return streamFile(res, filepath);
  }

  // Logo preview: /logos/<stem>.png  →  rasterize from assets/logos/<stem>.<ext>
  if (url.startsWith('/logos/')) {
    const file = decodeURIComponent(url.slice('/logos/'.length));
    if (!/^[A-Za-z0-9._-]+\.png$/.test(file)) return send404(res);
    const stem = file.replace(/\.png$/, '');
    // Find the source file with any supported extension.
    let sourceFile = null;
    try {
      const entries = fs.readdirSync(LOGOS_DIR);
      sourceFile = entries.find(f => f.replace(/\.[^.]+$/, '') === stem);
    } catch (_) {
      return send404(res);
    }
    if (!sourceFile) return send404(res);
    try {
      const previewPath = await getLogoPreviewPath(sourceFile);
      return streamFile(res, previewPath);
    } catch (err) {
      console.error('[static-server] logo preview failed:', err.message);
      return send404(res);
    }
  }

  send404(res);
}

function startStaticServer() {
  const port = parseInt(process.env.PORT, 10) || 3000;
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(err => {
      console.error('[static-server] handler error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Server Error');
      }
    });
  });
  server.listen(port, () => {
    const base = publicBaseUrl();
    console.log(`[static-server] listening on :${port}`);
    if (base) {
      console.log(`[static-server] public base URL: ${base}`);
    } else {
      console.warn('[static-server] PUBLIC_BASE_URL is not set — Slack image blocks will not render.');
    }
  });
  return server;
}

module.exports = {
  startStaticServer,
  publicBaseUrl,
  templatePreviewUrl,
  logoPreviewUrl,
};
