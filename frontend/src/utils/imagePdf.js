// A4 in PostScript points, the default sheet the card is laid out on.
const A4 = { width: 595.28, height: 841.89 };
const DEFAULT_MARGIN = 48;
// Room under the card for the side label, plus the gap between the two.
const CAPTION_GAP = 26;
const CAPTION_SIZE = 11;
// Helvetica's average advance is close enough to this for centring a one-word
// label. The alternative is measuring through a canvas, which would make this
// module depend on the DOM for no real gain.
const HELVETICA_ADVANCE = 0.55;

// Every string in the PDF structure is ASCII, so one byte per char. The only
// binary payload is the JPEG stream, which arrives as bytes already.
function latin1(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

const round = (n) => Math.round(n * 100) / 100;

// Literal string in a content stream. The label is a plain word, but escaping
// the delimiters keeps the writer safe for any caller.
function pdfText(value) {
  const escaped = String(value).replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');
  return `(${escaped})`;
}

/**
 * Wraps JPEG images in a minimal PDF, one page per image.
 *
 * The images go in as /DCTDecode XObjects, which is exactly what JPEG already
 * is, so the bytes are copied through untouched — no re-encoding and no
 * dependency. (PNG would have needed its filters undone and the result
 * Flate-compressed, which is why the export renders JPEG for the PDF path.)
 *
 * Each page is A4 with the image centred and a short label underneath, so a
 * two-sided card prints as two ordinary sheets. Pass `pageWidth`/`pageHeight`/
 * `margin` to change that.
 *
 * @param {{label?: string, jpeg: Uint8Array, width: number, height: number}[]} pages
 * @returns {Uint8Array} the complete PDF file
 */
export function buildImagePdf(pages, options = {}) {
  if (!pages?.length) throw new Error('A PDF needs at least one page.');

  const pageWidth = options.pageWidth ?? A4.width;
  const pageHeight = options.pageHeight ?? A4.height;
  const margin = options.margin ?? DEFAULT_MARGIN;

  // Fixed objects first (catalog, page tree, one font), then three per page:
  // the page itself, its content stream, and the image it draws.
  const FONT_OBJECT = 3;
  const objectCount = 3 + pages.length * 3;
  const pageObject = (index) => 4 + index * 3;
  const contentObject = (index) => 5 + index * 3;
  const imageObject = (index) => 6 + index * 3;

  const chunks = [];
  const offsets = new Array(objectCount + 1).fill(0);
  let length = 0;

  // Byte offsets in the cross-reference table have to count real bytes, not
  // characters, so everything is appended as bytes and measured as it lands.
  const push = (data) => {
    const bytes = typeof data === 'string' ? latin1(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const beginObject = (number, dictionary) => {
    offsets[number] = length;
    push(`${number} 0 obj\n${dictionary}\n`);
  };

  push('%PDF-1.4\n');
  // A comment with high-bit bytes marks the file as containing 8-bit data, so
  // transfer agents don't try to re-encode the JPEG streams as text.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const kids = pages.map((_, index) => `${pageObject(index)} 0 R`).join(' ');
  beginObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  beginObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  beginObject(FONT_OBJECT, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  pages.forEach((page, index) => {
    const scale = Math.min(
      (pageWidth - margin * 2) / page.width,
      (pageHeight - margin * 2 - CAPTION_GAP) / page.height
    );
    const drawWidth = page.width * scale;
    const drawHeight = page.height * scale;
    // PDF's origin is bottom-left, so the card's top margin becomes the y it
    // starts at, and the label sits in the gap above the bottom margin.
    const drawX = (pageWidth - drawWidth) / 2;
    const drawY = margin + CAPTION_GAP;
    const captionY = margin + CAPTION_SIZE * 0.8;
    const captionWidth = page.label ? page.label.length * CAPTION_SIZE * HELVETICA_ADVANCE : 0;

    const content = [
      'q',
      // cm takes SIX operands — a b c d e f — and takes exactly six. Mapping the
      // unit square (0,0)-(1,1) onto the card's rect is the diagonal matrix
      // [w 0 0 h x y]. Writing the rect as four operands instead is a content
      // stream syntax error, and a viewer that trips over one discards the
      // whole stream: the page renders blank, image and label both.
      `${round(drawWidth)} 0 0 ${round(drawHeight)} ${round(drawX)} ${round(drawY)} cm`,
      '/Im0 Do',
      'Q',
      ...(page.label
        ? [
            'BT',
            `/F1 ${CAPTION_SIZE} Tf`,
            '0.19 0.24 0.27 rg',
            `${round((pageWidth - captionWidth) / 2)} ${round(captionY)} Td`,
            `${pdfText(page.label)} Tj`,
            'ET',
          ]
        : []),
    ].join('\n');
    const contentBytes = latin1(content);

    beginObject(
      pageObject(index),
      [
        '<< /Type /Page',
        '/Parent 2 0 R',
        `/MediaBox [0 0 ${round(pageWidth)} ${round(pageHeight)}]`,
        `/Resources << /XObject << /Im0 ${imageObject(index)} 0 R >> /Font << /F1 ${FONT_OBJECT} 0 R >> >>`,
        `/Contents ${contentObject(index)} 0 R`,
        '>>',
      ].join(' ')
    );

    beginObject(contentObject(index), `<< /Length ${contentBytes.length} >>`);
    push('stream\n');
    push(contentBytes);
    push('endstream\nendobj\n');

    beginObject(
      imageObject(index),
      [
        '<< /Type /XObject /Subtype /Image',
        `/Width ${page.width}`,
        `/Height ${page.height}`,
        '/ColorSpace /DeviceRGB',
        '/BitsPerComponent 8',
        '/Filter /DCTDecode',
        // +1 for the newline before endstream, so /Length covers every byte
        // between the two keywords.
        `/Length ${page.jpeg.length + 1}`,
        '>>',
      ].join(' ')
    );
    push('stream\n');
    push(page.jpeg);
    push('\nendstream\nendobj\n');
  });

  const xrefOffset = length;
  // Each entry has to be exactly 20 bytes: 10-digit offset, 5-digit generation,
  // the type, then a two-byte end-of-line.
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let number = 1; number <= objectCount; number++) {
    xref += `${String(offsets[number]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const file = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    file.set(chunk, at);
    at += chunk.length;
  }
  return file;
}
