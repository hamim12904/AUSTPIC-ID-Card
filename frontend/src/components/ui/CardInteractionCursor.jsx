import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Anything the pointer can act on should grow the cursor, not just the inputs
// written onto the card: every button, link and select in the UI, plus the
// card's own fields and photo slot via data-card-input.
const INTERACTIVE_SELECTOR = '[data-card-input], button, a[href], select, [role="button"]';

export default function CardInteractionCursor() {
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, overField: false });
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const update = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') {
        setCursor((current) => ({ ...current, visible: false }));
        return;
      }

      const target = event.target;
      const overField = Boolean(target?.closest?.(INTERACTIVE_SELECTOR));
      setCursor({ x: event.clientX, y: event.clientY, visible: true, overField });
    };

    const onPointerDown = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      setPulseKey((key) => key + 1);
      update(event);
    };

    const hide = () => setCursor((current) => ({ ...current, visible: false }));
    const onPointerOut = (event) => {
      if (!event.relatedTarget) hide();
    };

    window.addEventListener('pointermove', update, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide);

    return () => {
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden="true"
      className={`card-cursor ${cursor.visible ? 'is-visible' : ''} ${cursor.overField ? 'is-field' : ''}`}
      style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0) translate(-50%, -50%)` }}
    >
      <span className="card-cursor-core" />
      {pulseKey > 0 && <span key={pulseKey} className="card-cursor-pulse" />}
    </div>,
    document.body
  );
}
