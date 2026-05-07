/**
 * Render gallery thumbnails for /banner Step 1.
 *
 * Each banner is first rendered at full 1600×900 by Puppeteer (so layout
 * matches what the user will actually receive), then downscaled with sharp
 * to PREVIEW_WIDTH for Slack's image-proxy. The full-size rendered file is
 * deleted; only the thumbnail lands in docs/previews/.
 *
 * Why downscale? Slack's image-block proxy fetches every preview image
 * before the modal opens to the user. A 1600×900 PNG is ~1.5–2 MB; with
 * 21 templates that's 30+ MB to ferry on every /banner click — which is
 * exactly what was making the modal take 10–15 s to appear. At 600 px
 * wide each thumbnail is 80–200 KB and the whole gallery loads in <1 s.
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { renderBanner, closeBrowser } = require('./renderer');
const { PREVIEWS } = require('./templates/preview-list');

const PREVIEW_DIR = path.resolve(__dirname, '../docs/previews');
const PREVIEW_WIDTH = 600; // height auto: 600 × (9/16) = 338

if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

async function main() {
  for (const { num, id, defaults, variant } of PREVIEWS) {
    try {
      const params = variant ? { ...defaults, variant } : { ...defaults };
      const fullSizePath = await renderBanner(id, params);
      const dest = path.join(PREVIEW_DIR, `template-${num}.png`);

      await sharp(fullSizePath)
        .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toFile(dest);

      const { size } = fs.statSync(dest);
      fs.unlinkSync(fullSizePath);
      console.log(`✓ Template ${num.toString().padStart(2)}  (${(size / 1024).toFixed(0).padStart(4)} KB)`);
    } catch (err) {
      console.error(`✗ Template ${num}: ${err.message}`);
    }
  }
  await closeBrowser();
  console.log('\nDone!');
}

main().catch(console.error);
