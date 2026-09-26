import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import FlipController from './FlipController.jsx';
import IDCardFront from './IDCardFront.jsx';
import IDCardBack from './IDCardBack.jsx';
import ProgressDots from './ProgressDots.jsx';

/**
 * Modal shown from "Preview". Only ever mounted once every field on both
 * sides has passed validation (see IDCardShell's handlePreview), so it never
 * needs its own empty-state handling.
 *
 * Renders the card in read-only mode (see FieldOverlay/CardSelect) so what
 * the person sees here — plain baked-in text, no dropdown caret, no inputs —
 * matches the card that actually gets generated. Submitting from here reuses
 * the same onGenerate flow the old single "Generate card" button used.
 */
export default function CardPreviewOverlay({ template, onClose, onSubmit, submitting }) {
  const [side, setSide] = useState('front');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

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
          Preview — this is exactly what gets generated
        </p>

        <div className="id-card-surface pointer-events-none mt-4">
          <FlipController flipped={side === 'back'}>
            <IDCardFront template={template} readOnly />
            <IDCardBack template={template} readOnly />
          </FlipController>
        </div>

        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <ProgressDots current={side} />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
              className="rounded-full border border-ink/15 bg-white/70 px-5 py-2.5 font-body text-sm font-medium text-ink transition hover:border-teal-light hover:bg-white"
            >
              <span aria-hidden="true" className="mr-2 inline-block text-base">↻</span>
              Flip to {side === 'front' ? 'back' : 'front'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 font-body text-sm font-medium text-ink/60 underline"
            >
              Back to edit
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              data-generate-trigger
              className="btn-green rounded-full px-6 py-2.5 font-body text-sm font-medium disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
