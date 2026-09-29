// Minimal CDP driver: launches headless Chrome, loads a page, waits for the
// harness to print a RESULT line, dumps that output, and saves a screenshot.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const url = process.argv[2];
const shot = process.argv[3];

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1280,1000',
  '--user-data-dir=C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\chrome-ui',
  'about:blank',
]);
chrome.stderr.on('data', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('chrome debug port never opened');
}

const socket = new WebSocket(await wsUrl());
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 1;
const pending = new Map();
const events = [];
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
};

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Page.navigate', { url }, sessionId);

let output = '';
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  await sleep(300);
  try {
    const res = await send(
      'Runtime.evaluate',
      { expression: "document.getElementById('out')?.textContent || ''", returnByValue: true },
      sessionId
    );
    output = res.result.value || '';
    if (/RESULT (OK|FAIL)/.test(output)) break;
  } catch {
    /* page may still be navigating */
  }
}

console.log(output);

if (shot) {
  const res = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(shot, Buffer.from(res.data, 'base64'));
  console.log(`saved ${shot}`);
}

const failed = /RESULT FAIL/.test(output);
socket.close();
chrome.kill();
process.exit(failed ? 1 : 0);
