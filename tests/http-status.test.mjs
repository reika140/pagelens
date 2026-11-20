import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHttpUrlsInPage, checkHttpLinks, httpStatusCategory } from '../dist/js/extension/http-status.js';

const origin = 'https://store.example.test/products';

function response(status, url, redirected = false) {
  return { status, url, redirected, body: null };
}

test('HTTP classification reports status classes without inventing SEO errors', () => {
  assert.equal(httpStatusCategory(200), 'success');
  assert.equal(httpStatusCategory(301), 'warning');
  assert.equal(httpStatusCategory(401), 'error');
  assert.equal(httpStatusCategory(402), 'error');
  assert.equal(httpStatusCategory(403), 'error');
  assert.equal(httpStatusCategory(501), 'error');
  assert.equal(httpStatusCategory(null), 'info');
});

test('HTTP checks return exact 401/402/403 and successful/redirected observations via HEAD', async t => {
  const old = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const status = Number(new URL(url).pathname.slice(1));
    return response(status || 200, url, url.includes('/302'));
  };
  t.after(() => { globalThis.fetch = old; });
  const urls = ['https://store.example.test/401', 'https://store.example.test/402', 'https://store.example.test/403', 'https://store.example.test/302', 'https://store.example.test/200'];
  const found = await checkHttpUrlsInPage(urls, origin);
  assert.deepEqual(found.map(x => x.status), [401,402,403,302,200]);
  assert.ok(found.every(x => x.method === 'HEAD' && x.state === 'verified'));
  assert.ok(calls.every(x => x.options.credentials === 'same-origin' && x.options.method === 'HEAD'));
});

test('HEAD 405/501 falls back to lightweight same-origin GET', async t => {
  const old = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return response(options.method === 'HEAD' ? Number(new URL(url).pathname.slice(1)) : 200, url);
  };
  t.after(() => { globalThis.fetch = old; });
  const found = await checkHttpUrlsInPage(['https://store.example.test/405','https://store.example.test/501'], origin);
  assert.deepEqual(found.map(x => x.status), [200,200]);
  assert.deepEqual(found.map(x => x.method), ['GET','GET']);
  assert.equal(calls.filter(x => x.method === 'GET').length, 2);
  assert.ok(calls.filter(x => x.method === 'GET').every(x => x.headers.Range === 'bytes=0-0'));
});

test('external links use anonymous CORS checks; blocked response is not marked broken', async t => {
  const old = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.mode, 'cors');
    throw new TypeError('Failed to fetch');
  };
  t.after(() => { globalThis.fetch = old; });
  const found = await checkHttpUrlsInPage(['https://external.example.org/failure'], origin);
  assert.equal(found[0].status, null);
  assert.equal(found[0].state, 'unavailable');
  assert.match(found[0].reason, /CORS/);
});

test('limits checks, de-duplicates links, rejects dangerous protocols and local cross-origin targets', async t => {
  const old = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return response(200,url); };
  t.after(() => { globalThis.fetch = old; });
  const urls = ['javascript:alert(1)','http://127.0.0.1/admin','https://store.example.test/1','https://store.example.test/1', ...Array.from({length:25}, (_,i) => `https://store.example.test/${i+2}`)];
  const found = await checkHttpUrlsInPage(urls, origin);
  assert.equal(found.length, 16);
  assert.equal(found[0].state, 'skipped');
  assert.equal(found[1].state, 'skipped');
  assert.equal(calls.length, 14);
});

test('tab injection uses the activeTab permission and returns observed results', async t => {
  const old = globalThis.chrome;
  globalThis.chrome = { scripting: { executeScript: async ({target,func,args}) => {
    assert.equal(target.tabId, 12);
    assert.equal(func.name, 'checkHttpUrlsInPage');
    assert.deepEqual(args, [['https://store.example.test/403'],origin]);
    return [{result:[{url:args[0][0],status:403,method:'HEAD',state:'verified',redirected:false,finalUrl:args[0][0],reason:''}]}];
  } } };
  t.after(() => { globalThis.chrome = old; });
  const result = await checkHttpLinks(12,['https://store.example.test/403'],origin);
  assert.equal(result[0].status,403);
});
