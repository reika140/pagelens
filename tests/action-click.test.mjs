import test from 'node:test';
import assert from 'node:assert/strict';

let click;
let getMessage;
let updated;
let removed;
const calls = { panel: [], inject: [], messages: [] };
const scan = { url: 'https://fixture.example/path', title: 'Captured from action', counts: { headings: 0, images: 0, links: 0, jsonLd: 0 } };
globalThis.chrome = {
  action: { onClicked: { addListener(fn) { click = fn; } } },
  sidePanel: { open: async (opts) => { calls.panel.push(opts); } },
  scripting: { executeScript: async (opts) => { calls.inject.push(opts); return [{ result: scan }]; } },
  tabs: { onUpdated: { addListener(fn) { updated = fn; } }, onRemoved: { addListener(fn) { removed = fn; } } },
  runtime: {
    onMessage: { addListener(fn) { getMessage = fn; } },
    sendMessage: async (msg) => { calls.messages.push(msg); },
  },
};
await import('../dist/js/extension/background.js');

function pull(tabId) {
  return new Promise((resolve) => {
    const async = getMessage({ type: 'pagelens:get-action-scan', tabId }, {}, resolve);
    if (!async) setImmediate(() => resolve(null));
  });
}

test('toolbar action opens panel and starts an actual extraction without host permissions', async () => {
  assert.equal(typeof click, 'function');
  click({ id: 84, windowId: 2, url: 'https://fixture.example/path' });
  const reply = await pull(84);
  assert.deepEqual(calls.panel, [{ windowId: 2 }]);
  assert.equal(calls.inject.length, 1);
  assert.equal(calls.inject[0].target.tabId, 84);
  assert.equal(typeof calls.inject[0].func, 'function');
  assert.equal(reply.ok, true);
  assert.equal(reply.snapshot.title, scan.title);
});

test('blocked scheme never triggers script injection', async () => {
  click({ id: 85, windowId: 2, url: 'chrome://settings/' });
  const reply = await pull(85);
  assert.equal(reply.ok, false);
  assert.match(reply.error, /HTTP\(S\)/);
  assert.equal(calls.inject.length, 1);
});

test('action scan is scoped to the clicked tab', async () => {
  const result = await pull(99999);
  assert.equal(result, null);
  const previous = await pull(84);
  assert.equal(previous.ok, true);
});

test('cached scans are invalidated on navigation and tab close', async () => {
  updated(84, { status: 'loading' });
  assert.equal(await pull(84), null);
  click({ id: 90, windowId: 2, url: 'https://fixture.example/path' });
  assert.equal((await pull(90)).ok, true);
  removed(90);
  assert.equal(await pull(90), null);
});
