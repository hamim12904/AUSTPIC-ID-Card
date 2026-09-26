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
 * GET /api/members/next-id -> { memberId }
 *
 * Allocation is idempotent per user: the id is persisted on the user document
 * and returned unchanged on every later call, so refreshing the page or
 * retrying the request can't burn a new number. Two concurrent first requests
 * may each burn a sequence, but the `$set` guard means only one id is ever
 * persisted and both callers receive that same id.
 */
export async function getNextMemberId(req, res, next) {
  try {
    const user = await User.findById(req.user._id);

    if (!user) throw ApiError.unauthorized('That account no longer exists.');
    if (user.memberId) return res.json({ memberId: user.memberId });

    const candidate = await burnNextSequence();
    const claimed = await User.findOneAndUpdate(
      { _id: user._id, memberId: { $exists: false } },
      { $set: { memberId: candidate } },
      { returnDocument: 'after' }
    );

    // Lost the race: re-read to return the id the winner persisted.
    const memberId = claimed?.memberId ?? (await User.findById(user._id))?.memberId;
    if (!memberId) throw new Error('Failed to allocate a member id.');

    return res.json({ memberId });
  } catch (err) {
    return next(err);
  }
}

export default { getNextMemberId };
