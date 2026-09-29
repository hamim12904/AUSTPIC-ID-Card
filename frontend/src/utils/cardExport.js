import { renderCardSide, NATIVE_CARD_WIDTH } from './cardRender.js';
import { rasterizeCardFace } from './domRaster.js';
import { buildImagePdf } from './imagePdf.js';

// PNG is lossless, so the flat download uses it. The PDF has to embed JPEG
// (see utils/imagePdf.js), and a high quality setting keeps the card's small
// type legible without bloating the file.
const PDF_QUALITY = 0.95;

/**
 * The families the card sets type in, taken from the template so a card that
 * gains a face does not silently lose it from the export. Anything not listed
 * here is left out of the inlined CSS.
 */
function cardFontFamilies(template) {
  const names = new Set();
  const fields = [
    ...(template?.frontFields ?? []),
    ...(template?.backFields ?? []),
  ];
  for (const field of fields) {
    for (const value of [field.fontFamily, field.placeholderFontFamily]) {
      if (!value) continue;
      for (const part of value.split(',')) {
        const name = part.trim().replace(/^["']|["']$/g, '');
        if (name) names.add(name);
      }
    }
  }
  // The per-side defaults in config/cardTypography.js, which a field only
  // overrides when it sets its own.
  names.add('Mina');
  names.add('Poppins');
  return Array.from(names);
}

/**
 * One side of the card, ready to encode.
 *
 * Prefers rasterising the face the person is looking at, so the file is that
 * exact rendering at full resolution. Falls back to utils/cardRender.js if the
 * DOM cannot be rasterised — an image the browser can display but the exporter
 * cannot read, or a browser without foreignObject support — because a slightly
 * different card is much better than no card at all.
 *
 * `background` is what goes under the card's rounded corners. Left unset they
 * stay transparent, which is what a PNG should carry so it can be placed on any
 * background. The PDF cannot: it embeds JPEG, which has no alpha channel, and a
 * viewer given transparent pixels there would show them as black.
 */
async function renderSide({ node, template, side, fields, photoUrl, background }) {
  if (node) {
    try {
      return await rasterizeCardFace({
        node,
        pixelWidth: NATIVE_CARD_WIDTH,
        fontFamilies: cardFontFamilies(template),
        background,
      });
    } catch (err) {
      console.warn(
        `[cardExport] could not rasterise the ${side} from the DOM, falling back to the canvas renderer:`,
        err
      );
    }
  }
  return renderCardSide({ template, side, fields, photoUrl });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the card image.'));
      },
      type,
      quality
    );
  });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: some browsers abort the download if the URL goes
  // away before the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** AUST-PIC-2026-1234 style stem, so a member's two files are recognisable. */
function fileStem(fields) {
  const id = (fields?.memberId ?? '').toString().trim();
  const name = (fields?.name ?? '').toString().trim().replace(/\s+/g, '-');
  return ['AUST-PIC-2026', id, name].filter(Boolean).join('-');
}

/**
 * Downloads one side of the card as a PNG, at the template art's full native
 * resolution.
 */
export async function downloadCardPng({ node, template, side, fields, photoUrl }) {
  // No background: the corners outside the card's radius stay transparent so the
  // file can sit on any surface.
  const canvas = await renderSide({ node, template, side, fields, photoUrl });
  const blob = await canvasToBlob(canvas, 'image/png');
  saveBlob(blob, `${fileStem(fields)}-${side}.png`);
  return blob;
}

/**
 * Downloads both sides of the card as a two-page PDF — page 1 front, page 2
 * back, each centred on A4.
 */
export async function downloadCardPdf({ frontNode, backNode, template, fields, photoUrl }) {
  const pages = [];
  for (const [side, node] of [
    ['front', frontNode],
    ['back', backNode],
  ]) {
    const canvas = await renderSide({
      node,
      template,
      side,
      fields,
      photoUrl,
      background: '#ffffff',
    });
    const blob = await canvasToBlob(canvas, 'image/jpeg', PDF_QUALITY);
    pages.push({
      label: side === 'front' ? 'Front' : 'Back',
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    });
  }

  const pdf = buildImagePdf(pages);
  saveBlob(new Blob([pdf], { type: 'application/pdf' }), `${fileStem(fields)}.pdf`);
  return pdf;
}
