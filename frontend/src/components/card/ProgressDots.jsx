import { motion } from 'framer-motion';

// Just the two sides that actually exist on currentSide ('front' | 'back').
// The active side renders as a short line, the other as a small dot, and
// framer-motion's layout animation morphs one into the other smoothly
// whichever way the side flips.
const STEPS = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
];

export default function ProgressDots({ current }) {
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
