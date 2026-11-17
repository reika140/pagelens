import test from 'node:test';
import assert from 'node:assert/strict';
import { isGoogleFirstResultsPage, updateOrganicRankings, ORGANIC_RANKING_PREF } from '../dist/js/extension/organic-rank.js';

test('Google page-one scope, languages and web-only mode', () => {
  for (const url of [
    'https://www.google.com/search?q=bigcommerce+shopify',
    'https://www.google.com.vn/search?q=chuy%E1%BB%83n+shopify&start=0',
    'https://google.co.uk/search?q=seo&udm=14',
    'https://google.de/search?q=SEO',
  ]) assert.equal(isGoogleFirstResultsPage(url), true, url);
  for (const url of [
    'https://google.com/search?q=foo&start=10',
    'https://google.com/search?q=foo&start=-1',
    'https://google.com/search?q=foo&udm=2',
    'https://google.com/search?q=foo&tbm=nws',
    'https://google.com/search?q=',
    'https://google.com/',
    'https://google.evil.example/search?q=foo',
    'https://www.notgoogle.com/search?q=foo',
    'chrome://newtab/',
  ]) assert.equal(isGoogleFirstResultsPage(url), false, url);
});

test('popup queries current SERP status with temporary active-tab scripting permission', async () => {
  const calls=[];
  globalThis.chrome={ scripting:{ executeScript:async request=>{
    calls.push(request);
    return [{result:{eligible:true,active:true,count:4,reason:'ok'}}];
  }}};
  const res=await updateOrganicRankings(14,'show');
  assert.equal(res.count,4);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].target,{tabId:14});
  assert.equal(calls[0].func.name,'rankOrganicResultsInPage');
  assert.deepEqual(calls[0].args,['show']);
});

test('automatic Google content script and preference key ship in the extension', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
  assert.equal(ORGANIC_RANKING_PREF, 'pagelens-organic-ranking-enabled');
  const content = await readFile(new URL('../dist/js/extension/google-serp-content.js', import.meta.url), 'utf8');
  assert.match(content, /storage\.onChanged/);
  assert.match(content, /MutationObserver/);
  assert.match(content, /rankOrganicResultsInPage/);
  assert.equal(manifest.permissions.includes('storage'), true);
  assert.equal(manifest.host_permissions, undefined);
  assert.doesNotMatch(content, /^(?:import|export)\s/m);
});
