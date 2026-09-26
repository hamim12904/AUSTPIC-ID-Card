/**
 * Smoke test for the auth surface. Exercises every path that does not require
 * a live MongoDB (validation, auth guard, error envelope, 404 shape).
 * Run with: node scripts/smoke.mjs
 */
import assert from 'node:assert';
import app from '../index.js';

const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
let failed = 0;

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

const post = (p, body) =>
  fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

console.log('\nhealth + error envelope');

await check('GET /api/health returns 200', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ok');
});

await check('unknown route returns { error: { code, message } }', async () => {
  const r = await fetch(`${base}/api/nope`);
  assert.equal(r.status, 404);
  const b = await r.json();
  assert.equal(b.error.code, 'not_found');
  assert.ok(b.error.message.includes('/api/nope'));
});

await check('malformed JSON body returns 400 not an HTML stack', async () => {
  const r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(r.status, 400);
  const b = await r.json();
  assert.equal(b.error.code, 'malformed_json');
});

console.log('\nrequireAuth guard (runs before any DB access)');

await check('GET /api/members/next-id without a token -> 401', async () => {
  const r = await fetch(`${base}/api/members/next-id`);
  assert.equal(r.status, 401);
  const b = await r.json();
  assert.equal(b.error.code, 'unauthorized');
});

await check('malformed Authorization header -> 401', async () => {
  const r = await fetch(`${base}/api/members/next-id`, {
    headers: { Authorization: 'Bearer not-a-real-jwt' },
  });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.code, 'unauthorized');
});

await check('wrong auth scheme -> 401', async () => {
  const r = await fetch(`${base}/api/auth/me`, { headers: { Authorization: 'Basic abc123' } });
  assert.equal(r.status, 401);
});

console.log('\nsignup / login validation (rejected before any DB access)');

await check('signup: short password -> 400 validation_error', async () => {
  const r = await post('/api/auth/signup', { name: 'A', email: 'a@b.co', password: '12345' });
  assert.equal(r.status, 400);
  const b = await r.json();
  assert.equal(b.error.code, 'validation_error');
  assert.match(b.error.message, /at least 6/);
});

await check('signup: bad email -> 400 with client-matching wording', async () => {
  const r = await post('/api/auth/signup', { name: 'A', email: 'nope', password: 'secret123' });
  assert.equal(r.status, 400);
  const b = await r.json();
  // Must match src/utils/validation.js so the two never disagree.
  assert.equal(b.error.message, 'Enter a valid email address.');
});

await check('signup: missing name -> 400', async () => {
  const r = await post('/api/auth/signup', { email: 'a@b.co', password: 'secret123' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'validation_error');
});

await check('login: missing password -> 400', async () => {
  const r = await post('/api/auth/login', { email: 'a@b.co' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, 'validation_error');
});

await check('error bodies never contain a stack or password', async () => {
  const r = await post('/api/auth/signup', { name: '', email: 'bad', password: '1' });
  const text = await r.text();
  assert.ok(!text.includes('at Object'), 'response leaked a stack trace');
  assert.ok(!text.toLowerCase().includes('password":'), 'response echoed the password');
});

console.log(`\n${passed} passed, ${failed} failed\n`);

server.close();
process.exit(failed ? 1 : 0);
