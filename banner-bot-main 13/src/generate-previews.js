/**
 * Render gallery thumbnails for /banner Step 1.
 *
 * Each banner is first rendered at full 1600×900 by Puppeteer (so layout
 * matches what the user will actually receive), then downscaled to
 * PREVIEW_W × PREVIEW_H by loading the full PNG into a tiny HTML page
 * and screenshotting it with Puppeteer (which we already use anyway).
 * Avoids native deps like `sharp` that can break Docker builds.
 *
 * Why downscale? Slack's image-block proxy fetches every preview image
 * before the modal opens to the user. Full-size 1600×900 banners are
 * 1.5–2 MB each; with 21 templates that's ~35 MB to ferry on every
 * /banner click, which made the modal take 10–15s to appear. At 600 px
 * wide, each thumbnail is 80–250 KB and the whole gallery loads in <1 s.
 */
const path = require('path');
const fs = require('fs');
const { renderBanner, closeBrowser, getBrowser } = require('./renderer');
const { PREVIEWS } = require('./templates/preview-list');

const PREVIEW_DIR = path.resolve(__dirname, '../docs/previews');
const PREVIEW_W = 600;
const PREVIEW_H = 338; // 600 × (9/16)

if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

/**
 * Downscale a PNG file using Puppeteer. We load the source PNG via a base64
 * data URL into a 600×338 viewport and re-screenshot it. The browser's
 * built-in image scaling does the resampling.
 */
async function downscalePng(srcPath, destPath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const data = fs.readFileSync(srcPath).toString('base64');
    const html = `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0}
      html,body{width:${PREVIEW_W}px;height:${PREVIEW_H}px;overflow:hidden}
    </style></head><body>
      <img src="data:image/png;base64,${data}"
           style="display:block;width:${PREVIEW_W}px;height:${PREVIEW_H}px"/>
    </body></html>`;
    await page.setViewport({ width: PREVIEW_W, height: PREVIEW_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({
      path: destPath,
      type: 'png',
      clip: { x: 0, y: 0, width: PREVIEW_W, height: PREVIEW_H },
    });
  } finally {
    await page.close();
  }
}

async function main() {
  for (const { num, id, defaults, variant } of PREVIEWS) {
    try {
      const params = variant ? { ...defaults, variant } : { ...defaults };
      const fullSizePath = await renderBanner(id, params);
      const dest = path.join(PREVIEW_DIR, `template-${num}.png`);

      await downscalePng(fullSizePath, dest);
      fs.unlinkSync(fullSizePath);

      const { size } = fs.statSync(dest);
      console.log(`✓ Template ${num.toString().padStart(2)}  (${(size / 1024).toFixed(0).padStart(4)} KB)`);
    } catch (err) {
      console.error(`✗ Template ${num}: ${err.message}`);
    }
  }
  await closeBrowser();
  console.log('\nDone!');
}

main().catch(console.error);
