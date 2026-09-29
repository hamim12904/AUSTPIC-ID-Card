import { motion } from 'framer-motion';

// Just the two sides that actually exist on currentSide ('front' | 'back').
// The active side renders as a short line, the other as a small dot, and
// framer-motion's layout animation morphs one into the other smoothly
// whichever way the side flips.
const STEPS = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
];

/**
 * The two sides of the card.
 *
 * Without `onSelect` this is purely a position indicator, which is what the
 * editor wants: the card itself is right there to be flipped, and a row of
 * 8px dots would be a miserable click target.
 *
 * With `onSelect` it becomes the visible side switch — a small segmented
 * control instead of two 8px dots. The preview modal uses that: it has no Flip
 * button in its footer, because a standalone Flip pill there looked like a
 * third download button.
 */
export default function ProgressDots({ current, onSelect }) {
  if (onSelect) {
    return (
      <div className="card-preview-steps" role="group" aria-label="Choose a side of the card">
        {STEPS.map((step) => {
          const active = step.key === current;
          return (
            <button
              key={step.key}
              type="button"
              className={`card-preview-step${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onSelect(step.key)}
            >
              {step.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5" role="status" aria-label={`Now showing the ${current} of the card`}>
      {STEPS.map((step) => {
        const active = step.key === current;
        return (
          <motion.span
            key={step.key}
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className={`block h-2 rounded-full ${active ? 'bg-teal-light' : 'bg-ink/15'}`}
            style={{ width: active ? '1.75rem' : '0.5rem' }}
            aria-hidden="true"
          />
        );
      })}
      <span className="sr-only">{current === 'front' ? 'Showing front' : 'Showing back'}</span>
    </div>
  );
}
