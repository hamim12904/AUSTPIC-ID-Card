/**
 * Member photo: the one card field whose payload is a file rather than text.
 *
 * The bytes go to Cloudinary and the user document keeps a pointer to them
 * (models/user.js), so the card's photo and its other inputs live side by side in
 * the same MongoDB without either one bloating the other. The route is scoped to
 * the signed-in user rather than to a submission: the photo belongs to the member
 * and the member is this user document, and /api/submissions is still a
 * placeholder (index.js:65).
 */
import { ApiError } from '../middleware/errorHandler.js';
import {
  cloudinaryClient,
  signedPhotoUrl,
  PHOTO_FOLDER,
  PHOTO_TRANSFORMATION,
  PHOTO_TYPE,
} from '../utils/cloudinary.js';

/**
 * The public id this member's photo is stored under: their user id.
 *
 * Deterministic on purpose. It is what makes replacing a photo an overwrite
 * rather than an accumulation — every upload lands on the same asset id, so
 * changing the picture cannot leave the old one behind consuming storage and
 * bandwidth in the account. It also means an upload can be retried safely: a
 * request that failed after Cloudinary accepted the file is fixed by sending it
 * again, with no second orphaned asset.
 */
function publicIdFor(user) {
  return String(user._id);
}

/** Uploads a buffer to Cloudinary and resolves with the asset. */
function sendToCloudinary(client, buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: PHOTO_FOLDER,
        public_id: publicId,
        resource_type: 'image',
        // Private, not merely unlisted — see PHOTO_TYPE in utils/cloudinary.js.
        type: PHOTO_TYPE,
        // Replacing, not accumulating — see publicIdFor.
        overwrite: true,
        // Drops the CDN cache of the previous version, so a replaced photo is
        // the one delivered immediately rather than for up to an hour.
        invalidate: true,
        transformation: PHOTO_TRANSFORMATION,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * The stored photo as the rest of the API and the schema spell it.
 *
 * The URL is built here, per response, from the stored publicId and version
 * rather than read off the document. A stored delivery URL would be a snapshot:
 * it cannot be re-signed, it does not expire, and it silently goes stale the
 * moment PHOTO_TRANSFORMATION changes, which would leave every member's card
 * rendering at the wrong size with nothing in the code to explain it.
 */
function toPhotoPayload(photo) {
  if (!photo?.publicId) return null;
  return {
    url: signedPhotoUrl(photo.publicId, photo.version),
    publicId: photo.publicId,
    width: photo.width,
    height: photo.height,
    bytes: photo.bytes,
    uploadedAt: photo.uploadedAt,
  };
}

/**
 * POST /api/members/photo (multipart `photo`) -> { photo }
 *
 * The client sends the picture it already cropped (components/photo/
 * PhotoCropModal.jsx bakes the member's pan and zoom into the bitmap), so what
 * is stored is exactly what the member saw on the card. Cloudinary then
 * normalises it to the card's square slot and re-encodes it, so the stored asset
 * is never the raw phone-camera original.
 */
export async function uploadPhoto(req, res, next) {
  try {
    const client = cloudinaryClient();
    if (!client) {
      // Not a broken upload — a deployment without the keys. Distinct from the
      // generic 500 so the client can say "not available" rather than "failed".
      throw new ApiError(503, 'photo_upload_unavailable', 'Photo upload is not available right now. Please try again later.');
    }

    if (!req.file) {
      throw ApiError.badRequest('Please choose a photo to upload.');
    }

    const publicId = publicIdFor(req.user);
    let asset;
    try {
      asset = await sendToCloudinary(client, req.file.buffer, publicId);
    } catch (err) {
      // Logged here, not surfaced: a Cloudinary error carries an HTTP status and
      // a stack, and errorHandler only ever tells the client the generic message.
      console.error('[photoController] Cloudinary upload failed:', err?.message || err);
      throw new ApiError(502, 'photo_upload_failed', 'We could not save your photo. Please try again.');
    }

    // The identity of the asset, not a URL. A delivery URL is signed against
    // the API secret and can carry an expiry, so persisting one would freeze a
    // link that is only supposed to be valid for the member holding it. The URL
    // is minted per response instead (toPhotoPayload, and the model's toJSON).
    req.user.photo = {
      publicId: asset.public_id,
      version: asset.version,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      uploadedAt: new Date(),
    };
    await req.user.save();

    res.json({ photo: toPhotoPayload(req.user.photo) });
  } catch (err) {
    next(err);
  }
}

export default { uploadPhoto };
