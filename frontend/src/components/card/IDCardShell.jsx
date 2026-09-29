import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { useCardStore } from '../../store/useCardStore.js';
import { isSideValid, validateSide } from '../../utils/validation.js';
import FlipController from './FlipController.jsx';
import IDCardFront from './IDCardFront.jsx';
import IDCardBack from './IDCardBack.jsx';
import CardActionBar from './CardActionBar.jsx';
import ProgressDots from './ProgressDots.jsx';
import CardPreviewOverlay from './CardPreviewOverlay.jsx';

// A double-click that lands on one of the card's own controls is left to the
// browser: double-clicking a field selects a word, and double-clicking the
// photo slot opens the picker. Everywhere else on the card, a double-click
// turns it over.
const CARD_CONTROL_SELECTOR = '[data-card-input], button, textarea';

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

  const MAX_TILT_DEG = 1.75; // was 6 — even more subtle

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
  // Gate for preview and submit: every field on both sides has to validate
  // before the card can be previewed or handed in, matching the "fill
  // everything first" requirement.
  const allValid = frontValid && backValid;

  // The member id is the one field the member can't type, so a failed
  // allocation would otherwise block Generate with nothing on screen saying
  // why. Surface it, with a retry, the moment the request fails.
  const memberIdStatus = useCardStore((s) => s.memberIdStatus);
  const retryMemberId = useCardStore((s) => s.retryMemberId);
  const memberIdFailed = memberIdStatus === 'error';

  useEffect(() => {
    if (status === 'idle') {
      setTriedNext({ front: false, back: false });
    }
  }, [status]);

  /**
   * Shared by preview and submit: when the card is not finished, turn to the
   * side that is missing something and list what it is, rather than opening
   * anything. Returns true when there was a problem to show.
   */
  const revealMissingFields = () => {
    const nextTried = {
      front: !frontValid,
      back: !backValid,
    };

    if (!nextTried.front && !nextTried.back) return false;

    setTriedNext(nextTried);
    setSide(nextTried.front ? 'front' : 'back');
    return true;
  };

  const handlePreviewClick = () => {
    if (revealMissingFields()) return;
    setPreviewOpen(true);
  };

  const handleSubmitClick = () => {
    if (revealMissingFields()) return;
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
        onDoubleClick={(event) => {
          if (event.target.closest?.(CARD_CONTROL_SELECTOR)) return;
          flipSide();
        }}
        onKeyDown={(event) => {
          if (event.key.toLowerCase() === 'f' && !event.target.closest?.(CARD_CONTROL_SELECTOR)) {
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
          {currentSide === 'front'
            ? 'Fill the front fields directly on the card.'
            : 'Fill the back fields directly on the card. Your member ID is assigned automatically.'}
        </p>
        <p className="-mt-2 text-center font-body text-[11px] text-ink/35">
          Double-click the card to turn it over.
        </p>
        <CardActionBar
          currentSide={currentSide}
          ready={allValid}
          submitting={status === 'submitting'}
          onFlip={flipSide}
          onPreview={handlePreviewClick}
          onSubmit={handleSubmitClick}
        />
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
        {memberIdFailed && (
          <div className="w-full rounded-2xl border border-red-200 bg-white/80 px-4 py-3 text-left" role="alert">
            <p className="font-body text-xs font-semibold text-red-500">
              Couldn't assign your member ID.
            </p>
            <p className="mt-1 font-body text-[11px] text-red-500/90">
              It's generated for you, so it can't be typed in. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={retryMemberId}
              className="mt-2 rounded-full border border-red-200 px-3 py-1 font-body text-[11px] text-red-500 transition-colors hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewOpen && (
          <CardPreviewOverlay
            template={template}
            onClose={() => setPreviewOpen(false)}
            onSubmit={handleSubmitClick}
            submitting={status === 'submitting'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
