import { useId, useRef } from 'react';
import { useCardStore } from '../../store/useCardStore.js';
import { validateField } from '../../utils/validation.js';
import CardSelect from './CardSelect.jsx';

// cqw is 1% of the card face width (the face is a container), so these scale
// with the card. configuredSize is the config's fontSize, used as the upper
// clamp so a field can never overflow the card art. The name field is sized
// per side (front bigger, back unchanged) rather than sharing one formula, so
// bumping the front headline doesn't drag the back's copy up with it.
function getFieldSize(field, side) {
  const configuredSize = Number(field.fontSize) || (side === 'front' ? 18 : 16);
  if (field.key === 'name') {
    return side === 'front'
      ? `clamp(18px, 6.2cqw, ${configuredSize}px)`
      : `clamp(13px, 4.8cqw, ${configuredSize}px)`;
  }
  if (side === 'front') {
    return `clamp(13px, 3.1cqw, ${configuredSize}px)`;
  }
  return `clamp(12px, 2.6cqw, ${configuredSize}px)`;
}

export default function FieldOverlay({ field, showErrors, side, readOnly = false }) {
  const value = useCardStore((s) => s.fields[field.key] ?? '');
  const setField = useCardStore((s) => s.setField);
  const controlRef = useRef(null);
  const errorId = useId();
  const error = !readOnly && showErrors ? validateField(value, field) : null;
  const isFront = side === 'front';

  // Per-field typography from the template config, falling back to the
  // side-wide default so a field only needs to override what it changes.
  const typography = {
    fontFamily: field.fontFamily || (isFront ? '"Mina", sans-serif' : '"Poppins", sans-serif'),
    fontWeight: field.fontWeight ?? (isFront ? 400 : 500),
    fontSize: getFieldSize(field, side),
    lineHeight: field.multiline ? 1.15 : 1.05,
  };

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

  // Read-only/"final" rendering used by the preview: plain baked-in text,
  // no inputs, no dropdown chrome. This is meant to look exactly like the
  // card that actually gets generated, so nothing interactive — including
  // the select's caret icon — belongs here.
  if (readOnly) {
    return (
      <div className="field-overlay field-static" style={style} data-card-field={field.key}>
        <span className="field-static-text" style={{ ...typography, ...textStyle }}>
          {value}
        </span>
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
        <textarea {...commonProps} ref={controlRef} rows={3} />
      ) : (
        <input {...commonProps} ref={controlRef} type="text" />
      )}
      {error && <span id={errorId} className="sr-only">{error}</span>}
    </div>
  );
}
