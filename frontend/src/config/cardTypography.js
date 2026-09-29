// The card's type is sized in cqw — 1% of the card face's width — so a field
// reads the same on a narrow phone card as on a wide desktop one. The card
// faces are the containers (see `container-type: inline-size` in
// IDCardFront/IDCardBack), so 1cqw is 1% of the card.
//
// Each entry is the percentage of card width a field is designed around, plus
// the px floor the clamp() needs to keep a field legible on a small screen.
// The name is 10px larger on each side than it was: name|front 26.0px -> 36.1px
// and name|back 20.2px -> 30.2px at the reference width. Expressed in cqw
// because the template's fontSize is a ceiling these never reach, so raising
// that alone would have changed nothing.
const FIELD_SCALE = {
  'name|front': { cqw: 8.6, floorPx: 18 },
  'name|back': { cqw: 7.2, floorPx: 13 },
  front: { cqw: 4.1, floorPx: 13 },
  back: { cqw: 2.6, floorPx: 12 },
};

// The width the px figures in that clamp are authored against, and the width
// .id-card-surface actually renders at on any viewport wider than ~452px. The
// canvas export (utils/cardRender.js) resolves the clamp against this same
// width, which is what makes a downloaded card agree with the one on screen
// rather than merely resembling it.
export const REFERENCE_CARD_WIDTH = 420;

// The card art is 2214x3516, so every field's height in percent of the card's
// height needs this to become a pixel box. Lives here rather than in
// utils/cardRender.js because the type fitter (utils/textFit.js) measures
// against the same box, and the two must not disagree about how tall a field is.
export const CARD_HEIGHT_RATIO = 3516 / 2214;

function scaleFor(field, side) {
  return FIELD_SCALE[field.key === 'name' ? `name|${side}` : side] || FIELD_SCALE.back;
}

/** Percentage of the card's width this field's font is designed around. */
export function getFieldCqw(field, side) {
  return scaleFor(field, side).cqw;
}

/**
 * Fraction of the card's width this field's font should occupy — the same
 * value getFieldSize produces, but resolved and stripped of units so the
 * canvas export can multiply it by whatever width it is rendering at.
 *
 * The clamp is applied rather than skipped. It is not decorative: at the
 * reference width the back's 2.6cqw lands on 10.9px and gets floored to 12px,
 * so ignoring the floor would export that text about 10% smaller than the
 * person just approved in the preview.
 */
export function getFieldSizeRatio(field, side) {
  const { cqw, floorPx } = scaleFor(field, side);
  const capPx = Number(field.fontSize) || (side === 'front' ? 18 : 16);
  const preferredPx = (cqw / 100) * REFERENCE_CARD_WIDTH;
  const resolvedPx = Math.min(Math.max(preferredPx, floorPx), capPx);
  return resolvedPx / REFERENCE_CARD_WIDTH;
}

/** The CSS font-size for a field: a cqw size clamped to the config's cap. */
export function getFieldSize(field, side) {
  const { cqw, floorPx } = scaleFor(field, side);
  const configuredSize = Number(field.fontSize) || (side === 'front' ? 18 : 16);
  return `clamp(${floorPx}px, ${cqw}cqw, ${configuredSize}px)`;
}

/**
 * Everything about how a field's text is set, from the template config plus a
 * per-side default. Shared by the live card (FieldOverlay) and the canvas
 * export so the two can never drift apart.
 */
export function getFieldTypography(field, side) {
  const isFront = side === 'front';
  return {
    fontFamily: field.fontFamily || (isFront ? '"Mina", sans-serif' : '"Poppins", sans-serif'),
    fontWeight: field.fontWeight ?? (isFront ? 400 : 500),
    fontSize: getFieldSize(field, side),
    lineHeight: field.multiline ? 1.15 : 1.05,
  };
}

/**
 * Horizontal inset inside a field box, as a fraction of the card's width.
 * Mirrors `padding: 0 0.15rem` on .field-input and .field-static-text: 0.15rem
 * at the 16px root font is 2.4px against the reference card width.
 */
export function getFieldPaddingRatio() {
  return (0.15 * 16) / REFERENCE_CARD_WIDTH;
}
