const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { TEMPLATES } = require('./templates/templates');

const OUTPUT_DIR = path.resolve(__dirname, '../output');

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function renderBanner(templateId, params) {
  const template = TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  const html = template.render(params);
  const b = await getBrowser();
  const page = await b.newPage();

  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Wait for fonts to load, then auto-fit title within container
  await page.evaluate(async () => {
    await document.fonts.ready;

    const title = document.getElementById('title');
    const container = document.getElementById('title-container');
    if (!title || !container) return;

    const maxH = container.offsetHeight;
    const maxW = container.offsetWidth;
    let fontSize = parseInt(window.getComputedStyle(title).fontSize) || 111;

    // Temporarily remove flex centering to get true scroll dimensions
    const origJustify = container.style.justifyContent;
    container.style.justifyContent = 'flex-start';

    while (fontSize > 40) {
      title.style.fontSize = fontSize + 'px';
      // Force reflow
      void title.offsetHeight;
      if (container.scrollHeight <= maxH && title.scrollWidth <= maxW) break;
      fontSize -= 2;
    }

    // Restore centering
    container.style.justifyContent = origJustify;
  });

  const filename = `banner-${templateId}-${Date.now()}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  await page.screenshot({
    path: outputPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1600, height: 900 },
  });

  await page.close();
  return outputPath;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

module.exports = { renderBanner, closeBrowser, getBrowser };
