/**
 * Slack interaction wiring.
 *
 *   /banner                       → Step 1 modal: template gallery
 *     ↳ button "select_template"  → push Step 2 (form + logo gallery)
 *       ↳ button "select_logo"    → views.update, fills the targeted slot
 *       ↳ button "clear_logo"     → views.update, removes one slot
 *       ↳ button "back_to_templates" → views.update, goes back to Step 1
 *       ↳ submit "banner_submit"  → post a public parent message
 *                                   ("@user requested X — pending review")
 *                                   in the requester's channel; render
 *                                   banner + thumbnail; DM the approver
 *                                   the thumbnail with Approve/Reject
 *                                   buttons. No banner image leaks into
 *                                   the channel before approval.
 *
 *   button "approve_banner"       → only APPROVER_USER_ID can succeed.
 *                                   Uploads the full banner as a thread
 *                                   reply under the parent message, then
 *                                   updates the parent to "Approved".
 *   button "reject_banner"        → only APPROVER_USER_ID can succeed.
 *                                   Updates the parent message to
 *                                   "Rejected", pings the requester
 *                                   ephemerally, discards the file.
 *
 * Form rendering is driven by `template.fields` — each template only shows
 * the inputs it actually consumes (e.g. APR has no logo gallery, "Week in
 * Blockchains" has only a date input, multi-logo templates show 2–3 logo
 * slots). The Light/Dark selector is intentionally absent: each preview
 * already pins its own theme (via `variant` or via `defaults.theme`), so
 * the user never picks one.
 */

const fs = require('fs');
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

    // Logo *kind* — orthogonal semantic filter. APR + Dark Full + Dark Text
    // Left + Icon Right are tied to token branding; the two Collaboration 3
    // Companies layouts are tied to partner-company branding. When absent,
    // the gallery is not restricted by kind.
    const logoKind = preview?.logoKind === 'token' || preview?.logoKind === 'company'
      ? preview.logoKind
      : 'all';

    const categoryLabel = logoCategory === 'full'
      ? 'full / wordmark logos only'
      : logoCategory === 'logomark'
      ? 'logomarks (icon only)'
      : '';

    const kindLabel = logoKind === 'token'
      ? 'token / coin logos only'
      : logoKind === 'company'
      ? 'company logos only'
      : '';

    const filterSuffix = [categoryLabel, kindLabel].filter(Boolean).join(', ');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Partner logo${slots.length > 1 ? 's' : ''}*${
          filterSuffix ? ` _— ${filterSuffix}_` : ''
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

    const logos = listLogos(logoCategory, logoKind);
    if (logos.length === 0) {
      const emptyDesc = [
        logoCategory !== 'all' ? logoCategory : '',
        logoKind !== 'all' ? logoKind : '',
      ].filter(Boolean).join(' ');
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_No ${emptyDesc ? emptyDesc + ' ' : ''}partner logos available in \`assets/logos/\`._` },
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

  // ── Final submit: design-review flow with channel thread ──────────────
  //
  // Flow:
  //   1. Post a parent message in the channel ("@user requested *X* —
  //      pending review by @Max"). This is the root of the thread that
  //      the approved banner will land in. Posted as a normal message
  //      (everyone in the channel sees it) but the banner itself stays
  //      hidden until approval.
  //   2. Render full banner + thumbnail.
  //   3. DM the approver with the thumbnail + Approve / Reject buttons.
  //   4. On approve: full banner is posted as a thread reply under the
  //      parent message, and the parent is updated to "Approved by Max".
  //   5. On reject: parent is updated to "Rejected by Max", requester
  //      gets an ephemeral nudge to retry.
  //
  // The full file stays on disk until approve/reject discards it.
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

    // Bail early if no approver is configured — there's nothing to do
    // since we're not going to post anything in the channel ourselves.
    if (!APPROVER_USER_ID) {
      console.warn('[banner_submit] APPROVER_USER_ID is not set — cannot route for review.');
      if (channelId) {
        await client.chat
          .postEphemeral({
            channel: channelId,
            user: userId,
            text:
              ':warning: Banner can\'t be generated — `APPROVER_USER_ID` is not configured ' +
              'on the server. Ask an admin to set it to the Slack ID of the designated approver.',
          })
          .catch(() => {});
      }
      return;
    }

    let fullPath = null;
    let thumbPath = null;
    let parentTs = null;

    try {
      // 1. Parent message in the channel — becomes the thread root for
      //    the approved banner. Visible to everyone in the channel, but
      //    contains no preview image.
      if (channelId) {
        try {
          const parent = await client.chat.postMessage({
            channel: channelId,
            text:
              `:art: <@${userId}> requested *${preview.label}* — ` +
              `pending design review by <@${APPROVER_USER_ID}>.`,
          });
          parentTs = parent.ts;
        } catch (err) {
          console.error('[banner_submit] failed to post parent message:', err.message);
        }
      }

      // 2. Render full + thumbnail.
      fullPath = await renderBanner(preview.id, params);
      thumbPath = fullPath.replace(/\.png$/, '-thumb.png');
      await thumbnailBanner(fullPath, thumbPath);

      // 3. Open a DM with the approver and upload the preview there.
      const im = await client.conversations.open({ users: APPROVER_USER_ID });
      const approverDm = im.channel.id;

      const titleText = params.title || preview.label;
      await client.files.uploadV2({
        channel_id: approverDm,
        file: fs.createReadStream(thumbPath),
        filename: `banner-preview-${Date.now()}.png`,
        title: `Preview: ${titleText}`,
        initial_comment:
          `:eyes: *Design review request* from <@${userId}>` +
          (channelId ? ` (channel <#${channelId}>)` : ' (DM)') +
          `\nTemplate: *${preview.label}*` +
          (params.title ? `\nTitle: "${params.title}"` : ''),
      });

      // 4. Approve / Reject buttons in the same DM. The button value
      //    carries everything needed to thread-reply the banner to the
      //    parent message (or re-render if the file is gone after a
      //    container restart). Slack caps `value` at 2000 chars; typical
      //    payload here is <800.
      const fullPayload = JSON.stringify({
        requesterId: userId,
        requesterChannel: channelId,
        parentTs,
        fullPath,
        previewId: preview.id,
        previewNum: preview.num,
        label: preview.label,
        params,
      });
      const slimPayload = JSON.stringify({
        requesterId: userId,
        requesterChannel: channelId,
        parentTs,
        fullPath,
        previewId: preview.id,
        label: preview.label,
      });
      const buttonValue = fullPayload.length <= 1900 ? fullPayload : slimPayload;

      await client.chat.postMessage({
        channel: approverDm,
        text: 'Approve or reject banner',
        blocks: [
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Approve', emoji: true },
                style: 'primary',
                action_id: 'approve_banner',
                value: buttonValue,
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Reject', emoji: true },
                style: 'danger',
                action_id: 'reject_banner',
                value: buttonValue,
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('Banner generation error:', error);
      if (channelId) {
        await client.chat
          .postEphemeral({
            channel: channelId,
            user: userId,
            text: `:x: Failed to generate banner: ${error.message}`,
          })
          .catch(() => {});
      }
      // If we already posted a parent message, mark it as failed so it
      // doesn't sit there forever pretending review is in progress.
      if (parentTs && channelId) {
        await client.chat
          .update({
            channel: channelId,
            ts: parentTs,
            text: `:x: <@${userId}>'s *${preview.label}* request failed to render.`,
          })
          .catch(() => {});
      }
      // On error, drop the full file too — nobody's going to deliver it.
      if (fullPath && fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
    } finally {
      // Thumbnail is no longer needed once uploaded; full file stays
      // until approve/reject (or until the container restarts).
      if (thumbPath && fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch (_) {}
      }
    }
  });

  // ── Approve button (clicked by the designer in their DM) ───────────────
  // Verifies the clicker is the configured approver, then uploads the
  // full-resolution banner to the original requester's channel, tagging
  // them so they get a notification.
  app.action('approve_banner', async ({ ack, body, client, respond }) => {
    await ack();

    const clickerId = body.user?.id;
    const dmChannel = body.channel?.id || body.container?.channel_id;
    const dmMessageTs = body.message?.ts || body.container?.message_ts;

    if (!APPROVER_USER_ID) {
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':warning: `APPROVER_USER_ID` is not configured on the server.',
      }).catch(() => {});
      return;
    }
    if (clickerId !== APPROVER_USER_ID) {
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: `:no_entry_sign: Only <@${APPROVER_USER_ID}> can approve banners.`,
      }).catch(() => {});
      return;
    }

    let payload = {};
    try {
      payload = JSON.parse(body.actions?.[0]?.value || '{}');
    } catch (_) {}

    const requesterId = payload.requesterId;
    const requesterChannel = payload.requesterChannel;
    if (!requesterId) return;

    // Deliver location: original channel if /banner was run in one,
    // otherwise the requester's DM with the bot.
    let deliveryChannel = requesterChannel;
    if (!deliveryChannel) {
      try {
        const im = await client.conversations.open({ users: requesterId });
        deliveryChannel = im.channel.id;
      } catch (err) {
        console.error('approve_banner: failed to open DM with requester:', err.message);
        return;
      }
    }

    // Make sure we have a renderable file. Re-render if it's gone
    // (container restart between submit and approve).
    let fullPath = payload.fullPath;
    if (!fullPath || !fs.existsSync(fullPath)) {
      if (payload.previewId && payload.params) {
        try {
          fullPath = await renderBanner(payload.previewId, payload.params);
        } catch (err) {
          console.error('approve_banner: re-render failed:', err);
          await respond({
            response_type: 'ephemeral',
            replace_original: false,
            text: `:warning: Re-render failed: ${err.message}. Ask <@${requesterId}> to rerun /banner.`,
          }).catch(() => {});
          return;
        }
      } else {
        await respond({
          response_type: 'ephemeral',
          replace_original: false,
          text: `:warning: This approval is from an older version and can't be processed. Ask <@${requesterId}> to rerun /banner.`,
        }).catch(() => {});
        return;
      }
    }

    // Upload the full banner. If the submit handler successfully posted
    // a parent message in the channel, the file goes in as a thread reply
    // there. Otherwise (DM, or parent failed) it lands at top level.
    try {
      const titleText = payload.params?.title || payload.label || 'Banner';
      const uploadOpts = {
        channel_id: deliveryChannel,
        file: fs.createReadStream(fullPath),
        filename: `banner-${Date.now()}.png`,
        title: `Banner: ${titleText}`,
        initial_comment:
          `:tada: <@${requesterId}> your approved banner is ready` +
          (payload.label ? ` — *${payload.label}*` : '') +
          `.`,
      };
      if (payload.parentTs) {
        uploadOpts.thread_ts = payload.parentTs;
      }
      await client.files.uploadV2(uploadOpts);
    } catch (err) {
      console.error('approve_banner: failed to upload full banner:', err);
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: `:warning: Couldn't deliver to <@${requesterId}>: ${err.message}`,
      }).catch(() => {});
      return;
    } finally {
      if (fullPath && fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
    }

    // Update the parent message in the requester's channel to record
    // the approval — the "pending review" wording becomes outdated as
    // soon as the file lands in the thread.
    if (payload.parentTs && requesterChannel) {
      await client.chat
        .update({
          channel: requesterChannel,
          ts: payload.parentTs,
          text:
            `:white_check_mark: <@${requesterId}>'s *${payload.label || 'banner'}* ` +
            `was approved by <@${APPROVER_USER_ID}> — file in thread.`,
        })
        .catch(() => {});
    }

    // Update the designer's DM to record the decision.
    if (dmChannel && dmMessageTs) {
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
      await client.chat
        .update({
          channel: dmChannel,
          ts: dmMessageTs,
          text: 'Approved',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text:
                  `:white_check_mark: *Approved* · ${ts}\n` +
                  `Delivered to <@${requesterId}>` +
                  (requesterChannel ? ` in <#${requesterChannel}>.` : ' (DM).'),
              },
            },
          ],
        })
        .catch(() => {});
    }
  });

  // ── Reject button (clicked by the designer in their DM) ────────────────
  // Notifies the requester ephemerally that the banner was rejected and
  // discards the rendered file.
  app.action('reject_banner', async ({ ack, body, client, respond }) => {
    await ack();

    const clickerId = body.user?.id;
    const dmChannel = body.channel?.id || body.container?.channel_id;
    const dmMessageTs = body.message?.ts || body.container?.message_ts;

    if (!APPROVER_USER_ID || clickerId !== APPROVER_USER_ID) {
      await respond({
        response_type: 'ephemeral',
        replace_original: false,
        text: `:no_entry_sign: Only <@${APPROVER_USER_ID}> can reject banners.`,
      }).catch(() => {});
      return;
    }

    let payload = {};
    try {
      payload = JSON.parse(body.actions?.[0]?.value || '{}');
    } catch (_) {}

    const requesterId = payload.requesterId;
    const requesterChannel = payload.requesterChannel;

    // Update the parent message in the requester's channel to record
    // the rejection — replaces the "pending review" wording.
    if (payload.parentTs && requesterChannel) {
      await client.chat
        .update({
          channel: requesterChannel,
          ts: payload.parentTs,
          text:
            `:x: <@${requesterId}>'s *${payload.label || 'banner'}* ` +
            `was rejected by <@${APPROVER_USER_ID}>.`,
        })
        .catch(() => {});
    }

    // Notify the requester (privately) that their banner didn't pass review.
    if (requesterId) {
      const target = requesterChannel || (await client.conversations
        .open({ users: requesterId })
        .then(r => r.channel.id)
        .catch(() => null));

      if (target) {
        await client.chat
          .postEphemeral({
            channel: target,
            user: requesterId,
            text:
              `:x: Your ${payload.label ? `*${payload.label}* ` : ''}banner request ` +
              `was rejected by <@${APPROVER_USER_ID}>. ` +
              `Run /banner again with adjustments.`,
          })
          .catch(() => {});
      }
    }

    // Discard the rendered file.
    if (payload.fullPath && fs.existsSync(payload.fullPath)) {
      try { fs.unlinkSync(payload.fullPath); } catch (_) {}
    }

    // Record the decision in the designer's DM.
    if (dmChannel && dmMessageTs) {
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
      await client.chat
        .update({
          channel: dmChannel,
          ts: dmMessageTs,
          text: 'Rejected',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text:
                  `:x: *Rejected* · ${ts}\n` +
                  (requesterId ? `<@${requesterId}> has been notified.` : ''),
              },
            },
          ],
        })
        .catch(() => {});
    }
  });
}

module.exports = { registerSlackHandlers };
