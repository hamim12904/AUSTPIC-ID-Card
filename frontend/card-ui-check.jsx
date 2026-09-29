// Temporary harness: opens the real preview modal and measures where its
// footer rows and buttons actually land, so "aligned" is a measurement rather
// than an opinion. Results go to #out for scripts/run-ui-check.mjs.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import { template } from './src/config/template.js';
import { useCardStore } from './src/store/useCardStore.js';
import IDCardShell from './src/components/card/IDCardShell.jsx';

const out = document.getElementById('out');
const log = [];
const say = (line) => {
  log.push(line);
  out.textContent = log.join('\n');
};

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  say(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
};

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

useCardStore.setState({
  fields: {
    name: 'Abdur Rahman Chowdhury',
    studentId: '20.09.2020.14',
    department: 'CSE',
    bloodGroup: 'B+(ve)',
    contact: '+8801712345678',
    memberId: 'AUSTPIC-0142',
    address: 'Flat 4B, House 27, Road 11, Dhanmondi, Dhaka 1209',
    email: 'abdur.rahman@aust.edu.bd',
  },
});

createRoot(document.getElementById('root')).render(
  <div style={{ padding: 24 }}>
    <IDCardShell template={template} onGenerate={() => say('onGenerate')} scale={1} opacity={1} />
  </div>
);

const box = (el) => {
  const r = el.getBoundingClientRect();
  return { l: r.left, r: r.right, w: r.width, cx: r.left + r.width / 2 };
};
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

(async () => {
  await nextFrame();
  await nextFrame();

  // Open the preview through the real button.
  document.querySelector('.card-action-bar button:nth-child(2)').click();
  await nextFrame();
  await nextFrame();

  const panel = document.querySelector('.card-preview-panel');
  check('preview is open', Boolean(panel));
  if (!panel) {
    say(failures ? `RESULT FAIL (${failures})` : 'RESULT OK');
    return;
  }

  // --- what is in the footer now -------------------------------------------
  const allButtons = [...panel.querySelectorAll('button')];
  const labels = allButtons.map((b) => b.textContent.trim());
  say(`footer buttons: ${JSON.stringify(labels)}`);

  check('no Flip pill left in the footer', !labels.some((l) => /^flip/i.test(l)), labels.join(' | '));
  check('four controls remain, down from five', allButtons.length === 4, `found ${allButtons.length}`);

  // --- the side switch -----------------------------------------------------
  const steps = panel.querySelectorAll('.card-preview-step');
  check('side switch has two options', steps.length === 2, `found ${steps.length}`);
  check(
    'side switch is labelled Front/Back',
    [...steps].map((s) => s.textContent.trim()).join('/') === 'Front/Back',
    [...steps].map((s) => s.textContent.trim()).join('/')
  );
  check('front starts active', steps[0]?.getAttribute('aria-pressed') === 'true');
  check(
    'the switch is a real control, not decorative dots',
    !panel.querySelector('.card-preview-steps [aria-hidden]')
  );

  // Clicking Back must turn the card over.
  steps[1].click();
  await nextFrame();
  check('choosing Back turns the card over', Boolean(panel.querySelector('.card-flip-inner.flipped')));
  check('back step becomes active', steps[1]?.getAttribute('aria-pressed') === 'true');
  steps[0].click();
  await nextFrame();
  check('choosing Front turns it back', !panel.querySelector('.card-flip-inner.flipped'));

  // --- alignment -----------------------------------------------------------
  // The panel's own content box is what every row should span.
  const panelBox = box(panel);
  const panelStyle = getComputedStyle(panel);
  const padL = parseFloat(panelStyle.paddingLeft);
  const padR = parseFloat(panelStyle.paddingRight);
  const contentL = panelBox.l + padL;
  const contentR = panelBox.r - padR;
  say(`panel content box: ${contentL.toFixed(1)} .. ${contentR.toFixed(1)} (${(contentR - contentL).toFixed(1)}px)`);

  const rows = {
    downloads: panel.querySelector('.card-preview-downloads'),
    actions: panel.querySelector('.card-preview-actions'),
  };

  for (const [name, el] of Object.entries(rows)) {
    const b = box(el);
    check(`${name} row spans the full content width`, near(b.l, contentL) && near(b.r, contentR), `${b.l.toFixed(1)}..${b.r.toFixed(1)}`);
  }

  // Both rows must share the exact same edges, which is what was broken before.
  const dl = box(rows.downloads);
  const ac = box(rows.actions);
  check('the two rows share a left edge', near(dl.l, ac.l), `${dl.l.toFixed(1)} vs ${ac.l.toFixed(1)}`);
  check('the two rows share a right edge', near(dl.r, ac.r), `${dl.r.toFixed(1)} vs ${ac.r.toFixed(1)}`);

  // Downloads: two equal halves filling the row.
  const dls = [...rows.downloads.querySelectorAll('.card-download-btn')].map(box);
  check('two download buttons', dls.length === 2, `found ${dls.length}`);
  if (dls.length === 2) {
    check('downloads are equal width', near(dls[0].w, dls[1].w, 1), `${dls[0].w.toFixed(1)} vs ${dls[1].w.toFixed(1)}`);
    check('first download hugs the left edge', near(dls[0].l, contentL), dls[0].l.toFixed(1));
    check('second download hugs the right edge', near(dls[1].r, contentR), dls[1].r.toFixed(1));
  }

  // Decisions: back to edit hard left, submit hard right.
  const acts = [...rows.actions.querySelectorAll('button')].map((b) => ({ b, ...box(b) }));
  check('two decision buttons', acts.length === 2, `found ${acts.length}`);
  if (acts.length === 2) {
    const [first, second] = acts;
    check('the first decision starts at the left edge', near(first.l, contentL), `${first.l.toFixed(1)} vs ${contentL.toFixed(1)}`);
    check('the second decision ends at the right edge', near(second.r, contentR), `${second.r.toFixed(1)} vs ${contentR.toFixed(1)}`);
    check(
      'the two decisions sit at opposite ends',
      second.l - first.r > 12,
      `gap ${(second.l - first.r).toFixed(1)}px`
    );
  }

  // All pills in the modal share one height, so nothing looks ragged.
  const heights = [...panel.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height));
  check('every control in the modal is the same height', new Set(heights).size === 1, `heights ${heights.join(',')}`);

  // The side switch is centred over the card above it.
  const stepsBox = box(panel.querySelector('.card-preview-steps'));
  check(
    'the side switch is centred',
    near(stepsBox.cx, (contentL + contentR) / 2, 1),
    `${stepsBox.cx.toFixed(1)} vs ${((contentL + contentR) / 2).toFixed(1)}`
  );

  // Nothing should overflow the panel.
  const overflow = [...panel.querySelectorAll('button')].filter((b) => {
    const b2 = box(b);
    return b2.l < contentL - 1 || b2.r > contentR + 1;
  });
  check('no control overflows the panel', overflow.length === 0, `${overflow.length} overflowing`);

  say(failures === 0 ? 'RESULT OK' : `RESULT FAIL (${failures})`);
})();
