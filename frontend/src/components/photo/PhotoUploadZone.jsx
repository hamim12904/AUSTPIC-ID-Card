import { useEffect, useRef, useState } from 'react';
import { useCardStore } from '../../store/useCardStore.js';
import { getPhotoGeometry, photoCornerRadius as radius } from '../../config/photoGeometry.js';
import PhotoCropModal from './PhotoCropModal.jsx';

export default function PhotoUploadZone({ photo, photoField, readOnly = false }) {
  const inputRef = useRef(null);
  const [rawFile, setRawFile] = useState(null);
  const [rawUrl, setRawUrl] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const previewUrl = useCardStore((s) => s.photo.previewUrl);
  const processedUrl = useCardStore((s) => s.photo.processedUrl);
  // The upload is a network round trip, so the slot has to say so: without it
  // "Use photo" looks instantaneous and the member cannot tell a still-uploading
  // picture from a stored one, or re-pick a photo that already failed.
  const status = useCardStore((s) => s.photo.status);
  const uploadError = useCardStore((s) => s.photo.error);

  const { image, overlay, overlayImage, placeholderImage } = getPhotoGeometry({ photo, photoField });

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
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    height: `${overlay.height}%`,
    zIndex: 2,
  };

  // Underneath the slot, not over it: an error about the picture must never
  // cover the picture. Positioned off the slot's own rect so it tracks the
  // template geometry wherever the photo sits.
  const errorStyle = {
    position: 'absolute',
    left: `${image.x}%`,
    top: `${image.y + image.height + 1}%`,
    width: `${image.width}%`,
    zIndex: 3,
    margin: 0,
    textAlign: 'center',
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

  // Read-only is the preview's mode: the picture is shown exactly as it will
  // print, but there is no button, no hidden file input and no crop modal. The
  // preview card is clickable (a double-click turns it over), so leaving a
  // live <button> here would mean clicking the photo opened a file picker.
  if (readOnly) {
    return (
      <>
        <div style={style} className="photo-upload-zone" aria-hidden="true">
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className="photo-preview-image"
              style={{ borderRadius: radius(image.shape), zIndex: 1 }}
              draggable={false}
            />
          )}
        </div>
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
      </>
    );
  }

  const uploading = status === 'uploading';

  return (
    <>
      <button
        type="button"
        data-card-input="true"
        aria-label={uploading ? 'Uploading photo' : hasPhoto ? 'Change photo' : 'Upload photo'}
        aria-busy={uploading}
        onClick={() => inputRef.current?.click()}
        style={style}
        className="photo-upload-zone group flex items-center justify-center"
        disabled={uploading}
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
          {uploading ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Add photo'}
        </span>
      </button>
      {/* The failure has to survive the crop modal closing over it, and the
          label above only shows on hover. Pinned under the slot instead, where
          the member reads the photo. */}
      {uploadError && (
        <p className="photo-upload-error" style={errorStyle} role="alert">
          {uploadError}
        </p>
      )}
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
