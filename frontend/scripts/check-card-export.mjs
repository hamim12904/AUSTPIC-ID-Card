// Checks what the download actually paints, by running the real
// renderCardSide() against a recording canvas. The preview and the export are
// separate renderers over the same template, so a field can appear in one and
// not the other; this asserts the export paints every populated field, inside
// its own box, on both sides.
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

// A recording 2D context. Clips are tracked as a stack of rects so a
// fillText() can be checked against the box that was active when it was called.
function makeCtx(record) {
  const state = { font: '10px sans-serif', fillStyle: '#000', textAlign: 'start', textBaseline: 'alphabetic' };
  let clips = [];
  const clipStack = [];
  let pendingPath = null;

  const px = () => Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 0);

  return {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    get font() { return state.font; },
    set font(v) { state.font = v; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v) { state.fillStyle = v; },
    get textAlign() { return state.textAlign; },
    set textAlign(v) { state.textAlign = v; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(v) { state.textBaseline = v; },
    save() { clipStack.push([...clips]); },
    restore() { clips = clipStack.pop() ?? []; },
    beginPath() { pendingPath = null; },
    rect(x, y, w, h) { pendingPath = { x, y, w, h }; },
    ellipse() { pendingPath = null; },
    roundRect(x, y, w, h) { pendingPath = { x, y, w, h }; },
    clip() { if (pendingPath) clips = [...clips, pendingPath]; },
    drawImage() {},
    measureText(text) { return { width: widthOf(text, px()) }; },
    fillText(text, x, y) {
      const box = clips.length ? clips[clips.length - 1] : null;
      record.push({
        text,
        x,
        y,
        fontSize: px(),
        font: state.font,
        fillStyle: state.fillStyle,
        textAlign: state.textAlign,
        width: widthOf(text, px()),
        clip: box,
      });
    },
  };
}

globalThis.document = {
  fonts: { load: async () => {}, ready: Promise.resolve() },
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    return { getContext: () => makeCtx(currentRecord) };
  },
};
let currentRecord = [];
globalThis.Image = class {
  constructor() {
    this.naturalWidth = 2214;
    this.naturalHeight = 3516;
    setTimeout(() => this.onload?.(), 0);
  }
  set src(v) { this._src = v; }
};

const { renderCardSide, NATIVE_CARD_WIDTH } = await import('../src/utils/cardRender.js');
const { CARD_HEIGHT_RATIO } = await import('../src/config/cardTypography.js');
const { default: template } = await import('../src/config/template.js');

const NAME = 'Abdur Rahman Chowdhury Jr';
const fields = {
  name: NAME,
  studentId: '221042063',
  department: 'CSE',
  bloodGroup: 'A+(ve)',
  contact: '+8801712345678',
  memberId: 'PIC-2026-02-0001',
  address: 'House 12, Road 5, Dhaka 1207',
  email: 'member@example.com',
};

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
};

const W = NATIVE_CARD_WIDTH;
const H = W * CARD_HEIGHT_RATIO;

for (const side of ['front', 'back']) {
  const record = [];
  currentRecord = record;
  await renderCardSide({ template, side, fields, photoUrl: null, width: W });

  const defs = side === 'front' ? template.frontFields : template.backFields;
  console.log(`${side}:`);

  for (const field of defs) {
    const value = fields[field.key];
    if (value === undefined) continue;
    const expected = field.uppercase ? value.toUpperCase() : value;
    // A drawn line may be a wrapped fragment, so match on the first word.
    const needle = expected.split(/\s+/)[0];
    const hits = record.filter((c) => c.text.includes(needle));
    if (hits.length === 0) {
      check(`${field.key} painted`, false, `nothing drawn for ${JSON.stringify(expected)}`);
      continue;
    }
    const hit = hits[0];
    const boxX = (field.x / 100) * W;
    const boxY = (field.y / 100) * H;
    const boxW = (field.w / 100) * W;
    const boxH = (field.h / 100) * H;
    const inside =
      hit.x >= boxX - 0.5 &&
      hit.x <= boxX + boxW + 0.5 &&
      hit.y >= boxY - 0.5 &&
      hit.y <= boxY + boxH + 0.5;
    check(
      `${field.key} painted inside its box`,
      inside && hit.fontSize > 0,
      `"${hit.text}" ${hit.fontSize.toFixed(1)}px at (${hit.x.toFixed(0)}, ${hit.y.toFixed(0)}), box (${boxX.toFixed(0)}, ${boxY.toFixed(0)}) ${boxW.toFixed(0)}x${boxH.toFixed(0)}`
    );
  }
}

console.log(failures === 0 ? 'RESULT OK' : `RESULT FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
