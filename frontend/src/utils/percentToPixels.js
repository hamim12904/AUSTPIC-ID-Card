/**
 * Converts one field's %-based box into pixels for a given rendered
 * width/height. Not needed for the DOM-overlay approach (FieldOverlay uses
 * CSS % directly) — kept for the day a canvas-based live preview replaces
 * the overlay inputs, or for sending pixel rects to the backend.
 */
export function percentToPixels(fieldDef, renderWidth, renderHeight) {
  return {
    x: (fieldDef.x / 100) * renderWidth,
    y: (fieldDef.y / 100) * renderHeight,
    width: (fieldDef.w / 100) * renderWidth,
    height: (fieldDef.h / 100) * renderHeight,
  };
}

/** Same conversion, against the template's native (full-resolution) image size. */
export function percentToNativePixels(fieldDef, nativeWidth, nativeHeight) {
  return percentToPixels(fieldDef, nativeWidth, nativeHeight);
}
