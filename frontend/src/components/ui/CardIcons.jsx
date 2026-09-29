// The app has no icon library, so the handful of glyphs it needs are inlined
// here. All share a 24-unit box, a 1.7 stroke and round caps/joins, which is
// what gives them a single weight at 20px. Stroke is currentColor so a button
// can recolour them by changing its own text colour.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export function PreviewIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.6 12S6.2 5.9 12 5.9 21.4 12 21.4 12 17.8 18.1 12 18.1 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}

export function DownloadIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.4v11.9" />
      <path d="m7.4 10.8 4.6 4.5 4.6-4.5" />
      <path d="M4 16.4v2.7A1.9 1.9 0 0 0 5.9 21h12.2a1.9 1.9 0 0 0 1.9-1.9v-2.7" />
    </svg>
  );
}
