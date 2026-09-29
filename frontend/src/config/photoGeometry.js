import { PHOTO_FIELD } from './template.js';

// The picture slot's geometry is read from the nested { x, y, width, height }
// rects in config/template.js, falling back to the old flat { x, y, w, h } the
// backend template still returns, and finally to the local PHOTO_FIELD — so the
// slot keeps working whichever template config is live.
//
// Lives here rather than inside PhotoUploadZone because the canvas export
// (utils/cardRender.js) has to resolve the exact same rects to draw the photo
// and its ring into the downloaded card.
export function readPhotoRect(source) {
  if (!source) return null;
  const width = source.width ?? source.w;
  const height = source.height ?? source.h;
  if (width == null || height == null) return null;
  return {
    x: source.x ?? 0,
    y: source.y ?? 0,
    width,
    height,
    shape: source.shape ?? 'circle',
  };
}

/**
 * The photo slot, its printed ring, and the blank shown when nothing has been
 * uploaded yet. The ring is a sibling of the slot in the DOM (never a child)
 * so its geometry stays independent of the photo's.
 */
export function getPhotoGeometry(template) {
  const photo = template?.photo;
  return {
    image: readPhotoRect(photo?.image) || readPhotoRect(template?.photoField) || PHOTO_FIELD.image,
    overlay: readPhotoRect(photo?.overlay) || readPhotoRect(PHOTO_FIELD.overlay),
    overlayImage: photo?.overlayImage ?? PHOTO_FIELD.overlayImage,
    placeholderImage: photo?.placeholderImage ?? PHOTO_FIELD.placeholderImage,
  };
}

/** CSS border-radius for the photo slot, matching PhotoUploadZone. */
export function photoCornerRadius(shape) {
  return shape === 'circle' ? '50%' : '0.5rem';
}
