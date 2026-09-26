/**
 * Validates one field's current value against its template definition.
 * Mirrors the Zod/Joi checks the backend runs (roadmap §5.5), so the
 * "Next" / "Generate" buttons can block before ever hitting the network.
 * Returns null when valid, or a short user-facing message when not.
 */
export function validateField(value, fieldDef) {
  const trimmed = (value ?? '').toString().trim();

  if (fieldDef.required && trimmed.length === 0) {
    return 'This field is required.';
  }
  if (fieldDef.maxLength && trimmed.length > fieldDef.maxLength) {
    return `Keep it under ${fieldDef.maxLength} characters.`;
  }
  if (fieldDef.key === 'email' && trimmed.length > 0) {
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!looksLikeEmail) return 'Enter a valid email address.';
  }
  if (fieldDef.options && trimmed.length > 0 && !fieldDef.options.includes(trimmed)) {
    return 'Choose one of the listed options.';
  }
  return null;
}

/** Validates every field for one side; returns { key: message } for invalid ones only. */
export function validateSide(fieldDefs, fields) {
  const errors = {};
  for (const def of fieldDefs) {
    const message = validateField(fields[def.key], def);
    if (message) errors[def.key] = message;
  }
  return errors;
}

export function isSideValid(fieldDefs, fields) {
  return Object.keys(validateSide(fieldDefs, fields)).length === 0;
}
