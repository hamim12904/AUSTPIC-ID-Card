/**
 * Rasterising the card's real DOM into a canvas, so a download is the same
 * rendering the person just approved.
 *
 * The card used to be redrawn by hand on a canvas in utils/cardRender.js, which
 * meant two independent implementations of one layout: CSS and cqw in the
 * browser, arithmetic and fillText() in the export. They agreed only until
 * something changed in one of them, and every field nudge turned into a bug
 * report about the other — vertical alignment, the name fitter, type sizes.
 * None of those can drift here, because there is nothing to drift: the node the
 * preview is showing is the node that gets painted.
 *
 * How it works: the live face is cloned into an SVG <foreignObject>, carrying
 * the page's own CSS, its web fonts inlined as data URLs and its images inlined
 * the same way. The SVG is then loaded as an image and drawn to a canvas.
 *
 * Two details carry the "exactly the preview" guarantee:
 *
 * - The SVG's viewBox is the face's *laid out* size, so the clone is laid out at
 *   the same size the preview laid it out at and the whole thing is then scaled
 *   to the download's resolution. Laying it out at the output size instead would
 *   look equivalent but is not: rem-derived padding and the px floors in the
 *   type clamp() do not scale with a re-layout, so the two would differ by about
 *   1% on the inner width and a name near the fit boundary would land
 *   differently in each. Scaling one layout keeps every unit proportional.
 *
 * - Everything the SVG references is inlined. An SVG loaded as an image is a
 *   separate, static document: it cannot reach the page's stylesheets, its
 *   loaded fonts, or any external image, and a single remaining external
 *   reference taints the canvas so toBlob() throws.
 */

import { CARD_HEIGHT_RATIO } from '../config/cardTypography.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** Only ever awaited for a face; both must be settled before the clone is built. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The card image could not be decoded.'));
    img.src = src;
  });
}

async function toDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not read ${url} (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not encode ${url}.`));
    reader.readAsDataURL(blob);
  });
}

/**
 * The page's CSS as text.
 *
 * Same-origin stylesheets are readable through cssRules. The Google Fonts
 * <link> is not — it is cross-origin — so its text is fetched instead, which it
 * permits. Both are needed: a card whose type fell back to a system face would
 * be a very visible difference from the preview.
 */
async function collectPageCss() {
  const chunks = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) chunks.push(rule.cssText);
    } catch {
      // Cross-origin. Caught below via the <link>, or genuinely unreadable, in
      // which case the card still renders, just without those rules.
    }
  }

  for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
    const href = link.href;
    if (href.startsWith(window.location.origin)) continue; // already inlined above
    try {
      const response = await fetch(href);
      if (response.ok) chunks.push(await response.text());
    } catch {
      // No cross-origin access: the faces it declared are simply unavailable to
      // the export, exactly as they would be to a card with no web font.
    }
  }

  return chunks.join('\n');
}

/** Family names out of a `font-family: 'Poppins', sans-serif` declaration. */
function familyNames(value) {
  return value
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

const FONT_FACE_BLOCK = /@font-face\s*\{([^}]*)\}/g;

/**
 * Rebuilds every @font-face with its src() as a data URL.
 *
 * Restricted to the families the card actually sets type in. Space Grotesk and
 * friends are UI chrome that never appears inside a card face, and inlining
 * every weight of a display family would add megabytes to the SVG for no gain.
 */
async function inlineFonts(css, wantedFamilies) {
  const faces = [];
  for (const match of css.matchAll(FONT_FACE_BLOCK)) {
    const body = match[1];
    const family = /font-family:\s*([^;]+)/.exec(body)?.[1];
    const src = /src:\s*url\((['"]?)([^'")]+)\1\)/.exec(body)?.[2];
    if (!family || !src) continue;
    const names = familyNames(family);
    if (wantedFamilies.length && !names.some((n) => wantedFamilies.includes(n))) continue;

    const url = new URL(src, document.baseURI).href;
    let dataUrl;
    try {
      dataUrl = await toDataUrl(url);
    } catch {
      continue; // An unreachable face degrades to a fallback, not to a failure.
    }
    const weight = /font-weight:\s*([^;]+)/.exec(body)?.[1]?.trim();
    const style = /font-style:\s*([^;]+)/.exec(body)?.[1]?.trim();
    const stretch = /font-stretch:\s*([^;]+)/.exec(body)?.[1]?.trim();
    faces.push(
      [
        '@font-face{',
        `font-family:${family.trim()};`,
        `src:url(${dataUrl});`,
        weight ? `font-weight:${weight};` : '',
        style ? `font-style:${style};` : '',
        stretch ? `font-stretch:${stretch};` : '',
        '}',
      ].join('')
    );
  }
  return faces.join('\n');
}

/**
 * Prepares a clone of a face for export: drops the interactive furniture, undoes
 * the flip, and inlines every image.
 */
async function prepareClone(node) {
  const clone = node.cloneNode(true);

  // The back face carries its own rotateY(180deg) so the two faces can sit in the
  // same 3D context; the wrapper's rotation cancels it when the card is turned
  // over. Cloning the face alone leaves that rotation behind, which would print
  // the back mirrored. Cleared here, along with the 3D properties that go with it.
  const rootStyle = clone.style;
  rootStyle.transform = 'none';
  rootStyle.transformStyle = 'flat';
  rootStyle.backfaceVisibility = 'visible';
  rootStyle.perspective = 'none';
  // The preview's own elevation shadow is a page affordance, not part of the card.
  rootStyle.boxShadow = 'none';
  rootStyle.filter = 'none';
  // The face is absolutely positioned inside a wrapper it no longer has.
  rootStyle.position = 'relative';
  rootStyle.inset = 'auto';
  rootStyle.width = '100%';
  rootStyle.height = '100%';

  // Nothing interactive survives into a read-only card; the visible hit strips
  // and hidden screen-reader text have no business in a picture.
  for (const el of Array.from(
    clone.querySelectorAll('.field-label-hit, .sr-only, input, button, textarea, select')
  )) {
    el.remove();
  }

  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;
      try {
        img.setAttribute('src', await toDataUrl(src));
        img.removeAttribute('srcset');
      } catch (err) {
        // A picture the browser can show but fetch cannot read (an API image
        // without CORS) would leave the SVG referencing something external,
        // which taints the canvas. Better to fail and use the canvas fallback.
        throw new Error(`Could not inline ${src}: ${err.message}`);
      }
    })
  );

  return clone;
}

/**
 * Paints a card face at `pixelWidth` across, returning a canvas.
 *
 * @param {object} options
 * @param {HTMLElement} options.node the live `.card-face` element to copy
 * @param {number} options.pixelWidth output width in pixels
 * @param {string[]} [options.fontFamilies] families to inline; others are skipped
 * @param {string} [options.background] colour to lay under the card. Left unset,
 *   the slivers outside the card's rounded corners stay transparent, which is
 *   what a PNG wants. The PDF path passes white because it encodes JPEG, which
 *   has no alpha and would otherwise render those corners black.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function rasterizeCardFace({ node, pixelWidth, fontFamilies = [], background }) {
  if (typeof document === 'undefined') {
    throw new Error('The card can only be rendered in a browser.');
  }
  if (!node) throw new Error('There is no card on screen to export.');

  // The face's own laid out size. This is the viewBox, and the reason the
  // export is the preview scaled up rather than a second layout of it.
  const rect = node.getBoundingClientRect();
  const viewWidth = Math.round(rect.width);
  const viewHeight = Math.round(rect.height);
  if (viewWidth < 1 || viewHeight < 1) {
    throw new Error('The card is not on screen, so it cannot be exported.');
  }

  const outputWidth = Math.max(1, Math.round(pixelWidth));
  const outputHeight = Math.round(outputWidth * CARD_HEIGHT_RATIO);

  // Fonts before the clone: awaiting them keeps the card in step with the
  // preview, which is the entire point of exporting the DOM.
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Nothing to do; the faces that did load are the ones inlined below.
    }
  }

  const [css, clone] = await Promise.all([collectPageCss(), prepareClone(node)]);
  const fonts = await inlineFonts(css, fontFamilies);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(outputWidth));
  svg.setAttribute('height', String(outputHeight));
  svg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);

  const foreign = document.createElementNS(SVG_NS, 'foreignObject');
  foreign.setAttribute('x', '0');
  foreign.setAttribute('y', '0');
  foreign.setAttribute('width', String(viewWidth));
  foreign.setAttribute('height', String(viewHeight));

  const host = document.createElementNS(XHTML_NS, 'div');
  host.setAttribute('style', `width:${viewWidth}px;height:${viewHeight}px;margin:0;`);

  const styleEl = document.createElementNS(XHTML_NS, 'style');
  // Appended last so it cannot be beaten by an inline style, and so the inlined
  // faces are declared before anything tries to use them.
  styleEl.textContent = `${fonts}\n${css}`;
  host.appendChild(clone);
  host.appendChild(styleEl);

  foreign.appendChild(host);
  svg.appendChild(foreign);

  // Serialised rather than templated: XMLSerializer escapes the CSS and the
  // markup correctly, which a hand-built string would not, and the result is
  // well-formed XHTML inside the foreignObject.
  const markup = new XMLSerializer().serializeToString(svg);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

  // Loaded as an image rather than an <img> in the document, so nothing about
  // the live card is disturbed while the export is built.
  const raster = await loadImage(source);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser blocked 2D canvas rendering.');
  // The face is a rounded card, so whatever lies outside its radius is
  // transparent. Left that way the corners match the preview and a PNG can be
  // dropped onto any background. A caller encoding a format without alpha (see
  // the `background` option) supplies a colour here instead.
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
  }
  ctx.drawImage(raster, 0, 0, outputWidth, outputHeight);
  return canvas;
}
