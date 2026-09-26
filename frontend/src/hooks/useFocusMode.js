import { useCallback, useEffect, useState } from 'react';

/**
 * Handles the "resting -> focused" transition: tapping the resting card
 * scales it up, raises it above the page, and locks page scroll so the
 * front/back fill flow has its own internal navigation (roadmap §2.1).
 */
export function useFocusMode() {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    document.body.style.overflow = focused ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [focused]);

  const enterFocus = useCallback(() => setFocused(true), []);
  const exitFocus = useCallback(() => setFocused(false), []);

  // Escape key exits focus mode as a keyboard-accessible alternative to the "×"
  useEffect(() => {
    if (!focused) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') exitFocus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused, exitFocus]);

  return { focused, enterFocus, exitFocus };
}
