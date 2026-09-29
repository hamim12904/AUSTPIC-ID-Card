import Counter from '../models/counter.js';
import { User } from '../models/user.js';
import { ApiError } from '../middleware/errorHandler.js';

// Change this if the cohort code should roll over automatically instead of
// being fixed. Kept as a constant for now to match "starts from PIC-2026-02-0001".
const MEMBER_ID_PREFIX = 'PIC-2026-02';
const COUNTER_KEY = 'member-2026-02';

function formatMemberId(seq) {
  return `${MEMBER_ID_PREFIX}-${String(seq).padStart(4, '0')}`;
}

async function burnNextSequence() {
  const counter = await Counter.findOneAndUpdate(
    { _id: COUNTER_KEY },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return formatMemberId(counter.seq);
}

/**
 * Allocates this user's member id if they don't have one yet, and returns it.
 *
 * Idempotent: an account that already has an id keeps it, so calling this on
 * every sign-in is free and can't renumber anybody. Two concurrent calls may
 * each burn a sequence, but the `$set` guard means only one id is ever
 * persisted and both callers get that same one back.
 *
 * Used by authController so `memberId` is always present in the signup / login /
 * me payload — the card reads it straight off the user document, with no second
 * request that could fail and leave the card stuck.
 */
export async function ensureMemberId(user) {
  if (!user) return undefined;
  if (user.memberId) return user.memberId;

  const candidate = await burnNextSequence();
  const claimed = await User.findOneAndUpdate(
    { _id: user._id, memberId: { $exists: false } },
    { $set: { memberId: candidate } },
    { returnDocument: 'after' }
  );

  // Lost the race: re-read to return the id the winner persisted.
  const memberId = claimed?.memberId ?? (await User.findById(user._id))?.memberId;
  if (!memberId) throw new Error('Failed to allocate a member id.');

  // findOneAndUpdate returns a separate document, so mirror the id onto the
  // caller's instance. authController serialises that instance straight into
  // its response, and without this the freshly created user would go out with
  // no memberId despite the database having one.
  user.memberId = memberId;
  return memberId;
}

/**
 * GET /api/members/next-id -> { memberId }
 *
 * A fallback for the card. Signup and login already return the id on the user
 * document, so this only does real work for accounts created before that, and
 * for a client whose stored profile is missing it.
 */
export async function getNextMemberId(req, res, next) {
  try {
    const user = await User.findById(req.user._id);

    if (!user) throw ApiError.unauthorized('That account no longer exists.');

    return res.json({ memberId: await ensureMemberId(user) });
  } catch (err) {
    return next(err);
  }
}

export default { getNextMemberId, ensureMemberId };
