import { useEffect, useRef, useState } from 'react';
import { useCardStore } from '../../store/useCardStore.js';
import { PHOTO_FIELD } from '../../config/template.js';
import PhotoCropModal from './PhotoCropModal.jsx';

// Accepts the nested { x, y, width, height } rects from config/template.js as
// well as the old flat { x, y, w, h } the backend template still returns, so
// the photo slot keeps working whichever config is live.
function readRect(source) {
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

const radius = (shape) => (shape === 'circle' ? '50%' : '0.5rem');

export default function PhotoUploadZone({ photo, photoField }) {
  const inputRef = useRef(null);
  const [rawFile, setRawFile] = useState(null);
  const [rawUrl, setRawUrl] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const previewUrl = useCardStore((s) => s.photo.previewUrl);
  const processedUrl = useCardStore((s) => s.photo.processedUrl);

  const image = readRect(photo?.image) || readRect(photoField) || PHOTO_FIELD.image;
  const overlayRect = readRect(photo?.overlay) || readRect(PHOTO_FIELD.overlay);
  const overlayImage = photo?.overlayImage ?? PHOTO_FIELD.overlayImage;
  const placeholderImage = photo?.placeholderImage ?? PHOTO_FIELD.placeholderImage;

  // hasPhoto tracks a real user upload; photoUrl is what actually gets shown,
  // falling back to the blank so the slot is never empty.
  const hasPhoto = Boolean(processedUrl || previewUrl);
  const photoUrl = (processedUrl || previewUrl) || placeholderImage;

  // The picture slot. Deliberately z-index auto so it does NOT open a stacking
  // context: that lets the photo, the overlay and the label each pick their own
  // layer below and still stack in the right order. The circular crop lives on
  // the photo image, not here, so nothing clips the overlay.
  const style = {
    position: 'absolute',
    left: `${image.x}%`,
    top: `${image.y}%`,
    width: `${image.width}%`,
    height: `${image.height}%`,
    borderRadius: radius(image.shape),
  };

  // The overlay is a SIBLING of the picture slot, not a child. Its geometry is
  // read straight from config and never references image, so editing the
  // picture rect cannot move, resize or rescale the overlay. It sits above the
  // photo (z-index 2) and below the hover label (z-index 3).
  const overlayStyle = {
    position: 'absolute',
    left: `${overlayRect.x}%`,
    top: `${overlayRect.y}%`,
    width: `${overlayRect.width}%`,
    height: `${overlayRect.height}%`,
    zIndex: 2,
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setRawUrl(URL.createObjectURL(file));
    setCropModalOpen(true);
    event.target.value = '';
  };

  // Revoke when the url changes or the slot closes. Deliberately NOT keyed on
  // mount: StrictMode double-invokes effects on mount, so a mount-time cleanup
  // would revoke the url while the cropper is still using it and the preview
  // would come up blank.
  useEffect(() => () => {
    if (rawUrl) URL.revokeObjectURL(rawUrl);
  }, [rawUrl]);

  return (
    <>
      <button
        type="button"
        data-card-input="true"
        aria-label={hasPhoto ? 'Change photo' : 'Upload photo'}
        onClick={() => inputRef.current?.click()}
        style={style}
        className="photo-upload-zone group flex items-center justify-center"
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="photo-preview-image"
            style={{ borderRadius: radius(image.shape), zIndex: 1 }}
            draggable={false}
          />
        )}
        <span className="photo-upload-label">
          {hasPhoto ? 'Change photo' : 'Add photo'}
        </span>
      </button>
      {overlayImage && (
        <img
          src={overlayImage}
          alt=""
          className="photo-overlay-image"
          style={overlayStyle}
          draggable={false}
          aria-hidden="true"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {cropModalOpen && rawFile && rawUrl && (
        <PhotoCropModal
          file={rawFile}
          imageUrl={rawUrl}
          shape={image.shape}
          onClose={() => {
            setCropModalOpen(false);
            setRawUrl(null);
            setRawFile(null);
          }}
        />
      )}
    </>
  );
}
