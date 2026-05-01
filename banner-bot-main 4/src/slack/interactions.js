/**
 * Slack interaction wiring.
 *
 *   /banner                       → Step 1 modal: template gallery
 *     ↳ button "select_template"  → push Step 2 (form + logo gallery)
 *       ↳ button "select_logo"    → views.update, marks logo as selected
 *       ↳ button "clear_logo"     → views.update, removes selection
 *       ↳ button "back_to_templates" → views.update, goes back to Step 1
 *       ↳ submit "banner_submit"  → render banner, post to channel as a
 *                                   thread parent + upload file in thread +
 *                                   post the "Approved by Max" follow-up.
 *
 *   button "approve_banner"       → updates the follow-up message in place,
 *                                   crossing out the button and recording
 *                                   who approved.
 */

const fs = require('fs');
const { TEMPLATES, listLogos } = require('../templates/templates');
const { PREVIEWS, getPreview } = require('../templates/preview-list');
const { renderBanner } = require('../renderer');
const {
  publicBaseUrl,
  templatePreviewUrl,
  logoPreviewUrl,
} = require('../lib/static-server');

// ---------------------------------------------------------------------------
// View builders
// ---------------------------------------------------------------------------

const APPROVER_NAME = process.env.APPROVER_NAME || 'Max';

function packMeta(obj) {
  return JSON.stringify(obj || {});
}

function unpackMeta(str) {
  try {
    return str ? JSON.parse(str) : {};
  } catch (_) {
    return {};
  }
}

/**
 * Step 1 — template gallery.
 * 21 entries × 3 blocks (header section + image + actions) = 63 blocks (limit: 100).
 */
function buildTemplateGalleryView(meta) {
  const baseUrl = publicBaseUrl();
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Step 1 of 2 — Choose a template*\nClick the button under any preview to continue.',
      },
    },
    { type: 'divider' },
  ];

  if (!baseUrl) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':warning: `PUBLIC_BASE_URL` is not configured — previews will not load. Falling back to text labels.',
      },
    });
  }

  for (const p of PREVIEWS) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${p.num}. ${p.label}*`,
      },
    });

    if (baseUrl) {
      blocks.push({
        type: 'image',
        image_url: templatePreviewUrl(p.num),
        alt_text: p.label,
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: `Use this template` },
          value: String(p.num),
          action_id: 'select_template',
          style: 'primary',
        },
      ],
    });
  }

  return {
    type: 'modal',
    callback_id: 'banner_step_template',
    title: { type: 'plain_text', text: 'Create Banner' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: packMeta(meta),
    blocks,
  };
}

/**
 * Step 2 — form + logo gallery.
 * The selected template preview shows at the top. Below: title/subtitle/theme/
 * date inputs (initial values restored from `formState`). At the bottom: a
 * gallery of partner-logo previews with select buttons.
 */
function buildFormView(meta, formState = {}) {
  const baseUrl = publicBaseUrl();
  const preview = getPreview(meta.previewNum);
  const tplName = preview ? preview.label : `Template ${meta.previewNum}`;

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Step 2 of 2 — Banner details*\nSelected template: *${tplName}*`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '← Change template' },
        action_id: 'back_to_templates',
        value: 'back',
      },
    },
  ];

  if (baseUrl && preview) {
    blocks.push({
      type: 'image',
      image_url: templatePreviewUrl(preview.num),
      alt_text: tplName,
    });
  }

  blocks.push(
    { type: 'divider' },

    {
      type: 'input',
      block_id: 'title_block',
      label: { type: 'plain_text', text: 'Title' },
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'title_input',
        placeholder: { type: 'plain_text', text: 'Main banner title' },
        multiline: true,
        ...(formState.title ? { initial_value: formState.title } : {}),
      },
    },

    {
      type: 'input',
      block_id: 'subtitle_block',
      label: { type: 'plain_text', text: 'Subtitle' },
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'subtitle_input',
        placeholder: { type: 'plain_text', text: 'Small text above the title' },
        ...(formState.subtitle ? { initial_value: formState.subtitle } : {}),
      },
    },

    {
      type: 'input',
      block_id: 'theme_block',
      label: { type: 'plain_text', text: 'Theme' },
      element: {
        type: 'static_select',
        action_id: 'theme_select',
        options: [
          { text: { type: 'plain_text', text: 'Light' }, value: 'light' },
          { text: { type: 'plain_text', text: 'Dark' }, value: 'dark' },
        ],
        initial_option: {
          text: { type: 'plain_text', text: formState.theme === 'dark' ? 'Dark' : 'Light' },
          value: formState.theme === 'dark' ? 'dark' : 'light',
        },
      },
    },

    {
      type: 'input',
      block_id: 'date_block',
      label: { type: 'plain_text', text: 'Date Range (only used by the “Week in Blockchains” template)' },
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'date_input',
        placeholder: { type: 'plain_text', text: 'e.g. February 23 – March 1' },
        ...(formState.dateRange ? { initial_value: formState.dateRange } : {}),
      },
    },

    { type: 'divider' },
  );

  // ── Partner logo section ────────────────────────────────────────────────
  const selectedLogo = meta.partnerLogo;
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: selectedLogo
        ? `*Partner logo:* \`${selectedLogo}\``
        : '*Partner logo:* _none selected_',
    },
    accessory: selectedLogo
      ? {
          type: 'button',
          text: { type: 'plain_text', text: 'Clear' },
          action_id: 'clear_logo',
          value: 'clear',
        }
      : undefined,
  });

  const logos = listLogos();
  if (logos.length === 0) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '_No partner logos available in `assets/logos/`._' },
      ],
    });
  } else {
    for (const logoFile of logos) {
      const isSelected = selectedLogo === logoFile;
      const stem = logoFile.replace(/\.[^.]+$/, '');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: isSelected ? `*${stem}* ✅` : `*${stem}*`,
        },
      });

      if (baseUrl) {
        blocks.push({
          type: 'image',
          image_url: logoPreviewUrl(logoFile),
          alt_text: stem,
        });
      }

      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: isSelected ? '✓ Selected' : 'Select',
            },
            value: logoFile,
            action_id: 'select_logo',
            ...(isSelected ? { style: 'primary' } : {}),
          },
        ],
      });
    }
  }

  // Slack modals cap at 100 blocks. Hard guard so we don't 500.
  const safeBlocks = blocks.slice(0, 100);

  return {
    type: 'modal',
    callback_id: 'banner_submit',
    title: { type: 'plain_text', text: 'Create Banner' },
    submit: { type: 'plain_text', text: 'Generate' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: packMeta(meta),
    blocks: safeBlocks,
  };
}

/**
 * Pull current input values out of a Slack view payload so we can preserve
 * them across views.update calls.
 */
function extractFormState(view) {
  const v = view?.state?.values || {};
  return {
    title: v.title_block?.title_input?.value || '',
    subtitle: v.subtitle_block?.subtitle_input?.value || '',
    theme: v.theme_block?.theme_select?.selected_option?.value || 'light',
    dateRange: v.date_block?.date_input?.value || '',
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function registerSlackHandlers(app) {
  // ── /banner: open Step 1 ───────────────────────────────────────────────
  app.command('/banner', async ({ ack, body, client }) => {
    await ack();
    const meta = { channelId: body.channel_id || '' };
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildTemplateGalleryView(meta),
    });
  });

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────
  app.action('select_template', async ({ ack, body, client }) => {
    await ack();
    const previewNum = parseInt(body.actions[0].value, 10);
    const meta = unpackMeta(body.view.private_metadata);
    meta.previewNum = previewNum;
    await client.views.update({
      view_id: body.view.id,
      hash: body.view.hash,
      view: buildFormView(meta, {}),
    });
  });

  // ── Step 2 → Step 1 ────────────────────────────────────────────────────
  app.action('back_to_templates', async ({ ack, body, client }) => {
    await ack();
    const meta = unpackMeta(body.view.private_metadata);
    delete meta.previewNum;
    delete meta.partnerLogo;
    await client.views.update({
      view_id: body.view.id,
      hash: body.view.hash,
      view: buildTemplateGalleryView(meta),
    });
  });

  // ── Step 2: pick a partner logo ────────────────────────────────────────
  app.action('select_logo', async ({ ack, body, client }) => {
    await ack();
    const logoFile = body.actions[0].value;
    const meta = unpackMeta(body.view.private_metadata);
    meta.partnerLogo = logoFile;
    const formState = extractFormState(body.view);
    await client.views.update({
      view_id: body.view.id,
      hash: body.view.hash,
      view: buildFormView(meta, formState),
    });
  });

  // ── Step 2: clear partner logo ─────────────────────────────────────────
  app.action('clear_logo', async ({ ack, body, client }) => {
    await ack();
    const meta = unpackMeta(body.view.private_metadata);
    delete meta.partnerLogo;
    const formState = extractFormState(body.view);
    await client.views.update({
      view_id: body.view.id,
      hash: body.view.hash,
      view: buildFormView(meta, formState),
    });
  });

  // ── Final submit: render & post ────────────────────────────────────────
  app.view('banner_submit', async ({ ack, view, client, body }) => {
    await ack();

    const meta = unpackMeta(view.private_metadata);
    const formState = extractFormState(view);
    const channelId = meta.channelId;
    const userId = body.user.id;

    const preview = getPreview(meta.previewNum);
    if (!preview) {
      console.error('banner_submit without a previewNum in metadata');
      return;
    }

    // Build params: defaults from preview-list, overridden by form input.
    const params = { ...preview.defaults };
    if (formState.title) params.title = formState.title;
    if (formState.subtitle) params.subtitle = formState.subtitle;
    if (formState.theme) params.theme = formState.theme;
    if (formState.dateRange) params.dateRange = formState.dateRange;
    if (preview.variant) params.variant = preview.variant;

    if (meta.partnerLogo) {
      // Apply to all partnerLogo* slots so multi-logo templates show *something*.
      params.partnerLogo = meta.partnerLogo;
      if (!params.partnerLogo1) params.partnerLogo1 = meta.partnerLogo;
    }

    let parentTs = null;
    let outputPath = null;

    try {
      // 1. Post a parent message in the channel — everything else lands in
      //    its thread, so the channel itself stays clean.
      if (channelId) {
        const msg = await client.chat.postMessage({
          channel: channelId,
          text: `:hourglass_flowing_sand: <@${userId}> is generating *${preview.label}*…`,
        });
        parentTs = msg.ts;
      }

      // 2. Render banner.
      outputPath = await renderBanner(preview.id, params);

      // 3. Upload the file as a thread reply.
      const uploadTarget = channelId || userId;
      const titleText = params.title || preview.label;
      await client.files.uploadV2({
        channel_id: uploadTarget,
        thread_ts: parentTs || undefined,
        file: fs.createReadStream(outputPath),
        filename: `banner-${Date.now()}.png`,
        title: `Banner: ${titleText}`,
        initial_comment: `:white_check_mark: Banner ready — *${preview.label}*${
          params.title ? ` · "${params.title}"` : ''
        }`,
      });

      // 4. Post the approval follow-up in the same thread.
      if (channelId) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: parentTs,
          text: 'Pending approval',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:eyes: Awaiting design review.`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: `Approved by ${APPROVER_NAME}`,
                    emoji: true,
                  },
                  style: 'primary',
                  action_id: 'approve_banner',
                  value: parentTs || '',
                },
              ],
            },
          ],
        });
      }

      // 5. Update the parent message.
      if (parentTs) {
        await client.chat
          .update({
            channel: channelId,
            ts: parentTs,
            text: `:art: <@${userId}> generated *${preview.label}* — file in thread.`,
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error('Banner generation error:', error);
      const target = channelId || userId;
      if (target) {
        await client.chat.postMessage({
          channel: target,
          thread_ts: parentTs || undefined,
          text: `:x: Failed to generate banner: ${error.message}`,
        });
      }
    } finally {
      if (outputPath && fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (_) {}
      }
    }
  });

  // ── "Approved by Max" button click ─────────────────────────────────────
  app.action('approve_banner', async ({ ack, body, client }) => {
    await ack();

    const channel = body.channel?.id || body.container?.channel_id;
    const messageTs = body.message?.ts || body.container?.message_ts;
    if (!channel || !messageTs) return;

    const approverDisplay = `<@${body.user.id}>`;
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    try {
      await client.chat.update({
        channel,
        ts: messageTs,
        text: `Approved by ${APPROVER_NAME}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:white_check_mark: *Approved by ${APPROVER_NAME}* — clicked by ${approverDisplay} at ${ts}.`,
            },
          },
        ],
      });
      // Optional: react to the parent so it's visible in the channel.
      const parentTs = body.actions?.[0]?.value;
      if (parentTs) {
        await client.reactions
          .add({ channel, timestamp: parentTs, name: 'white_check_mark' })
          .catch(() => {});
      }
    } catch (err) {
      console.error('approve_banner update failed:', err);
    }
  });
}

module.exports = { registerSlackHandlers };
