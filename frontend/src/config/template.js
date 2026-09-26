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
      y: 53.8,
      w: 69.4,
      h: 5,
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
    },
    {
      key: 'studentId',
      label: 'Student ID',
      placeholder: 'Enter student ID',
      x: 42,
      y: 69.6,
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
      y: 73.75,
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
      y: 77.9,
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
      y: 82.05,
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
      y: 39.5,
      w: 69.4,
      h: 5,
      fontSize: 50,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 700,
      placeholderFontFamily: '"Space Grotesk", sans-serif',
      color: '#0c2f38',
      align: 'center',
      maxLength: 30,
      required: true,
      uppercase: true,
    },
    {
      key: 'memberId',
      label: 'Member ID',
      placeholder: 'Enter member ID',
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
      y: 57.5,
      w: 56.7,
      h: 4,
      fontSize: 18,
      fontFamily: '"Poppins", sans-serif',
      fontWeight: 500,
      color: '#0c2f38',
      align: 'left',
      maxLength: 60,
      required: true,
    },
    {
      key: 'bloodGroup',
      label: 'Blood group',
      placeholder: 'Select blood group',
      x: 35.3,
      y: 63,
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
