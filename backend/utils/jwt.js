import jwt from 'jsonwebtoken';

const TOKEN_TTL = '7d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // index.js guards this at boot, so reaching here means something imported
    // this module without going through that check. Fail loudly rather than
    // signing or verifying with an empty secret.
    throw new Error('JWT_SECRET is not set. Add it to server/.env before starting the server.');
  }
  return secret;
}

export function signToken(user) {
  return jwt.sign({ sub: String(user._id ?? user.id), email: user.email }, getSecret(), {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

export default { signToken, verifyToken };
