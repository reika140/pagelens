/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnapshot } from '../dist/js/core/normalize.js';
import { createMarkdown } from '../dist/js/core/export.js';
import { readableError } from '../dist/js/extension/locate.js';

const URL = 'https://example.test/';
const entry = (value) => ({ value, locator: 'head > meta' });
const fixture = (overrides = {}) => ({
  url: URL,
  title: '', titleTags: [], descriptions: [], canonicals: [], robots: [], viewports: [],
  openGraph: [], twitter: [], hreflang: [], headings: [], images: [], links: [], jsonLd: [],
  counts: { headings: 0, images: 0, links: 0, jsonLd: 0 },
  limits: { headings: 10000, images: 10000, links: 10000, jsonLd: 10000 },
  ...overrides,
});

test('missing and empty metadata findings use clear, distinct language', () => {
  const missing = normalizeSnapshot(fixture());
  assert.equal(missing.findings.find(x => x.id === 'title-missing')?.title, 'Title tag missing');
  assert.equal(missing.findings.find(x => x.id === 'viewport-missing')?.title, 'Viewport meta tag missing');
  const empty = normalizeSnapshot(fixture({
    titleTags: [entry('')], descriptions: [entry('')], canonicals: [entry('')],
  }));
  assert.equal(empty.findings.find(x => x.id === 'title-empty')?.title, 'Document title is empty');
  assert.equal(empty.findings.find(x => x.id === 'description-empty')?.title, 'Meta description is empty');
  assert.equal(empty.findings.find(x => x.id === 'canonical-empty')?.title, 'Canonical URL is empty');
});

test('multiple canonical declarations are described as links, not as SEO failure scores', () => {
  const scan = normalizeSnapshot(fixture({canonicals: [entry(URL), entry(URL)]}));
  const finding = scan.findings.find(x => x.id === 'canonical-duplicate');
  assert.equal(finding?.title, 'Multiple canonical links');
  assert.equal(finding?.severity, 'warning');
  assert.doesNotMatch(finding?.description ?? '', /penalty|ranking drop|guarantee/i);
});

test('truncated JSON-LD findings use human-readable category names', () => {
  const scan = normalizeSnapshot(fixture({
    counts: {headings:0,images:0,links:0,jsonLd:10002},
    limits: {headings:10000,images:10000,links:10000,jsonLd:10000},
  }));
  const finding = scan.findings.find(x => x.id === 'truncated-jsonLd');
  assert.equal(finding?.title, 'Inspection limited: JSON-LD');
  assert.doesNotMatch(finding?.title ?? '', /jsonLd/);
});

test('structured-data reporting distinguishes JSON syntax from eligibility', () => {
  const scan = normalizeSnapshot(fixture({
    jsonLd: [{id:0,locator:'head > script',tooLarge:false,text:'{"@type":"Article"}'},
      {id:1,locator:'head > script',tooLarge:false,text:'{"@type":'},
      {id:2,locator:'head > script',tooLarge:true,text:'{}'}],
    counts:{headings:0,images:0,links:0,jsonLd:3},
  }));
  const markdown = createMarkdown(scan);
  assert.match(markdown, /Syntax:\*\* Valid JSON syntax/);
  assert.match(markdown, /JSON syntax error:/);
  assert.match(markdown, /Not checked:/);
  assert.doesNotMatch(markdown, /Eligible for rich results|Google approved/i);
});

test('scan errors are actionable without showing raw Chrome internals', () => {
  assert.match(readableError(new Error('Cannot access contents of the page.')), /site access/i);
  assert.match(readableError(new Error('No tab with id: 4')), /tab changed or closed/i);
  const generic = readableError(new Error('chrome.scripting.executeScript Internal stack 0xdeadbeef'));
  assert.equal(generic, 'The page could not be scanned. Reopen PageLens and try again.');
});
