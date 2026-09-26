import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { useCardStore } from '../../store/useCardStore.js';
import { isSideValid, validateSide } from '../../utils/validation.js';
import FlipController from './FlipController.jsx';
import IDCardFront from './IDCardFront.jsx';
import IDCardBack from './IDCardBack.jsx';
import ProgressDots from './ProgressDots.jsx';
import CardPreviewOverlay from './CardPreviewOverlay.jsx';

// "3D feel" on the card: on mouse, the tilt follows the cursor continuously
// while hovering (a classic tilt-card effect); on touch, tapping tilts it
// toward the touch point. Lives on its own inner wrapper so it never fights
// the outer scroll-linked scale/opacity or the CSS-driven flip transform —
// each of the three transforms sits on a different element.
function useCardTilt() {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const pressScale = useMotionValue(1);
  // Softer spring + a smaller max angle than before, so the movement reads
  // as a gentle tilt rather than a jolt.
  const rotateSpring = { stiffness: 300, damping: 30, mass: 0.5 };
  const springRotateX = useSpring(rotateX, rotateSpring);
  const springRotateY = useSpring(rotateY, rotateSpring);
  const springScale = useSpring(pressScale, { stiffness: 350, damping: 34 });

  const MAX_TILT_DEG = 1.5; // was 6 — even more subtle

  const applyTiltFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * MAX_TILT_DEG * 2);
    rotateX.set(py * -MAX_TILT_DEG * 2);
  };

  // Mouse: tilt tracks the pointer continuously while it hovers the card.
  const onPointerMove = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    applyTiltFromEvent(event);
  };

  // A click no longer snaps the tilt to a new angle or resets it — it just
  // dips the scale slightly, so pressing feels responsive without adding
  // extra movement on top of whatever tilt the hover already set.
  const onPointerDown = (event) => {
    if (!event.pointerType || event.pointerType === 'mouse') {
      pressScale.set(0.999);
      return;
    }
    // Touch has no hover, so the tap itself sets the tilt.
    applyTiltFromEvent(event);
    pressScale.set(0.999);
  };

  const onPointerUp = (event) => {
    pressScale.set(1);
    if (event.pointerType && event.pointerType !== 'mouse') {
      rotateX.set(0);
      rotateY.set(0);
    }
  };

  const resetAll = () => {
    rotateX.set(0);
    rotateY.set(0);
    pressScale.set(1);
  };

  return {
    style: { rotateX: springRotateX, rotateY: springRotateY, scale: springScale },
    handlers: {
      onPointerMove,
      onPointerDown,
      onPointerUp,
      onPointerLeave: resetAll,
      onPointerCancel: resetAll,
    },
  };
}

export default function IDCardShell({ template, onGenerate, scale, opacity }) {
  const surfaceRef = useRef(null);
  const currentSide = useCardStore((s) => s.currentSide);
  const status = useCardStore((s) => s.status);
  const fields = useCardStore((s) => s.fields);
  const flipSide = useCardStore((s) => s.flipSide);
  const setSide = useCardStore((s) => s.setSide);
  const [triedNext, setTriedNext] = useState({ front: false, back: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const tilt = useCardTilt();

  const frontErrors = validateSide(template.frontFields, fields);
  const backErrors = validateSide(template.backFields, fields);
  const frontValid = isSideValid(template.frontFields, fields);
  const backValid = isSideValid(template.backFields, fields);
  const activeErrors = currentSide === 'front' ? frontErrors : backErrors;
  const shouldShowErrors = triedNext[currentSide];
  // Gate for Preview: every field on both sides has to validate before the
  // person can see the (read-only) card, matching the "fill everything
  // first" requirement.
  const allValid = frontValid && backValid;

  useEffect(() => {
    if (status === 'idle') {
      setTriedNext({ front: false, back: false });
    }
  }, [status]);

  const handlePreviewClick = () => {
    const nextTried = {
      front: !frontValid,
      back: !backValid,
    };

    if (nextTried.front || nextTried.back) {
      setTriedNext(nextTried);
      setSide(nextTried.front ? 'front' : 'back');
      return;
    }

    setPreviewOpen(true);
  };

  const handleSubmit = () => {
    setPreviewOpen(false);
    onGenerate();
  };

  return (
    <div className="flex w-full flex-col items-center">
      <motion.div
        ref={surfaceRef}
        style={{ scale, opacity }}
        className="id-card-surface card-interaction-surface relative"
        tabIndex={0}
        role="group"
        aria-label="Interactive AUST PIC ID card"
        onKeyDown={(event) => {
          if (event.key.toLowerCase() === 'f' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA' && event.target.tagName !== 'SELECT') {
            flipSide();
          }
        }}
      >
        {/* Separate element from the flip wrapper below: rotateX/rotateY here
            is the tap tilt, rotateY(180deg) inside FlipController is the
            flip. Nesting keeps the two from stomping on each other. */}
        <motion.div className="card-tilt" style={tilt.style} {...tilt.handlers}>
          <FlipController flipped={currentSide === 'back'}>
            <IDCardFront template={template} showErrors={triedNext.front} />
            <IDCardBack template={template} showErrors={triedNext.back} />
          </FlipController>
        </motion.div>
      </motion.div>

      <div className="mt-7 flex w-full max-w-[520px] flex-col items-center gap-4">
        <ProgressDots current={currentSide} />
        <p className="text-center font-body text-xs text-ink/50">
          {currentSide === 'front' ? 'Fill the front fields directly on the card.' : 'Fill the back fields directly on the card.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={flipSide}
            className="rounded-full border border-ink/15 bg-white/70 px-5 py-2.5 font-body text-sm font-medium text-ink transition hover:border-teal-light hover:bg-white"
          >
            <span aria-hidden="true" className="mr-2 inline-block text-base">↻</span>
            Flip to {currentSide === 'front' ? 'back' : 'front'}
          </button>
          <button
            type="button"
            onClick={handlePreviewClick}
            className={`rounded-full px-6 py-2.5 font-body text-sm font-medium transition ${
              allValid
                ? 'btn-green'
                : 'border border-ink/15 bg-white/70 text-ink/50 hover:border-teal-light hover:bg-white'
            }`}
          >
            {allValid ? 'Preview' : 'Preview (fill all fields)'}
          </button>
        </div>
        {shouldShowErrors && Object.keys(activeErrors).length > 0 && (
          <div className="w-full rounded-2xl border border-red-200 bg-white/80 px-4 py-3 text-left" role="alert">
            <p className="font-body text-xs font-semibold text-red-500">Complete the highlighted fields first.</p>
            <ul className="mt-1 space-y-0.5 font-body text-[11px] text-red-500/90">
              {Object.entries(activeErrors).map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewOpen && (
          <CardPreviewOverlay
            template={template}
            onClose={() => setPreviewOpen(false)}
            onSubmit={handleSubmit}
            submitting={status === 'submitting'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
