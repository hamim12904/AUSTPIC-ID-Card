import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useCardStore } from '../../store/useCardStore.js';
import { downloadCardPdf, downloadCardPng } from '../../utils/cardExport.js';
import FlipController from './FlipController.jsx';
import IDCardFront from './IDCardFront.jsx';
import IDCardBack from './IDCardBack.jsx';
import ProgressDots from './ProgressDots.jsx';
import CardActionButton from '../ui/CardActionButton.jsx';
import { DownloadIcon } from '../ui/CardIcons.jsx';

/**
 * Modal shown from the preview action. Only ever mounted once every field on
 * both sides has passed validation (see IDCardShell's revealMissingFields), so
 * it never needs its own empty-state handling.
 *
 * Renders the card in read-only mode (see FieldOverlay) so what the person
 * sees here — plain baked-in text, no dropdown caret, no inputs — is card
 * content rather than UI.
 *
 * The two face elements are held by ref because the download rasterises these
 * exact nodes (utils/domRaster.js) instead of rebuilding the card on a canvas.
 * That is what makes a file match this modal: the export is this rendering at
 * full resolution, so there is no second implementation of the layout to fall
 * out of step with the first.
 */
export default function CardPreviewOverlay({ template, onClose, onSubmit, submitting }) {
  const [side, setSide] = useState('front');
  // 'png' | 'pdf' | null — which export is being built, so its own button can
  // show progress while the other stays visibly idle.
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);

  const fields = useCardStore((s) => s.fields);
  const photo = useCardStore((s) => s.photo);

  // The nodes the download paints. Both faces are mounted (the flip is a 3D
  // transform, not a conditional), so both are available whichever side is
  // showing and the PDF can rasterise each in turn.
  const frontNodeRef = useRef(null);
  const backNodeRef = useRef(null);

  // The cropped local render is preferred over the server's copy: it is already
  // square, which is what the picture slot expects.
  const photoUrl = photo.processedUrl || photo.previewUrl;

  const flip = () => setSide((current) => (current === 'front' ? 'back' : 'front'));

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const runExport = async (kind) => {
    setExporting(kind);
    setExportError(null);
    try {
      if (kind === 'png') {
        await downloadCardPng({
          node: side === 'front' ? frontNodeRef.current : backNodeRef.current,
          template,
          side,
          fields,
          photoUrl,
        });
      } else {
        await downloadCardPdf({
          frontNode: frontNodeRef.current,
          backNode: backNodeRef.current,
          template,
          fields,
          photoUrl,
        });
      }
    } catch (err) {
      console.error(`[CardPreviewOverlay] ${kind} export failed:`, err);
      setExportError(err?.message || 'Could not build the download. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (typeof document === 'undefined') return null;

  const nextSide = side === 'front' ? 'back' : 'front';

  return createPortal(
    <motion.div
      className="card-preview-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="card-preview-panel"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Preview your AUST PIC ID card"
      >
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/45">
          ID Card Preview
        </p>

        {/* Double-click turns the card over here too, matching the editor. Safe
            because read-only mode has nothing to select or drag: the fields
            are plain text and the photo slot is a div, not a file input. */}
        <div
          className="id-card-surface card-preview-card mt-4"
          onDoubleClick={flip}
          role="button"
          tabIndex={0}
          aria-label={`Card ${side}. Activate, or double-click, to see the ${nextSide}.`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              flip();
            }
          }}
        >
          <FlipController flipped={side === 'back'}>
            <IDCardFront template={template} readOnly ref={frontNodeRef} />
            <IDCardBack template={template} readOnly ref={backNodeRef} />
          </FlipController>
        </div>

        <div className="mt-4 flex w-full flex-col items-center gap-4">
          {/* The side switch. The card turns over on double-click, but that is
              a hidden gesture, so the switch is also a control — which is why
              there is no separate Flip button competing with the downloads. */}
          <ProgressDots current={side} onSelect={setSide} />

          {/* Downloads: the reason to be in this modal, so they get their own
              row of two equal halves, both edges matching the row below. */}
          <div className="card-preview-downloads">
            <button
              type="button"
              className="card-download-btn"
              onClick={() => runExport('png')}
              disabled={Boolean(exporting) || submitting}
            >
              <DownloadIcon />
              {exporting === 'png' ? 'Preparing PNG…' : `PNG · ${side}`}
            </button>
            <button
              type="button"
              className="card-download-btn"
              onClick={() => runExport('pdf')}
              disabled={Boolean(exporting) || submitting}
            >
              <DownloadIcon />
              {exporting === 'pdf' ? 'Preparing PDF…' : 'PDF · both sides'}
            </button>
          </div>

          {exportError && (
            <p
              className="w-full rounded-2xl border border-red-200 bg-white/80 px-4 py-2.5 text-left font-body text-xs text-red-500"
              role="alert"
            >
              {exportError}
            </p>
          )}

          {/* The decision, and only the decision: one button each way, pushed to
              opposite ends so the row reads as a choice rather than a set of
              peers. Submit's right edge lines up with the PDF button's. */}
          <div className="card-preview-actions">
            <CardActionButton shape="quiet" onClick={onClose}>
              Back to edit
            </CardActionButton>
            <CardActionButton tone="solid" onClick={onSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </CardActionButton>
          </div>
        </div>

      </motion.div>
    </motion.div>,
    document.body
  );
}
