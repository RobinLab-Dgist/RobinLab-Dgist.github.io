const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../layouts/_partials/hooks/head-end/github-button.html'), 'utf8');
const controller = source.slice(source.lastIndexOf("document.addEventListener('DOMContentLoaded'"), source.lastIndexOf('</script>'));
function fixture({ reduced = false, legacy = false, play = () => Promise.resolve() } = {}) {
  const classes = new Set(), events = {}, documentEvents = {}, heroEvents = {}, windowEvents = {};
  const hero = { classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    addEventListener: (e, fn) => heroEvents[e] = fn };
  let plays = 0;
  const video = { currentTime: 0, readyState: 0, paused: true, ended: false, error: null,
    closest: () => hero, addEventListener: (e, fn) => events[e] = fn,
    play: () => { plays++; return play(); }, pause: () => { video.paused = true; events.pause?.(); } };
  const motion = { matches: reduced };
  if (legacy) motion.addListener = fn => motion.change = fn;
  else motion.addEventListener = (_, fn) => motion.change = fn;
  const document = { hidden: false, querySelector: () => video,
    addEventListener: (e, fn) => { if (e === 'DOMContentLoaded') fn(); else documentEvents[e] = fn; } };
  vm.runInNewContext(controller, { document, window: { PointerEvent: function () {}, matchMedia: () => motion,
    addEventListener: (e, fn) => windowEvents[e] = fn } });
  return { video, events, motion, document, documentEvents, heroEvents, windowEvents,
    ready: () => classes.has('is-video-ready'), plays: () => plays,
    advance: () => { Object.assign(video, { currentTime: 0.3, readyState: 2, paused: false }); events.timeupdate(); } };
}

test('pending playback and the first black frames keep the poster', () => {
  const f = fixture({ play: () => new Promise(() => {}) });
  assert.equal(f.ready(), false);
  Object.assign(f.video, { currentTime: 0.01, readyState: 2, paused: false });
  f.events.playing(); f.events.timeupdate();
  assert.equal(f.ready(), false);
  f.advance(); assert.equal(f.ready(), true);
});

test('rejection restores the poster even after time has advanced', async () => {
  let reject;
  const f = fixture({ play: () => new Promise((_, r) => reject = r) });
  f.advance(); assert.equal(f.ready(), true);
  reject(new Error('NotAllowedError'));
  await new Promise(setImmediate);
  assert.equal(f.ready(), false);
});

test('pause, buffering and failures restore poster; healthy buffered stalls do not', () => {
  const f = fixture();
  for (const event of ['pause', 'waiting', 'emptied', 'error', 'stalled']) {
    f.advance(); f.events[event](); assert.equal(f.ready(), false, event);
  }
  f.advance(); f.video.readyState = 3; f.events.stalled(); assert.equal(f.ready(), true);
});

test('natural completion keeps the last frame without seeking', () => {
  const f = fixture(); f.advance();
  Object.assign(f.video, { currentTime: 10, paused: true, ended: true });
  f.events.pause();
  assert.equal(f.ready(), true);
  assert.equal(f.video.currentTime, 10);
});

test('reduced motion works with modern and legacy WebView listeners', () => {
  for (const legacy of [false, true]) {
    const f = fixture({ reduced: true, legacy });
    assert.equal(f.plays(), 0);
    f.motion.matches = false; f.motion.change(); assert.equal(f.plays(), 1);
    f.advance(); f.motion.matches = true; f.motion.change();
    assert.equal(f.ready(), false); assert.equal(f.video.paused, true);
  }
});

test('a real tap retries playback, permits explicit reduced-motion playback, and ignores links/end', () => {
  const f = fixture();
  const tap = link => f.heroEvents.pointerup({ target: { closest: () => link } });
  tap({}); assert.equal(f.plays(), 1);
  tap(null); assert.equal(f.plays(), 2);
  f.video.ended = true; tap(null); assert.equal(f.plays(), 2);
  const reduced = fixture({ reduced: true });
  reduced.heroEvents.pointerup({ target: { closest: () => null } });
  assert.equal(reduced.plays(), 1);
  reduced.advance(); assert.equal(reduced.ready(), true);
});

test('canplay and foreground restoration retry an interrupted video without restarting an ended one', () => {
  const f = fixture();
  f.events.canplay(); assert.equal(f.plays(), 2);
  f.document.hidden = true; f.documentEvents.visibilitychange();
  assert.equal(f.plays(), 2);
  f.document.hidden = false; f.documentEvents.visibilitychange();
  assert.equal(f.plays(), 3);
  f.windowEvents.pageshow(); assert.equal(f.plays(), 4);
  f.video.ended = true; f.windowEvents.pageshow(); f.events.canplay();
  assert.equal(f.plays(), 4);
});

test('fixed light configuration overrides a stale dark class without changing stored preferences', () => {
  const script = fs.readFileSync(path.join(__dirname, '../layouts/_partials/hooks/head-end/light-theme.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const classes = new Set(['dark']);
  const root = { dataset: { wcThemeDefault: 'light' }, classList: { remove: x => classes.delete(x) }, style: {} };
  vm.runInNewContext(script, { document: { documentElement: root, addEventListener: () => {} }, window: { addEventListener: () => {} } });
  assert.equal(classes.has('dark'), false);
  assert.equal(root.style.colorScheme, 'only light');
});
