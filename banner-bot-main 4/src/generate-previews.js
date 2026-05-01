const { renderBanner, closeBrowser } = require('./renderer');
const { PREVIEWS } = require('./templates/preview-list');
const path = require('path');
const fs = require('fs');

const PREVIEW_DIR = path.resolve(__dirname, '../docs/previews');
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

async function main() {
  for (const { num, id, defaults, variant } of PREVIEWS) {
    try {
      const params = variant ? { ...defaults, variant } : { ...defaults };
      const outputPath = await renderBanner(id, params);
      const dest = path.join(PREVIEW_DIR, `template-${num}.png`);
      fs.copyFileSync(outputPath, dest);
      fs.unlinkSync(outputPath);
      console.log(`✓ Template ${num}`);
    } catch (err) {
      console.error(`✗ Template ${num}: ${err.message}`);
    }
  }
  await closeBrowser();
  console.log('\nDone!');
}

main().catch(console.error);
