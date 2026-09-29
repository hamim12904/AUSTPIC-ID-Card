// Structural check for utils/imagePdf.js: the cross-reference table's byte
// offsets are the whole ballgame in a hand-written PDF, and an off-by-one only
// shows up as " Acrobat couldn't open this file". Run with: node scripts/check-image-pdf.mjs
import { buildImagePdf } from '../src/utils/imagePdf.js';

const latin1ToString = (bytes) =>
  Array.from(bytes, (b) => String.fromCharCode(b)).join('');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Two "JPEG" payloads of different sizes, so an offset bug on the second image
// cannot hide behind a fixed-length stream.
const frontJpeg = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) % 251);
const backJpeg = Uint8Array.from({ length: 1237 }, (_, i) => (i * 13) % 239);

const pdf = buildImagePdf([
  { label: 'Front', jpeg: frontJpeg, width: 2214, height: 3516 },
  { label: 'Back', jpeg: backJpeg, width: 2214, height: 3516 },
]);

const text = latin1ToString(pdf);
console.log('imagePdf structure');

// --- Header, trailer, EOF ---------------------------------------------------
check('starts with %PDF-1.4', text.startsWith('%PDF-1.4\n'));
check('binary marker comment present', text.includes('\x25\xe2\xe3\xcf\xd3\n'));
check('ends with %%EOF', text.trimEnd().endsWith('%%EOF'));
check('has /Type /Catalog', text.includes('/Type /Catalog'));
check('page tree counts 2 pages', text.includes('/Kids [4 0 R 7 0 R] /Count 2'));
check('has a base-14 font', text.includes('/BaseFont /Helvetica'));
check(
  'MediaBox is A4 portrait',
  text.includes('/MediaBox [0 0 595.28 841.89]'),
  'A4 should be 595.28 x 841.89 pt'
);

// --- Object numbering: 1 catalog, 2 pages, 3 font, then 3 per page -----------
const objectNumbers = [...text.matchAll(/^(\d+) 0 obj$/gm)].map((m) => Number(m[1]));
check(
  'objects are numbered 1..9 with no gaps',
  objectNumbers.join(',') === '1,2,3,4,5,6,7,8,9',
  `got ${objectNumbers.join(',')}`
);
check(
  'page 1 references image object 6',
  text.includes('/Im0 6 0 R') && text.includes('/Contents 5 0 R')
);
check(
  'page 2 references image object 9',
  text.includes('/Im0 9 0 R') && text.includes('/Contents 8 0 R')
);

// --- Cross-reference table --------------------------------------------------
const xrefStart = text.indexOf('xref\n0 10\n');
check('xref table found', xrefStart > 0);
check('startxref points at the xref keyword', text.includes(`startxref\n${xrefStart}\n`));

const xrefBody = text.slice(xrefStart);
const entries = [...xrefBody.matchAll(/^(\d{10}) (\d{5}) ([nf]) $/gm)];
check('xref has 10 entries (free + 9 objects)', entries.length === 10, `got ${entries.length}`);

entries.slice(1).forEach((entry, i) => {
  const objectNumber = i + 1;
  const offset = Number(entry[1]);
  const header = `${objectNumber} 0 obj`;
  check(
    `xref entry ${objectNumber} points at "${header}"`,
    text.startsWith(header, offset),
    `offset ${offset} holds ${JSON.stringify(text.slice(offset, offset + 16))}`
  );
});
check('free entry is the 65535 head', entries[0][1] === '0000000000' && entries[0][2] === '65535' && entries[0][3] === 'f');

// --- Stream /Length agreement ----------------------------------------------
for (const [name, bytes] of [['front', frontJpeg], ['back', backJpeg]]) {
  const dict = text.match(
    new RegExp(`<< /Type /XObject /Subtype /Image[^>]*?/Length (\\d+) >>\\nstream\\n`, 'g')
  );
  check(`${name}: two image XObjects present`, dict?.length === 2);

  const index = name === 'front' ? 0 : 1;
  const declared = Number(dict[index].match(/\/Length (\d+) /)[1]);
  check(
    `${name}: /Length covers the payload plus its trailing newline`,
    declared === bytes.length + 1,
    `declared ${declared}, payload ${bytes.length}`
  );

  // Walk the file: the payload has to start right after "stream\n" and be
  // followed by exactly "\nendstream".
  const start = text.indexOf('stream\n', text.indexOf(dict[index])) + 'stream\n'.length;
  const actual = Array.from(pdf.slice(start, start + bytes.length));
  const expected = Array.from(bytes);
  check(
    `${name}: payload bytes sit at the declared offset`,
    actual.every((b, i) => b === expected[i])
  );
  check(
    `${name}: payload is followed by endstream`,
    text.startsWith('\nendstream\nendobj\n', start + bytes.length)
  );
}

const contentStreams = [...text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)];
check('two content streams', contentStreams.length === 2, `got ${contentStreams.length}`);
// --- Content stream: every operator has to get the operand count PDF expects -
// A stream with the wrong number of operands is a syntax error, and a viewer
// stops at the first one and renders the page blank. So walk the stream the way
// a viewer does — operands accumulate, an operator consumes them — and assert
// each operator's arity.
const OPERAND_COUNTS = {
  q: 0, Q: 0, BT: 0, ET: 0,
  cm: 6,
  Do: 1, // a name: /Im0 Do
  Tj: 1, // a literal string: (Front) Tj
  Tf: 2, // name + size
  Td: 2,
  rg: 3,
};

function checkStream(stream, label) {
  const problems = [];
  let pending = 0;

  for (const token of stream.split(/[\s]+/).filter(Boolean)) {
    // Operands are numbers, names (/Im0) and literal strings ((Front)).
    // Anything else has to be an operator, which consumes what is pending.
    const isOperand = /^[-+]?[\d.]+$/.test(token) || token.startsWith('/') || token.startsWith('(');
    if (isOperand) {
      pending += 1;
      continue;
    }
    const arity = OPERAND_COUNTS[token];
    if (arity === undefined) {
      problems.push(`unknown operator ${JSON.stringify(token)}`);
      continue;
    }
    if (pending !== arity) {
      problems.push(`${token} got ${pending} operand(s), needs ${arity}`);
    }
    pending = 0;
  }
  if (pending !== 0) problems.push(`${pending} operand(s) with no operator after them`);

  check(`${label}: every operator has the right operand count`, problems.length === 0, problems.join('; '));
}

contentStreams.forEach((match, i) => {
  const declared = Number(match[1]);
  const start = match.index + match[0].length;
  const stream = text.slice(start, start + declared);
  check(
    `content stream ${i + 1} /Length matches its bytes`,
    text.slice(start + declared, start + declared + 9) === 'endstream',
    `declared ${declared}`
  );
  check(`content stream ${i + 1} draws the image and the label`, stream.includes('/Im0 Do') && stream.includes('Tj'));
  checkStream(stream, `content stream ${i + 1}`);
});

// --- Geometry: the matrix really maps the unit square onto the card's rect ---
const cmLine = text.match(/^([-\d. ]+) cm$/m);
check('image placement matrix present', Boolean(cmLine));
if (cmLine) {
  const [a, b, c, d, e, f] = cmLine[1].trim().split(/\s+/).map(Number);
  const margin = 48;
  const gap = 26;
  const [w, h] = [2214, 3516];
  const scale = Math.min((595.28 - margin * 2) / w, (841.89 - margin * 2 - gap) / h);
  const drawW = w * scale;
  const drawH = h * scale;

  check('cm is a pure scale, no skew or flip', b === 0 && c === 0, `b=${b} c=${c}`);
  check('cm scales x to the card width', Math.abs(a - drawW) < 0.01, `a=${a}, want ${round2(drawW)}`);
  check('cm scales y to the card height', Math.abs(d - drawH) < 0.01, `d=${d}, want ${round2(drawH)}`);
  check('card keeps the 2214:3516 art ratio', Math.abs(a / d - 2214 / 3516) < 0.001);
  check('cm centres the card horizontally', Math.abs(e - (595.28 - drawW) / 2) < 0.01, `e=${e}`);
  check('cm clears the bottom margin and the caption', Math.abs(f - (margin + gap)) < 0.01, `f=${f}`);
  check('card stays inside the top margin', f + d <= 841.89 - margin + 0.01, `top=${round2(f + d)}`);
  check('card stays inside the left margin', e >= margin - 0.01, `left=${e}`);
  check('card stays inside the right margin', e + a <= 595.28 - margin + 0.01, `right=${round2(e + a)}`);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- Degenerate input -------------------------------------------------------
try {
  buildImagePdf([]);
  check('rejects an empty page list', false, 'should have thrown');
} catch {
  check('rejects an empty page list', true);
}

console.log(failures === 0 ? '\nAll imagePdf checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
