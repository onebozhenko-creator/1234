/**
 * Downscale a full-size banner PNG to a smaller preview thumbnail.
 *
 * Used by the approval flow: when a user submits /banner, we render the
 * full 1600×900 PNG (kept on disk) but post only the smaller thumbnail to
 * the thread until the approver clicks "Approve". This prevents people
 * from copying & using the banner before design review.
 *
 * Reuses the already-running Puppeteer browser so we don't add native
 * dependencies (sharp etc.) that complicate Docker builds.
 */
const fs = require('fs');
const path = require('path');
const { getBrowser } = require('../renderer');

const PREVIEW_W = 600;
const PREVIEW_H = 338; // 600 × (9/16)

async function thumbnailBanner(srcPath, destPath) {
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
  return destPath;
}

module.exports = { thumbnailBanner, PREVIEW_W, PREVIEW_H };
