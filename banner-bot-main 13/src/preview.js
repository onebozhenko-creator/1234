/**
 * Preview script - generates all template types locally for review.
 * Usage: npm run preview
 */
const { renderBanner } = require('./renderer');
const { closeBrowser, } = require('./renderer');
const { TEMPLATES, listLogos } = require('./templates/templates');

async function main() {
  console.log('Generating preview banners...\n');
  console.log(`Available logos: ${listLogos().join(', ') || '(none)'}`);
  console.log(`Templates: ${Object.keys(TEMPLATES).join(', ')}\n`);

  const logos = listLogos();
  const firstLogo = logos[0] || '';

  const previews = [
    {
      id: 'type-a',
      params: { title: "Monad's Next Global Initiatives", subtitle: 'Monad Ignites the Builder Economy', partnerLogo: firstLogo, theme: 'light' },
    },
    {
      id: 'type-b',
      params: { title: 'The Ethereum Foundation Is Set to Stake 70,000 ETH From Treasury', subtitle: '', partnerLogo: firstLogo, theme: 'light' },
    },
    {
      id: 'type-b',
      params: { title: 'Selecting the Right Staking-as-a-Service Provider', theme: 'light' },
      suffix: '-no-logo',
    },
    {
      id: 'type-c',
      params: { title: 'The Hardware Layer of Agentic Economy' },
    },
    {
      id: 'type-c',
      params: { title: 'Future-Proofing Proof of Stake', subtitle: 'Infrastructure Deep Dive' },
      suffix: '-with-subtitle',
    },
    {
      id: 'type-d',
      params: { partnerLogo: firstLogo, theme: 'light' },
    },
    {
      id: 'type-e',
      params: { dateRange: 'February 23 – March 1', theme: 'light' },
    },
    {
      id: 'type-f',
      params: { title: 'How to stake ADA using Trezor Suite', subtitle: 'Step-by-step guide', partnerLogo: firstLogo, theme: 'light' },
    },
  ];

  for (const { id, params, suffix = '' } of previews) {
    try {
      const outputPath = await renderBanner(id, params);
      console.log(`✓ ${TEMPLATES[id].name}${suffix}: ${outputPath}`);
    } catch (err) {
      console.error(`✗ ${id}${suffix}: ${err.message}`);
    }
  }

  await closeBrowser();
  console.log('\nDone! Check the output/ directory.');
}

main().catch(console.error);
