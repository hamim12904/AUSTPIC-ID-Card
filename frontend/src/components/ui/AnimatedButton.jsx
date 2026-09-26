import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const MotionLink = motion(Link);

// Tracks pointer/touch position over the button and writes it as CSS
// variables (--mx, --my) so the CSS spotlight can follow it.
//
// Deliberately no reset on pointerleave: the last spot the pointer touched is
// kept, so the glow fades out where it was instead of sliding back to the
// centre. --mx/--my fall back to 50% only from the CSS default, which applies
// until the first move.
function useSpotlight() {
  const ref = useRef(null);

  const setPosition = (clientX, clientY) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  return {
    ref,
    onPointerMove: (event) => setPosition(event.clientX, event.clientY),
    onPointerDown: (event) => setPosition(event.clientX, event.clientY),
  };
}

export default function AnimatedButton({
  to,
  onClick,
  type = 'button',
  children,
  className = '',
  disabled = false,
}) {
  const { ref, ...spotlight } = useSpotlight();

  const shared = {
    ref,
    className: `glow-btn ${className} ${disabled ? 'glow-btn--disabled' : ''}`.trim(),
    // The hover growth is CSS padding on the inner pill, not a transform: a
    // transform-scale widens the button without changing its layout box, so
    // the sibling never moves. Padding does change the box, so the flex row
    // re-lays out and the row's justify-content:center keeps the pair centred.
    // Only the press scales here, as a transient transform.
    whileTap: disabled ? undefined : { scaleX: 0.96, scaleY: 0.96 },
    transition: { type: 'spring', stiffness: 400, damping: 22 },
    ...spotlight,
  };

  if (to) {
    return (
      <MotionLink to={to} {...shared}>
        <span className="glow-btn__inner">{children}</span>
      </MotionLink>
    );
  }

  return (
    <motion.button type={type} onClick={onClick} disabled={disabled} {...shared}>
      <span className="glow-btn__inner">{children}</span>
    </motion.button>
  );
}