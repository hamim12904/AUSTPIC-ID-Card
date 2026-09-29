/**
 * End-to-end test for the DB-backed auth flow. REQUIRES a running MongoDB
 * (see backend/.env for MONGODB_URI). Run with: node scripts/smoke-db.mjs
 */
import assert from 'node:assert';
import mongoose from 'mongoose';
import app from '../index.js';
import { User } from '../models/user.js';
import { Counter } from '../models/counter.js';
import { isCloudinaryConfigured } from '../utils/cloudinary.js';

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

await check('signup allocates the member id up front, so the card needs no 2nd request', async () => {
  assert.match(
    userA.memberId ?? '',
    /^PIC-2026-02-\d{4}$/,
    `signup payload had no usable memberId: ${JSON.stringify(userA.memberId)}`
  );
  // It has to be persisted, not just echoed back, or a reload would lose it.
  const raw = await mongoose.connection.collection('users').findOne({ email: emailA });
  assert.equal(raw.memberId, userA.memberId, 'memberId in the payload is not the one in the database');
});

await check('GET /auth/me returns the same member id (re-hydrates a stale profile)', async () => {
  const r = await call('/api/auth/me', { token: tokenA });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.memberId, userA.memberId);
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

console.log('\nphoto');

const cloudinaryReady = isCloudinaryConfigured();
if (!cloudinaryReady) {
  console.log(
    '        (no CLOUDINARY_* keys in server/.env — the storage round trip is skipped, the guards below still run)'
  );
}

// A real 1x1 JPEG, so the multipart reader and Cloudinary are both exercised with
// actual image bytes rather than a blob with an image content type.
//
// This exact byte string used to be a shorter 154-byte JPEG that began and ended
// with the right SOI/EOI markers but was internally malformed, so Cloudinary
// rejected it with "Invalid image file" and every photo assertion below failed
// for a reason that had nothing to do with the code under test. The markers being
// correct is what made it convincing. This 336-byte one decodes cleanly.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCABkAGQBAREA/8QAHwAAAQUBAQEB' +
    'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
    'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
    'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
    'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z',
  'base64'
);

const postPhoto = (token, { type = 'image/jpeg', bytes = JPEG, filename = 'card-photo.jpg' } = {}) => {
  const form = new FormData();
  form.append('photo', new Blob([bytes], { type }), filename);
  return fetch(base + '/api/members/photo', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
};

await check('photo upload needs a session', async () => {
  const r = await postPhoto(null);
  assert.equal(r.status, 401);
});

await check('a non-image upload is rejected before it reaches Cloudinary', async () => {
  const r = await postPhoto(tokenA, { type: 'text/plain', bytes: Buffer.from('not a photo') });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'validation_error');
});

if (cloudinaryReady) {
  await check('upload returns a Cloudinary url and records it on the user document', async () => {
    const r = await postPhoto(tokenA);
    assert.equal(r.status, 200, `upload failed: ${JSON.stringify(await r.clone().json())}`);
    const { photo } = await r.json();
    assert.match(photo.url, /^https:\/\/res\.cloudinary\.com\//, `not a Cloudinary url: ${photo?.url}`);
    assert.ok(photo.publicId, 'no publicId, so a replaced photo could never be found or destroyed');
    assert.equal(photo.width, 1200);
    assert.equal(photo.height, 1200);

    // Delivery is authenticated, so the URL is signed per response rather than
    // stored — a persisted one would be a frozen link that can neither be
    // re-signed nor expire. What the document keeps is the pointer, and it is
    // the pointer, not the URL, that the response is built from.
    const raw = await mongoose.connection.collection('users').findOne({ email: emailA });
    assert.equal(raw.photo.publicId, photo.publicId, 'the pointer in the response is not the one in the database');
    assert.ok(raw.photo.version, 'no version, so delivery could not be pinned to the bytes that were stored');
    assert.equal(raw.photo.url, undefined, 'a delivery url was persisted; it must be minted per response');
  });

  // The whole point of the storage round trip: an unguessable photo that the
  // member can load and a stranger cannot.
  await check('the stored photo needs a signed url to be fetched at all', async () => {
    const { photo } = await (await postPhoto(tokenA)).json();
    const signed = await fetch(photo.url);
    assert.equal(signed.status, 200, `the member's own signed url did not resolve: ${signed.status}`);
    // Cloudinary serves authenticated assets with a wildcard CORS header, which
    // is what lets the browser export (utils/domRaster.js) fetch and inline it.
    assert.equal(signed.headers.get('access-control-allow-origin'), '*', 'no CORS header, so the card export could not read the photo');

    // Take the signature off, exactly as anyone enumerating public ids would.
    const stripped = photo.url.replace(/\/s--[^/]+\//, '/');
    const unsigned = await fetch(stripped);
    assert.notEqual(unsigned.status, 200, 'the photo was served with the signature removed');
  });

  await check('the photo rides back in the auth payload, so a reload re-hydrates it', async () => {
    const me = await (await call('/api/auth/me', { token: tokenA })).json();
    assert.match(me.user.photo?.url ?? '', /^https:\/\/res\.cloudinary\.com\//);
  });

  await check('a second upload replaces the asset instead of adding one', async () => {
    const first = await (await postPhoto(tokenA)).json();
    const second = await (await postPhoto(tokenA)).json();
    assert.equal(second.photo.publicId, first.photo.publicId, 'the public id changed, so the old asset was orphaned');
  });

  await check('each member\'s photo is filed under their own user id, so neither can touch the other\'s', async () => {
    const bob = await (
      await call('/api/auth/login', { method: 'POST', body: { email: emailB, password: 'secret123' } })
    ).json();
    await postPhoto(bob.token);
    for (const email of [emailA, emailB]) {
      const stored = await mongoose.connection.collection('users').findOne({ email });
      assert.ok(
        stored.photo.publicId.includes(stored._id.toString()),
        `${email}'s photo is filed under ${stored.photo.publicId}`
      );
    }
  });
} else {
  await check('without keys the endpoint answers 503, never a 500', async () => {
    const r = await postPhoto(tokenA);
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error.code, 'photo_upload_unavailable');
  });
}

console.log(`\n${passed} passed, ${failed} failed\n`);

await mongoose.disconnect();
server.close();
process.exit(failed ? 1 : 0);
