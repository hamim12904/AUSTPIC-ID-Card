/**
 * The pill used by the card's action row and the preview modal's footer.
 *
 * Three shapes, one component, so the two places that offer "flip / preview /
 * submit / download" cannot drift apart visually:
 *
 *   text     — a labelled pill ("Flip to back", "Submit")
 *   iconOnly — a square pill showing just the icon. The label moves to the
 *              accessible name and a hover/focus tooltip, both read from the
 *              same `label` prop so they can never disagree.
 *   quiet    — a bare text action with no chrome, for "Back to edit"
 *
 * Sizing is fixed in CSS (.card-action-btn) rather than left to padding
 * utilities, because icon-only and text buttons have to line up on the same
 * height whether or not there is a label in them.
 */
export default function CardActionButton({
  children,
  label,
  icon,
  onClick,
  disabled = false,
  tone = 'ghost',
  shape = 'text',
  title,
  className = '',
}) {
  const iconOnly = shape === 'icon';
  const classes = [
    'card-action-btn',
    `card-action-btn--${tone}`,
    iconOnly ? 'card-action-btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : title || undefined}
      // The tooltip is CSS, driven off this attribute (see .card-action-btn).
      // Only icon-only buttons get one: a labelled button already says itself.
      data-tip={iconOnly ? label : undefined}
      title={!iconOnly ? title : undefined}
    >
      {icon && <span className="card-action-btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
