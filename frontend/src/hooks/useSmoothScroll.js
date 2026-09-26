import { useCallback, useEffect, useRef } from 'react';

const DURATION = 1500;

// Symmetric ease: slow start, fast middle, slow settle. Linear or
// ease-out alone makes the card arrive abruptly, which is the "too fast"
// feeling this replaces.
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Replaces `scrollIntoView({ behavior: 'smooth' })`, which gives no control
// over duration. The card's reveal is scroll-linked (framer's useScroll in
// useScrollReveal), so a quick native glide makes the card pop in almost
// instantly; animating the scroll over a fixed duration lets the reveal play
// out on the way down.
export function useSmoothScroll() {
  const frameRef = useRef(0);

  const scrollTo = useCallback((target) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;

    // Honour the OS setting rather than forcing a long animated ride.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollIntoView();
      return;
    }

    const startY = window.scrollY;
    // Resolve the offset up front: the target moves as we scroll (the Hero
    // fades and the card grows), so re-measuring each frame would drift.
    const endY = startY + el.getBoundingClientRect().top;
    const distance = endY - startY;
    const startedAt = performance.now();

    cancelAnimationFrame(frameRef.current);

    const step = (now) => {
      const progress = Math.min((now - startedAt) / DURATION, 1);
      // 'instant' overrides html { scroll-behavior: smooth } for this call,
      // otherwise the browser smooths on top of our easing and it stutters.
      window.scrollTo({ top: startY + distance * easeInOutCubic(progress), behavior: 'instant' });

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);
  }, []);

  // Don't keep scrolling a page the user has navigated away from.
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return scrollTo;
}
