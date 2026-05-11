const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const FONTS_DIR = path.resolve(__dirname, '../assets/fonts');
const LOGOS_DIR = path.resolve(__dirname, '../assets/logos');
const OUTPUT_DIR = path.resolve(__dirname, '../output/presentation');

function fontToBase64(filename) {
  const buffer = fs.readFileSync(path.join(FONTS_DIR, filename));
  return buffer.toString('base64');
}

function imageToBase64(filepath) {
  if (!fs.existsSync(filepath)) return '';
  const buffer = fs.readFileSync(filepath);
  const ext = path.extname(filepath).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

const fonts = {
  extraLight: fontToBase64('ZalandoSans-ExtraLight.ttf'),
  light: fontToBase64('ZalandoSans-Light.ttf'),
  regular: fontToBase64('ZalandoSans-Regular.ttf'),
  medium: fontToBase64('ZalandoSans-Medium.ttf'),
};

const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-light.png'));
const everstakeLogoDark = imageToBase64(path.join(LOGOS_DIR, 'everstake-dark.png'));

function baseStyles() {
  return `
    @font-face { font-family: 'ZS'; src: url('data:font/truetype;base64,${fonts.extraLight}') format('truetype'); font-weight: 200; }
    @font-face { font-family: 'ZS'; src: url('data:font/truetype;base64,${fonts.light}') format('truetype'); font-weight: 300; }
    @font-face { font-family: 'ZS'; src: url('data:font/truetype;base64,${fonts.regular}') format('truetype'); font-weight: 400; }
    @font-face { font-family: 'ZS'; src: url('data:font/truetype;base64,${fonts.medium}') format('truetype'); font-weight: 500; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1920px; height: 1080px; overflow: hidden; font-family: 'ZS', sans-serif; }
    .slide { position: relative; width: 1920px; height: 1080px; padding: 48px; overflow: hidden; }
    .dark { background: linear-gradient(to top right, #034638 75%, #012d24 100%); color: #f5fffd; }
    .light { background: #f5fffd; color: #034638; }
    .headline { font-weight: 200; line-height: 1.08; }
    .subtitle { font-weight: 500; color: #7b9690; }
    .body-text { font-weight: 300; line-height: 1.5; }
    .accent { color: #40c1ac; }
    .accent-bg { background: rgba(64,193,172,0.15); border-radius: 16px; padding: 32px; }
    .blob { position: absolute; border-radius: 50%; filter: blur(200px); z-index: 0; }
    .content { position: relative; z-index: 1; }
    .logo { position: absolute; bottom: 48px; right: 48px; height: 32px; z-index: 10; }
    .divider { width: 80px; height: 3px; background: #40c1ac; margin: 24px 0; }
    .card { background: rgba(64,193,172,0.08); border: 1px solid rgba(64,193,172,0.2); border-radius: 16px; padding: 36px; }
    .card-dark { background: rgba(245,255,253,0.06); border: 1px solid rgba(245,255,253,0.12); border-radius: 16px; padding: 36px; }
  `;
}

// SLIDE 0: Title
function slideTitleHTML() {
  return `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="slide dark">
      <div class="blob" style="left:-300px;top:-300px;width:700px;height:700px;background:linear-gradient(180deg,rgba(64,193,172,0.30),rgba(130,230,180,0.8));"></div>
      <div class="blob" style="right:-200px;bottom:-200px;width:500px;height:500px;background:linear-gradient(180deg,rgba(245,190,55,0.15),rgba(245,190,55,0.3));"></div>
      <div class="content" style="height:100%;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-weight:500;font-size:24px;color:#40c1ac;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:32px;">Everstake × Exodus</div>
        <div class="headline" style="font-size:72px;max-width:1200px;">Solana Order Flow &<br>Monetization Strategy</div>
        <div class="divider"></div>
        <div style="font-weight:300;font-size:32px;color:#7b9690;max-width:800px;">Unlocking New Revenue Streams for Exodus</div>
      </div>
      <img src="${everstakeLogo}" class="logo" />
    </div>
  </body></html>`;
}

// SLIDE 1: The Opportunity
function slide1HTML() {
  return `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="slide dark">
      <div class="blob" style="left:-200px;top:-200px;width:600px;height:600px;background:linear-gradient(180deg,rgba(64,193,172,0.20),rgba(123,150,144,0.40));"></div>
      <div class="content" style="height:100%;display:flex;flex-direction:column;">
        <div class="subtitle" style="font-size:22px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">The Opportunity</div>
        <div class="headline" style="font-size:56px;margin-bottom:48px;">Capturing Untapped<br>Network Value</div>
        <div style="display:flex;gap:32px;flex:1;align-items:stretch;">
          <div class="card-dark" style="flex:1;display:flex;flex-direction:column;">
            <div style="font-weight:500;font-size:20px;color:#40c1ac;margin-bottom:16px;">Current State</div>
            <div class="body-text" style="font-size:22px;">Exodus generates massive transaction volume, driving significant activity across the network.</div>
          </div>
          <div class="card-dark" style="flex:1;display:flex;flex-direction:column;">
            <div style="font-weight:500;font-size:20px;color:#40c1ac;margin-bottom:16px;">The Missed Opportunity</div>
            <div class="body-text" style="font-size:22px;">A substantial amount of value generated by this order flow (via priority fees and benign arbitrage) is currently ungathered and absorbed by the broader ecosystem.</div>
          </div>
          <div class="card-dark" style="flex:1;display:flex;flex-direction:column;">
            <div style="font-weight:500;font-size:20px;color:#40c1ac;margin-bottom:16px;">The Goal</div>
            <div class="body-text" style="font-size:22px;">Empower Exodus to monetize this left-on-the-table revenue securely, transparently, and independently.</div>
          </div>
        </div>
      </div>
      <img src="${everstakeLogo}" class="logo" />
    </div>
  </body></html>`;
}

// SLIDE 2: Option 1
function slide2HTML() {
  return `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="slide light">
      <div class="blob" style="left:-300px;top:-300px;width:700px;height:700px;background:linear-gradient(180deg,rgba(64,193,172,0.35),rgba(130,230,180,0.7));"></div>
      <div class="content" style="height:100%;display:flex;flex-direction:column;">
        <div class="subtitle" style="font-size:22px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">Option 1 — SWQOS Quick</div>
        <div class="headline" style="font-size:52px;margin-bottom:40px;">Custom RPC &<br>Tip-Based Revenue Share</div>

        <div style="display:flex;gap:32px;flex:1;">
          <!-- Left column -->
          <div style="flex:1;display:flex;flex-direction:column;gap:24px;">
            <div class="accent-bg">
              <div style="font-weight:500;font-size:18px;color:#034638;margin-bottom:12px;">How it Works</div>
              <div class="body-text" style="font-size:20px;color:#034638;">
                <div style="margin-bottom:12px;">• Wallet enforces a minimal, unnoticeable default tip (e.g., 0.005 SOL)</div>
                <div>• Transactions bypass standard RPC congestion for faster, highly reliable execution</div>
              </div>
            </div>
            <div class="accent-bg">
              <div style="font-weight:500;font-size:18px;color:#034638;margin-bottom:12px;">Why it Wins</div>
              <div class="body-text" style="font-size:20px;color:#034638;">Immediate passive income, ~95% landing rate, and zero upfront integration cost.</div>
            </div>
          </div>
          <!-- Right column: Economics -->
          <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
            <div style="background:#034638;border-radius:16px;padding:40px;color:#f5fffd;">
              <div style="font-weight:500;font-size:20px;color:#40c1ac;margin-bottom:24px;">The Economics</div>
              <div style="font-weight:200;font-size:64px;margin-bottom:16px;">90%</div>
              <div class="body-text" style="font-size:20px;margin-bottom:24px;">of generated tips go directly back to Partner</div>
              <div style="border-top:1px solid rgba(64,193,172,0.3);padding-top:20px;">
                <div class="body-text" style="font-size:18px;color:#7b9690;">Example:</div>
                <div class="body-text" style="font-size:22px;">100,000 TXs @ 0.005 SOL = 500 SOL Gross</div>
                <div style="font-weight:500;font-size:24px;color:#40c1ac;margin-top:8px;">Partner retains ~450 SOL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <img src="${everstakeLogoDark}" class="logo" />
    </div>
  </body></html>`;
}

// SLIDE 3: Option 2
function slide3HTML() {
  return `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="slide dark">
      <div class="blob" style="right:-200px;top:-200px;width:600px;height:600px;background:linear-gradient(180deg,rgba(64,193,172,0.15),rgba(123,150,144,0.30));"></div>
      <div class="blob" style="left:-150px;bottom:-150px;width:500px;height:500px;background:linear-gradient(180deg,rgba(245,190,55,0.10),rgba(245,190,55,0.25));"></div>
      <div class="content" style="height:100%;display:flex;flex-direction:column;">
        <div class="subtitle" style="font-size:22px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">Option 2 — Order Flow & MEV</div>
        <div class="headline" style="font-size:52px;margin-bottom:40px;">Strategic MEV &<br>Arbitrage</div>

        <div style="display:flex;gap:32px;flex:1;">
          <!-- Left: How it works -->
          <div style="flex:1;display:flex;flex-direction:column;gap:24px;">
            <div class="card-dark" style="flex:1;">
              <div style="font-weight:500;font-size:20px;color:#40c1ac;margin-bottom:20px;">How it Works</div>
              <div style="display:flex;flex-direction:column;gap:20px;">
                <div style="display:flex;gap:16px;align-items:flex-start;">
                  <div style="min-width:36px;height:36px;border-radius:50%;background:rgba(64,193,172,0.2);display:flex;align-items:center;justify-content:center;font-weight:500;font-size:16px;color:#40c1ac;">1</div>
                  <div class="body-text" style="font-size:20px;">Route exclusive order flow to our searchers before it hits the public mempool</div>
                </div>
                <div style="display:flex;gap:16px;align-items:flex-start;">
                  <div style="min-width:36px;height:36px;border-radius:50%;background:rgba(64,193,172,0.2);display:flex;align-items:center;justify-content:center;font-weight:500;font-size:16px;color:#40c1ac;">2</div>
                  <div class="body-text" style="font-size:20px;">User's swap creates a temporary price discrepancy across DEXs</div>
                </div>
                <div style="display:flex;gap:16px;align-items:flex-start;">
                  <div style="min-width:36px;height:36px;border-radius:50%;background:rgba(64,193,172,0.2);display:flex;align-items:center;justify-content:center;font-weight:500;font-size:16px;color:#40c1ac;">3</div>
                  <div class="body-text" style="font-size:20px;">Benign arbitrage balances the pools, profits shared directly with you</div>
                </div>
              </div>
            </div>
          </div>
          <!-- Right: Economics -->
          <div style="flex:1;display:flex;flex-direction:column;gap:24px;">
            <div style="background:rgba(64,193,172,0.12);border-radius:16px;padding:40px;flex:1;display:flex;flex-direction:column;justify-content:center;">
              <div style="font-weight:500;font-size:20px;color:#40c1ac;margin-bottom:24px;">The Economics</div>
              <div style="font-weight:200;font-size:48px;margin-bottom:8px;">$300K–$500K</div>
              <div class="body-text" style="font-size:22px;color:#7b9690;margin-bottom:32px;">per month in net commission profits during optimal market conditions</div>
              <div class="divider"></div>
              <div style="font-weight:500;font-size:20px;margin-top:16px;">Why it Wins</div>
              <div class="body-text" style="font-size:20px;margin-top:12px;">Maximizes the financial value of your high-volume trading traffic without adding friction for the user.</div>
            </div>
          </div>
        </div>
      </div>
      <img src="${everstakeLogo}" class="logo" />
    </div>
  </body></html>`;
}

// SLIDE 4: Contact
function slide4HTML() {
  return `<!DOCTYPE html><html><head><style>${baseStyles()}</style></head><body>
    <div class="slide dark">
      <div class="blob" style="left:50%;top:50%;transform:translate(-50%,-50%);width:800px;height:800px;background:linear-gradient(180deg,rgba(64,193,172,0.15),rgba(130,230,180,0.25));"></div>
      <div class="content" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <div style="font-weight:500;font-size:24px;color:#40c1ac;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:40px;">Want to know more?</div>
        <div class="headline" style="font-size:72px;margin-bottom:48px;">Let's Get in Touch</div>
        <div class="divider" style="margin:0 auto 48px;"></div>
        <div style="display:flex;gap:48px;align-items:center;">
          <div style="text-align:left;">
            <div class="body-text" style="font-size:24px;color:#7b9690;margin-bottom:8px;">Email</div>
            <div style="font-weight:400;font-size:28px;">business@everstake.one</div>
          </div>
          <div style="width:2px;height:60px;background:rgba(64,193,172,0.3);"></div>
          <div style="text-align:left;">
            <div class="body-text" style="font-size:24px;color:#7b9690;margin-bottom:8px;">Website</div>
            <div style="font-weight:400;font-size:28px;">everstake.one</div>
          </div>
        </div>
      </div>
      <img src="${everstakeLogo}" class="logo" style="bottom:48px;right:48px;" />
    </div>
  </body></html>`;
}

async function main() {
  const slides = [
    { name: 'slide-0-title', html: slideTitleHTML() },
    { name: 'slide-1-opportunity', html: slide1HTML() },
    { name: 'slide-2-option1', html: slide2HTML() },
    { name: 'slide-3-option2', html: slide3HTML() },
    { name: 'slide-4-contact', html: slide4HTML() },
  ];

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const slide of slides) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(slide.html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);

    const pngPath = path.join(OUTPUT_DIR, `${slide.name}.png`);
    await page.screenshot({ path: pngPath, type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });

    // Save editable HTML
    const htmlPath = path.join(OUTPUT_DIR, `${slide.name}.html`);
    fs.writeFileSync(htmlPath, slide.html);

    console.log(`✓ ${slide.name}`);
    await page.close();
  }

  await browser.close();
  console.log('\nDone! Check output/presentation/');
}

main().catch(console.error);
