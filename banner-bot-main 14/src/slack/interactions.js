/**
 * Slack interaction wiring.
 *
 *   /banner                       → Step 1 modal: template gallery
 *     ↳ button "select_template"  → push Step 2 (form + logo gallery)
 *       ↳ button "select_logo"    → views.update, fills the targeted slot
 *       ↳ button "clear_logo"     → views.update, removes one slot
 *       ↳ button "back_to_templates" → views.update, goes back to Step 1
 *       ↳ submit "banner_submit"  → render banner, post to channel as a
 *                                   thread parent + upload file in thread +
 *                                   post the "Approved by Max" follow-up.
 *
 *   button "approve_banner"       → only the user whose Slack ID matches
 *                                   APPROVER_USER_ID can succeed; everyone
 *                                   else gets an ephemeral rejection.
 *
 * Form rendering is driven by `template.fields` — each template only shows
 * the inputs it actually consumes (e.g. APR has no logo gallery, "Week in
 * Blockchains" has only a date input, multi-logo templates show 2–3 logo
 * slots). The Light/Dark selector is intentionally absent: each preview
 * already pins its own theme (via `variant` or via `defaults.theme`), so
 * the user never picks one.
 */

const fs = require('fs');
const path = require('path');
const { TEMPLATES, listLogos } = require('../templates/templates');
const { PREVIEWS, getPreview } = require('../templates/preview-list');
const { renderBanner } = require('../renderer');
const { thumbnailBanner } = require('../lib/thumbnail');
const {
  publicBaseUrl,
  templatePreviewUrl,
  logoPreviewUrl,
} = require('../lib/static-server');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Default approver: Maksym Kunytsia. Override per-deployment via env if needed
// (e.g. for testing in a separate workspace). Setting APPROVER_USER_ID to an
// empty string explicitly disables approval (fail closed).
const APPROVER_NAME = process.env.APPROVER_NAME || 'Maksym Kunytsia';
const APPROVER_USER_ID = process.env.APPROVER_USER_ID !== undefined
  ? process.env.APPROVER_USER_ID
  : 'U08CA4E0DC2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Returns the list of partner-logo slot keys this template consumes.
 * Examples:
 *   ['partnerLogo']                                    → 1 slot
 *   ['partnerLogo1', 'partnerLogo2']                   → 2 slots
 *   ['partnerLogo1', 'partnerLogo2', 'partnerLogo3']   → 3 slots
 *   []                                                 → no logo gallery
 */
function logoSlots(template) {
  if (!template?.fields) return [];
  return template.fields.filter(f => /^partnerLogo\d?$/.test(f));
}

function templateForPreview(preview) {
  return preview ? TEMPLATES[preview.id] : null;
}

// ---------------------------------------------------------------------------
// Step 1 — template gallery
// ---------------------------------------------------------------------------

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
      text: { type: 'mrkdwn', text: `*${p.num}. ${p.label}*` },
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
          text: { type: 'plain_text', text: 'Use this template' },
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

// ---------------------------------------------------------------------------
// Step 2 — per-template form
// ---------------------------------------------------------------------------

/**
 * Builds the Step 2 modal. Only renders inputs whose names appear in the
 * selected template's `fields` array. The logo gallery section is shown
 * only when the template has at least one `partnerLogo*` slot, and the
 * gallery's per-row buttons are scaled to the number of slots (1, 2, or 3).
 *
 * `formState` carries values typed by the user across views.update calls so
 * they survive logo selection / slot switching.
 */
function buildFormView(meta, formState = {}) {
  const baseUrl = publicBaseUrl();
  const preview = getPreview(meta.previewNum);
  const template = templateForPreview(preview);
  const fields = template?.fields || [];
  // logoType:'none' explicitly suppresses the logo gallery even if the
  // template's `fields` mention partnerLogo* — used for purely-text or
  // background-driven templates (Text-in-Center, Week-in-Blockchains).
  const slots = preview?.logoType === 'none' ? [] : logoSlots(template);

  const tplName = preview ? preview.label : `Template ${meta.previewNum}`;
  const selectedLogos = meta.partnerLogos || {}; // { partnerLogo: 'aptos.svg', ... }

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

  blocks.push({ type: 'divider' });

  // ── Title ──────────────────────────────────────────────────────────────
  if (fields.includes('title')) {
    blocks.push({
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
    });
  }

  // ── Subtitle ───────────────────────────────────────────────────────────
  if (fields.includes('subtitle')) {
    blocks.push({
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
    });
  }

  // ── Date range (Week-in-Blockchains only) ──────────────────────────────
  if (fields.includes('dateRange')) {
    blocks.push({
      type: 'input',
      block_id: 'date_block',
      label: { type: 'plain_text', text: 'Date Range' },
      element: {
        type: 'plain_text_input',
        action_id: 'date_input',
        placeholder: { type: 'plain_text', text: 'e.g. February 23 – March 1' },
        ...(formState.dateRange ? { initial_value: formState.dateRange } : {}),
      },
    });
  }

  // ── Partner logos ──────────────────────────────────────────────────────
  if (slots.length > 0) {
    blocks.push({ type: 'divider' });

    // Selection summary at the top of the section.
    const summary = slots.map(slotKey => {
      const name = selectedLogos[slotKey];
      const slotLabel = slotLabelFor(slotKey, slots);
      return name
        ? `• *${slotLabel}:* \`${name}\``
        : `• *${slotLabel}:* _none_`;
    }).join('\n');

    // Logo category for THIS template — restricts which files appear in
    // the gallery so users can't pair a wordmark with a circular icon
    // slot or a logomark with a wide brand panel.
    const logoCategory = preview?.logoType === 'full' || preview?.logoType === 'logomark'
      ? preview.logoType
      : 'all';

    const categoryLabel = logoCategory === 'full'
      ? 'full / wordmark logos only'
      : logoCategory === 'logomark'
      ? 'logomarks (icon only)'
      : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Partner logo${slots.length > 1 ? 's' : ''}*${
          categoryLabel ? ` _— ${categoryLabel}_` : ''
        }\n${summary}`,
      },
    });

    // Optional "Clear all" button when at least one slot is filled.
    if (Object.values(selectedLogos).some(Boolean)) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Clear all logos' },
            action_id: 'clear_logo',
            value: 'all',
          },
        ],
      });
    }

    const logos = listLogos(logoCategory);
    if (logos.length === 0) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_No ${logoCategory === 'all' ? '' : logoCategory + ' '}partner logos available in \`assets/logos/\`._` },
        ],
      });
    } else {
      for (const logoFile of logos) {
        const stem = logoFile.replace(/\.[^.]+$/, '');
        const usedInSlots = slots.filter(s => selectedLogos[s] === logoFile);

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: usedInSlots.length > 0
              ? `*${stem}* — used in ${usedInSlots.map(s => slotLabelFor(s, slots)).join(', ')}`
              : `*${stem}*`,
          },
        });

        if (baseUrl) {
          blocks.push({
            type: 'image',
            image_url: logoPreviewUrl(logoFile),
            alt_text: stem,
          });
        }

        // One button per slot. For single-slot templates this is just "Select".
        // For multi-slot, we render "Slot 1", "Slot 2", etc.
        const buttons = slots.map(slotKey => {
          const isHere = selectedLogos[slotKey] === logoFile;
          const label = slots.length === 1
            ? (isHere ? '✓ Selected' : 'Select')
            : (isHere ? `✓ ${slotLabelFor(slotKey, slots)}` : `Use as ${slotLabelFor(slotKey, slots)}`);
          return {
            type: 'button',
            text: { type: 'plain_text', text: label },
            value: JSON.stringify({ slot: slotKey, file: logoFile }),
            action_id: `select_logo_${slotKey}`,
            ...(isHere ? { style: 'primary' } : {}),
          };
        });

        blocks.push({ type: 'actions', elements: buttons });
      }
    }
  } else {
    // Template doesn't take logos at all — make it explicit so the user
    // doesn't wonder where the picker went.
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '_This template doesn\'t use partner logos._' },
      ],
    });
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
 * "partnerLogo" → "Logo"
 * "partnerLogo1" / "partnerLogo2" → "Logo 1" / "Logo 2" (when ≥2 slots)
 */
function slotLabelFor(slotKey, slots) {
  if (slots.length <= 1) return 'Logo';
  const m = slotKey.match(/(\d+)$/);
  return m ? `Logo ${m[1]}` : slotKey;
}

/**
 * Pull current input values out of a Slack view payload so we can preserve
 * them across views.update calls. Tolerant of missing blocks (different
 * templates render different inputs).
 */
function extractFormState(view) {
  const v = view?.state?.values || {};
  return {
    title: v.title_block?.title_input?.value || '',
    subtitle: v.subtitle_block?.subtitle_input?.value || '',
    dateRange: v.date_block?.date_input?.value || '',
  };
}

/**
 * Race-tolerant wrapper around client.views.update.
 *
 * We deliberately omit the `hash` parameter — it would only cause spurious
 * `hash_conflict` errors when the user clicks gallery buttons faster than
 * Slack propagates the previous update. Last-write-wins is the right
 * semantic for this UI: whichever click lands last is the one the user
 * sees reflected.
 *
 * Two specific Slack errors are still expected races we can ignore:
 *   • `hash_conflict`     — somehow Slack still flagged it; not actionable.
 *   • `not_found`         — the user closed the modal mid-update.
 *   • `expired_trigger_id`— same idea, view is gone.
 *
 * Anything else gets logged but not rethrown, so a stale click doesn't
 * become an "unhandled error" in Bolt's middleware chain.
 */
async function safeViewsUpdate(client, viewId, view, label) {
  try {
    await client.views.update({ view_id: viewId, view });
  } catch (err) {
    const code = err?.data?.error;
    if (['hash_conflict', 'not_found', 'expired_trigger_id'].includes(code)) {
      // Expected during rapid clicking — the user already moved on.
      return;
    }
    console.error(`[${label}] views.update failed:`, code || err.message);
  }
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
    meta.partnerLogos = {};
    await safeViewsUpdate(client, body.view.id, buildFormView(meta, {}), 'select_template');
  });

  // ── Step 2 → Step 1 ────────────────────────────────────────────────────
  app.action('back_to_templates', async ({ ack, body, client }) => {
    await ack();
    const meta = unpackMeta(body.view.private_metadata);
    delete meta.previewNum;
    delete meta.partnerLogos;
    await safeViewsUpdate(client, body.view.id, buildTemplateGalleryView(meta), 'back_to_templates');
  });

  // ── Step 2: pick a partner logo (one handler per slot key) ─────────────
  // We register handlers for 'partnerLogo', 'partnerLogo1', 'partnerLogo2',
  // 'partnerLogo3' — that's all the slot keys any current template uses.
  for (const slotKey of ['partnerLogo', 'partnerLogo1', 'partnerLogo2', 'partnerLogo3']) {
    app.action(`select_logo_${slotKey}`, async ({ ack, body, client }) => {
      await ack();
      let payload;
      try {
        payload = JSON.parse(body.actions[0].value);
      } catch (_) {
        return;
      }
      const meta = unpackMeta(body.view.private_metadata);
      meta.partnerLogos = meta.partnerLogos || {};
      // Toggle: clicking the same combo again clears the slot.
      if (meta.partnerLogos[payload.slot] === payload.file) {
        delete meta.partnerLogos[payload.slot];
      } else {
        meta.partnerLogos[payload.slot] = payload.file;
      }
      const formState = extractFormState(body.view);
      await safeViewsUpdate(client, body.view.id, buildFormView(meta, formState), `select_logo_${slotKey}`);
    });
  }

  // ── Step 2: clear all logos ────────────────────────────────────────────
  app.action('clear_logo', async ({ ack, body, client }) => {
    await ack();
    const meta = unpackMeta(body.view.private_metadata);
    meta.partnerLogos = {};
    const formState = extractFormState(body.view);
    await safeViewsUpdate(client, body.view.id, buildFormView(meta, formState), 'clear_logo');
  });

  // ── Final submit: render full banner, but post ONLY the small preview ──
  // The full file is held on disk until the approver clicks "Approve". This
  // prevents people grabbing the banner before design review.
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

    // Build params: defaults from preview-list (theme/variant baked in),
    // overridden by user input. Form only renders inputs the template
    // actually uses, so we don't leak irrelevant fields.
    const params = { ...preview.defaults };
    if (formState.title) params.title = formState.title;
    if (formState.subtitle) params.subtitle = formState.subtitle;
    if (formState.dateRange) params.dateRange = formState.dateRange;
    if (preview.variant) params.variant = preview.variant;
    if (meta.partnerLogos) {
      for (const [slotKey, file] of Object.entries(meta.partnerLogos)) {
        if (file) params[slotKey] = file;
      }
    }

    let parentTs = null;
    let fullPath = null;
    let thumbPath = null;

    try {
      // 1. Parent message — keeps the channel itself uncluttered.
      if (channelId) {
        const msg = await client.chat.postMessage({
          channel: channelId,
          text: `:hourglass_flowing_sand: <@${userId}> is generating *${preview.label}*…`,
        });
        parentTs = msg.ts;
      }

      // 2. Render full banner + thumbnail preview.
      fullPath = await renderBanner(preview.id, params);
      thumbPath = fullPath.replace(/\.png$/, '-thumb.png');
      await thumbnailBanner(fullPath, thumbPath);

      // 3. Upload only the THUMBNAIL preview as a thread reply. Note the
      //    explicit "preview, not final" framing so reviewers understand
      //    they shouldn't use this image yet.
      const uploadTarget = channelId || userId;
      const titleText = params.title || preview.label;
      await client.files.uploadV2({
        channel_id: uploadTarget,
        thread_ts: parentTs || undefined,
        file: fs.createReadStream(thumbPath),
        filename: `banner-preview-${Date.now()}.png`,
        title: `Preview: ${titleText}`,
        initial_comment:
          `:eyes: *Preview only* — *${preview.label}*` +
          (params.title ? ` · "${params.title}"` : '') +
          `\n_The full-resolution file will be delivered after design review._`,
      });

      // 4. Approval message + button. The button value carries the full
      //    file path so the approve handler can find and upload it. If
      //    the file is gone (container restart), the handler re-renders
      //    from the encoded params instead.
      if (channelId && parentTs) {
        const approverMention = APPROVER_USER_ID
          ? `<@${APPROVER_USER_ID}>`
          : `*${APPROVER_NAME}*`;

        // Encode everything we'd need to re-render. Slack button `value`
        // is limited to 2000 chars; typical encoded payload is <600.
        const approvalPayload = JSON.stringify({
          parentTs,
          fullPath,
          previewId: preview.id,
          previewNum: preview.num,
          label: preview.label,
          params,
        });

        await client.chat.postMessage({
          channel: channelId,
          thread_ts: parentTs,
          text: 'Pending approval',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:eyes: Awaiting design review by ${approverMention}.`,
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
                  value: approvalPayload.length <= 1900
                    ? approvalPayload
                    : JSON.stringify({ parentTs, fullPath, previewId: preview.id, label: preview.label }),
                },
              ],
            },
          ],
        });
      }

      // 5. Update parent message — drop the hourglass.
      if (parentTs) {
        await client.chat
          .update({
            channel: channelId,
            ts: parentTs,
            text: `:art: <@${userId}> submitted *${preview.label}* for design review — preview in thread.`,
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
      // On error, clean up the full file too — it's not coming back.
      if (fullPath && fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
    } finally {
      // Thumbnail is no longer needed once uploaded; full file stays
      // until approve (or until the container restarts).
      if (thumbPath && fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch (_) {}
      }
    }
  });

  // ── "Approved by Maksym" button click ──────────────────────────────────
  // Only the configured approver may succeed. On approval:
  //   1. Update the approve message in place ("Approved by … — clicker · ts")
  //   2. Upload the full-resolution banner to the same thread as a NEW
  //      message — this is what users should download and use.
  //   3. React :white_check_mark: on the parent for at-a-glance status.
  app.action('approve_banner', async ({ ack, body, client, respond }) => {
    await ack();

    const channel = body.channel?.id || body.container?.channel_id;
    const messageTs = body.message?.ts || body.container?.message_ts;
    const clickerId = body.user?.id;

    // Gate: must match the configured approver.
    if (!APPROVER_USER_ID) {
      console.warn('[approve_banner] APPROVER_USER_ID is not set — refusing to approve.');
      try {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text:
            ':warning: Approval is locked — `APPROVER_USER_ID` is not configured on the server. ' +
            'Ask an admin to set it to the Slack ID of the designated approver.',
        });
      } catch (_) {}
      return;
    }

    if (clickerId !== APPROVER_USER_ID) {
      try {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text: `:no_entry_sign: Only <@${APPROVER_USER_ID}> can approve banners.`,
        });
      } catch (_) {}
      return;
    }

    if (!channel || !messageTs) return;

    // Decode the payload encoded by banner_submit.
    let payload = {};
    try {
      payload = JSON.parse(body.actions?.[0]?.value || '{}');
    } catch (_) {}

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    // 1. Update the approve message to record who/when.
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
              text: `:white_check_mark: *Approved by ${APPROVER_NAME}* — <@${clickerId}> · ${ts}`,
            },
          },
        ],
      });
    } catch (err) {
      console.error('approve_banner: failed to update approve message:', err.message);
    }

    // 2. Deliver the full-resolution banner.
    //    Prefer the on-disk file (fastest); fall back to re-rendering if
    //    the container was restarted between submit and approve.
    let fullPath = payload.fullPath;
    let renderedFresh = false;

    if (!fullPath || !fs.existsSync(fullPath)) {
      if (payload.previewId && payload.params) {
        try {
          fullPath = await renderBanner(payload.previewId, payload.params);
          renderedFresh = true;
        } catch (err) {
          console.error('approve_banner: re-render failed:', err);
          await client.chat
            .postMessage({
              channel,
              thread_ts: payload.parentTs || messageTs,
              text:
                `:warning: Approval recorded, but the full file couldn't be delivered ` +
                `(re-render failed: ${err.message}). Please rerun /banner.`,
            })
            .catch(() => {});
          return;
        }
      } else {
        // No render params encoded — old approval message format. We can't recover.
        await client.chat
          .postMessage({
            channel,
            thread_ts: payload.parentTs || messageTs,
            text:
              `:warning: Approval recorded, but this approval button is from an older ` +
              `version of the bot and can't deliver the full file. Please rerun /banner.`,
          })
          .catch(() => {});
        return;
      }
    }

    try {
      const titleText = payload.params?.title || payload.label || 'Banner';
      await client.files.uploadV2({
        channel_id: channel,
        thread_ts: payload.parentTs || messageTs,
        file: fs.createReadStream(fullPath),
        filename: `banner-${Date.now()}.png`,
        title: `Banner: ${titleText}`,
        initial_comment:
          `:tada: *Final approved banner*${payload.label ? ` — ${payload.label}` : ''}. ` +
          `Use this version.`,
      });
    } catch (err) {
      console.error('approve_banner: failed to upload full banner:', err);
      await client.chat
        .postMessage({
          channel,
          thread_ts: payload.parentTs || messageTs,
          text: `:warning: Approval recorded, but couldn't upload the full file: ${err.message}`,
        })
        .catch(() => {});
    } finally {
      // Clean up the on-disk file now that it's been delivered.
      if (fullPath && fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
    }

    // 3. Reaction on the parent message for at-a-glance "approved" status.
    if (payload.parentTs) {
      await client.reactions
        .add({ channel, timestamp: payload.parentTs, name: 'white_check_mark' })
        .catch(() => {});
    }
  });
}

module.exports = { registerSlackHandlers };
