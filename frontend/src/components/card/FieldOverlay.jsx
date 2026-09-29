import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCardStore } from '../../store/useCardStore.js';
import { validateField } from '../../utils/validation.js';
import { getFieldTypography } from '../../config/cardTypography.js';
import { fitFieldSizeRatio, invalidateTextFitCache, softBreakSegments } from '../../utils/textFit.js';
import CardSelect from './CardSelect.jsx';

/**
 * A value with a <wbr> after every @ and ., the boundaries utils/textFit.js
 * wraps an over-long run on, so a long address breaks in the preview at the
 * same place the export breaks it. `overflow-wrap: break-word` only takes over
 * once a run has no other break point, so it still covers a segment too wide to
 * fit on any line.
 *
 * The extra span is not decoration: .field-static-text is a flex container, and
 * a <wbr> among its children would be blockified into a flex item of its own —
 * an empty one stacked down a column instead of a break opportunity in a line.
 */
function BreakableValue({ value }) {
  const segments = softBreakSegments(value);
  return (
    <span className="field-static-value">
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment}
          {index < segments.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </span>
  );
}

/**
 * A value with a zero-width space after every @ and ., the same boundaries
 * softBreakSegments() hands the read-only render.
 *
 * A <textarea> has no <wbr>, and an arbitrary character is the only other place
 * it will break an over-long run — which is how the editor used to split an
 * address mid-word while the preview and the export split it on a boundary. A
 * zero-width space is a break opportunity every browser honours and which costs
 * no width, so all three agree.
 *
 * Only ever the idle display. The spaces are invisible but they are still in
 * the value, and a caret parked just after one swallows a backspace — so
 * editing always works on the real text.
 */
function decorateWithSoftBreaks(value) {
  return value.replace(/[@.]/g, (ch) => `${ch}\u200b`);
}

export default function FieldOverlay({ field, showErrors, side, readOnly = false }) {
  const value = useCardStore((s) => s.fields[field.key] ?? '');
  const setField = useCardStore((s) => s.setField);
  const controlRef = useRef(null);
  const errorId = useId();
  const error = !readOnly && showErrors ? validateField(value, field) : null;

  // A multiline field wraps its value (see decorateWithSoftBreaks), so the
  // decoration is only worth having on the one control that wraps: the
  // <textarea>. An <input> is a single line by definition.
  const [editing, setEditing] = useState(false);
  const decorated = decorateWithSoftBreaks(value);
  const caretRef = useRef(null);

  // Writing a new value always parks the caret at the end of the field, so
  // taking the decoration back out on focus has to put it back where the click
  // landed — mapped through the decoration, whose zero-width spaces would
  // otherwise shift every position after the first @ or . along by one.
  useLayoutEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (editing && caret != null) controlRef.current?.setSelectionRange(caret, caret);
  }, [editing]);

  // Measuring text needs the real web font, which usually isn't ready on the
  // first paint. Until it is, the fit is computed against a fallback face and
  // can be too generous; the cache is dropped and a counter bumped so every
  // field is measured again once the fonts land.
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      invalidateTextFitCache();
      setFontEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-field typography from the template config, falling back to the
  // side-wide default so a field only needs to override what it changes.
  // Shared with the canvas export (utils/cardRender.js) so a downloaded card
  // is set exactly like the one on screen.
  const typography = getFieldTypography(field, side);

  // A `fit` field shrinks to whatever its value needs (see utils/textFit.js).
  // Expressed in cqw with no px floor, because the box is a percentage of the
  // card: the same proportional size then holds at any card width, and the
  // export — which multiplies that same ratio by its pixel width — lands in the
  // same place. fontEpoch is what re-measures once the real font is available.
  const fitRatio = useMemo(
    () => (field.fit ? fitFieldSizeRatio(field, side, value) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field, side, value, fontEpoch]
  );
  if (fitRatio) typography.fontSize = `${(fitRatio * 100).toFixed(4)}cqw`;


  const textStyle = {
    color: field.color,
    textAlign: field.align || 'left',
    textTransform: field.uppercase ? 'uppercase' : 'none',
    // Read back by .field-input::placeholder in index.css.
    ...(field.placeholderFontFamily
      ? { '--placeholder-font-family': field.placeholderFontFamily }
      : {}),
  };

  const style = {
    position: 'absolute',
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.w}%`,
    height: `${field.h}%`,
    ...typography,
    ...textStyle,
  };

  // Plain baked-in text, no input, no dropdown chrome. Two callers land here:
  // the whole-card readOnly/"final" render used by the preview, and any single
  // field the template marks readOnly (memberId — allocated server-side). Both
  // are meant to look exactly like the card that actually gets generated, so
  // nothing interactive — including the select's caret icon — belongs here.
  if (readOnly || field.readOnly) {
    // A readOnly field with no value is mid-allocation or failed — say so in
    // the field rather than leaving a blank the member can't fill, since this
    // one is the only field with no box to type into.
    const showHint = !value && field.autoHint;
    return (
      <div
        className={`field-overlay field-static ${error ? 'has-error' : ''}`}
        style={style}
        data-card-field={field.key}
      >
        <span
          className={[
            'field-static-text',
            // The card art prints a multiline field's label beside its first
            // line, so a multiline field is pinned to the top of its box. A
            // single-line one stays centred, which is where its label sits.
            field.multiline ? 'is-top' : '',
            // A plain <input> never wraps. Without this a value that ran into
            // the fitter's floor would wrap onto a second line here while the
            // editor clipped it, and the two would stop agreeing.
            field.multiline ? '' : 'is-nowrap',
            showHint ? 'is-auto-hint' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ ...typography, ...textStyle }}
        >
          {showHint ? field.autoHint : <BreakableValue value={value} />}
        </span>
        {error && (
          <span id={errorId} className="sr-only" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  const commonProps = {
    className: 'field-input w-full h-full bg-transparent',
    style: { ...typography, ...textStyle },
    value,
    maxLength: field.maxLength,
    placeholder: field.placeholder || field.label || '',
    onChange: (event) => setField(field.key, event.target.value),
    'aria-invalid': Boolean(error),
    'aria-label': field.label || field.key,
    'aria-describedby': error ? errorId : undefined,
    'data-card-input': 'true',
  };

  return (
    <div className={`field-overlay ${error ? 'has-error' : ''}`} style={style} data-card-field={field.key}>
      {/* The card art bakes the field names in to the left of each box. This
          transparent strip covers that printed label so clicking it focuses the
          input, and carries data-card-input so the custom cursor grows. */}
      {field.labelHitWidth > 0 && (
        <div
          className="field-label-hit"
          data-card-input="true"
          aria-hidden="true"
          style={{ right: '100%', width: `${field.labelHitWidth}%` }}
          onClick={() => controlRef.current?.focus()}
        />
      )}
      {field.options ? (
        <CardSelect
          field={field}
          value={value}
          onChange={(next) => setField(field.key, next)}
          textStyle={textStyle}
          showError={Boolean(error)}
        />
      ) : field.multiline ? (
        <div className="field-multiline" onClick={() => controlRef.current?.focus()}>
          <textarea
            {...commonProps}
            className="field-input field-multiline-input w-full bg-transparent"
            ref={controlRef}
            rows={3}
            value={editing ? value : decorated}
            // The zero-width spaces are invisible but they are still characters,
            // so they have to be given back or a long address stops short.
            maxLength={field.maxLength ? field.maxLength + decorated.length - value.length : undefined}
            onFocus={(event) => {
              const { selectionStart, value: shown } = event.target;
              caretRef.current = shown.slice(0, selectionStart).replace(/\u200b/g, '').length;
              setEditing(true);
            }}
            onBlur={() => setEditing(false)}
          />
        </div>
      ) : (
        <input {...commonProps} ref={controlRef} type="text" />
      )}
      {error && <span id={errorId} className="sr-only">{error}</span>}
    </div>
  );
}
