const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');
const LOGOS_DIR = path.join(ASSETS_DIR, 'logos');

function fontToBase64(filename) {
  const filepath = path.join(FONTS_DIR, filename);
  const buffer = fs.readFileSync(filepath);
  return buffer.toString('base64');
}

function imageToBase64(filepath) {
  if (!fs.existsSync(filepath)) return '';
  const buffer = fs.readFileSync(filepath);
  const ext = path.extname(filepath).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function getEverstakeLogo(theme) {
  const filename = theme === 'dark' ? 'everstake-light.png' : 'everstake-dark.png';
  return imageToBase64(path.join(LOGOS_DIR, filename));
}

function getPartnerLogo(logoFilename) {
  if (!logoFilename) return '';
  const filepath = path.join(LOGOS_DIR, logoFilename);
  return imageToBase64(filepath);
}

// Base64 encode fonts for inline use
const fonts = {
  extraLight: fontToBase64('ZalandoSans-ExtraLight.ttf'),
  light: fontToBase64('ZalandoSans-Light.ttf'),
  regular: fontToBase64('ZalandoSans-Regular.ttf'),
  medium: fontToBase64('ZalandoSans-Medium.ttf'),
};

function baseStyles() {
  return `
    @font-face {
      font-family: 'Zalando Sans';
      src: url('data:font/truetype;base64,${fonts.extraLight}') format('truetype');
      font-weight: 200;
    }
    @font-face {
      font-family: 'Zalando Sans';
      src: url('data:font/truetype;base64,${fonts.light}') format('truetype');
      font-weight: 300;
    }
    @font-face {
      font-family: 'Zalando Sans';
      src: url('data:font/truetype;base64,${fonts.regular}') format('truetype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Zalando Sans';
      src: url('data:font/truetype;base64,${fonts.medium}') format('truetype');
      font-weight: 500;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1600px;
      height: 900px;
      overflow: hidden;
      font-family: 'Zalando Sans', sans-serif;
    }
    .banner {
      position: relative;
      width: 1600px;
      height: 900px;
      overflow: hidden;
    }
  `;
}

function gridOverlay(theme = 'light') {
  const color = theme === 'dark' ? 'rgba(222,232,230,0.12)' : '#dee8e6';
  // 5 vertical lines + 2 horizontal lines matching Figma grid
  return `
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;">
      <div style="position:absolute;left:40px;top:0;width:2px;height:100%;background:${color};"></div>
      <div style="position:absolute;left:400px;top:0;width:2px;height:100%;background:${color};"></div>
      <div style="position:absolute;left:800px;top:0;width:2px;height:100%;background:${color};"></div>
      <div style="position:absolute;left:1200px;top:0;width:2px;height:100%;background:${color};"></div>
      <div style="position:absolute;left:1558px;top:0;width:2px;height:100%;background:${color};"></div>
      <div style="position:absolute;left:0;top:40px;width:100%;height:2px;background:${color};"></div>
      <div style="position:absolute;left:0;top:858px;width:100%;height:2px;background:${color};"></div>
    </div>
  `;
}

function gradientBlobs(positions) {
  return positions.map(({ x, y, size, color }) => `
    <div style="
      position:absolute;
      left:${x}px;top:${y}px;
      width:${size}px;height:${size}px;
      border-radius:50%;
      filter:blur(200px);
      z-index:0;
      background:${color};
    "></div>
  `).join('');
}

// ============================================
// TYPE A: Split layout - left text, right partner logo
// Examples: DES-283 (Monad), DES-286 (Solana), DES-284 (Aptos), DES-301 (Neo)
// ============================================
function typeA({ title, subtitle, partnerLogo, theme = 'light' }) {
  const bgColor = theme === 'dark' ? 'linear-gradient(180deg, #034638 75%, #012d24 100%)' : '#f5fffd';
  const textColor = theme === 'dark' ? '#f5fffd' : '#034638';
  const dividerColor = theme === 'dark' ? 'rgba(222,232,230,0.12)' : '#dee8e6';
  const everstakeLogo = getEverstakeLogo(theme);
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  const blobs = theme === 'light' ? gradientBlobs([
    { x: -120, y: -120, size: 640, color: 'radial-gradient(circle, rgba(64,193,172,0.45), rgba(130,230,180,0.7))' },
  ]) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:${bgColor};color:${textColor};">
      ${blobs}
      ${gridOverlay(theme)}

      <!-- Everstake logo top-left -->
      <img src="${everstakeLogo}" style="position:absolute;top:52px;left:80px;height:32px;z-index:10;" />

      <!-- Vertical divider -->
      <div style="position:absolute;left:800px;top:0;width:2px;height:100%;background:${dividerColor};z-index:2;"></div>

      <!-- Left side: text -->
      <div style="position:absolute;left:80px;bottom:80px;z-index:5;max-width:680px;">
        ${subtitle ? `<div style="font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;">${subtitle}</div>` : ''}
        <div style="font-weight:200;font-size:96px;line-height:1.04;">${title}</div>
      </div>

      <!-- Right side: partner logo centered -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:800px;top:0;width:800px;height:900px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:500px;max-height:300px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// TYPE B: Centered title, light background with gradient accents
// Examples: DES-285, DES-312 (Ethereum)
// ============================================
function typeB({ title, subtitle, partnerLogo, theme = 'light' }) {
  const bgColor = theme === 'dark' ? 'linear-gradient(180deg, #034638 75%, #012d24 100%)' : '#f5fffd';
  const textColor = theme === 'dark' ? '#f5fffd' : '#034638';
  const everstakeLogo = getEverstakeLogo(theme);
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  const blobs = theme === 'light' ? gradientBlobs([
    { x: -100, y: -100, size: 500, color: 'radial-gradient(circle, rgba(64,193,172,0.4), rgba(130,230,180,0.6))' },
    { x: 1100, y: 500, size: 500, color: 'radial-gradient(circle, rgba(64,193,172,0.3), rgba(130,230,180,0.4))' },
  ]) : gradientBlobs([
    { x: -100, y: -100, size: 500, color: 'radial-gradient(circle, rgba(64,193,172,0.2), rgba(80,200,170,0.3))' },
  ]);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:${bgColor};color:${textColor};">
      ${blobs}
      ${gridOverlay(theme)}

      <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5;padding:80px;">
        ${partnerLogoSrc ? `<img src="${partnerLogoSrc}" style="max-width:300px;max-height:120px;margin-bottom:40px;" />` : ''}
        ${subtitle ? `<div style="font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px;text-align:center;">${subtitle}</div>` : ''}
        <div style="font-weight:200;font-size:96px;line-height:1.04;text-align:center;max-width:1200px;">${title}</div>
      </div>
    </div>
  </body></html>`;
}

// ============================================
// TYPE C: Text in center (v1–v4)
// Figma-exported backgrounds (PNG) + text overlay
// ============================================
function typeC({ title, subtitle, variant = 'v1' }) {
  const isLight = variant === 'v2';
  const textColor = isLight ? '#034638' : '#f5fffd';
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, `bg-text-center-${variant}.png`));

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:${textColor};">
      <!-- Figma background (gradients + lines, pixel-perfect) -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Title: centered between grid lines (y=242..658, x=242..1358) -->
      <div id="title-container" style="position:absolute;left:262px;top:262px;width:1076px;height:376px;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        ${subtitle ? `<div style="font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px;text-align:center;flex-shrink:0;">${subtitle}</div>` : ''}
        <div id="title" style="font-weight:200;font-size:111px;line-height:1.04;text-align:center;">${title}</div>
      </div>
    </div>
  </body></html>`;
}

// ============================================
// APR: Split layout — subtitle + title left, crypto icon right
// Example: DES-314 (Aptos APR)
// Figma positions: subtitle x=82 y=513 44px w500, title x=82 y=586 112px w250
// ============================================
function typeAPR({ title, subtitle, partnerLogo }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-apr.png'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#034638;">
      <!-- Figma background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Subtitle: Figma x=82 y=513, 44px, weight 500, color #7b9690 -->
      ${subtitle ? `<div style="position:absolute;left:82px;top:513px;z-index:5;font-weight:500;font-size:44px;color:#7b9690;">${subtitle}</div>` : ''}

      <!-- Title: Figma x=82 y=586, 112px, weight 250, max-width 810px -->
      <div id="title-container" style="position:absolute;left:82px;top:586px;width:810px;height:272px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:112px;line-height:1.04;color:#034638;">${title}</div>
      </div>

      <!-- Partner logo on right panel: centered in x=940..1560, y=42..860 -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:940px;top:42px;width:620px;height:818px;z-index:5;display:flex;align-items:center;justify-content:center;">
          <img src="${partnerLogoSrc}" style="max-width:400px;max-height:400px;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// TYPE D: Partnership - two logos with "x" between
// Examples: DES-298 (everstake x Pye)
// ============================================
function typeD({ partnerLogo, theme = 'light' }) {
  const bgColor = theme === 'dark' ? 'linear-gradient(180deg, #034638 75%, #012d24 100%)' : '#f5fffd';
  const textColor = theme === 'dark' ? '#f5fffd' : '#034638';
  const everstakeLogo = getEverstakeLogo(theme);
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  const blobs = theme === 'light' ? gradientBlobs([
    { x: -100, y: -100, size: 500, color: 'radial-gradient(circle, rgba(64,193,172,0.4), rgba(130,230,180,0.6))' },
    { x: -100, y: 500, size: 400, color: 'radial-gradient(circle, rgba(255,180,80,0.4), rgba(255,200,100,0.5))' },
    { x: 1100, y: -100, size: 400, color: 'radial-gradient(circle, rgba(64,193,172,0.2), rgba(130,230,180,0.3))' },
  ]) : gradientBlobs([
    { x: -100, y: 200, size: 500, color: 'radial-gradient(circle, rgba(64,193,172,0.15), rgba(80,200,170,0.2))' },
  ]);

  // Use a larger everstake logo for partnership banners
  const everstakeLogoLarge = imageToBase64(path.join(LOGOS_DIR, theme === 'dark' ? 'everstake-light.png' : 'everstake-dark.png'));

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:${bgColor};color:${textColor};">
      ${blobs}
      ${gridOverlay(theme)}

      <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:60px;z-index:5;">
        <img src="${everstakeLogoLarge}" style="height:80px;width:auto;" />
        <span style="font-weight:300;font-size:48px;opacity:0.6;">x</span>
        ${partnerLogoSrc ? `<img src="${partnerLogoSrc}" style="max-height:80px;max-width:300px;width:auto;" />` : ''}
      </div>
    </div>
  </body></html>`;
}

// ============================================
// TYPE E: Week in Blockchains
// ============================================
function typeE({ dateRange, cryptoIcons = [], theme = 'light' }) {
  const textColor = '#034638';
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-dark.png'));

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:#f5fffd;color:${textColor};">

      <!-- Gradient blob: Figma ellipse 640x640 at (-320,-320) blur 200 -->
      <div style="
        position:absolute;
        left:-320px;top:-320px;
        width:640px;height:640px;
        border-radius:50%;
        filter:blur(200px);
        z-index:0;
        background:linear-gradient(180deg, rgba(64,193,172,0.40), rgba(130,230,180,1.0));
      "></div>

      <!-- Everstake logo: Figma x=56 y=56 h=40 w=250 -->
      <img src="${everstakeLogo}" style="position:absolute;top:56px;left:56px;height:40px;z-index:10;" />

      <!-- Date + title: Figma date at x=56 y=523, title at x=56 y=578 -->
      <div style="position:absolute;left:56px;top:523px;z-index:5;max-width:654px;">
        <div style="font-weight:500;font-size:26px;margin-bottom:24px;">${dateRange || ''}</div>
        <div style="font-weight:200;font-size:128px;line-height:1.04;">Week in<br>Blockchains</div>
      </div>

      <!-- Right: gradient bg (Figma: #40c1ac 20% → #7b9690 50%) + icons -->
      <div style="position:absolute;left:800px;top:0;width:800px;height:900px;z-index:1;background:linear-gradient(180deg, rgba(64,193,172,0.20), rgba(123,150,144,0.50));">
        <img src="${imageToBase64(path.join(LOGOS_DIR, 'week-icons-grid.png'))}" style="width:100%;height:100%;object-fit:cover;" />
      </div>
    </div>
  </body></html>`;
}

// ============================================
// TYPE F: Split layout with right illustration/image
// Examples: DES-294a (Trezor + Cardano visual)
// ============================================
function typeF({ title, subtitle, partnerLogo, rightImage, theme = 'light' }) {
  const bgColor = theme === 'dark' ? 'linear-gradient(180deg, #034638 75%, #012d24 100%)' : '#f5fffd';
  const textColor = theme === 'dark' ? '#f5fffd' : '#034638';
  const everstakeLogo = getEverstakeLogo(theme);
  const partnerLogoSrc = getPartnerLogo(partnerLogo);
  const rightImageSrc = rightImage ? getPartnerLogo(rightImage) : '';
  const dividerColor = theme === 'dark' ? 'rgba(222,232,230,0.12)' : '#dee8e6';

  const blobs = theme === 'light' ? gradientBlobs([
    { x: -120, y: -120, size: 640, color: 'radial-gradient(circle, rgba(64,193,172,0.45), rgba(130,230,180,0.7))' },
  ]) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:${bgColor};color:${textColor};">
      ${blobs}
      ${gridOverlay(theme)}

      <div style="position:absolute;left:800px;top:0;width:2px;height:100%;background:${dividerColor};z-index:2;"></div>

      <!-- Top left: everstake + partner logos -->
      <div style="position:absolute;top:52px;left:80px;display:flex;align-items:center;gap:20px;z-index:10;">
        <img src="${everstakeLogo}" style="height:32px;" />
        ${partnerLogoSrc ? `
          <span style="font-size:20px;opacity:0.4;">x</span>
          <img src="${partnerLogoSrc}" style="height:32px;width:auto;" />
        ` : ''}
      </div>

      <!-- Left side: text -->
      <div style="position:absolute;left:80px;bottom:80px;z-index:5;max-width:680px;">
        ${subtitle ? `<div style="font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;">${subtitle}</div>` : ''}
        <div style="font-weight:200;font-size:96px;line-height:1.04;">${title}</div>
      </div>

      <!-- Right side: illustration -->
      ${rightImageSrc ? `
        <div style="position:absolute;left:802px;top:0;width:798px;height:900px;z-index:3;overflow:hidden;">
          <img src="${rightImageSrc}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      ` : `
        <div style="position:absolute;left:802px;top:0;width:798px;height:900px;z-index:3;background:${theme === 'dark' ? 'rgba(64,193,172,0.08)' : 'rgba(64,193,172,0.06)'};"></div>
      `}
    </div>
  </body></html>`;
}

// ============================================
// Template 5: About Blockchain — split layout, text left, partner logo right
// Figma: DES-283 (about blockchain - v1)
// ============================================
function template5({ title, subtitle, partnerLogo }) {
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-dark.png'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:#f5fffd;color:#034638;">

      <!-- Gradient blob: (-320,-320) 640x640 blur 200px -->
      <div style="position:absolute;left:-320px;top:-320px;width:640px;height:640px;border-radius:50%;filter:blur(200px);z-index:0;
        background:linear-gradient(180deg, rgba(64,193,172,0.40), rgba(130,230,180,1.0));"></div>

      <!-- Right panel gradient + pattern (clipped to panel) -->
      <div style="position:absolute;left:800px;top:0;width:800px;height:900px;z-index:0;overflow:hidden;
        background:linear-gradient(180deg, rgba(64,193,172,0.20), rgba(123,150,144,0.50));">
        <img src="${imageToBase64(path.join(LOGOS_DIR, 'pattern-right.svg'))}" style="position:absolute;left:-193px;top:-150px;width:1185px;height:1200px;opacity:0.6;" />
      </div>

      <!-- Everstake logo: x=56 y=56 h=40 -->
      <img src="${everstakeLogo}" style="position:absolute;top:56px;left:56px;height:40px;z-index:10;" />

      <!-- Subtitle: x=56 y=580, 20px w500 uppercase -->
      ${subtitle ? `<div style="position:absolute;left:56px;top:580px;z-index:5;font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;">${subtitle}</div>` : ''}

      <!-- Title: x=56 y=644, 96px w200, max-width 700px with auto-fit -->
      <div id="title-container" style="position:absolute;left:56px;top:644px;width:700px;height:220px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:96px;line-height:1.04;">${title}</div>
      </div>

      <!-- Right side: partner logo centered -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:800px;top:0;width:800px;height:900px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:750px;max-height:650px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 6: About Blockchain v2 — mirror of template-5
// Partner logo left, text right
// ============================================
function template6({ title, subtitle, partnerLogo }) {
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-dark.png'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:#f5fffd;color:#034638;">

      <!-- Left panel gradient + pattern (clipped) -->
      <div style="position:absolute;left:0;top:0;width:800px;height:900px;z-index:0;overflow:hidden;
        background:linear-gradient(180deg, rgba(64,193,172,0.20), rgba(123,150,144,0.50));">
        <img src="${imageToBase64(path.join(LOGOS_DIR, 'pattern-right.svg'))}" style="position:absolute;left:-193px;top:-150px;width:1185px;height:1200px;opacity:0.6;" />
      </div>

      <!-- Green blob top-right -->
      <div style="position:absolute;left:1336px;top:-400px;width:664px;height:770px;border-radius:50%;filter:blur(200px);z-index:0;
        background:linear-gradient(180deg, rgba(64,193,172,0.40), rgba(130,230,180,1.0));"></div>

      <!-- Partner logo centered in left panel -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:0;top:0;width:800px;height:900px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:500px;max-height:300px;width:auto;height:auto;" />
        </div>
      ` : ''}

      <!-- Everstake logo: x=856 y=56 -->
      <img src="${everstakeLogo}" style="position:absolute;top:56px;left:856px;height:40px;z-index:10;" />

      <!-- Subtitle: x=856 y=521, 20px w500 uppercase -->
      ${subtitle ? `<div style="position:absolute;left:856px;top:521px;z-index:5;font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;">${subtitle}</div>` : ''}

      <!-- Title: x=856 y=577, 86px w200, max-width 688px with auto-fit -->
      <div id="title-container" style="position:absolute;left:856px;top:577px;width:688px;height:280px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:86px;line-height:1.08;">${title}</div>
      </div>
    </div>
  </body></html>`;
}

// ============================================
// Template 7: Dark left panel + partner logo right
// Figma: DES-301 (Neo N3 Flagship Projects)
// ============================================
function template7({ title, subtitle, partnerLogo }) {
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-light.png'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:#f5fffd;">

      <!-- Left dark panel -->
      <div style="position:absolute;left:0;top:0;width:800px;height:900px;z-index:0;background:#034638;overflow:hidden;">
        <!-- Gradient blob -->
        <div style="position:absolute;left:441px;top:-388px;width:718px;height:717px;border-radius:50%;filter:blur(200px);
          background:linear-gradient(180deg, rgba(64,193,172,0.20), rgba(123,150,144,0.50));"></div>
      </div>

      <!-- Everstake logo white: x=48 y=48 -->
      <img src="${everstakeLogo}" style="position:absolute;top:48px;left:48px;height:40px;z-index:10;" />

      <!-- Subtitle: x=48 y=494, 28px w500, white -->
      ${subtitle ? `<div style="position:absolute;left:48px;top:494px;z-index:5;font-weight:500;font-size:28px;color:#f5fffd;">${subtitle}</div>` : ''}

      <!-- Title: x=48 y=560, 140px w250, white, auto-fit -->
      <div id="title-container" style="position:absolute;left:48px;top:560px;width:700px;height:300px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:140px;line-height:1.04;color:#f5fffd;">${title}</div>
      </div>

      <!-- Right side: partner logo centered -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:800px;top:0;width:800px;height:900px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:500px;max-height:300px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 8: Text left, dark right panel with partner logo
// Figma: DES-313 — mirror of template-7
// ============================================
function template8({ title, subtitle, partnerLogo }) {
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-dark.png'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="background:#f5fffd;color:#034638;">

      <!-- Green blob top-left -->
      <div style="position:absolute;left:-320px;top:-320px;width:640px;height:640px;border-radius:50%;filter:blur(200px);z-index:0;
        background:linear-gradient(180deg, rgba(64,193,172,0.40), rgba(130,230,180,1.0));"></div>

      <!-- Right dark panel -->
      <div style="position:absolute;left:800px;top:0;width:800px;height:900px;z-index:0;background:#034638;overflow:hidden;">
        <!-- Gradient blob -->
        <div style="position:absolute;left:441px;top:-388px;width:718px;height:717px;border-radius:50%;filter:blur(200px);
          background:linear-gradient(180deg, rgba(64,193,172,0.20), rgba(123,150,144,0.50));"></div>
      </div>

      <!-- Everstake logo dark: x=48 y=48 -->
      <img src="${everstakeLogo}" style="position:absolute;top:48px;left:48px;height:40px;z-index:10;" />

      <!-- Subtitle -->
      ${subtitle ? `<div style="position:absolute;left:48px;top:530px;z-index:5;font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;">${subtitle}</div>` : ''}

      <!-- Title: x=48 y=576, 88px, auto-fit -->
      <div id="title-container" style="position:absolute;left:48px;top:576px;width:704px;height:280px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:88px;line-height:1.04;">${title}</div>
      </div>

      <!-- Partner logo centered in right dark panel (white/light color) -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:800px;top:0;width:800px;height:900px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:500px;max-height:300px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 9: Centered layout — logo top, title bottom, grid lines
// Figma: DES-312 (Ethereum Foundation)
// ============================================
function template9({ title, partnerLogo }) {
  const partnerLogoSrc = getPartnerLogo(partnerLogo);
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-9.png'));

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#034638;">

      <!-- Figma background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Partner logo: centered between y=141..351 -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:0;top:143px;width:1600px;height:208px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-height:80px;width:auto;" />
        </div>
      ` : ''}

      <!-- Title: centered between y=353..757, x=316, max-width 968 -->
      <div id="title-container" style="position:absolute;left:316px;top:393px;width:968px;height:340px;z-index:5;display:flex;align-items:center;justify-content:center;">
        <div id="title" style="font-weight:200;font-size:88px;line-height:1.04;text-align:center;">${title}</div>
      </div>
    </div>
  </body></html>`;
}

// ============================================
// Template 10: Dark full — everstake logo top-left, title bottom-left, partner logo right (all white)
// Figma: DES-351
// ============================================
function template10({ title, partnerLogo }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-10.png'));
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-light.png'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#f5fffd;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Everstake logo white: x=82 y=90 -->
      <img src="${everstakeLogo}" style="position:absolute;top:90px;left:82px;height:40px;z-index:10;" />

      <!-- Title: x=82 y=544, 132px, white, auto-fit -->
      <div id="title-container" style="position:absolute;left:82px;top:544px;width:663px;height:274px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:132px;line-height:1.04;">${title}</div>
      </div>

      <!-- Partner logo white, centered in right area (x=801..1560, y=40..860) -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:801px;top:40px;width:759px;height:820px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:436px;max-height:440px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 11: Collaboration 3 companies — title left, 3 logos right
// Figma: Collaboration - 3 company
// ============================================
function template11({ title, subtitle, partnerLogo1, partnerLogo2, partnerLogo3 }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-11.png'));
  const logo1Src = partnerLogo1 ? getPartnerLogo(partnerLogo1) : '';
  const logo2Src = partnerLogo2 ? getPartnerLogo(partnerLogo2) : '';
  const logo3Src = partnerLogo3 ? getPartnerLogo(partnerLogo3) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#034638;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Title: x=82 y=478, 86px -->
      <div id="title-container" style="position:absolute;left:82px;top:478px;width:810px;height:267px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:86px;line-height:1.08;">${title}</div>
      </div>

      <!-- Subtitle: x=82 y=769, 44px, #7b9690 -->
      ${subtitle ? `<div style="position:absolute;left:82px;top:769px;z-index:5;font-weight:500;font-size:44px;color:#7b9690;">${subtitle}</div>` : ''}

      <!-- Logo 1: centered in (940..1560, 40..291) -->
      ${logo1Src ? `
        <div style="position:absolute;left:940px;top:40px;width:620px;height:251px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo1Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}

      <!-- Logo 2: centered in (940..1560, 293..576) -->
      ${logo2Src ? `
        <div style="position:absolute;left:940px;top:293px;width:620px;height:283px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo2Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}

      <!-- Logo 3: centered in (940..1560, 578..860) -->
      ${logo3Src ? `
        <div style="position:absolute;left:940px;top:578px;width:620px;height:282px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo3Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 12: Dark Collaboration 3 companies — dark bg, white text left, 3 logos right
// Figma: Collaboration - 3 company (dark)
// ============================================
function template12({ title, subtitle, partnerLogo1, partnerLogo2, partnerLogo3 }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-12.png'));
  const logo1Src = partnerLogo1 ? getPartnerLogo(partnerLogo1) : '';
  const logo2Src = partnerLogo2 ? getPartnerLogo(partnerLogo2) : '';
  const logo3Src = partnerLogo3 ? getPartnerLogo(partnerLogo3) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#f5fffd;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Title: x=82 y=478, 86px, white -->
      <div id="title-container" style="position:absolute;left:82px;top:478px;width:810px;height:267px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:86px;line-height:1.08;">${title}</div>
      </div>

      <!-- Subtitle: x=82 y=769, 44px, #7b9690 -->
      ${subtitle ? `<div style="position:absolute;left:82px;top:769px;z-index:5;font-weight:500;font-size:44px;color:#7b9690;">${subtitle}</div>` : ''}

      <!-- Logo 1: centered in (940..1560, 40..291), white -->
      ${logo1Src ? `
        <div style="position:absolute;left:940px;top:40px;width:620px;height:251px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo1Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}

      <!-- Logo 2: centered in (940..1560, 293..576), white -->
      ${logo2Src ? `
        <div style="position:absolute;left:940px;top:293px;width:620px;height:283px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo2Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}

      <!-- Logo 3: centered in (940..1560, 578..860), white -->
      ${logo3Src ? `
        <div style="position:absolute;left:940px;top:578px;width:620px;height:282px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo3Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 13: Guide/Tutorial — everstake x partner top, subtitle + title left, crypto icon right
// Figma: DES-294
// ============================================
function template13({ title, subtitle, partnerLogo, cryptoIcon }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-13.png'));
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-dark.png'));
  const partnerLogoSrc = partnerLogo ? getPartnerLogo(partnerLogo) : '';
  const cryptoIconSrc = cryptoIcon ? getPartnerLogo(cryptoIcon) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#034638;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Top: everstake x partner logos -->
      <div style="position:absolute;left:82px;top:82px;display:flex;align-items:center;gap:20px;z-index:10;">
        <img src="${everstakeLogo}" style="height:40px;" />
        ${partnerLogoSrc ? `
          <span style="font-size:18px;color:#7b9690;">x</span>
          <img src="${partnerLogoSrc}" style="height:40px;width:auto;" />
        ` : ''}
      </div>

      <!-- Subtitle: x=82 y=468, 22px -->
      ${subtitle ? `<div style="position:absolute;left:82px;top:468px;z-index:5;font-weight:500;font-size:22px;letter-spacing:0.05em;">${subtitle}</div>` : ''}

      <!-- Title: x=82 y=518, 96px, auto-fit -->
      <div id="title-container" style="position:absolute;left:82px;top:518px;width:654px;height:300px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:96px;line-height:1.04;">${title}</div>
      </div>

      <!-- Crypto icon centered in right panel -->
      ${cryptoIconSrc ? `
        <div style="position:absolute;left:800px;top:40px;width:760px;height:820px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${cryptoIconSrc}" style="max-width:480px;max-height:480px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 14: Dark — partner logo left panel, text right (white)
// Figma: DES-286 (Solana)
// ============================================
function template14({ title, subtitle, partnerLogo }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-14.png'));
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-light.png'));
  const partnerLogoSrc = partnerLogo ? getPartnerLogo(partnerLogo) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#f5fffd;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Partner logo centered in left panel (40..799, 40..860), white -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:40px;top:40px;width:759px;height:820px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:600px;max-height:300px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}

      <!-- Everstake logo white: x=855 y=82 -->
      <img src="${everstakeLogo}" style="position:absolute;top:82px;left:855px;height:40px;z-index:10;" />

      <!-- Subtitle: x=855 y=470, 20px -->
      ${subtitle ? `<div style="position:absolute;left:855px;top:470px;z-index:5;font-weight:500;font-size:20px;letter-spacing:0.1em;text-transform:uppercase;">${subtitle}</div>` : ''}

      <!-- Title: x=855 y=526, 96px, auto-fit -->
      <div id="title-container" style="position:absolute;left:855px;top:526px;width:655px;height:300px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:96px;line-height:1.04;">${title}</div>
      </div>
    </div>
  </body></html>`;
}

// ============================================
// Template 15: Dark — text left, partner icon right panel
// Figma: DES-322
// ============================================
function template15({ title, subtitle, partnerLogo }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-15.png'));
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-light.png'));
  const partnerLogoSrc = partnerLogo ? getPartnerLogo(partnerLogo) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#f5fffd;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Everstake logo white: x=82 y=90 -->
      <img src="${everstakeLogo}" style="position:absolute;top:90px;left:82px;height:40px;z-index:10;" />

      <!-- Title: x=82 y=493, 83px, auto-fit -->
      <div id="title-container" style="position:absolute;left:82px;top:493px;width:663px;height:258px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:83px;line-height:1.04;">${title}</div>
      </div>

      <!-- Subtitle: x=82 y=775, 38px, #7b9690 -->
      ${subtitle ? `<div style="position:absolute;left:82px;top:775px;z-index:5;font-weight:500;font-size:38px;color:#7b9690;">${subtitle}</div>` : ''}

      <!-- Partner icon centered in right panel (801..1560, 40..860), white -->
      ${partnerLogoSrc ? `
        <div style="position:absolute;left:801px;top:40px;width:759px;height:820px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${partnerLogoSrc}" style="max-width:480px;max-height:480px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Template 16: Dark Guide — icon left panel, everstake x partner + title right
// Figma: DES-286 (Cardano/Trezor)
// ============================================
function template16({ title, partnerLogo, cryptoIcon }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-14.png'));
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-light.png'));
  const partnerLogoSrc = partnerLogo ? getPartnerLogo(partnerLogo) : '';
  const cryptoIconSrc = cryptoIcon ? getPartnerLogo(cryptoIcon) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#f5fffd;">
      <!-- Background (reuse template-14 bg) -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Crypto icon centered in left panel (40..799, 40..860), white -->
      ${cryptoIconSrc ? `
        <div style="position:absolute;left:40px;top:40px;width:759px;height:820px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${cryptoIconSrc}" style="max-width:480px;max-height:480px;width:auto;height:auto;filter:brightness(0) invert(1);" />
        </div>
      ` : ''}

      <!-- Top right: everstake x partner logos -->
      <div style="position:absolute;left:855px;top:100px;display:flex;align-items:center;gap:20px;z-index:10;">
        <img src="${everstakeLogo}" style="height:40px;" />
        ${partnerLogoSrc ? `
          <span style="font-size:18px;color:#7b9690;">x</span>
          <img src="${partnerLogoSrc}" style="height:40px;width:auto;filter:brightness(0) invert(1);" />
        ` : ''}
      </div>

      <!-- Title: x=855 y=530, 92px, auto-fit -->
      <div id="title-container" style="position:absolute;left:855px;top:530px;width:647px;height:288px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:92px;line-height:1.04;">${title}</div>
      </div>
    </div>
  </body></html>`;
}

// ============================================
// Template 17: Collaboration 2 companies — title left, 2 logos stacked right
// Figma: DES-320 (Everstake + Sats Terminal)
// ============================================
function template17({ title, partnerLogo1, partnerLogo2 }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-17.png'));
  const logo1Src = partnerLogo1 ? getPartnerLogo(partnerLogo1) : '';
  const logo2Src = partnerLogo2 ? getPartnerLogo(partnerLogo2) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner" style="color:#034638;">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Title: x=82 y=418, 96px, auto-fit -->
      <div id="title-container" style="position:absolute;left:82px;top:418px;width:810px;height:400px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        <div id="title" style="font-weight:200;font-size:96px;line-height:1.04;">${title}</div>
      </div>

      <!-- Logo 1: centered in (940..1560, 40..449) -->
      ${logo1Src ? `
        <div style="position:absolute;left:940px;top:40px;width:620px;height:409px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo1Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}

      <!-- Logo 2: centered in (940..1560, 451..860) -->
      ${logo2Src ? `
        <div style="position:absolute;left:940px;top:451px;width:620px;height:409px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo2Src}" style="max-width:479px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// ============================================
// Collaboration: everstake x partner — two logos centered
// Figma: everstake logo at x=274 y=402, partner at x=1045 y=383
// Center frame: y=325 h=250 (vertically centered in banner)
// ============================================
function typeCollaboration({ partnerLogo }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-collaboration.png'));
  // Everstake logo in #034638 (SVG from Figma Collaboration frame)
  const everstakeLogo = imageToBase64(path.join(LOGOS_DIR, 'everstake-collab.svg'));
  const partnerLogoSrc = getPartnerLogo(partnerLogo);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner">
      <!-- Figma background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Centered logos: everstake x partner (visually equal) -->
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:50px;z-index:5;">
        <img src="${everstakeLogo}" style="height:86px;width:auto;" />
        <span style="font-family:'Zalando Sans',sans-serif;font-weight:300;font-size:48px;color:#034638;opacity:0.5;">x</span>
        ${partnerLogoSrc ? `<img src="${partnerLogoSrc}" style="height:86px;width:auto;" />` : ''}
      </div>
    </div>
  </body></html>`;
}

// ============================================
// Template 18: Wide dark left + 2 logos right (light)
// Figma: DES-306 variant (Solana/DoubleZero)
// ============================================
function template18({ title, subtitle, partnerLogo1, partnerLogo2 }) {
  const bgSrc = imageToBase64(path.join(LOGOS_DIR, 'bg-template-18.png'));
  const logo1Src = partnerLogo1 ? getPartnerLogo(partnerLogo1) : '';
  const logo2Src = partnerLogo2 ? getPartnerLogo(partnerLogo2) : '';

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
  </style></head><body>
    <div class="banner">
      <!-- Background -->
      <img src="${bgSrc}" style="position:absolute;top:0;left:0;width:1600px;height:900px;z-index:0;" />

      <!-- Subtitle and title share a flex container so they sit
           together near the bottom (subtitle just above title) -->
      <div id="title-container" style="position:absolute;left:48px;top:448px;width:884px;height:400px;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;">
        ${subtitle ? `<div style="font-weight:500;font-size:40px;color:#7b9690;margin-bottom:24px;">${subtitle}</div>` : ''}
        <div id="title" style="font-weight:200;font-size:96px;line-height:1.04;color:#f5fffd;">${title}</div>
      </div>

      <!-- Logo 1: centered in (980..1600, 0..448) -->
      ${logo1Src ? `
        <div style="position:absolute;left:980px;top:2px;width:620px;height:446px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo1Src}" style="max-width:438px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}

      <!-- Logo 2: centered in (980..1600, 450..898) -->
      ${logo2Src ? `
        <div style="position:absolute;left:980px;top:450px;width:620px;height:448px;display:flex;align-items:center;justify-content:center;z-index:5;">
          <img src="${logo2Src}" style="max-width:450px;max-height:100px;width:auto;height:auto;" />
        </div>
      ` : ''}
    </div>
  </body></html>`;
}

// Template registry
const TEMPLATES = {
  'type-a': {
    name: 'Brand Article',
    description: 'Split layout: title left, partner logo right',
    render: typeA,
    fields: ['title', 'subtitle', 'partnerLogo', 'theme'],
  },
  'type-b': {
    name: 'Centered Title',
    description: 'Large centered title with optional logo above',
    render: typeB,
    fields: ['title', 'subtitle', 'partnerLogo', 'theme'],
  },
  'type-c': {
    name: 'Dark Article',
    description: 'Dark background with centered title',
    render: typeC,
    fields: ['title', 'subtitle'],
  },
  'type-d': {
    name: 'Partnership',
    description: 'Everstake x Partner logos',
    render: typeD,
    fields: ['partnerLogo', 'theme'],
  },
  'type-e': {
    name: 'Week in Blockchains',
    description: 'Weekly digest banner with crypto icons',
    render: typeE,
    fields: ['dateRange', 'cryptoIcons', 'theme'],
  },
  'type-f': {
    name: 'Guide / Tutorial',
    description: 'Split layout with right illustration',
    render: typeF,
    fields: ['title', 'subtitle', 'partnerLogo', 'rightImage', 'theme'],
  },
  'apr': {
    name: 'APR',
    description: 'Crypto APR banner: subtitle + title left, logo right',
    render: typeAPR,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'collaboration': {
    name: 'Collaboration',
    description: 'Everstake x Partner — two logos centered',
    render: typeCollaboration,
    fields: ['partnerLogo'],
  },
  'template-5': {
    name: 'About Blockchain v1',
    description: 'Split layout: text left, partner logo right',
    render: template5,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'template-6': {
    name: 'About Blockchain v2',
    description: 'Split layout: partner logo left, text right',
    render: template6,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'template-7': {
    name: 'Dark Left Panel',
    description: 'Dark left with text, partner logo right',
    render: template7,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'template-8': {
    name: 'Dark Right Panel',
    description: 'Text left, dark right with partner logo',
    render: template8,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'template-9': {
    name: 'Centered Logo + Title',
    description: 'Logo top center, title bottom center, grid lines',
    render: template9,
    fields: ['title', 'partnerLogo'],
  },
  'template-10': {
    name: 'Dark Full',
    description: 'Dark bg, white text left, white partner logo right',
    render: template10,
    fields: ['title', 'partnerLogo'],
  },
  'template-11': {
    name: 'Collaboration 3 Companies',
    description: 'Title left, 3 partner logos stacked right',
    render: template11,
    fields: ['title', 'subtitle', 'partnerLogo1', 'partnerLogo2', 'partnerLogo3'],
  },
  'template-12': {
    name: 'Dark Collaboration 3 Companies',
    description: 'Dark bg, white text left, 3 white logos right',
    render: template12,
    fields: ['title', 'subtitle', 'partnerLogo1', 'partnerLogo2', 'partnerLogo3'],
  },
  'template-13': {
    name: 'Guide / Tutorial',
    description: 'Everstake x partner top, title left, crypto icon right',
    render: template13,
    fields: ['title', 'subtitle', 'partnerLogo', 'cryptoIcon'],
  },
  'template-14': {
    name: 'Dark Partner Left',
    description: 'Dark bg, partner logo left panel, white text right',
    render: template14,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'template-15': {
    name: 'Dark Text Left + Icon Right',
    description: 'Dark bg, white text left, partner icon on right gradient panel',
    render: template15,
    fields: ['title', 'subtitle', 'partnerLogo'],
  },
  'template-16': {
    name: 'Dark Guide',
    description: 'Dark bg, crypto icon left, everstake x partner + title right',
    render: template16,
    fields: ['title', 'partnerLogo', 'cryptoIcon'],
  },
  'template-17': {
    name: 'Collaboration 2 Companies',
    description: 'Title left, 2 partner logos stacked right',
    render: template17,
    fields: ['title', 'partnerLogo1', 'partnerLogo2'],
  },
  'template-18': {
    name: 'Wide Dark + 2 Logos',
    description: 'Wide dark left with text, 2 logos stacked right on light bg',
    render: template18,
    fields: ['title', 'subtitle', 'partnerLogo1', 'partnerLogo2'],
  },
};

// Logo category map. Two kinds:
//   • 'full'     — has wordmark / brand text (e.g. "Aptos" written next
//                  to the icon). Suitable for templates with a wide
//                  panel where the wordmark fits comfortably.
//   • 'logomark' — icon / symbol only, no text. Suitable for templates
//                  with small circular slots (APR badge, 2-3 collab
//                  layouts) where text would be unreadable.
//
// Anything not listed defaults to 'logomark' (the safer choice when
// uncertain — a wordmark squeezed into a logomark slot looks much
// worse than a logomark in a wordmark slot).
const LOGO_CATEGORY = {
  // Wordmark / full-brand logos
  'aptos-full.svg':         'full',
  'doublezero.svg':         'full',
  'ethereum-full.svg':      'full',
  'neo-full.svg':           'full',
  'partner-horizontal.svg': 'full',
  'satsterminal.svg':       'full',
  'solana-full.svg':        'full',
  'trezor.svg':             'full',
  'trezor-white.svg':       'full',

  // Icon-only logomarks
  'aptos.png':              'logomark',
  'cardano.svg':            'logomark',
  'celestia.svg':           'logomark',
  'collab2-logo1.svg':      'logomark',
  'collab3-logo1.svg':      'logomark',
  'collab3-logo2.svg':      'logomark',
  'collab3-logo3.svg':      'logomark',
  'icon-network.svg':       'logomark',
  'injective.svg':          'logomark',
  'monad.svg':              'logomark',
  'solana.png':             'logomark',
  'sui.png':                'logomark',
  't18-logo1.svg':          'logomark',
};

function getLogoCategory(filename) {
  return LOGO_CATEGORY[filename] || 'logomark';
}

// List available partner logos, optionally filtered by category.
//   listLogos()           → every logo
//   listLogos('full')     → only wordmark logos
//   listLogos('logomark') → only logomarks
//
// Filters out background/decoration assets that aren't actual brand
// logos (`bg-*`, `pattern-*`, `week-icons*`, and Everstake's own marks).
function listLogos(category) {
  const files = fs.readdirSync(LOGOS_DIR);
  const NON_LOGO = /^(bg-|pattern-|everstake-|week-icons)/i;
  const all = files.filter(
    f => !NON_LOGO.test(f) && /\.(png|jpg|jpeg|svg|webp)$/i.test(f)
  );
  if (!category || category === 'all') return all;
  return all.filter(f => getLogoCategory(f) === category);
}

module.exports = { TEMPLATES, listLogos, getLogoCategory, getPartnerLogo, getEverstakeLogo, imageToBase64 };
