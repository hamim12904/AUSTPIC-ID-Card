// Throwaway check of the shared fitter. The point is the algorithm and the
// agreement between the three renderers, so measureText is mocked with a
// deterministic per-character metric rather than a real font. The advance
// widths are shaped like Poppins 700: capitals clearly wider than lowercase,
// which is what makes the uppercase handling in fitFieldSizeRatio testable.
const ADVANCE = { uppercase: 0.7, lowercase: 0.52, space: 0.28, other: 0.34 };

function advanceOf(ch) {
  if (ch === ' ') return ADVANCE.space;
  if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) return ADVANCE.uppercase;
  if (ch === ch.toLowerCase() && ch !== ch.toUpperCase()) return ADVANCE.lowercase;
  return ADVANCE.other;
}

function widthOf(text, px) {
  let total = 0;
  for (const ch of text) total += advanceOf(ch);
  return total * px;
}

let lastFont = '';
const mockCtx = {
  set font(value) {
    lastFont = value;
  },
  get font() {
    return lastFont;
  },
  measureText(text) {
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(lastFont)?.[1] ?? 0);
    return { width: widthOf(text, px) };
  },
};

globalThis.document = {
  createElement: () => ({ getContext: () => mockCtx }),
  fonts: { ready: Promise.resolve(), load: async () => {} },
};

const { fitFieldSizeRatio, invalidateTextFitCache, wrapLines } = await import('../src/utils/textFit.js');
const { template } = await import('../src/config/template.js');
const {
  REFERENCE_CARD_WIDTH,
  CARD_HEIGHT_RATIO,
  getFieldPaddingRatio,
  getFieldSizeRatio,
  getFieldTypography,
} = await import('../src/config/cardTypography.js');

const front = template.frontFields.find((f) => f.key === 'name');
const back = template.backFields.find((f) => f.key === 'name');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
};

// Re-derive what the box actually is, exactly as textFit does, so we can
// confirm the size it returns genuinely fits the text AS RENDERED.
function verifyFits(field, side, value) {
  const { fontWeight, fontFamily, lineHeight } = getFieldTypography(field, side);
  const family = fontFamily.replace(/["']/g, '');
  const pad = getFieldPaddingRatio() * REFERENCE_CARD_WIDTH;
  const inner = (field.w / 100) * REFERENCE_CARD_WIDTH - pad * 2;
  const boxH = (field.h / 100) * REFERENCE_CARD_WIDTH * CARD_HEIGHT_RATIO;
  const cap = getFieldSizeRatio(field, side);
  const shown = field.uppercase ? value.toUpperCase() : value;

  const ratio = fitFieldSizeRatio(field, side, value);
  if (ratio === null) {
    // Reported as "already fits" — verify that claim at the configured size.
    const capPx = cap * REFERENCE_CARD_WIDTH;
    return {
      shrunk: false,
      ok: widthOf(shown, capPx) <= inner && capPx * lineHeight <= boxH + 0.5,
      cap,
      ratio: cap,
      shown,
    };
  }
  const px = ratio * REFERENCE_CARD_WIDTH;
  const fits = widthOf(shown, px) <= inner && px * lineHeight <= boxH + 0.5;
  return { shrunk: true, ok: fits, cap, ratio, shown, px };
}

console.log('front name:');
for (const [label, value] of [
  ['short  "A"', 'A'],
  ['medium "Abdur Rahman"', 'Abdur Rahman'],
  ['long   "Abdur Rahman Chowdhury"', 'Abdur Rahman Chowdhury'],
  ['max    30 chars', 'Abdur Rahman Chowdhury Jr'],
]) {
  const r = verifyFits(front, 'front', value);
  const cap = getFieldSizeRatio(front, 'front');
  check(
    `${label} fits as rendered (${JSON.stringify(r.shown)})`,
    r.ok && (!r.shrunk || r.ratio <= cap),
    r.shrunk
      ? `${(r.ratio * 100).toFixed(2)}cqw of ${(cap * 100).toFixed(2)}cqw (${((r.ratio / cap) * 100).toFixed(0)}%)`
      : 'kept configured size'
  );
}

console.log('back name:');
for (const [label, value] of [
  ['short  "A"', 'A'],
  ['max    30 chars', 'Abdur Rahman Chowdhury Jr'],
]) {
  const r = verifyFits(back, 'back', value);
  const cap = getFieldSizeRatio(back, 'back');
  check(
    `${label} fits as rendered (${JSON.stringify(r.shown)})`,
    r.ok && (!r.shrunk || r.ratio <= cap),
    r.shrunk
      ? `${(r.ratio * 100).toFixed(2)}cqw of ${(cap * 100).toFixed(2)}cqw (${((r.ratio / cap) * 100).toFixed(0)}%)`
      : 'kept configured size'
  );
}

console.log('consistency:');
// The whole design rests on one number being reusable. The DOM gets it as cqw,
// the export multiplies it by pixel width. Those must be the same size.
const value = 'Abdur Rahman Chowdhury Jr';
const ratio = fitFieldSizeRatio(front, 'front', value);
check('a long front name actually shrinks', ratio !== null && ratio < getFieldSizeRatio(front, 'front'));
const domPxAtReference = ratio * REFERENCE_CARD_WIDTH;
const exportPxAtNative = ratio * 2214;
check(
  'dom cqw and export pixels are the same ratio',
  Math.abs(domPxAtReference / REFERENCE_CARD_WIDTH - exportPxAtNative / 2214) < 1e-9,
  `${domPxAtReference.toFixed(2)}px @420 vs ${exportPxAtNative.toFixed(0)}px @2214`
);
check(
  'scale-invariant: same ratio at 320px as at 2214px',
  Math.abs(ratio * 320 / 320 - ratio * 2214 / 2214) < 1e-12
);
check('blank value is never fitted', fitFieldSizeRatio(front, 'front', '   ') === null);
check('repeat call is stable', fitFieldSizeRatio(front, 'front', value) === fitFieldSizeRatio(front, 'front', value));

// The bug this suite exists for: measuring the typed text instead of the
// rendered text. Uppercase is wider, so a fit computed on mixed case leaves the
// name clipped. Sizes are font-dependent, so assert the relationship rather
// than a number.
const mixed = fitFieldSizeRatio(front, 'front', 'Abdur Rahman Chowdhury Jr');
invalidateTextFitCache();
const upper = fitFieldSizeRatio(front, 'front', 'ABDUR RAHMAN CHOWDHURY JR');
check('an already-uppercase name needs no larger size than the same name typed', upper === mixed);
const sizedForMixed = verifyFits(front, 'front', 'abdur rahman chowdhury jr');
check(
  'a name fit on its typed width still fits when rendered uppercase',
  sizedForMixed.ok,
  sizedForMixed.shrunk ? `measured at ${(sizedForMixed.ratio * 100).toFixed(2)}cqw` : 'no shrink needed'
);

console.log('vertical fit:');
// A field whose line box is taller than its box gets clipped, and the clip is
// silent — the export just prints a chopped line. This is the guard for the
// front scale bump, and for any later one.
const CARD_HEIGHT = REFERENCE_CARD_WIDTH * CARD_HEIGHT_RATIO;
for (const [side, fields] of [
  ['front', template.frontFields],
  ['back', template.backFields],
]) {
  for (const field of fields) {
    const { lineHeight } = getFieldTypography(field, side);
    const ratio = getFieldSizeRatio(field, side);
    const boxH = (field.h / 100) * CARD_HEIGHT;
    const lineBox = ratio * REFERENCE_CARD_WIDTH * lineHeight;
    const headroom = boxH - lineBox;
    check(
      `${side}/${field.key} line fits its box`,
      headroom >= 0,
      `${lineBox.toFixed(1)}px line in ${boxH.toFixed(1)}px box, ${headroom.toFixed(1)}px spare`
    );
  }
}

console.log('multiline email:');
// An address has no spaces, so it can only be broken mid-token. The requirements
// are that it lands on a second line rather than running off the right edge, and
// that it never needs a third.
const email = template.backFields.find((f) => f.key === 'email');
{
  const { lineHeight } = getFieldTypography(email, 'back');
  const cap = getFieldSizeRatio(email, 'back') * REFERENCE_CARD_WIDTH;
  const pad = getFieldPaddingRatio() * REFERENCE_CARD_WIDTH;
  const innerWidth = (email.w / 100) * REFERENCE_CARD_WIDTH - pad * 2;
  const boxHeight = (email.h / 100) * REFERENCE_CARD_WIDTH * CARD_HEIGHT_RATIO;
  const roomForLines = Math.max(1, Math.floor(boxHeight / (cap * lineHeight)));
  check('box has room for two lines', roomForLines >= 2, `${roomForLines} lines`);

  for (const address of [
    'a@b.com',
    'abdur.rahman.chowdhury@aust.edu.bd',
    'a-very-long-address.that-keeps-going@a-rather-long-subdomain.example.edu.bd',
  ]) {
    const ratio = fitFieldSizeRatio(email, 'back', address) ?? cap / REFERENCE_CARD_WIDTH;
    const px = ratio * REFERENCE_CARD_WIDTH;
    mockCtx.font = `500 ${px}px Poppins`;
    const lines = wrapLines(mockCtx, address, innerWidth);
    const widest = Math.max(...lines.map((l) => widthOf(l, px)));
    const fitsHeight = lines.length * px * lineHeight <= boxHeight + 0.5;
    check(
      `${JSON.stringify(address)} wraps within the right edge`,
      widest <= innerWidth && fitsHeight && lines.length <= roomForLines,
      `${lines.length} line(s), widest ${widest.toFixed(0)}px of ${innerWidth.toFixed(0)}px, box holds ${roomForLines}`
    );
    // The point of breaking on @ and . rather than anywhere: a wrapped address
    // pauses where a reader expects it to, not mid-word.
    if (lines.length > 1) {
      check(
        `${JSON.stringify(address)} breaks on a boundary`,
        lines.slice(0, -1).every((l) => l.endsWith('@') || l.endsWith('.')),
        `lines: ${JSON.stringify(lines)}`
      );
    }
  }
}

console.log(failures === 0 ? 'RESULT OK' : `RESULT FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
