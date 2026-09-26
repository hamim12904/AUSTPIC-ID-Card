import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardStore } from '../../store/useCardStore.js';
import { uploadPhoto } from '../../api/submissionApi.js';

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
 * card preview matches what the backend builds from cropRect. croppedAreaPixels
 * is already expressed in natural image pixels and accounts for zoom, so it can
 * be used directly as the source rectangle.
 */
async function cropToDataUrl(src, area, size) {
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
  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function PhotoCropModal({ file, imageUrl, shape, onClose }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const submissionId = useCardStore((s) => s.submissionId);
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
    try {
      previewUrl = await cropToDataUrl(imageUrl, croppedAreaPixels, 900);
    } catch (err) {
      console.warn('[PhotoCropModal] local crop render failed, using uncropped file:', err);
    }

    setPhoto({ file, cropRect: croppedAreaPixels, previewUrl, processedUrl: null });

    // If there's no submission yet (frontend-only dev, backend not reachable),
    // just keep the local preview and skip the network call.
    if (submissionId) {
      try {
        const { processedPhotoUrl } = await uploadPhoto(submissionId, file, croppedAreaPixels);
        setPhoto({ processedUrl: processedPhotoUrl });
      } catch (err) {
        console.warn('[PhotoCropModal] upload failed, keeping local preview only:', err);
      }
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
