/**
 * Logo preview utility.
 *
 * Slack image blocks accept only PNG/JPG/GIF — not SVG. Most of our partner
 * logos are SVG, so we lazily rasterize them to PNG previews on first request
 * and cache results on disk.
 *
 * Output thumbnails are 480x240 with white background (white reads well in
 * both light & dark Slack themes; partner logos are dark-on-transparent).
 */
const path = require('path');
const fs = require('fs');
const { getBrowser } = require('../renderer');

const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const LOGOS_DIR = path.join(ASSETS_DIR, 'logos');
const CACHE_DIR = path.resolve(__dirname, '../../output/logo-previews');

const PREVIEW_W = 480;
const PREVIEW_H = 240;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function previewPathFor(logoFilename) {
  const base = logoFilename.replace(/\.[^.]+$/, '');
  return path.join(CACHE_DIR, `${base}.png`);
}

/**
 * Returns the absolute path of a PNG preview for a logo file (creating &
 * caching it if needed). The input filename is relative to assets/logos/.
 */
async function getLogoPreviewPath(logoFilename) {
  ensureCacheDir();
  const cachedPath = previewPathFor(logoFilename);
  if (fs.existsSync(cachedPath)) return cachedPath;

  const sourcePath = path.join(LOGOS_DIR, logoFilename);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Logo source file not found: ${logoFilename}`);
  }

  const ext = path.extname(logoFilename).toLowerCase();

  // Raster formats can be served directly. We still copy them into the cache
  // dir so the static server only has to expose one folder.
  if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
    fs.copyFileSync(sourcePath, cachedPath);
    return cachedPath;
  }

  // SVG / WebP path: render via Puppeteer, contained inside a 480x240 white box.
  const fileContent = fs.readFileSync(sourcePath);
  let embed;
  if (ext === '.svg') {
    // Inline the SVG so CSS sizing applies cleanly.
    embed = `<div style="display:flex;align-items:center;justify-content:center;width:${PREVIEW_W}px;height:${PREVIEW_H}px;">
      <div style="max-width:${PREVIEW_W - 40}px;max-height:${PREVIEW_H - 40}px;display:flex;align-items:center;justify-content:center;">
        ${fileContent.toString('utf8')}
      </div>
    </div>`;
  } else {
    const dataUrl = `data:image/${ext.slice(1)};base64,${fileContent.toString('base64')}`;
    embed = `<div style="display:flex;align-items:center;justify-content:center;width:${PREVIEW_W}px;height:${PREVIEW_H}px;">
      <img src="${dataUrl}" style="max-width:${PREVIEW_W - 40}px;max-height:${PREVIEW_H - 40}px;object-fit:contain;" />
    </div>`;
  }

  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:${PREVIEW_W}px;height:${PREVIEW_H}px;background:#ffffff;}
    svg{max-width:100%;max-height:100%;width:auto;height:auto;}
  </style></head><body>${embed}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: PREVIEW_W, height: PREVIEW_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({
      path: cachedPath,
      type: 'png',
      clip: { x: 0, y: 0, width: PREVIEW_W, height: PREVIEW_H },
    });
  } finally {
    await page.close();
  }

  return cachedPath;
}

/**
 * Pre-warm the cache for an array of logo filenames. Called once at startup
 * so the first /banner invocation is snappy.
 */
async function warmLogoPreviews(logoFilenames) {
  for (const f of logoFilenames) {
    try {
      await getLogoPreviewPath(f);
    } catch (err) {
      console.warn(`[logo-previews] failed to render ${f}: ${err.message}`);
    }
  }
}

module.exports = { getLogoPreviewPath, warmLogoPreviews, CACHE_DIR };
