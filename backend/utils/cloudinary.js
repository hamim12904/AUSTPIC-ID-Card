/**
 * Cloudinary, the store the member photo's image bytes actually live in.
 *
 * The user document keeps only a pointer to the asset (see models/user.js), so
 * the same MongoDB holds every other card input and none of the picture data.
 * That is the reason to use Cloudinary at all: the bytes are served over a CDN,
 * transformed per request, and the database document stays a few hundred bytes
 * however large the photo is.
 *
 * The env is read LAZILY, on first use, and never at import time. ESM evaluates
 * every import before the importing module's body, and index.js only calls
 * dotenv.config() in its body (index.js:16) — so anything read during import
 * would see an empty process.env and conclude the keys were missing.
 */
import { v2 as cloudinary } from 'cloudinary';

/** Every name a caller needs in one place, so the boot check and the SDK cannot disagree. */
const VARS = {
  CLOUDINARY_CLOUD_NAME: () => process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: () => process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: () => process.env.CLOUDINARY_API_SECRET,
};

/** The names not present in the environment, for index.js's startup check. */
export function missingCloudinaryVars() {
  return Object.entries(VARS)
    .filter(([, read]) => !read())
    .map(([name]) => name);
}

/** True when a photo upload could actually succeed. */
export function isCloudinaryConfigured() {
  return missingCloudinaryVars().length === 0;
}

/**
 * The configured SDK, or null when the keys are not set.
 *
 * Callers treat null as "photo upload is switched off" and answer with a clean
 * 503 rather than letting an SDK error surface as an opaque 500 in front of the
 * member — the same reasoning as the missing JWT_SECRET check in index.js.
 *
 * `cloudinary.config()` MERGES into the singleton and returns the plain config
 * object, which has no `uploader` or `api` on it. The client with those methods
 * is the `cloudinary` export itself, so that is what has to be returned — handing
 * the config object back would make every `client.uploader.*` call fail with a
 * TypeError that surfaces to the member as a 502.
 */
export function cloudinaryClient() {
  if (!isCloudinaryConfigured()) return null;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

/**
 * Where member photos are filed, and how they are shaped on the way in.
 *
 * - Square, because the card's picture slot is a circle (photoGeometry.js) and
 *   the client already cropped the member's choice to a square — re-filling to
 *   the same shape just normalises it and guarantees the stored image is never
 *   the wrong aspect for any future slot size.
 * - `gravity: 'auto'` picks the interesting part of the frame, so a photo that
 *   slipped past the cropper still stores something sensible.
 * - 1200px is comfortably above the largest the card ever prints it at (the
 *   photo ring is about 1/5 of a 2214px-wide card), so the export rasterises
 *   from this without upscaling artefacts.
 * - `f_auto` negotiates webp/avif against whatever the browser accepts and
 *   falls back to the original format otherwise, which costs nothing and is
 *   what the card's <img> tags want.
 * - `q_auto:good` picks Cloudinary's perceptual quality target, so members on
 *   slow connections do not download a 4MB phone camera original.
 */
export const PHOTO_FOLDER = 'aust-pic/photos';
export const PHOTO_TRANSFORMATION = {
  width: 1200,
  height: 1200,
  crop: 'fill',
  gravity: 'auto',
  quality: 'auto:good',
  fetch_format: 'auto',
};

/**
 * 'authenticated' rather than the default 'upload'.
 *
 * This is the difference between a photo that is private and one that is merely
 * unlisted. A plain `image/upload` asset is served to anyone who asks for the
 * URL with no credentials at all, and the public id here IS the member's
 * MongoDB _id (photoController.publicIdFor), so the URL is enumerable by anyone
 * who ever obtains a user id. An 'authenticated' asset is refused outright
 * unless the request carries a signature we generated — no signature, no bytes.
 *
 * Confirmed against the live account: an unsigned request to the same asset
 * returns HTTP 400, while a signed one returns 200 with `access-control-allow-origin: *`
 * (so the card export's fetch in utils/domRaster.js still works).
 */
export const PHOTO_TYPE = 'authenticated';

/**
 * A time-limited delivery URL for one member's photo, or null when Cloudinary
 * is not configured.
 *
 * `version` must be the version recorded at upload: it is what pins the URL to
 * the exact bytes that were stored, so a replaced photo is not served from a
 * stale cache entry. Together with publicId it is all the identity the asset
 * needs — which is why the user document stores those two and rebuilds the URL
 * on the way out (models/user.js) rather than persisting a URL that would expire
 * or drift from the transformation.
 *
 * Two layers, and the second is conditional:
 *
 * 1. `sign_url` puts an HMAC of the path keyed on the API secret in the URL.
 *    Unguessable without the secret, and needs no extra Cloudinary setup.
 * 2. When CLOUDINARY_AUTH_TOKEN_KEY is set, an expiring __cld_token__ is added
 *    on top, so even a URL that leaked stops working once it lapses. That key
 *    has to be created in the Cloudinary dashboard (Settings -> Security ->
 *    Authenticated delivery), so it is opt-in and the URL falls back to layer 1
 *    alone when it is absent.
 */
export function signedPhotoUrl(publicId, version, transformation = PHOTO_TRANSFORMATION) {
  const client = cloudinaryClient();
  if (!client || !publicId) return null;

  const authToken = process.env.CLOUDINARY_AUTH_TOKEN_KEY
    ? { key: process.env.CLOUDINARY_AUTH_TOKEN_KEY, duration: 900 }
    : false;

  return client.url(publicId, {
    type: PHOTO_TYPE,
    resource_type: 'image',
    version,
    sign_url: true,
    secure: true,
    transformation,
    auth_token: authToken,
  });
}
