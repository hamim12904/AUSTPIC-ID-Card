import { CARD_HEIGHT_RATIO, getFieldPaddingRatio, getFieldSizeRatio, getFieldTypography } from '../config/cardTypography.js';
import { getPhotoGeometry } from '../config/photoGeometry.js';
import { fitFieldSizeRatio, wrapLines } from './textFit.js';

// The card art in public/templates is 2214x3516 and .id-card-surface locks the
// card to that same ratio, so rendering at the art's native width reproduces
// the background with no resampling at all.
export const NATIVE_CARD_WIDTH = 2214;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('Missing image source.'));
      return;
    }
    const img = new Image();
    // A photo served by the API has to be requested with CORS, otherwise the
    // canvas picks up a taint and the export fails at toBlob time. Same-origin
    // assets, blob: and data: URLs ignore the attribute and stay untainted.
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load an image from ${src}.`));
    img.src = src;
  });
}

// Canvas falls back to a substitute face with no warning if a web font has not
// finished loading, which would silently bake the wrong typeface into the
// download. Wait for the faces the card actually uses.
async function loadCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('700 40px Poppins'),
      document.fonts.load('500 40px Poppins'),
      document.fonts.load('400 40px Mina'),
      document.fonts.ready,
    ]);
  } catch (err) {
    // A missing face only costs typographic fidelity, so carry on rather than
    // failing the whole download over it.
    console.warn('[cardRender] web fonts did not finish loading:', err);
  }
}

/** Percent-of-card rects (what the template stores) to device pixels. */
function toPixels(rect, width, height) {
  return {
    x: (rect.x / 100) * width,
    y: (rect.y / 100) * height,
    w: (rect.width / 100) * width,
    h: (rect.height / 100) * height,
    shape: rect.shape,
  };
}

/** object-fit: contain / cover, centred in the rect. */
function drawFitted(ctx, img, rect, mode) {
  const scale =
    mode === 'cover'
      ? Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight)
      : Math.min(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, rect.x + (rect.w - w) / 2, rect.y + (rect.h - h) / 2, w, h);
}

function clipToSlot(ctx, rect) {
  ctx.beginPath();
  if (rect.shape === 'circle') {
    ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, rect.h / 2, 0, 0, Math.PI * 2);
  } else if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 0.5 * (2 * rect.w) / 24);
  } else {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.clip();
}

async function drawPhoto(ctx, { template, width, height, photoUrl }) {
  const { image, overlay, overlayImage, placeholderImage } = getPhotoGeometry(template);

  // The live card always shows something in the slot, falling back to the
  // printed blank, so the download has to do the same or the ring would sit
  // over bare artwork.
  const photo = await loadImage(photoUrl || placeholderImage);
  const slot = toPixels(image, width, height);
  ctx.save();
  clipToSlot(ctx, slot);
  drawFitted(ctx, photo, slot, 'cover');
  ctx.restore();

  if (overlayImage) {
    drawFitted(ctx, await loadImage(overlayImage), toPixels(overlay, width, height), 'contain');
  }
}

/** Trailing ellipsis, the way .card-select-value truncates an overlong option. */
function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

function drawField(ctx, field, { side, value, width, height, padding }) {
  const { fontFamily, fontWeight, lineHeight } = getFieldTypography(field, side);
  // A field marked `fit` steps its type down until the value fits the box, so a
  // long name prints in full instead of being cut off. Same measurement the
  // live card and the preview use (utils/textFit.js), resolved against the width
  // actually being painted, which is what keeps the three identical.
  const ratio = (field.fit ? fitFieldSizeRatio(field, side, value) : null) ?? getFieldSizeRatio(field, side);
  const fontSize = ratio * width;
  const lineBox = fontSize * lineHeight;

  // Canvas accepts a quoted family list, but the quotes add nothing once the
  // string is in a font shorthand, and a stray quote makes some engines drop
  // the whole declaration and fall back to 10px sans-serif.
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily.replace(/["']/g, '')}`;
  ctx.fillStyle = field.color || '#0c2f38';

  const boxX = (field.x / 100) * width;
  const boxWidth = (field.w / 100) * width;
  const innerWidth = Math.max(0, boxWidth - padding * 2);
  const align = field.align === 'center' || field.align === 'right' ? field.align : 'left';
  // textAlign resolves against the box, so the anchor has to be measured from
  // the box's own left edge, not the card's.
  const x = boxX + padding + (align === 'center' ? innerWidth / 2 : align === 'right' ? innerWidth : 0);
  ctx.textAlign = align;

  // The box is a fixed height with overflow hidden, so anything past the last
  // line that fits is simply not drawn — the same cut-off the preview shows.
  const boxHeight = (field.h / 100) * height;
  const lineCount = Math.max(1, Math.floor(boxHeight / lineBox));
  const text = field.uppercase ? value.toUpperCase() : value;
  const lines = field.options
    ? [ellipsize(ctx, text, innerWidth)]
    : wrapLines(ctx, text, innerWidth);

  // textBaseline 'top' puts y at the top of the em box, which is where a line
  // box's extra leading starts. Centring the leading above the text matches
  // the browser's half-leading for line-height.
  //
  // The card art prints a field's label beside the value. For a single-line
  // field that means centring the line in the box, which is what an <input>
  // does natively and what .field-static-text does with `justify-content:
  // center`. A multiline field's label belongs to its FIRST line, so the block
  // is pinned to the top instead — matching .field-multiline and
  // .field-static-text.is-top, and keeping this fallback in step with them if it
  // ever has to stand in for the DOM rasteriser.
  const boxTop = (field.y / 100) * height;
  const stackTop = field.multiline
    ? boxTop
    : boxTop + (boxHeight - lineCount * lineBox) / 2;
  const firstLineTop = stackTop + (lineBox - fontSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(boxX, (field.y / 100) * height, boxWidth, boxHeight);
  ctx.clip();

  ctx.textBaseline = 'top';
  lines.slice(0, lineCount).forEach((line, index) => {
    ctx.fillText(line, x, firstLineTop + index * lineBox);
  });
  ctx.restore();
}

/**
 * Paints one side of the card onto a fresh canvas at `width` pixels across,
 * returning it ready for toBlob/toDataURL.
 *
 * The live card is DOM laid over a background image, so this re-implements that
 * layer — art, then the photo and its ring on the front only, then every field's
 * text at its configured position — rather than trying to rasterise the DOM. Doing
 * it directly is what makes a full-resolution export possible: the
 * screenshot-style alternative has to fight the flip's 3D transforms (perspective,
 * preserve-3d, backface-visibility) and captures whatever the card happens to be
 * scaled to.
 *
 * Fields with no value are skipped. The DOM shows a dimmed placeholder there,
 * but a placeholder is a UI hint, not card content, and preview/submit are both
 * gated on every required field being filled anyway.
 */
export async function renderCardSide({ template, side, fields, photoUrl, width = NATIVE_CARD_WIDTH }) {
  if (typeof document === 'undefined') {
    throw new Error('The card can only be rendered in a browser.');
  }
  await loadCardFonts();

  const isFront = side === 'front';
  const fieldDefs = isFront ? template.frontFields : template.backFields;
  const canvasWidth = Math.max(1, Math.round(width));
  const canvasHeight = Math.round(canvasWidth * CARD_HEIGHT_RATIO);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser blocked 2D canvas rendering.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const art = await loadImage(isFront ? template.frontImage : template.backImage);
  ctx.drawImage(art, 0, 0, canvasWidth, canvasHeight);

  // Front only. The picture and its printed ring belong to the front face —
  // IDCardBack renders the back art and nothing else, no PhotoUploadZone — so
  // drawing them here too put a photo and a ring on the exported back that the
  // live card never shows.
  if (isFront) {
    await drawPhoto(ctx, { template, width: canvasWidth, height: canvasHeight, photoUrl });
  }

  const padding = getFieldPaddingRatio() * canvasWidth;
  for (const field of fieldDefs || []) {
    const value = (fields?.[field.key] ?? '').toString();
    if (!value.trim()) continue;
    drawField(ctx, field, { side, value, width: canvasWidth, height: canvasHeight, padding });
  }

  return canvas;
}
