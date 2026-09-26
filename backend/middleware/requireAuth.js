import { User } from '../models/user.js';
import { verifyToken } from '../utils/jwt.js';
import { ApiError } from './errorHandler.js';

/**
 * Guards routes that need a logged-in user. Validates the `Authorization:
 * Bearer <token>` header injected by src/api/client.js:12, then reloads the
 * user from the database so a deleted account cannot keep using an
 * unexpired token.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (!token || scheme.toLowerCase() !== 'bearer') {
      throw ApiError.unauthorized('Please log in to continue.');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      const expired = err?.name === 'TokenExpiredError';
      throw ApiError.unauthorized(
        expired ? 'Your session expired. Please log in again.' : 'Your session is invalid. Please log in again.'
      );
    }

    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('That account no longer exists.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export default requireAuth;
