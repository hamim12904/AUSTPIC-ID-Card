import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Custom dropdown for fields that declare `options`.
 *
 * Replaces a native <select> because the native popup cannot be styled, and
 * because this card renders at ~420px inside a scaling container where a
 * native menu looks out of place. The open list is portalled to <body> and
 * positioned from the trigger's rect, since .card-face clips its own overflow
 * and the fields sit near the bottom edge.
 *
 * The trigger mirrors .field-input's look, so the control is visually
 * indistinguishable from the plain text fields until it is opened.
 */
export default function CardSelect({ field, value, onChange, textStyle, showError, controlRef }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [rect, setRect] = useState(null);

  const options = field.options || [];
  const selectedIndex = options.indexOf(value);
  const isPlaceholder = selectedIndex === -1;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setRect({ left: box.left, top: box.bottom, width: box.width });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      if (listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // The card scrolls and scales under the trigger, so a fixed menu would
    // detach. Close instead of chasing it.
    const onReflow = () => setOpen(false);

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  const openMenu = (startIndex = isPlaceholder ? 0 : selectedIndex) => {
    setActiveIndex(startIndex);
    setOpen(true);
  };

  const commit = (index) => {
    onChange(options[index]);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
      return;
    }
    if (event.key === 'ArrowUp' && !open) {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  };

  const onMenuKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex >= 0) commit(activeIndex);
    }
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const trigger = (
    <div
      ref={wrapRef}
      className={`card-select ${open ? 'is-open' : ''} ${showError ? 'has-error' : ''}`}
      style={textStyle}
    >
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? 'card-select-list' : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `card-select-opt-${activeIndex}` : undefined}
        aria-label={field.label || field.key}
        aria-invalid={Boolean(showError)}
        data-card-input="true"
        className="card-select-trigger"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={isPlaceholder ? 'card-select-value is-placeholder' : 'card-select-value'}>
          {isPlaceholder ? field.placeholder || field.label || 'Select' : value}
        </span>
        <svg
          className="card-select-caret"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="10" cy="10" r="9" className="card-select-caret-ring" />
          <path
            d="M6.5 8.25 10 11.75l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );

  const menu =
    open && rect
      ? createPortal(
          <div
            ref={listRef}
            id="card-select-list"
            role="listbox"
            aria-label={field.label || field.key}
            className="card-select-menu"
            style={{ left: rect.left, top: rect.top, minWidth: rect.width }}
            onKeyDown={onMenuKeyDown}
          >
            {options.map((option, index) => (
              <div
                key={option}
                id={`card-select-opt-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === activeIndex}
                data-card-input="true"
                className={`card-select-option ${index === selectedIndex ? 'is-selected' : ''}`}
                style={{
                  fontFamily: textStyle.fontFamily,
                  fontWeight: textStyle.fontWeight,
                  fontSize: textStyle.fontSize,
                }}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
              >
                {option}
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
