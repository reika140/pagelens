import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyAnchorRel, LINK_HIGHLIGHT_PREF } from '../dist/js/extension/link-highlighter.js';

const cases = [
  ['', 'follow'], ['noopener noreferrer', 'follow'], ['FOLLOW', 'follow'],
  ['nofollow', 'nofollow'], ['ugc', 'ugc'], ['nofollow ugc', 'ugc'],
  ['UGC sponsored', 'ugc'], ['SPONSORED', null], ['nofollow sponsored', 'nofollow'],
  ['my-nofollow-token', 'follow'],
];
for (const [rel, expected] of cases) {
  test(`link rel classifier: ${JSON.stringify(rel)} -> ${expected}`, () => {
    assert.equal(classifyAnchorRel(rel), expected);
  });
}
test('link highlighting is opt-in, not a static all-websites content script', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.optional_host_permissions, undefined);
  assert.ok(!manifest.host_permissions);
  assert.ok(manifest.content_scripts.every(x => x.matches.every(y => y.includes('google.com'))));
  const bundle=await readFile(new URL('../dist/js/extension/link-highlight-content.js',import.meta.url),'utf8');
  assert.match(bundle,/classifyAnchorRel/);
  assert.match(bundle,/storage\.onChanged/);
  assert.doesNotMatch(bundle,/fetch\(|XMLHttpRequest|sendBeacon/);
  assert.equal(LINK_HIGHLIGHT_PREF,'pagelens-link-highlighting-enabled');
});

test('follow/nofollow/UGC dashed outline is 2px, with no host-wide permissions', async () => {
  const source = await readFile(new URL('../dist/js/extension/link-highlighter.js', import.meta.url), 'utf8');
  assert.equal((source.match(/outline: 2px dashed/g) || []).length, 3);
  assert.doesNotMatch(source, /outline: 1\.5px dashed/);
});
