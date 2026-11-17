/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import { DEFAULT_HEURISTICS } from '../core/types.js';
import type { Finding, Heuristics, InspectedImage, InspectedLink, ScanResult, Section, Severity } from '../core/types.js';
import { normalizeSnapshot } from '../core/normalize.js';
import { evaluateRules } from '../core/rules.js';
import { formatHeadingsForCopy, imagesCsv, linksCsv } from '../core/export.js';
import { currentActiveTab, highlightTab, isSupportedPage, readableError, scanTab } from '../extension/locate.js';
import { isActionScanReply } from '../extension/action-session.js';

import '../extension/browser-api.js';

type Theme = 'sepia' | 'dark';
type FindingFilter = 'issues' | 'all' | Severity;
type IconName = 'overview' | 'metadata' | 'headings' | 'images' | 'links' | 'structured' | 'refresh' | 'moon' | 'sun' | 'target' | 'copy' | 'download' | 'alert' | 'search' | 'check' | 'arrow' | 'back';
const tabs: Array<{ section: Section; label: string; icon: IconName }> = [
  { section: 'overview', label: 'Overview', icon: 'overview' },
  { section: 'metadata', label: 'Metadata', icon: 'metadata' },
  { section: 'headings', label: 'Headings', icon: 'headings' },
  { section: 'images', label: 'Images', icon: 'images' },
  { section: 'links', label: 'Links', icon: 'links' },
  { section: 'structured', label: 'JSON-LD', icon: 'structured' },
];
const paths: Record<IconName, string[]> = {
  overview: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  metadata: ['M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z', 'M8 3v5h5', 'M8 13h8', 'M8 17h8'],
  headings: ['M4 5v14', 'M13 5v14', 'M4 12h9', 'M18 9h3v10', 'M17 19h5'],
  images: ['M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3z', 'm2 17 6-6 4 4 3-3 7 7'],
  links: ['M10 13a5 5 0 0 0 7 .3l3-3a5 5 0 0 0-7-7l-2 2', 'M14 11a5 5 0 0 0-7-.3l-3 3a5 5 0 0 0 7 7l2-2'],
  structured: ['M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z', 'M14 3v5h5', 'm10 12-2 2 2 2', 'm14 12 2 2-2 2'],
  refresh: ['M20 11a8 8 0 0 0-14-5L4 8', 'M4 3v5h5', 'M4 13a8 8 0 0 0 14 5l2-2', 'M20 21v-5h-5'],
  moon: ['M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5z'],
  sun: ['M12 3v2', 'M12 19v2', 'M3 12h2', 'M19 12h2', 'm5.7 5.7 1.4 1.4', 'm16.9 16.9 1.4 1.4', 'm18.3 5.7-1.4 1.4', 'm7.1 16.9-1.4 1.4', 'M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8z'],
  target: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8z'],
  copy: ['M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3', 'M10 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 17v4h16v-4'],
  alert: ['M12 2 2 20h20L12 2z', 'M12 9v4', 'M12 17h.01'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.5-4.5'],
  check: ['m4 12 5 5L20 6'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  back: ['M19 12H5', 'm11 18-6-6 6-6'],
};
function icon(name: IconName, size = 17): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  for (const shape of paths[name]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', shape); svg.append(path);
  }
  return svg;
}
function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function button(label: string, action: () => void, options: { icon?: IconName; className?: string; title?: string; disabled?: boolean } = {}): HTMLButtonElement {
  const el = make('button', options.className ?? 'btn', '');
  el.type = 'button'; el.disabled = options.disabled ?? false; el.title = options.title ?? label;
  if (!label) el.setAttribute('aria-label', options.title ?? 'Button');
  if (options.icon) el.append(icon(options.icon));
  el.append(document.createTextNode(label));
  el.addEventListener('click', action);
  return el;
}
function pill(label: string, kind = 'neutral'): HTMLSpanElement { return make('span', `pill pill-${kind}`, label); }
function heading(title: string, subtitle: string): HTMLElement {
  const wrap = make('div', 'section-head');
  wrap.append(make('h2', 'section-title', title), make('p', 'section-description', subtitle));
  return wrap;
}
function field(label: string, value: string, options: { mono?: boolean; badges?: HTMLElement[]; locator?: string } = {}): HTMLElement {
  const row = make('div', 'data-row');
  const left = make('div', 'data-label', label);
  for (const badge of options.badges ?? []) left.append(badge);
  row.append(left, make('div', `data-value${options.mono ? ' mono' : ''}`, value || '—'));
  return row;
}
function card(className = ''): HTMLElement { return make('article', `item-card ${className}`); }
function empty(title: string, detail: string): HTMLElement {
  const el = make('div', 'empty-state');
  el.append(icon('check', 25), make('strong', '', title), make('p', '', detail));
  return el;
}
function truncate(text: string, max = 190): string { return text.length > max ? `${text.slice(0, max)}…` : text; }
function displayDate(utc: string): string {
  try { return new Date(utc).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return utc; }
}
function domain(url: string): string { try { return new URL(url).hostname; } catch { return 'No page selected'; } }
function getSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem('pagelens-theme');
    if (saved === 'dark') return 'dark';
    if (saved === 'sepia' || saved === 'light') return 'sepia'; // migrate v1.1.0 light preference
  } catch { /* Private browsing restrictions */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'sepia';
}
function getSavedHeuristics(): Heuristics {
  try {
    const stored = JSON.parse(localStorage.getItem('pagelens-heuristics') ?? 'null') as Partial<Heuristics> | null;
    if (!stored) return { ...DEFAULT_HEURISTICS };
    const options = { ...DEFAULT_HEURISTICS, ...stored };
    const numbers = [options.titleMin, options.titleMax, options.descriptionMin, options.descriptionMax];
    if (!numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= 500) || options.titleMin > options.titleMax || options.descriptionMin > options.descriptionMax) return { ...DEFAULT_HEURISTICS };
    return options;
  } catch { return { ...DEFAULT_HEURISTICS }; }
}
const state: {
  scan: ScanResult | null; loading: boolean; error: string | null; tabId: number | null;
  section: Section; search: string; severity: FindingFilter; imageFilter: 'all' | 'missing' | 'empty' | 'present';
  linkFilter: 'internal' | 'external'; theme: Theme; heuristics: Heuristics;
} = {
  scan: null, loading: false, error: null, tabId: null,
  section: 'overview', search: '', severity: 'issues',
  imageFilter: 'all', linkFilter: 'internal', theme: getSavedTheme(), heuristics: getSavedHeuristics(),
};
let serial = 0;
let notificationTimer: number | undefined;
const root = document.getElementById('app');
if (!root) throw new Error('PageLens root was not mounted.');
const app = root;

function notify(text: string, failure = false): void {
  let toast = document.getElementById('toast');
  if (!toast) { toast = make('div', 'toast'); toast.id = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); document.body.append(toast); }
  toast.className = `toast visible${failure ? ' toast-error' : ''}`;
  toast.textContent = text;
  if (notificationTimer !== undefined) window.clearTimeout(notificationTimer);
  notificationTimer = window.setTimeout(() => { toast?.classList.remove('visible'); }, 3600);
}
async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); notify('Copied to clipboard.'); }
  catch { notify('Clipboard unavailable. Try again or check clipboard permissions.', true); }
}
function download(content: string, extension: 'md' | 'csv', kind: string): void {
  try {
    const urlPart = (state.scan ? domain(state.scan.url) : 'webpage').replace(/[^a-z0-9.-]/gi, '_').slice(0, 70);
    const datePart = (state.scan?.scannedAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
    const name = `pagelens-${urlPart}-${kind}-${datePart}.${extension}`;
    const blob = new Blob([content], { type: extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    notify(`${kind} report downloaded.`);
  } catch (error) { notify(`Could not export report: ${String(error)}`, true); }
}
async function highlight(selector: string): Promise<void> {
  if (state.tabId === null) { notify('Scan a webpage first.', true); return; }
  try {
    const active = await currentActiveTab();
    if (active.id !== state.tabId) { notify('The active tab has changed. Refresh the scan.', true); return; }
    const outcome = await highlightTab(active.id, selector);
    notify(outcome.reason, !outcome.ok);
  } catch (error) { notify(readableError(error), true); }
}
function locateButton(selector: string, label: string): HTMLButtonElement {
  return button('', () => void highlight(selector), { icon: 'target', className: 'icon-btn locate-btn', title: `Highlight ${label} on the webpage` });
}
// Preserve a user's search and reading position when switching inspectors.
const sectionSearches: Record<Section, string> = {
  overview: '', metadata: '', headings: '', images: '', links: '', structured: '',
};
const sectionScroll: Record<Section, number> = {
  overview: 0, metadata: 0, headings: 0, images: 0, links: 0, structured: 0,
};

function changeTab(section: Section, locator?: string): void {
  const current = app.querySelector<HTMLElement>('#view');
  if (current) sectionScroll[state.section] = current.scrollTop;
  sectionSearches[state.section] = state.search;
  state.section = section;
  if (locator) {
    // A finding's jump must not land on an item hidden by a previous filter.
    sectionSearches[section] = '';
    const image = state.scan?.images.find((item) => item.locator === locator);
    if (image && section === 'images') state.imageFilter = 'all';
    const link = state.scan?.links.find((item) => item.locator === locator);
    if (link && section === 'links' && (link.kind === 'internal' || link.kind === 'external')) {
      state.linkFilter = link.kind;
    }
  }
  state.search = sectionSearches[section];
  render();
  const next = app.querySelector<HTMLElement>('#view');
  if (!next) return;
  if (locator) {
    const item = Array.from(next.querySelectorAll<HTMLElement>('[data-locator]'))
      .find((node) => node.dataset.locator === locator);
    if (item) {
      item.dataset.focused = 'true';
      item.focus({ preventScroll: true });
      item.scrollIntoView({ block: 'center' });
      return;
    }
  }
  next.scrollTop = locator ? 0 : sectionScroll[section];
}
function resetPage(): void {
  serial += 1;
  state.scan = null; state.error = null; state.loading = false; state.tabId = null;
  render();
}

/** Consume a scan started in the browser toolbar click's activeTab gesture. */
async function consumeToolbarScan(): Promise<void> {
  const request = ++serial;
  state.scan = null; state.error = null; state.loading = true;
  render();
  try {
    const active = await currentActiveTab();
    const reply: unknown = await chrome.runtime.sendMessage({ type: 'pagelens:get-action-scan', tabId: active.id });
    if (request !== serial) return;
    if (!isActionScanReply(reply, active.id)) {
      // The panel was opened from Chrome's side-panel picker, without a toolbar
      // gesture; no privilege was granted. Explain instead of requesting a site.
      state.tabId = active.id;
      return;
    }
    state.tabId = active.id;
    if (reply.ok) state.scan = normalizeSnapshot(reply.snapshot, state.heuristics);
    else state.error = readableError(new Error(reply.error));
  } catch (error) {
    if (request === serial) state.error = readableError(error);
  } finally {
    if (request === serial) { state.loading = false; render(); }
  }
}

/** Scans without prompting; activeTab works when the toolbar action was used. */
async function refresh(): Promise<void> {
  const request = ++serial;
  state.scan = null; state.error = null; state.loading = true;
  render();
  try {
    const tab = await currentActiveTab();
    if (request !== serial) return;
    state.tabId = tab.id;
    if (!isSupportedPage(tab.url)) {
      throw new Error('Open a normal HTTP(S) webpage to inspect it. Chrome internal pages, new tabs and extension pages are not supported.');
    }
    const raw = await scanTab(tab.id);
    if (request !== serial) return;
    state.scan = normalizeSnapshot(raw, state.heuristics);
    state.error = null;
  } catch (error) {
    if (request === serial) state.error = readableError(error);
  } finally {
    if (request === serial) { state.loading = false; render(); }
  }
}

// A tab switch cannot silently grant activeTab. The user clicks the toolbar
// action on the next site; this is the privacy-preserving behavior.
chrome.tabs.onActivated.addListener(() => resetPage());
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (tabId === state.tabId && (change.status === 'loading' || change.url)) resetPage();
});
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'pagelens:action-scan-ready') {
    void consumeToolbarScan();
  }
});

function render(): void {
  // Preserve the reading position on theme and preference changes too.
  const previousView = app.querySelector<HTMLElement>('#view');
  if (previousView?.dataset.section === state.section) {
    sectionScroll[state.section] = previousView.scrollTop;
  }
  document.documentElement.dataset.theme = state.theme;
  app.replaceChildren();
  const top = make('header', 'app-header');
  const brand = make('div', 'brand');
  const logo = make('div', 'logo-mark'); logo.append(icon('search', 19));
  const brandCopy = make('div', 'brand-copy');
  brandCopy.append(make('h1', '', 'PageLens'));
  const siteLabel = state.scan ? domain(state.scan.url) : state.loading ? 'Scanning current page' : state.error ? 'Page unavailable' : 'Website inspector';
  brandCopy.append(make('p', 'brand-domain', siteLabel));
  brand.append(logo, brandCopy);
  const topActions = make('div', 'header-actions');
  topActions.append(
    button('', () => {
      state.theme = state.theme === 'dark' ? 'sepia' : 'dark';
      try { localStorage.setItem('pagelens-theme', state.theme); } catch { /* session only */ }
      render();
    }, { icon: state.theme === 'dark' ? 'sun' : 'moon', className: 'icon-btn', title: `Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme` }),
    button('', () => void refresh(), { icon: 'refresh', className: 'icon-btn refresh-btn', disabled: state.loading, title: 'Refresh current scan' }),
  );
  top.append(brand, topActions);
  const nav = make('nav', 'module-nav');
  nav.setAttribute('aria-label', 'Inspector navigation');
  const navLabel = make('label', 'module-label', 'INSPECT');
  navLabel.htmlFor = 'module-switch';
  const moduleSelect = make('select', 'module-switch');
  moduleSelect.id = 'module-switch';
  moduleSelect.setAttribute('aria-label', 'Choose inspector');
  for (const entry of tabs) {
    const option = make('option', '', entry.label === 'JSON-LD' ? 'Structured Data' : entry.label);
    option.value = entry.section;
    moduleSelect.append(option);
  }
  moduleSelect.value = state.section;
  moduleSelect.addEventListener('change', () => changeTab(moduleSelect.value as Section));
  const selectWrap = make('div', 'module-select-wrap');
  selectWrap.append(icon(tabs.find((entry) => entry.section === state.section)?.icon ?? 'overview', 17), moduleSelect);
  nav.append(navLabel, selectWrap);
  if (state.section !== 'overview') {
    nav.append(button('Overview', () => changeTab('overview'), {
      icon: 'back', className: 'btn module-back', title: 'Back to Overview',
    }));
  }
  const main = make('main', 'main-content'); main.id = 'view';
  main.dataset.section = state.section; main.setAttribute('role', 'tabpanel');
  main.setAttribute('aria-labelledby', `tab-${state.section}`);
  if (state.loading) main.append(renderLoading());
  else if (state.error) main.append(renderError(state.error));
  else if (!state.scan) main.append(renderWelcome());
  else {
    const scan = state.scan;
    switch (state.section) {
      case 'overview': renderOverview(main, scan); break;
      case 'metadata': renderMetadata(main, scan); break;
      case 'headings': renderHeadings(main, scan); break;
      case 'images': renderImages(main, scan); break;
      case 'links': renderLinks(main, scan); break;
      case 'structured': renderStructured(main, scan); break;
    }
  }
  // Contextual controls live inside each inspector, never in a persistent footer.
  app.append(top, nav, main);
  main.scrollTop = sectionScroll[state.section];
}
function renderLoading(): HTMLElement {
  const wrap = make('div', 'center-state');
  wrap.append(make('div', 'spinner'), make('h2', '', 'Inspecting webpage'), make('p', '', 'Collecting live document metadata and DOM elements. No data leaves your device.'));
  return wrap;
}
function renderError(message: string): HTMLElement {
  const wrap = make('div', 'center-state error-state');
  wrap.append(icon('alert', 29), make('h2', '', 'Unable to inspect this page'), make('p', '', message));
  wrap.append(button('Try again', () => void refresh(), { icon: 'refresh', className: 'btn btn-primary' }));
  return wrap;
}
function renderWelcome(): HTMLElement {
  const wrap = make('div', 'center-state');
  wrap.append(icon('search', 30), make('h2', '', 'Ready to inspect'),
    make('p', '', 'Open a website and click the PageLens toolbar icon. It scans that tab immediately, without asking for access to every site.'),
    button('Refresh current page', () => void refresh(), { icon: 'refresh', className: 'btn btn-secondary' }));
  return wrap;
}
function technicalLocation(locator: string | null): HTMLElement | null {
  if (!locator) return null;
  const details = make('details', 'technical-location');
  details.append(make('summary', '', 'DOM location'), make('code', 'selector mono', locator));
  return details;
}
function renderOverview(parent: HTMLElement, scan: ScanResult): void {
  const errors = scan.findings.filter((f) => f.severity === 'error').length;
  const warnings = scan.findings.filter((f) => f.severity === 'warning').length;
  const infos = scan.findings.filter((f) => f.severity === 'info').length;

  const hero = make('section', 'overview-hero');
  hero.append(make('p', 'eyebrow', 'CURRENT PAGE'));
  hero.append(make('h2', 'overview-page-title', scan.metadata.title || domain(scan.url)));
  const url = make('p', 'page-url', scan.url);
  url.title = scan.url;
  hero.append(url);
  const status = make('div', 'overview-status');
  if (errors + warnings) {
    if (errors) status.append(pill(`${errors} error${errors === 1 ? '' : 's'}`, 'error'));
    if (warnings) status.append(pill(`${warnings} warning${warnings === 1 ? '' : 's'}`, 'warning'));
  } else status.append(pill('No errors or warnings found', 'success'));
  if (infos) status.append(make('span', 'status-note', `${infos} informational observation${infos === 1 ? '' : 's'}`));
  hero.append(status);
  const metadataLink = button('Inspect metadata', () => changeTab('metadata'), {
    icon: 'arrow', className: 'text-button overview-metadata-link',
  });
  hero.append(metadataLink);
  const details = make('details', 'overview-extras');
  details.append(make('summary', '', 'Page details'));
  details.append(field('Meta description', scan.metadata.description || 'Not declared'));
  details.append(field('Canonical', scan.metadata.canonical || 'Not declared'));
  details.append(field('Robots', scan.metadata.robots.length
    ? scan.metadata.robots.map((m) => `${m.key}: ${m.value || '(empty)'}`).join(' · ') : 'Not declared'));
  details.append(field('Viewport', scan.metadata.viewport || 'Not declared'));
  hero.append(details);
  parent.append(hero);

  const jumpTitle = make('div', 'list-heading module-heading');
  jumpTitle.append(make('h3', '', 'Explore this page'));
  parent.append(jumpTitle);
  const destinations: Array<{ section: Section; label: string; amount: number; icon: IconName; note?: string }> = [
    { section: 'headings', label: 'Headings', amount: scan.counts.headings, icon: 'headings' },
    { section: 'images', label: 'Images', amount: scan.counts.images, icon: 'images' },
    { section: 'links', label: 'Links', amount: scan.counts.internal + scan.counts.external, icon: 'links', note: 'Internal & external' },
    { section: 'structured', label: 'Structured Data', amount: scan.counts.jsonLd, icon: 'structured' },
  ];
  const grid = make('div', 'module-grid');
  for (const item of destinations) {
    const tile = button('', () => changeTab(item.section), {
      className: 'module-tile', title: `Inspect ${item.label}`,
    });
    tile.setAttribute('aria-label', `Inspect ${item.label}, ${item.amount} found`);
    const meta = make('div', 'tile-meta');
    const leading = make('span', 'tile-icon'); leading.append(icon(item.icon, 16));
    meta.append(leading, make('span', 'tile-label', item.label));
    const value = make('div', 'tile-value');
    value.append(make('strong', '', item.amount.toLocaleString()), icon('arrow', 15));
    tile.append(meta, value);
    if (item.note) tile.append(make('small', 'tile-note', item.note));
    grid.append(tile);
  }
  parent.append(grid);

  const headingLine = make('div', 'list-heading findings-heading');
  headingLine.append(make('h3', '', 'Issues & observations'));
  parent.append(headingLine);
  const filter = make('div', 'filter-row');
  const severity = make('select', 'select'); severity.setAttribute('aria-label', 'Filter findings by severity');
  for (const [value, label] of [
    ['issues', `Errors & warnings (${errors + warnings})`],
    ['all', `All observations (${scan.findings.length})`],
    ['error', `Errors (${errors})`],
    ['warning', `Warnings (${warnings})`],
    ['info', `Information (${infos})`],
  ]) {
    const option = make('option', '', label); option.value = value ?? ''; severity.append(option);
  }
  severity.value = state.severity;
  filter.append(severity); parent.append(filter);
  const list = make('div', 'list-stack findings-list'); parent.append(list);
  const update = () => {
    const items = scan.findings.filter((f) => state.severity === 'all' ||
      (state.severity === 'issues' ? f.severity !== 'info' : f.severity === state.severity));
    list.replaceChildren();
    if (!items.length) {
      list.append(empty(state.severity === 'issues' ? 'No issues detected' : 'No matching observations',
        state.severity === 'issues'
          ? 'No errors or warnings were found by these checks. Information items remain available in the filter.'
          : 'No observations match this filter.'));
      return;
    }
    for (const finding of items) list.append(findingCard(finding, scan));
  };
  severity.addEventListener('change', () => { state.severity = severity.value as FindingFilter; update(); });
  update();
  parent.append(make('p', 'fine-print', 'Evidence-based observations, not an SEO or accessibility score.'));
}

function findingCard(finding: Finding, scan: ScanResult): HTMLElement {
  const el = card(`finding finding-${finding.severity}`);
  const head = make('div', 'item-head');
  const left = make('div', 'item-head-main');
  left.append(pill(finding.severity.toUpperCase(), finding.severity), make('strong', 'item-title', finding.title));
  head.append(left);
  const right = make('div', 'item-actions');
  if (finding.locator && ['headings', 'images', 'links'].includes(finding.section)) {
    right.append(locateButton(finding.locator, finding.title));
  }
  // Invalid and special anchors have no visible Links list by design.
  const linked = finding.section === 'links' && finding.locator
    ? scan.links.find((link) => link.locator === finding.locator) : null;
  const navigable = finding.section !== 'overview' &&
    (!linked || linked.kind === 'internal' || linked.kind === 'external') &&
    !(finding.section === 'links' && !linked && !!finding.locator);
  if (navigable) {
    const canFocus = !!finding.locator && ['headings', 'images', 'links', 'structured'].includes(finding.section);
    const label = canFocus ? 'View item' : 'View section';
    right.append(button(label, () => changeTab(finding.section, canFocus ? finding.locator ?? undefined : undefined), {
      className: 'text-button', title: `Go to related ${finding.section} ${canFocus ? 'item' : 'section'}`,
    }));
  }
  head.append(right);
  el.append(head, make('p', 'item-description', finding.description));
  const details = make('details', 'finding-details');
  details.append(make('summary', '', 'Evidence'), make('div', 'evidence', finding.actual));
  const technical = technicalLocation(finding.locator);
  if (technical) details.append(technical);
  el.append(details);
  return el;
}
function tagStatus(tags: { value: string }[]): HTMLElement[] {
  if (!tags.length) return [pill('Missing', 'warning')];
  const badges = [pill(tags[0]?.value?.trim() ? 'Present' : 'Empty', tags[0]?.value?.trim() ? 'success' : 'warning')];
  if (tags.length > 1) badges.push(pill(`${tags.length} duplicates`, 'warning'));
  return badges;
}
function metadataGroup(parent: HTMLElement, title: string, entries: Array<{ key: string; value: string; locator: string }>): void {
  const section = make('details', 'accordion');
  const summary = make('summary', 'accordion-summary');
  summary.append(make('span', '', title), pill(`${entries.length}`));
  section.append(summary);
  const body = make('div', 'accordion-body');
  if (!entries.length) body.append(empty(`No ${title}`, 'No declarations were found.'));
  else for (const entry of entries) body.append(field(entry.key || '(unnamed)', entry.value || '(empty)'));
  section.append(body); parent.append(section);
}
function duplicateDetails(parent: HTMLElement, label: string, rows: Array<{ value: string; locator: string }>): void {
  if (rows.length < 2) return;
  const details = make('details', 'settings-panel duplicates-panel');
  details.append(make('summary', '', `Review all ${rows.length} ${label} declarations`));
  const content = make('div', 'settings-content');
  for (const [index, row] of rows.entries()) {
    content.append(field(`${label} #${index + 1}`, row.value || '(empty)', { locator: row.locator }));
  }
  details.append(content); parent.append(details);
}
function renderMetadata(parent: HTMLElement, scan: ScanResult): void {
  const m = scan.metadata;
  parent.append(heading('Metadata', 'Key declarations, with optional details below.'));
  const main = card('data-table');
  const titleBadges = tagStatus(m.titleTags);
  main.append(field('Title', m.title || '(empty)', { badges: titleBadges, locator: m.titleTags[0]?.locator }));
  main.append(field('Title length', `${Array.from(m.title).length} characters`));
  main.append(field('Meta description', m.description || '(empty)', { badges: tagStatus(m.descriptions), locator: m.descriptions[0]?.locator }));
  main.append(field('Description length', `${Array.from(m.description).length} characters`));
  main.append(field('Canonical', m.canonical || '(empty)', { mono: true, badges: tagStatus(m.canonicals), locator: m.canonicals[0]?.locator }));
  main.append(field('Viewport', m.viewport || '(empty)', { badges: tagStatus(m.viewports), locator: m.viewports[0]?.locator }));
  parent.append(main);
  duplicateDetails(parent, 'title', m.titleTags);
  duplicateDetails(parent, 'description', m.descriptions);
  duplicateDetails(parent, 'canonical', m.canonicals);
  duplicateDetails(parent, 'viewport', m.viewports);
  const settings = make('details', 'settings-panel');
  settings.append(make('summary', '', 'Length heuristics · configurable'));
  const options = make('div', 'settings-content');
  const enabledLabel = make('label', 'checkbox-label');
  const enabled = make('input'); enabled.type = 'checkbox'; enabled.checked = state.heuristics.enabled;
  enabledLabel.append(enabled, document.createTextNode('Show editorial length observations'));
  options.append(enabledLabel);
  const settingsFields = make('div', 'heuristic-fields');
  const numeric: Array<[keyof Heuristics, string]> = [['titleMin', 'Title min'], ['titleMax', 'Title max'], ['descriptionMin', 'Description min'], ['descriptionMax', 'Description max']];
  const inputs = new Map<keyof Heuristics, HTMLInputElement>();
  for (const [key, label] of numeric) {
    const wrap = make('label', 'number-field', label);
    const input = make('input'); input.type = 'number'; input.min = '0'; input.max = '500'; input.step = '1';
    input.value = String(state.heuristics[key]); wrap.append(input); inputs.set(key, input); settingsFields.append(wrap);
  }
  options.append(settingsFields, make('p', 'fine-print', 'Character counts are editorial heuristics, not fixed SEO rules. Changes recompute findings locally.'));
  options.append(button('Apply preferences', () => {
    const values = numeric.map(([key]) => Number(inputs.get(key)?.value));
    if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= 500) || (values[0] ?? 0) > (values[1] ?? 0) || (values[2] ?? 0) > (values[3] ?? 0)) {
      notify('Enter whole numbers from 0 to 500 with minimum ≤ maximum.', true); return;
    }
    state.heuristics = {
      enabled: enabled.checked, titleMin: values[0] ?? 30, titleMax: values[1] ?? 65,
      descriptionMin: values[2] ?? 70, descriptionMax: values[3] ?? 165,
    };
    try { localStorage.setItem('pagelens-heuristics', JSON.stringify(state.heuristics)); } catch { /* session only */ }
    if (state.scan) state.scan.findings = evaluateRules(state.scan, state.heuristics);
    notify('Length preferences applied.'); render();
  }, { className: 'btn btn-secondary' }));
  settings.append(options); parent.append(settings);
  metadataGroup(parent, 'Robots directives', m.robots);
  metadataGroup(parent, 'Open Graph', m.openGraph);
  metadataGroup(parent, 'Twitter/X cards', m.twitter);
  metadataGroup(parent, 'Hreflang', m.hreflang.map((h) => ({ key: h.language, value: h.value, locator: h.locator })));
}
function makeSearch(placeholder: string, action: (value: string) => void): HTMLElement {
  const wrapper = make('label', 'search-box'); wrapper.append(icon('search'));
  const input = make('input'); input.type = 'search'; input.placeholder = placeholder; input.value = state.search;
  input.setAttribute('aria-label', placeholder); input.autocomplete = 'off';
  input.addEventListener('input', () => { state.search = input.value; action(input.value); });
  wrapper.append(input); return wrapper;
}
function filterSelect(label: string, values: Array<[string, string]>, current: string, change: (value: string) => void): HTMLElement {
  const el = make('select', 'select'); el.setAttribute('aria-label', label);
  for (const [value, display] of values) { const opt = make('option', '', display); opt.value = value; el.append(opt); }
  el.value = current; el.addEventListener('change', () => change(el.value)); return el;
}
function sectionHeader(title: string, subtitle: string, action: HTMLButtonElement): HTMLElement {
  const row = make('div', 'section-title-row');
  row.append(heading(title, subtitle), action);
  return row;
}
function renderHeadings(parent: HTMLElement, scan: ScanResult): void {
  const visibleHeadings = () => scan.headings.filter((h) =>
    `${h.text} h${h.level}`.toLowerCase().includes(state.search.toLowerCase().trim()));
  const copyButton = button('Copy', () => void copyText(formatHeadingsForCopy(visibleHeadings())), {
    icon: 'copy', className: 'btn btn-secondary inline-action', title: 'Copy the filtered heading hierarchy',
  });
  parent.append(sectionHeader(`Headings · ${scan.counts.headings}`, 'Document order. Select the target to highlight an element.', copyButton));
  parent.append(makeSearch('Search heading text…', () => update()));
  const list = make('div', 'list-stack'); parent.append(list);
  function update(): void {
    list.replaceChildren();
    const items = visibleHeadings();
    copyButton.disabled = items.length === 0;
    if (!items.length) { list.append(empty('No matching headings', 'Try a different search or inspect another webpage.')); return; }
    for (const h of items) {
      const el = card('heading-card');
      el.dataset.locator = h.locator; el.tabIndex = -1;
      el.style.paddingLeft = `${12 + Math.min(h.level - 1, 5) * 8}px`;
      const left = make('div', 'item-head-main');
      left.append(pill(`H${h.level}`, h.level === 1 ? 'info' : 'neutral'), make('span', 'heading-text', h.text || '(empty heading)'));
      if (!h.text) left.append(pill('Empty', 'warning'));
      if (h.skippedLevels.length) left.append(pill(`Skipped H${h.skippedLevels.join(', H')}`, 'warning'));
      const row = make('div', 'item-head'); row.append(left, locateButton(h.locator, `H${h.level} heading`));
      el.append(row); list.append(el);
    }
  }
  update();
}
function renderImages(parent: HTMLElement, scan: ScanResult): void {
  const visibleImages = () => scan.images.filter((img) =>
    (state.imageFilter === 'all' || img.altStatus === state.imageFilter) &&
    `${img.alt ?? ''} ${img.src} ${img.source} ${img.lazySrc}`.toLowerCase().includes(state.search.trim().toLowerCase()));
  const exportButton = button('Export CSV', () => download(imagesCsv(scan, visibleImages()), 'csv', 'images'), {
    icon: 'download', className: 'btn btn-secondary inline-action', title: 'Export filtered images to CSV',
  });
  parent.append(sectionHeader(`Images · ${scan.counts.images}`, 'Inspect alt text, source and image dimensions.', exportButton));
  const toolbar = make('div', 'toolbar');
  toolbar.append(filterSelect('Filter by alt status', [['all', 'All alt statuses'], ['missing', 'Alt missing'], ['empty', 'Alt empty'], ['present', 'Alt present']], state.imageFilter,
    (value) => { state.imageFilter = value as typeof state.imageFilter; visibleLimit = 250; update(); }));
  parent.append(toolbar, makeSearch('Search source or alt text…', () => { visibleLimit = 250; update(); }));
  parent.append(make('p', 'fine-print', 'Empty alt text may be appropriate for decorative images.'));
  const list = make('div', 'list-stack'); parent.append(list);
  let visibleLimit = 250;
  function update(): void {
    list.replaceChildren();
    const items = visibleImages();
    exportButton.disabled = items.length === 0;
    if (!items.length) { list.append(empty('No matching images', 'Change the alt filter or the search text.')); return; }
    const visible = items.slice(0, visibleLimit);
    for (const image of visible) list.append(imageCard(image));
    if (items.length > visible.length) list.append(button(`Show more (${visible.length} of ${items.length})`, () => { visibleLimit += 250; update(); }, { className: 'btn btn-secondary' }));
  }
  update();
}
function imageCard(image: InspectedImage): HTMLElement {
  const el = card(); el.dataset.locator = image.locator; el.tabIndex = -1;
  const top = make('div', 'item-head'); const head = make('div', 'item-head-main');
  head.append(make('strong', 'item-title', `Image ${image.id + 1}`));
  head.append(pill(`Alt ${image.altStatus}`, image.altStatus === 'missing' ? 'warning' : image.altStatus === 'empty' ? 'info' : 'success'));
  if (image.sourceStatus !== 'present') head.append(pill(image.sourceStatus === 'lazy-candidate' ? 'Lazy candidate' : image.sourceStatus, 'neutral'));
  top.append(head, locateButton(image.locator, `image ${image.id + 1}`)); el.append(top);
  const details = make('div', 'compact-details');
  details.append(field('Alt', image.alt === null ? '(attribute missing)' : image.alt === '' ? '(empty attribute)' : truncate(image.alt)));
  details.append(field('Source', truncate(image.source || image.src || image.lazySrc || '(unavailable)', 350), { mono: true }));
  details.append(field('Dimensions', `${image.naturalWidth ?? image.width ?? '?'} × ${image.naturalHeight ?? image.height ?? '?'} px · ${image.loading || 'auto'} loading`));
  if (image.srcset) { const more = make('details', 'technical-location'); more.append(make('summary', '', 'Source candidates'), make('div', 'selector mono', image.srcset)); details.append(more); }
  el.append(details);
  return el;
}
function renderLinks(parent: HTMLElement, scan: ScanResult): void {
  const visibleLinks = () => scan.links.filter((link) => link.kind === state.linkFilter &&
    `${link.text} ${link.accessibleName} ${link.href} ${link.url}`.toLowerCase().includes(state.search.trim().toLowerCase()));
  const exportButton = button('Export CSV', () => download(linksCsv(scan, visibleLinks()), 'csv', `${state.linkFilter}-links`), {
    icon: 'download', className: 'btn btn-secondary inline-action', title: 'Export selected link type to CSV',
  });
  parent.append(sectionHeader(`Links · ${scan.counts.internal + scan.counts.external}`, 'Internal and external destinations. No HTTP validation.', exportButton));
  const switcher = make('div', 'link-switcher');
  switcher.setAttribute('role', 'tablist'); switcher.setAttribute('aria-label', 'Link type');
  const choices: Array<{ value: 'internal' | 'external'; label: string; count: number }> = [
    { value: 'internal', label: 'Internal Links', count: scan.counts.internal },
    { value: 'external', label: 'External Links', count: scan.counts.external },
  ];
  const tabButtons = choices.map(({ value, label, count }, index) => {
    const tab = button('', () => activate(value), { className: 'link-kind-tab', title: label });
    tab.append(make('span', '', label), make('span', 'link-kind-count', String(count)));
    tab.id = `links-${value}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-label', label);
    tab.setAttribute('aria-controls', 'links-results');
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
      const choice = choices[next]; if (choice) { activate(choice.value); tabButtons[next]?.focus(); }
    });
    switcher.append(tab);
    return tab;
  });
  function activate(value: 'internal' | 'external'): void {
    state.linkFilter = value;
    visibleLimit = 300;
    for (const [index, tab] of tabButtons.entries()) {
      const active = choices[index]?.value === value;
      tab.classList.toggle('link-kind-tab-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    list.setAttribute('aria-labelledby', `links-${value}`);
    update();
  }
  parent.append(switcher, makeSearch('Search anchor text or URL…', () => { visibleLimit = 300; update(); }));
  const list = make('div', 'list-stack'); list.id = 'links-results'; list.setAttribute('role', 'tabpanel'); parent.append(list);
  let visibleLimit = 300;
  function update(): void {
    list.replaceChildren();
    const items = visibleLinks();
    exportButton.disabled = items.length === 0;
    if (!items.length) { list.append(empty(`No ${state.linkFilter} links found`, 'Try a different search or switch link type.')); return; }
    const visible = items.slice(0, visibleLimit);
    for (const link of visible) list.append(linkCard(link));
    if (items.length > visible.length) list.append(button(`Show more (${visible.length} of ${items.length})`, () => { visibleLimit += 300; update(); }, { className: 'btn btn-secondary' }));
  }
  activate(state.linkFilter);
}
function linkCard(link: InspectedLink): HTMLElement {
  const el = card(); el.dataset.locator = link.locator; el.tabIndex = -1;
  const top = make('div', 'item-head'); const left = make('div', 'item-head-main');
  left.append(make('strong', 'item-title', truncate(link.accessibleName || link.text || '(unnamed link)', 95)));
  if (!link.hasAccessibleName) left.append(pill('Name?', 'warning'));
  top.append(left, locateButton(link.locator, 'link')); el.append(top);
  el.append(make('p', 'source-url mono', truncate(link.url || link.href || '(no href)', 350)));
  if (link.target || link.rel) el.append(make('p', 'fine-print', `${link.target ? `Target: ${link.target}` : ''}${link.target && link.rel ? ' · ' : ''}${link.rel ? `Rel: ${link.rel}` : ''}`));
  return el;
}
function renderStructured(parent: HTMLElement, scan: ScanResult): void {
  parent.append(heading(`Structured data · ${scan.counts.jsonLd}`, 'JSON-LD syntax and types. Rich Results eligibility is not checked.'));
  const list = make('div', 'list-stack'); parent.append(list);
  if (!scan.jsonLd.length) { list.append(empty('No JSON-LD blocks detected', 'The absence of JSON-LD does not, by itself, constitute an SEO issue.')); return; }
  for (const block of scan.jsonLd) {
    const el = card('jsonld-card'); el.dataset.locator = block.locator; el.tabIndex = -1; const top = make('div', 'item-head'); const left = make('div', 'item-head-main');
    left.append(make('strong', 'item-title', `JSON-LD block ${block.id + 1}`), pill(block.tooLarge ? 'Skipped (size)' : block.valid ? 'Valid JSON' : 'Invalid JSON', block.tooLarge ? 'info' : block.valid ? 'success' : 'warning'));
    top.append(left, button('Copy JSON', () => void copyText(block.formatted || block.source), { icon: 'copy', className: 'text-button' })); el.append(top);
    if (block.types.length) {
      const types = make('div', 'type-list'); for (const type of block.types) types.append(pill(type, 'info')); el.append(types);
    } else el.append(make('p', 'fine-print', 'No @type values detected.'));
    if (!block.valid) el.append(make('p', 'error-text', block.error));
    const details = make('details', 'json-details');
    details.append(make('summary', '', 'View formatted/source JSON'));
    const code = make('pre', 'json-code'); code.textContent = block.formatted || block.source;
    details.append(code); el.append(details); list.append(el);
  }
}
render();
void consumeToolbarScan();
