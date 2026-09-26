import { User } from '../models/user.js';
import { signToken } from '../utils/jwt.js';
import { BLOOD_GROUPS, DEPARTMENTS } from '../utils/constants.js';
import { ApiError } from '../middleware/errorHandler.js';

// Mirrors src/utils/validation.js so server and client reject the same input
// with the same wording; the frontend pre-checks so users rarely see these.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6; // matches minLength={6} on LoginPage/SignupPage

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function validateSignup({ name, email, password }) {
  const cleanName = String(name ?? '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password ?? '');

  if (!cleanName) throw ApiError.badRequest('Please enter your name.');
  if (cleanName.length > 80) throw ApiError.badRequest('Keep your name under 80 characters.');
  if (!cleanEmail) throw ApiError.badRequest('Please enter your email address.');
  if (!EMAIL_RE.test(cleanEmail)) throw ApiError.badRequest('Enter a valid email address.');
  if (!cleanPassword) throw ApiError.badRequest('Please enter a password.');
  if (cleanPassword.length < MIN_PASSWORD) {
    throw ApiError.badRequest(`Password must be at least ${MIN_PASSWORD} characters.`);
  }

  return { name: cleanName, email: cleanEmail, password: cleanPassword };
}

// ID card details the signup form offers alongside the credentials. Every one
// is optional: blank input and an untouched dropdown are simply left unset, so
// nothing here can block account creation. The card still enforces its own
// required checks when the member hits Generate.
const OPTIONAL_PROFILE_FIELDS = [
  { key: 'studentId', label: 'student ID', max: 20 },
  // uppercased before the enum check so a hand-typed "cse" is normalised rather
  // than rejected, and so the stored value always matches the card's option.
  { key: 'department', label: 'department', max: 20, oneOf: DEPARTMENTS, uppercase: true },
  { key: 'bloodGroup', label: 'blood group', max: 10, oneOf: BLOOD_GROUPS },
  { key: 'contact', label: 'contact', max: 20 },
  { key: 'address', label: 'address', max: 140 },
];

/**
 * Picks the present optional card details out of the request body.
 * Returns only the keys that were actually filled in — passing the rest to
 * User.create would set them to '' and trip the blood group / department enums.
 */
function collectProfile(body) {
  const profile = {};

  for (const { key, label, max, oneOf, uppercase } of OPTIONAL_PROFILE_FIELDS) {
    let value = String(body?.[key] ?? '').trim();
    if (!value) continue;
    if (uppercase) value = value.toUpperCase();
    if (value.length > max) {
      throw ApiError.badRequest(`Keep your ${label} under ${max} characters.`);
    }
    if (oneOf && !oneOf.includes(value)) {
      throw ApiError.badRequest(`Choose a valid ${label}.`);
    }
    profile[key] = value;
  }

  return profile;
}

/** POST /api/auth/signup -> { token, user } */
export async function signup(req, res, next) {
  try {
    const { name, email, password } = validateSignup(req.body);
    const profile = collectProfile(req.body);

    const existing = await User.findOne({ email });
    if (existing) throw ApiError.emailTaken();

    // A concurrent signup can still win the race; the unique index turns that
    // into a MongoServerError(11000) which errorHandler maps to email_taken.
    // The card details ride along on the user document, so the client can
    // pre-fill the card from the signup response without a second request.
    const user = await User.create({ name, email, password, ...profile });

    res.status(201).json({ token: signToken(user), user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login -> { token, user } */
export async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? '');

    if (!email || !password) {
      throw ApiError.badRequest('Please enter your email address and password.');
    }

    // password is select:false on the schema, so opt it back in for the check.
    const user = await User.findOne({ email }).select('+password');

    // One generic message for "no such user" and "wrong password" so the
    // endpoint can't be used to discover which emails are registered.
    const ok = user ? await user.verifyPassword(password) : false;
    if (!ok) throw ApiError.invalidCredentials();

    res.json({ token: signToken(user), user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me -> { user } — lets the client re-hydrate on page load. */
export async function me(req, res, next) {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (err) {
    next(err);
  }
}
