import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isSupportedPage, currentActiveTab, scanTab } from '../dist/js/extension/locate.js';

const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
const popupHtml = await readFile(new URL('../dist/popup.html', import.meta.url), 'utf8');

const calls = { queries: [], injections: [] };
const fixture = { url: 'https://fixture.example.test/page', title: 'Real extraction response', counts: { headings: 0, images: 0, links: 0, jsonLd: 0 } };
globalThis.chrome = {
  tabs: { query: async opts => { calls.queries.push(opts); return [{ id: 8, url: fixture.url }]; } },
  scripting: {
    executeScript: async (opts) => {
      calls.injections.push(opts);
      return [{ result: fixture }];
    },
  },
};

test('popup-only Chrome action uses temporary inspection access without broad site access', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'storage']);
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches.slice().sort(), [
    'https://www.google.com/*', 'https://google.com/*',
    'https://www.google.com.vn/*', 'https://google.com.vn/*'].sort());
  assert.equal(manifest.content_scripts[0].run_at, 'document_idle');
  assert.equal(manifest.content_scripts[0].js[0], 'js/extension/google-serp-content.js');
  assert.match(popupHtml, /\/js\/popup\/main\.js/);
  assert.match(popupHtml, /\/styles\/popup-window\.css/);
});

test('site eligibility accepts normal web pages, not privileged Chrome pages', () => {
  for (const url of ['https://fixture.example/', 'http://localhost:8000']) assert.equal(isSupportedPage(url), true);
  for (const url of [undefined, '', 'chrome://extensions/', 'chrome-extension://a/popup.html', 'file:///tmp/page.html', 'about:blank', 'javascript:alert(1)']) assert.equal(isSupportedPage(url), false);
});

test('popup can identify its active tab without the tabs permission', async () => {
  const result = await currentActiveTab();
  assert.deepEqual(result, { id: 8, url: fixture.url });
  assert.deepEqual(calls.queries.at(-1), { active: true, currentWindow: true });
});

test('on-demand popup scan injects actual extractor into the selected tab', async () => {
  const result = await scanTab(8);
  assert.deepEqual(result, fixture);
  const call = calls.injections.at(-1);
  assert.deepEqual(call.target, { tabId: 8 });
  assert.equal(typeof call.func, 'function');
  assert.equal(call.func.name, 'extractPageSnapshot');
});

test('popup only injects the DOM extractor; no page overlay or navigation script remains', async () => {
  calls.injections.length = 0;
  const result = await scanTab(8);
  assert.deepEqual(result, fixture);
  assert.equal(calls.injections.length, 1);
  assert.equal(calls.injections[0].func.name, 'extractPageSnapshot');
  assert.equal(calls.injections[0].args, undefined);
  const locateSource = await readFile(new URL('../dist/js/extension/locate.js', import.meta.url), 'utf8');
  const popupSource = await readFile(new URL('../dist/js/popup/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(locateSource + popupSource, /highlightTab|highlightInPage|pagelens-target-overlay|locateButton|scrollIntoView\(\{\s*behavior:\s*['"]smooth/);
});
