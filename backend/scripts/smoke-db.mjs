/**
 * End-to-end test for the DB-backed auth flow. REQUIRES a running MongoDB
 * (see backend/.env for MONGODB_URI). Run with: node scripts/smoke-db.mjs
 */
import assert from 'node:assert';
import mongoose from 'mongoose';
import app from '../index.js';
import { User } from '../models/user.js';
import { Counter } from '../models/counter.js';

await mongoose.connect(process.env.MONGODB_URI);
await User.init(); // build the unique email / sparse memberId indexes first
await Counter.deleteMany({});
await User.deleteMany({});

const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
let failed = 0;
const stamp = Date.now();

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

const call = (p, { method = 'GET', body, token } = {}) =>
  fetch(base + p, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const emailA = `alice${stamp}@aust.edu`;
const emailB = `bob${stamp}@aust.edu`;

console.log('\nsignup');

let tokenA;
let userA;

await check('signup returns 201 with { token, user }', async () => {
  const r = await call('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Alice AUST', email: emailA, password: 'secret123' },
  });
  assert.equal(r.status, 201);
  const b = await r.json();
  assert.ok(b.token, 'no token returned');
  assert.ok(b.user, 'no user returned');
  tokenA = b.token;
  userA = b.user;
});

await check('user payload has id/name/email and no password', () => {
  assert.ok(userA.id, 'missing id');
  assert.equal(userA.name, 'Alice AUST');
  assert.equal(userA.email, emailA);
  assert.ok(!('password' in userA), 'password leaked in response');
  assert.ok(!JSON.stringify(userA).includes('$2'), 'hash leaked in response');
});

await check('password is stored as a bcrypt hash, not plaintext', async () => {
  const raw = await mongoose.connection
    .collection('users')
    .findOne({ email: emailA });
  assert.ok(raw.password.startsWith('$2'), `not a bcrypt hash: ${raw.password}`);
  assert.notEqual(raw.password, 'secret123');
});

await check('email is normalized to lowercase', async () => {
  const r = await call('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Case Test', email: `MiXeD${stamp}@AUST.edu`, password: 'secret123' },
  });
  const b = await r.json();
  assert.equal(b.user.email, `mixed${stamp}@aust.edu`);
});

await check('duplicate email -> 409 email_taken', async () => {
  const r = await call('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Impostor', email: emailA, password: 'secret123' },
  });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error.code, 'email_taken');
});

console.log('\ntoken + guarded routes');

await check('GET /api/auth/me with the issued token', async () => {
  const r = await call('/api/auth/me', { token: tokenA });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.email, emailA);
});

await check('tampered token -> 401', async () => {
  const r = await call('/api/auth/me', { token: `${tokenA}x` });
  assert.equal(r.status, 401);
});

console.log('\nmember id allocation');

await check('first call allocates PIC-2026-02-0001', async () => {
  const r = await call('/api/members/next-id', { token: tokenA });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).memberId, 'PIC-2026-02-0001');
});

await check('repeat calls are idempotent (same id, no drift)', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await call('/api/members/next-id', { token: tokenA });
    assert.equal((await r.json()).memberId, 'PIC-2026-02-0001');
  }
});

await check('concurrent first calls still yield exactly one id', async () => {
  const r = await call('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Race Test', email: `race${stamp}@aust.edu`, password: 'secret123' },
  });
  const { token } = await r.json();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => call('/api/members/next-id', { token }))
  );
  const ids = new Set(
    await Promise.all(
      results.map(async (r) => {
        assert.equal(r.status, 200, 'concurrent request failed');
        return (await r.json()).memberId;
      })
    )
  );
  assert.equal(ids.size, 1, `expected 1 unique id, got ${[...ids].join(', ')}`);
  // Guard against a Set of undefined/empty passing the size check above.
  for (const id of ids) {
    assert.match(id, /^PIC-2026-02-\d{4}$/, `not a real member id: ${id}`);
  }
});

await check('a different user gets the next id in sequence', async () => {
  const r = await call('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Bob B', email: emailB, password: 'secret123' },
  });
  const { token } = await r.json();
  const id = (await (await call('/api/members/next-id', { token })).json()).memberId;
  const seq = Number(id.split('-').pop());
  assert.ok(seq >= 2, `expected seq >= 2, got ${id}`);
  assert.ok(id.startsWith('PIC-2026-02-'), `bad prefix: ${id}`);
});

console.log('\nlogin');

await check('login with correct credentials issues a token', async () => {
  const r = await call('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: 'secret123' },
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.ok(b.token);
  assert.equal(b.user.email, emailA);
  assert.ok(!('password' in b.user));
});

await check('login is case-insensitive on email', async () => {
  const r = await call('/api/auth/login', {
    method: 'POST',
    body: { email: emailA.toUpperCase(), password: 'secret123' },
  });
  assert.equal(r.status, 200);
});

await check('wrong password -> 401 invalid_credentials', async () => {
  const r = await call('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: 'wrongpassword' },
  });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.code, 'invalid_credentials');
});

await check('unknown email -> identical 401 (no user enumeration)', async () => {
  const unknown = await call('/api/auth/login', {
    method: 'POST',
    body: { email: `ghost${stamp}@aust.edu`, password: 'secret123' },
  });
  const wrongPw = await call('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password: 'wrongpassword' },
  });
  assert.equal(unknown.status, wrongPw.status);
  assert.deepEqual(await unknown.json(), await wrongPw.json());
});

console.log(`\n${passed} passed, ${failed} failed\n`);

await mongoose.disconnect();
server.close();
process.exit(failed ? 1 : 0);
