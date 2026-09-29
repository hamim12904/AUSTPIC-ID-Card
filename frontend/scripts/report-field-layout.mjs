// Reports where each field's glyphs actually land, so hand-tuned nudges can be
// checked for collisions. Text position is not the box position: a single-line
// field is centred in its box, a multiline one is pinned to the top.
import { readFileSync } from 'node:fs';

const H = (420 * 3516) / 2214; // card height at the reference width, in px
const card = readFileSync('src/config/template.js', 'utf8');

const sides = card.split(/backFields:\s*\[/);
const blocks = [
  ['front', sides[0]],
  ['back', sides[1]],
];

// 0.30 points of card height, in px, for readability below.
const px = (points) => (points / 100) * H;

for (const [side, block] of blocks) {
  console.log(`${side}:`);
  const fields = [...block.matchAll(/key: '(\w+)',[\s\S]*?y: ([\d.]+),[\s\S]*?h: ([\d.]+),/g)].map((m) => ({
    key: m[1],
    y: Number(m[2]),
    h: Number(m[3]),
  }));
  // Only the ones after the photo block, so the front's fields list is complete.
  let previousTextBottom = null;
  for (const [index, f] of fields.entries()) {
    // Bound the field's own text at the next field's key. Scanning to the end of
    // the block would make every field before a multiline one look multiline.
    const start = block.indexOf(`key: '${f.key}'`);
    const end = index + 1 < fields.length ? block.indexOf(`key: '${fields[index + 1].key}'`) : block.length;
    const multiline = /multiline: true/.test(block.slice(start, end));
    const fontPx =
      f.key === 'name' ? (side === 'front' ? 36.12 : 30.24) : side === 'front' ? 18.08 : 12.6;
    const lineHeight = multiline ? fontPx * 1.15 : fontPx * 1.05;
    // Worst case for a multiline field: as many lines as the box can hold, since
    // a longer value fills it. A single-line field is one line by definition.
    const lines = multiline ? Math.max(1, Math.floor(px(f.h) / lineHeight)) : 1;
    const textHeight = lineHeight * lines;
    const boxHeight = px(f.h);
    // Centred for a single line, pinned to the top for a multiline block.
    const textTop = px(f.y) + (multiline ? 0 : (boxHeight - textHeight) / 2);
    const textBottom = textTop + textHeight;
    const gap =
      previousTextBottom === null
        ? ''
        : `  text gap ${(textTop - previousTextBottom).toFixed(1)}px${
            textTop - previousTextBottom < 2 ? '  <-- TIGHT' : ''
          }`;
    console.log(
      `  ${f.key.padEnd(12)} box ${px(f.y).toFixed(0).padStart(5)}..${(px(f.y) + boxHeight).toFixed(0).padStart(5)}` +
        `   text ${textTop.toFixed(1).padStart(6)}..${textBottom.toFixed(1).padStart(6)}` +
        `   (${lines} line${lines > 1 ? 's' : ''}, ${fontPx.toFixed(1)}px)${gap}`
    );
    previousTextBottom = textBottom;
  }
}
