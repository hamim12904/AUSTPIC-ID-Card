export const bloodGroups = ['A+(ve)', 'A-(ve)', 'B+(ve)', 'B-(ve)', 'AB+(ve)', 'AB-(ve)', 'O+(ve)', 'O-(ve)'];

// AUST's own programme codes rather than full department names, because the
// card's department field is capped at 20 characters and "Computer Science &
// Engineering" would overflow it. Codes are also what students already know
// each other by. Keep in sync with BLOOD_GROUPS in backend/utils/constants.js.
// Add to this list when AUST introduces a programme.
export const departments = [
  'ARC', // Architecture
  'CE', // Civil Engineering
  'CSE', // Computer Science & Engineering
  'EEE', // Electrical & Electronic Engineering
  'IPE', // Industrial & Production Engineering
  'ME', // Mechanical Engineering
  'TE', // Textile Engineering
  'BBA', // Business Administration
  'A&S', // Arts & Sciences
];

// Geometry for the picture slot and its overlay, in percent of the card.
// `image` is the visible photo, `overlay` is the printed ring drawn on top of
// it. The overlay is deliberately slightly larger than the image so the ring
// reads as a border rather than a crop.
export const PHOTO_FIELD = {
  image: {
    x: 21.3,
    y: 15.8,
    width: 42.38 * 1.328,
    height: 26.63 * 1.328,
    shape: 'circle',
  },
  overlay: {
    x: 20.35,
    y: 15.12,
    width: 42.38 * 1.372,
    height: 26.63 * 1.372,
  },
  overlayImage: '/templates/overlay.png',
  placeholderImage: '/templates/blank_dp.png',
};

export const template = {
  templateId: 'aust-pic-2026',
  frontImage: '/templates/front.png',
  backImage: '/templates/back.png',
  photo: PHOTO_FIELD,
  // Flat { x, y, w, h } mirror of PHOTO_FIELD.image, kept only as a fallback
  // for older backend templates that describe the slot in flat terms. See the
  // readRect() fallback chain in PhotoUploadZone.jsx.
  photoField: {
    x: PHOTO_FIELD.image.x,
    y: PHOTO_FIELD.image.y,
    w: PHOTO_FIELD.image.width,
    h: PHOTO_FIELD.image.height,
  },
  frontFields: [
    {
      key: 'name',
      label: 'Full name',
      placeholder: 'Enter full name',
      x: 15.3,
      // Box grown 10px taller (h 5 -> 6.5, since the card is 667px tall at the
      // 420px reference width) to go with the larger type. Grown about the old
      // centre — 56.3 — rather than downward, so the name itself does not shift
      // and the vertical alignment already tuned on this card is left alone.
      y: 53.05,
      w: 69.4,
      h: 6.5,
      // Bigger than the back's matching field (see FieldOverlay's
      // getFieldSize) — this is the card's headline, so it gets its own,
      // larger cap.
      fontSize: 60,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 700,
      placeholderFontFamily: '"Space Grotesk", sans-serif',
      color: '#0c2f38',
      align: 'center',
      maxLength: 30,
      required: true,
      uppercase: true,
      // The headline, and the field most likely to be too long for its box: 30
      // uppercase characters will not fit at 60. Steps the type down until it
      // does, in the editor, the preview and the export alike.
      fit: true,
    },
    {
      key: 'studentId',
      label: 'Student ID',
      placeholder: 'Enter student ID',
      // Sat a couple of pixels below the printed "Student ID:", so nudged until it
      // matched: -2.5px, -3px, then +1px, leaving it 4.5px above where it
      // started. Geometry is a percentage of card height, and the card is 667px
      // tall at the 420px reference width, so 1px is 0.15 points. Reading it from
      // field.y is what moves the editor, the preview and the export together.
      y: 68.93,
      x: 42,
      w: 50,
      h: 3.6,
      labelHitWidth: 24,
      fontSize: 22,
      fontFamily: '"Mina", sans-serif',
      fontWeight: 400,
      color: '#0c2f38',
      align: 'left',
      maxLength: 20,
      required: true,
    },
    {
      key: 'department',
      label: 'Department',
      placeholder: 'Select department',
      x: 42,
      // Nudged to match the printed "Department:" alongside studentId: -2.75px,
      // -3px, then +1px, leaving it 4.75px above where it started. 0.15 points
      // is 1px at the 420px reference width, where the card is 667px tall.
      y: 73.3,
      w: 50,
      h: 3.6,
      labelHitWidth: 24,
      fontSize: 22,
      fontFamily: '"Mina", sans-serif',
      fontWeight: 400,
      color: '#0c2f38',
      align: 'left',
      maxLength: 20,
      required: true,
      // Declaring options is what turns this into a CardSelect instead of a
      // free-text input, so the card can only ever hold a real AUST programme
      // code — the same list the signup form offers.
      options: departments,
    },
    {
      key: 'bloodGroup',
      label: 'Blood group',
      placeholder: 'Select blood group',
      x: 42,
      // Lifted 3px (0.45 points) with the rest of this column, to match the
      // printed "Blood group:".
      y: 77.45,
      w: 50,
      h: 3.6,
      labelHitWidth: 24,
      fontSize: 22,
      fontFamily: '"Mina", sans-serif',
      fontWeight: 400,
      color: '#0c2f38',
      align: 'left',
      maxLength: 10,
      required: true,
      options: bloodGroups,
    },
    {
      key: 'contact',
      label: 'Contact',
      placeholder: 'Enter contact',
      x: 42,
      // Lifted 2px (0.30 points at the 420px reference width, where the card is
      // 667px tall) onto the printed "Contact:", which puts it back in line with
      // the rest of this column. It had been dropped 1.5px the other way.
      y: 81.97,
      w: 50,
      h: 3.6,
      labelHitWidth: 24,
      fontSize: 22,
      fontFamily: '"Mina", sans-serif',
      fontWeight: 400,
      color: '#0c2f38',
      align: 'left',
      maxLength: 20,
      required: true,
    },
  ],
  backFields: [
    {
      // Same key as the front name field, so both sides read and write
      // fields.name — type it once and it fills in on the other side.
      key: 'name',
      label: 'Full name',
      placeholder: 'Enter full name',
      x: 15.3,
      // Same +10px on the box, again about the old centre (42.0) so the text
      // stays put. It cannot be grown downward here: memberId starts at 46, so
      // h 6.5 from y 39.5 would butt the two boxes together.
      y: 38.75,
      w: 69.4,
      h: 6.5,
      fontSize: 50,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 700,
      placeholderFontFamily: '"Space Grotesk", sans-serif',
      color: '#0c2f38',
      align: 'center',
      maxLength: 30,
      required: true,
      uppercase: true,
      // Same shrinking fit as the front, measured against this side's own box.
      fit: true,
    },
    {
      key: 'memberId',
      label: 'Member ID',
      // Never typed. The server allocates it (GET /api/members/next-id, first
      // id PIC-2026-02-0001) and persists it on the user document, so
      // FieldOverlay renders this as baked-in text with no input. An editable
      // box would let a member hand in a card claiming an id that isn't theirs,
      // and would desync the card from the one in the database. autoHint stands
      // in until the value lands, so the field is never a silent blank.
      readOnly: true,
      autoHint: 'Assigning…',
      // x was 34 — that's exactly where the printed colon sits (measured at
      // 34.0%–34.4% of the card width), so typed text started on top of the
      // colon instead of after it. 35.3 clears it with the same ~0.9% gap
      // the front-side fields already use after their colons. w is trimmed
      // by the same 1.3 so the right edge doesn't move.
      x: 35.3,
      y: 46,
      w: 56.7,
      h: 4,
      fontSize: 22,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 500,
      color: '#0c2f38',
      align: 'left',
      maxLength: 24,
      required: true,
    },
    {
      key: 'address',
      label: 'Address',
      placeholder: 'Enter address',
      x: 35.3,
      y: 50.5,
      w: 56.7,
      h: 7,
      fontSize: 18,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 500,
      color: '#0c2f38',
      align: 'left',
      maxLength: 140,
      multiline: true,
      required: true,
    },
    {
      key: 'email',
      label: 'Email',
      placeholder: 'Enter email address',
      x: 35.3,
      // h 4 -> 4.5 for the second line. Both the fitter and the export read this
      // as "how many lines fit", and at h 4 the box held exactly one, so
      // multiline alone would still have been capped at a single line.
      //
      // y 57.5 -> 58.17, so the value sits 4.5px below where it started: +1.5px,
      // then +5px, then -2px. The box is top-aligned (see FieldOverlay), so its
      // first line sits on y directly and this moves the text without touching
      // where a wrapped second line lands. 0.30 points is 2px at the 420px
      // reference width, where the card is 667px tall. The box grew downward
      // rather than upward because the address box above ends exactly at 57.5.
      y: 58.17,
      h: 4.5,
      w: 56.7,
      fontSize: 18,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 500,
      color: '#0c2f38',
      align: 'left',
      maxLength: 60,
      // An address has no spaces to break on, so a long one used to run past
      // the right edge of the field. Wrapping to a second line keeps it inside,
      // and `fit` guarantees it needs no third: the fitter steps the type down
      // until the whole address is two lines, and it never widens a line past
      // the box, so it cannot exceed the right-hand side either.
      multiline: true,
      fit: true,
      required: true,
    },
    {
      key: 'bloodGroup',
      label: 'Blood group',
      placeholder: 'Select blood group',
      x: 35.3,
      // Lifted 2px (0.30 points) onto the printed "Blood group:". Unlike the
      // front's, this box is centred in its height rather than top-aligned, so
      // moving y moves the text by half the nudge — the whole 0.30 is the gap
      // being closed either way.
      y: 62.7,
      w: 56.7,
      h: 4,
      fontSize: 18,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 500,
      color: '#0c2f38',
      align: 'left',
      maxLength: 10,
      required: true,
      options: bloodGroups,
    },
  ],
};

export default template;
