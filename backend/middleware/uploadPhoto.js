/**
 * Multipart handling for the member photo.
 *
 * Memory storage, not disk: the file goes straight from the request into the
 * Cloudinary upload and is never written anywhere, so there is no temp directory
 * to clean up, no path to sanitise and no orphan file on disk if the upload
 * fails halfway. A card photo is a few hundred kilobytes once cropped, which is
 * a small enough ceiling to hold in memory (5 MB of MAX_BYTES is the cap).
 */
import multer from 'multer';
import { ApiError } from './errorHandler.js';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Checked against the browser-reported MIME type, not the extension.
 *
 * The extension is what a rename would change and the MIME type is what the
 * browser reports from the file's own content — neither is a real content check
 * (that would mean sniffing bytes), but the type is the part a casual rename
 * does not forge. Cloudinary re-encodes on the way in regardless: it decodes
 * what it received and writes a fresh asset, so a mislabelled file that slipped
 * through is stored as whatever it actually is, not as anything the uploader
 * claimed.
 */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
  fileFilter: (_req, file, done) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return done(ApiError.badRequest('Upload a JPEG, PNG or WebP image.'));
    }
    return done(null, true);
  },
});

/**
 * The `photo` field of a multipart request, as middleware.
 *
 * multer reports its own failures (an oversized file, a missing field) as a
 * MulterError, which errorHandler would otherwise pass through as a generic 500.
 * Translated here so the member gets the same { error: { code, message } }
 * envelope the rest of the API speaks — the axios interceptor in
 * src/api/client.js:24 puts that message straight on screen.
 */
export const photoUpload = (req, res, next) =>
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, 'photo_too_large', 'That photo is larger than 5 MB. Pick a smaller one.'));
      }
      return next(ApiError.badRequest('That photo could not be read. Try choosing it again.'));
    }

    return next(err);
  });

export default photoUpload;
