/**
 * Render gallery thumbnails for /banner Step 1.
 *
 * Each banner is first rendered at full 1600×900, then downscaled to
 * ~600×338 via the shared `thumbnailBanner` util. Small enough that
 * Slack's image-proxy can fetch all 21 in under a second, which keeps
 * the modal snappy.
 */
const path = require('path');
const fs = require('fs');
const { renderBanner, closeBrowser } = require('./renderer');
const { thumbnailBanner } = require('./lib/thumbnail');
const { PREVIEWS } = require('./templates/preview-list');

const PREVIEW_DIR = path.resolve(__dirname, '../docs/previews');
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

async function main() {
  for (const { num, id, defaults, variant } of PREVIEWS) {
    try {
      const params = variant ? { ...defaults, variant } : { ...defaults };
      const fullSizePath = await renderBanner(id, params);
      const dest = path.join(PREVIEW_DIR, `template-${num}.png`);

      await thumbnailBanner(fullSizePath, dest);
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
