require('dotenv').config();
const { App } = require('@slack/bolt');
const { registerSlackHandlers } = require('./slack/interactions');
const { closeBrowser } = require('./renderer');
const { startStaticServer, publicBaseUrl } = require('./lib/static-server');
const { warmLogoPreviews } = require('./lib/logo-previews');
const { listLogos } = require('./templates/templates');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

registerSlackHandlers(app);

(async () => {
  // Static server (template/logo previews) runs on PORT — required so
  // Slack image blocks can fetch the rendered PNGs.
  startStaticServer();

  // Pre-render PNG previews for all SVG logos so the gallery feels instant
  // when /banner is invoked. Runs in background — non-fatal if it fails.
  warmLogoPreviews(listLogos()).catch(err => {
    console.warn('[startup] logo warmup error:', err.message);
  });

  await app.start();
  console.log('⚡ Banner Bot is running!');
  console.log('Use /banner in Slack to create a banner.');

  if (!publicBaseUrl()) {
    console.warn(
      '\n[!] PUBLIC_BASE_URL is not set. Slack image previews will not render.\n' +
        '    On Railway this is provided automatically via RAILWAY_PUBLIC_DOMAIN;\n' +
        '    locally, expose a tunnel (e.g. cloudflared / ngrok) and set\n' +
        '    PUBLIC_BASE_URL=https://your-tunnel.example\n'
    );
  }
})();

// Graceful shutdown
async function shutdown() {
  await closeBrowser();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
