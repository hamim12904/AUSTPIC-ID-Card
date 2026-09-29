import {
  CARD_HEIGHT_RATIO,
  REFERENCE_CARD_WIDTH,
  getFieldPaddingRatio,
  getFieldSizeRatio,
  getFieldTypography,
} from '../config/cardTypography.js';

/**
 * Shrinking type to fit the box the template gave it, measured once and shared
 * by all three renderers.
 *
 * The card is laid out entirely in percentages, so a field that fits at the
 * reference width fits at every width. That is what makes a single proportional
 * number enough: the live card and the preview set it in cqw, the export
 * multiplies it by whatever pixel width it is painting at. A px floor would
 * break this — the browser would stop shrinking on a narrow screen while the
 * export kept going — so a fitted size is deliberately floorless.
 *
 * Only ever shrinks. A short name keeps the size the template configured; a
 * long one steps down until it fits, so nobody's short name is blown up.
 */

/**
 * How far below the configured size a field may be taken before we give up.
 *
 * Set from the worst case the template allows rather than by taste: a 30
 * character name needs roughly 60% of the front's cap in Poppins 700, and this
 * is the margin that keeps a real font a little wider than expected from
 * landing on the floor and clipping. It is insurance only — a name short
 * enough to reach it is already unusually long, and a slightly small name
 * beats an unreadable one on an ID.
 */
const MIN_SHRINK = 0.4;
const MIN_PX = 7;
/** Binary-search steps. 12 halves the range by ~0.02%, far below a pixel. */
const SEARCH_STEPS = 12;

// One offscreen context for the whole app. A canvas is used rather than DOM
// measurement so the numbers here are produced exactly the way the export
// paints them — same wrap, same font string, same box.
let measureCtx = null;

function measureContext() {
  if (measureCtx === null && typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  return measureCtx;
}

/**
 * A character an address can be broken after: `@` between the local part and the
 * domain, `.` between domain labels. A line ending on one of these is a place a
 * reader expects the address to pause; a line ending mid-word is not.
 */
const SOFT_BREAK_AFTER = /[@.]/;

/**
 * Splits a run into pieces that each end on a @ or a ., i.e. the boundaries a
 * wrap should prefer. Shared with the renderer, which turns each boundary into a
 * <wbr> so the DOM breaks the same runs the same way.
 */
export function softBreakSegments(token) {
  const segments = [];
  let current = '';
  for (const ch of token) {
    current += ch;
    if (SOFT_BREAK_AFTER.test(ch)) {
      segments.push(current);
      current = '';
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Splits one piece at arbitrary characters — the last resort for a run with no
 * @ or . in it, or a single label too wide to ever fit.
 */
function hardBreak(ctx, run, maxWidth) {
  const chunks = [];
  let chunk = '';
  for (const ch of run) {
    const candidate = chunk + ch;
    if (chunk && ctx.measureText(candidate).width > maxWidth) {
      chunks.push(chunk);
      chunk = ch;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

/**
 * Splits a token that is on its own wider than the box into chunks that each
 * fit, breaking on @ and . where it can so an address wraps to a new line at a
 * boundary rather than mid-word.
 *
 * Greedy wrapping can only break on whitespace, so a run with none — an email
 * address, a URL — came out as one line running past the right edge of the
 * field. Breaking it mid-token is what a <textarea> does with `overflow-wrap:
 * break-word`, which is how the editor already behaved and how the preview and
 * the export now behave to match; preferring the @ and . boundaries means the
 * preview's <wbr>s (see components/card/FieldOverlay.jsx) land the line in the
 * same place this does.
 */
function breakToken(ctx, token, maxWidth) {
  const chunks = [];
  let chunk = '';
  for (const segment of softBreakSegments(token)) {
    // The segment belongs to this line if it fits on it. Measuring the join
    // rather than the segment alone, since `chunk` may already be part full.
    if (chunk && ctx.measureText(chunk + segment).width > maxWidth) {
      chunks.push(chunk);
      chunk = '';
    }
    // A segment wider than the whole box on its own has to be split further.
    const parts =
      ctx.measureText(segment).width > maxWidth ? hardBreak(ctx, segment, maxWidth) : [segment];
    chunks.push(...parts.slice(0, -1));
    chunk += parts[parts.length - 1];
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

/**
 * Greedy word wrap at the field's inner width. Mirrors `white-space: pre-wrap`
 * on .field-static-text: newlines are honoured, runs of spaces collapse, and a
 * token too long to fit is broken mid-token rather than allowed to overflow.
 *
 * Shared with the export rather than duplicated, because a fit computed against
 * one wrap and painted with another would drift.
 */
export function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) {
        if (line) lines.push(line);
        const chunks = breakToken(ctx, word, maxWidth);
        lines.push(...chunks.slice(0, -1));
        line = chunks[chunks.length - 1] ?? '';
        continue;
      }
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** A field's inner box, in pixels, at the reference card width. */
function boxAtReference(field) {
  const padPx = getFieldPaddingRatio() * REFERENCE_CARD_WIDTH;
  return {
    innerWidth: Math.max(1, (field.w / 100) * REFERENCE_CARD_WIDTH - padPx * 2),
    boxHeight: (field.h / 100) * REFERENCE_CARD_WIDTH * CARD_HEIGHT_RATIO,
  };
}

// Fitting runs on every keystroke for every fitted field, and the answer only
// depends on (side, field, text), so memoising keeps typing smooth. Bounded so
// a long editing session can't grow it without limit.
const CACHE_LIMIT = 200;
const cache = new Map();

/**
 * Drops every cached fit.
 *
 * The key covers the field, the side and the text, but not which fonts were
 * actually loaded when it was measured. A fit taken against a fallback face is
 * wrong, and without this it would be served forever once the real web font
 * arrived. Call it when the fonts finish loading.
 */
export function invalidateTextFitCache() {
  cache.clear();
}

/**
 * The font size this field's value needs so it fits its box, as a fraction of
 * the card's width — the same unit getFieldSizeRatio returns.
 *
 * Returns null when the value already fits at its configured size, which is the
 * signal to leave the existing scale (and its px floor) alone.
 *
 * @param {object} field template field definition
 * @param {'front'|'back'} side
 * @param {string} value current text, blank included
 */
export function fitFieldSizeRatio(field, side, value) {
  const raw = (value ?? '').toString();
  if (!raw.trim()) return null;

  // Measure what will actually be drawn, not what was typed. A field with
  // `uppercase` renders through text-transform here and is uppercased again in
  // drawField, and capitals are appreciably wider than lowercase — measuring
  // the raw value picks a size that fits the text as entered and then clips
  // the text as shown.
  const text = field.uppercase ? raw.toUpperCase() : raw;

  const ctx = measureContext();
  if (!ctx) return null;

  const { fontFamily, fontWeight, lineHeight } = getFieldTypography(field, side);
  // Canvas rejects a quoted family list, and the same stripping the renderer
  // does — otherwise we would measure in one face and paint in another.
  const family = fontFamily.replace(/["']/g, '');

  const capPx = getFieldSizeRatio(field, side) * REFERENCE_CARD_WIDTH;
  const key = `${side}|${field.key}|${capPx.toFixed(2)}|${family}|${lineHeight}|${text}`;
  if (cache.has(key)) return cache.get(key);

  const { innerWidth, boxHeight } = boxAtReference(field);
  // A plain <input> never wraps, so a non-multiline field has to fit on one
  // line to match the editor. The preview would happily wrap, and the export
  // would clip — this is the line that keeps the three views identical.
  const maxLines = field.multiline ? Math.max(1, Math.floor(boxHeight / (capPx * lineHeight))) : 1;

  const fits = (px) => {
    ctx.font = `${fontWeight} ${px}px ${family}`;
    return wrapLines(ctx, text, innerWidth).length <= maxLines;
  };

  let result = null;
  if (!fits(capPx)) {
    // Largest size that still fits, between the floor and the configured cap.
    let lo = Math.max(MIN_PX, capPx * MIN_SHRINK);
    let hi = capPx;
    for (let i = 0; i < SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    // Below the floor the text still overflows and clips, same as it always
    // did. Returning the floor keeps that failure visible but predictable.
    result = lo / REFERENCE_CARD_WIDTH;
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}
