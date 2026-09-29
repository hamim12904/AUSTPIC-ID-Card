import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardStore } from '../../store/useCardStore.js';
import { uploadMyPhoto } from '../../api/memberApi.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the selected image.'));
    img.src = src;
  });
}

/**
 * Bakes the crop the user actually made — pan AND zoom — into a bitmap, so the
 * card preview matches what gets stored. croppedAreaPixels is already expressed
 * in natural image pixels and accounts for zoom, so it can be used directly as
 * the source rectangle.
 *
 * Returns the canvas rather than a finished image because it is read twice: once
 * as the instant local preview and once as the file to upload, and re-running
 * the crop for the second would be a second draw of the same pixels.
 */
async function renderCrop(src, area, size) {
  const img = await loadImage(src);

  // Clamp to the image. react-easy-crop can report a rect that runs past the
  // edges, and an out-of-bounds drawImage source renders as a black band.
  const sx = Math.max(0, Math.min(area.x, img.naturalWidth));
  const sy = Math.max(0, Math.min(area.y, img.naturalHeight));
  const sw = Math.max(1, Math.min(area.width, img.naturalWidth - sx));
  const sh = Math.max(1, Math.min(area.height, img.naturalHeight - sy));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  // JPEG has no alpha channel, so any transparency in the source would encode
  // as solid black. Lay down the card's white first.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return canvas;
}

/** The canvas as an uploadable file. A Blob, not a data URL: base64 adds a third
 *  to the bytes on the wire, and this is the same picture the slot already has. */
function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not read the cropped image.'))),
      'image/jpeg',
      0.92
    );
  });
}

/**
 * The square the crop is rendered at, in pixels.
 *
 * Matches PHOTO_TRANSFORMATION in backend/utils/cloudinary.js. The card's
 * picture slot is a circle about a fifth of a 2214px-wide card, so 1200 is
 * comfortably above what the export ever asks of it — and matching the stored
 * size exactly means the pixels the member chose are the pixels that get kept,
 * with no resampling in between.
 */
const CROP_SIZE = 1200;

export default function PhotoCropModal({ file, imageUrl, shape, onClose }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const setPhoto = useCardStore((s) => s.setPhoto);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);

    // Never leave the slot empty: if the local render fails for any reason,
    // fall back to the raw file so the user still sees their own picture.
    let previewUrl = imageUrl;
    let canvas = null;
    try {
      canvas = await renderCrop(imageUrl, croppedAreaPixels, CROP_SIZE);
      previewUrl = canvas.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      console.warn('[PhotoCropModal] local crop render failed, using uncropped file:', err);
    }

    setPhoto({ file, cropRect: croppedAreaPixels, previewUrl, processedUrl: null, status: 'uploading', error: null });

    // Store the picture the member actually chose. Sending the cropped bitmap
    // rather than the raw file is what makes the stored image and the card
    // identical; Cloudinary then re-encodes it into the card's square slot
    // (backend/utils/cloudinary.js) and the user document keeps only the URL.
    //
    // A failure is not fatal to the card: the local crop stays in the slot, the
    // member can still download their card, and picking a new photo retries.
    if (canvas) {
      try {
        const blob = await toBlob(canvas);
        const photo = await uploadMyPhoto(blob);
        setPhoto({ processedUrl: photo.url, status: 'ready', error: null });
      } catch (err) {
        console.warn('[PhotoCropModal] photo upload failed, keeping local preview only:', err);
        setPhoto({ status: 'error', error: err?.message || 'Your photo could not be uploaded.' });
      }
    } else {
      setPhoto({ status: 'error', error: 'That image could not be read. Try choosing it again.' });
    }

    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] bg-ink/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="relative w-full max-w-sm h-[60vh] bg-black rounded-xl overflow-hidden">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={shape === 'circle' ? 'round' : 'rect'}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full max-w-sm mt-4 accent-teal-light"
          aria-label="Zoom"
        />

        <div className="flex gap-3 mt-4 w-full max-w-sm">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full font-body text-sm text-white/80 border border-white/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="btn-green flex-1 py-2.5 rounded-full font-body text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
