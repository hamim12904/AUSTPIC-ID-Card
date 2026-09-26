// Server-side copy of the option lists the signup form offers. Kept separate
// from frontend/src/config/template.js because the two are separate packages
// with no shared build, so the values are duplicated rather than imported.
// Keep the two in sync: frontend/src/config/template.js (bloodGroups).
export const BLOOD_GROUPS = [
  'A+(ve)',
  'A-(ve)',
  'B+(ve)',
  'B-(ve)',
  'AB+(ve)',
  'AB-(ve)',
  'O+(ve)',
  'O-(ve)',
];

// Validated rather than trusted so a hand-rolled request can't store a
// department that the signup dropdown would never have produced.
export const DEPARTMENTS = [
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
