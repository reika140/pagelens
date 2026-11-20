/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import { DEFAULT_HEURISTICS } from '../core/types.js';
import type { Finding, Heuristics, InspectedImage, InspectedLink, ScanResult, Section, Severity } from '../core/types.js';
import { normalizeSnapshot } from '../core/normalize.js';
import { evaluateRules } from '../core/rules.js';
import { formatHeadingsForCopy, imagesCsv, linksCsv } from '../core/export.js';
import { currentActiveTab, isSupportedPage, readableError, scanTab } from '../extension/locate.js';
import { isGoogleFirstResultsPage, updateOrganicRankings, ORGANIC_RANKING_PREF } from '../extension/organic-rank.js';
import type { OrganicRankingResult } from '../extension/organic-rank.js';
import { LINK_HIGHLIGHT_PREF } from '../extension/link-highlighter.js';
import { imageFilename, safeImagePreviewSource } from '../core/normalize.js';
import { checkHttpLinks, httpStatusCategory } from '../extension/http-status.js';
import { collectHttpTargets, runHttpCheckQueue, HTTP_MAX_URLS } from '../extension/http-queue.js';
import type { HttpCheckResult } from '../extension/http-status.js';

import '../extension/browser-api.js';

type Theme = 'sepia' | 'dark';
type FindingFilter = 'issues' | 'all' | Severity;
type IconName = 'overview' | 'metadata' | 'headings' | 'images' | 'links' | 'structured' | 'refresh' | 'moon' | 'sun' | 'copy' | 'download' | 'alert' | 'search' | 'check' | 'arrow' | 'back' | 'settings';
const tabs: Array<{ section: Section; label: string; icon: IconName }> = [
  { section: 'metadata', label: 'Metadata', icon: 'metadata' },
  { section: 'headings', label: 'Headings', icon: 'headings' },
  { section: 'images', label: 'Images', icon: 'images' },
  { section: 'links', label: 'Links', icon: 'links' },
  { section: 'structured', label: 'JSON-LD', icon: 'structured' },
  { section: 'settings', label: 'Settings', icon: 'settings' },
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
  copy: ['M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3', 'M10 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 17v4h16v-4'],
  alert: ['M12 2 2 20h20L12 2z', 'M12 9v4', 'M12 17h.01'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.5-4.5'],
  check: ['m4 12 5 5L20 6'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  back: ['M19 12H5', 'm11 18-6-6 6-6'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z','M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 2-.06-.06A1.7 1.7 0 0 0 15.85 18a1.7 1.7 0 0 0-1.52 1.09L14.3 20h-4.6l-.03-.91A1.7 1.7 0 0 0 8.15 18a1.7 1.7 0 0 0-1.9.88l-.06.06-2-2 .06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.07-1.53L2.6 13.4v-2.8l.93-.06A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l2-2 .06.06A1.7 1.7 0 0 0 8.15 6a1.7 1.7 0 0 0 1.52-1.09L9.7 4h4.6l.03.91A1.7 1.7 0 0 0 15.85 6a1.7 1.7 0 0 0 1.9-.88l.06-.06 2 2-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.07 1.53l.93.07v2.8l-.93.07A1.7 1.7 0 0 0 19.4 15z'],
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
  organicRanking: OrganicRankingResult | null; organicBusy: boolean; organicEnabled: boolean;
  linkEnabled: boolean; linkBusy: boolean;
  httpBusy: boolean; httpStopRequested: boolean; httpStopped: boolean; httpError: string;
  httpChecks: Map<string, HttpCheckResult>;
} = {
  scan: null, loading: false, error: null, tabId: null,
  section: 'metadata', search: '', severity: 'issues',
  imageFilter: 'all', linkFilter: 'internal', theme: getSavedTheme(), heuristics: getSavedHeuristics(),
  organicRanking: null, organicBusy: false, organicEnabled: true,
  linkEnabled: false, linkBusy: false,
  httpBusy: false, httpStopRequested: false, httpStopped: false, httpError: '',
  httpChecks: new Map(),
};
let serial = 0;
let notificationTimer: number | undefined;
let httpProgressSubscriber: (() => void) | null = null;
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
  try { await navigator.clipboard.writeText(text); notify('Copied.'); }
  catch { notify('Could not copy. Check clipboard access and try again.', true); }
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
    notify(`${extension.toUpperCase()} download started.`);
  } catch { notify('Could not start the download. Please try again.', true); }
}
// Preserve a user's search and reading position when switching inspectors.
const sectionSearches: Record<Section, string> = {
  overview: '', metadata: '', headings: '', images: '', links: '', structured: '', settings: '',
};
const sectionScroll: Record<Section, number> = {
  overview: 0, metadata: 0, headings: 0, images: 0, links: 0, structured: 0, settings: 0,
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
/** Scan the tab after Chrome opens this toolbar popup and grants activeTab. */
async function refresh(): Promise<void> {
  const request = ++serial;
  state.scan = null; state.error = null; state.loading = true; state.organicRanking = null;
  state.httpStopRequested = true;
  state.httpChecks.clear(); state.httpBusy = false; state.httpStopped = false; state.httpError = '';
  render();
  try {
    // The user preference is global across popup sessions and Google tabs.
    const [stored, linkSetting] = await Promise.all([
      chrome.storage.local.get(ORGANIC_RANKING_PREF),
      chrome.storage.local.get(LINK_HIGHLIGHT_PREF),
    ]);
    if (request !== serial) return;
    state.organicEnabled = stored[ORGANIC_RANKING_PREF] !== false;
    if (!state.linkBusy) state.linkEnabled = linkSetting[LINK_HIGHLIGHT_PREF] === true;
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
    // activeTab is granted by the toolbar click. Reuse that temporary access
    // instead of requesting persistent site-wide permission.
    if (state.linkEnabled) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id }, files: ['js/extension/link-highlight-content.js'],
        });
      } catch { /* Inspection remains usable on restricted/managed pages. */ }
      if (request !== serial) return;
    }
    if (isGoogleFirstResultsPage(raw.url)) {
      try {
        // The page's Google-only content script manages the automatic badges.
        // The popup reads status, but never initiates numbering merely by opening.
        const ranking = await updateOrganicRankings(tab.id, 'status');
        if (request !== serial) return;
        state.organicRanking = ranking;
      } catch {
        state.organicRanking = { eligible: true, active: false, count: 0, reason: 'no-organic-results' };
      }
    }
  } catch (error) {
    if (request === serial) state.error = readableError(error);
  } finally {
    if (request === serial) { state.loading = false; render(); }
  }
}

// The action popup is opened by a trusted toolbar click. Chrome grants
// activeTab for that tab; a fresh popup always performs a fresh scan.
// No background scan cache, Side Panel message handoff or broad site access.

function render(): void {
  if (state.section !== 'links') httpProgressSubscriber = null;
  // Preserve the reading position when switching inspectors or changing themes.
  const previousView = app.querySelector<HTMLElement>('#view');
  if (previousView?.dataset.section === state.section) {
    sectionScroll[state.section] = previousView.scrollTop;
  }
  document.documentElement.dataset.theme = state.theme;
  app.replaceChildren();

  // A persistent icon rail replaces the previous large inspector dropdown.
  // It is a navigation landmark: the active destination is exposed via aria-current.
  const rail = make('nav', 'inspector-rail');
  rail.setAttribute('aria-label', 'Inspector navigation');
  const railLogo = make('div', 'rail-logo');
  railLogo.setAttribute('title', 'PageLens');
  railLogo.setAttribute('aria-label', 'PageLens');
  railLogo.append(icon('search', 21));
  rail.append(railLogo);
  const railItems = make('div', 'rail-items');
  for (const entry of tabs) {
    const destination = entry.label === 'JSON-LD' ? 'Structured data' : entry.label;
    const navButton = button('', () => {
      changeTab(entry.section);
      app.querySelector<HTMLButtonElement>(`.rail-button[data-section="${entry.section}"]`)?.focus({ preventScroll: true });
    }, {
      icon: entry.icon,
      className: 'rail-button',
      title: destination,
      disabled: !state.scan && entry.section !== 'settings',
    });
    navButton.dataset.section = entry.section;
    navButton.setAttribute('aria-label', destination);
    if (state.section === entry.section) {
      navButton.classList.add('rail-button-active');
      navButton.setAttribute('aria-current', 'page');
    }
    if (entry.section === 'settings') navButton.classList.add('settings-nav-button');
    railItems.append(navButton);
  }
  rail.append(railItems);
  // Arrow navigation is a convenience, not a requirement to use the normal Tab key.
  rail.addEventListener('keydown', (event) => {
    const key = event.key;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    const current = event.target;
    if (!(current instanceof HTMLButtonElement) || !current.classList.contains('rail-button')) return;
    const available = Array.from(railItems.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = available.indexOf(current);
    if (index < 0 || !available.length) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? available.length - 1 :
      (index + (key === 'ArrowDown' ? 1 : -1) + available.length) % available.length;
    available[next]?.focus();
  });

  const shell = make('div', 'content-shell');
  const top = make('header', 'app-header');
  const brand = make('div', 'brand');
  const brandCopy = make('div', 'brand-copy');
  brandCopy.append(make('h1', '', 'PageLens'));
  const siteLabel = state.scan ? domain(state.scan.url) : state.loading ? 'Scanning page…' : 'No page selected';
  brandCopy.append(make('p', 'brand-domain', siteLabel));
  brand.append(brandCopy);
  const topActions = make('div', 'header-actions');
  // Refresh reuses the grant given when the user clicked the popup action.
  if (state.scan && !state.loading) {
    topActions.append(button('', () => void refresh(), { icon: 'refresh', className: 'icon-btn refresh-btn', title: 'Scan page again' }));
  }
  top.append(brand, topActions);

  const main = make('main', 'main-content');
  main.id = 'view';
  main.dataset.section = state.section;
  main.setAttribute('aria-label', tabs.find((entry) => entry.section === state.section)?.label ?? 'Page inspector');
  if (state.loading) main.append(renderLoading());
  else if (state.section === 'settings') renderSettings(main);
  else if (state.error) main.append(renderActivationHint(state.error));
  else if (!state.scan) main.append(renderActivationHint());
  else {
    const scan = state.scan;
    switch (state.section) {
      case 'overview': renderMetadata(main, scan); break;
      case 'metadata': renderMetadata(main, scan); break;
      case 'headings': renderHeadings(main, scan); break;
      case 'images': renderImages(main, scan); break;
      case 'links': renderLinks(main, scan); break;
      case 'structured': renderStructured(main, scan); break;
    }
  }
  shell.append(top, main);
  app.append(rail, shell);
  main.scrollTop = sectionScroll[state.section];
}
function renderLoading(): HTMLElement {
  const wrap = make('div', 'center-state');
  wrap.append(make('div', 'spinner'), make('h2', '', 'Scanning page'), make('p', '', 'Reading metadata and page elements locally.'));
  return wrap;
}
/** Focus-aware popup states without ineffective buttons or permission prompts. */
function renderActivationHint(error?: string): HTMLElement {
  const unsupported = !!error && /HTTP\(S\)|Chrome internal|extension pages|Web Store|not supported/i.test(error);
  const wrap = make('div', 'activation-hint');
  wrap.setAttribute('role', 'status');
  if (unsupported) {
    wrap.append(
      make('p', 'activation-primary', 'This page cannot be inspected.'),
      make('p', 'activation-secondary', 'Open an HTTP(S) website, then click PageLens.'),
    );
  } else {
    wrap.append(
      make('p', 'activation-primary', error ? 'Unable to inspect this page.' : 'No page selected.'),
      make('p', 'activation-secondary', error ? 'Check site access in Chrome, then reopen PageLens.' : 'Open an HTTP(S) website, then click PageLens.'),
    );
  }
  return wrap;
}
function technicalLocation(locator: string | null): HTMLElement | null {
  if (!locator) return null;
  const details = make('details', 'technical-location');
  details.append(make('summary', '', 'Element location'), make('code', 'selector mono', locator));
  return details;
}
/** Global on/off switch: numbering runs on matching Google pages without opening PageLens. */
function renderGoogleOrganicRankings(): HTMLElement {
  const wrap = make('section', 'serp-tool');
  const labels = make('div', 'serp-tool-copy');
  labels.append(make('p', 'serp-tool-label', 'Organic result numbering'));
  const status = state.organicRanking;
  const text = !state.organicEnabled
    ? 'Organic numbering is off.'
    : status?.active
      ? `${status.count} organic ${status.count === 1 ? 'result' : 'results'} numbered on this page.`
      : 'Automatically number organic results on the first page of Google Web results.';
  labels.append(make('p', 'serp-tool-description', text));
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = `serp-switch${state.organicEnabled ? ' serp-switch-on' : ''}`;
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', 'Organic result numbering');
  toggle.setAttribute('aria-checked', String(state.organicEnabled));
  toggle.title = state.organicEnabled ? 'Turn off organic result numbering' : 'Turn on organic result numbering';
  toggle.disabled = state.organicBusy || state.loading;
  toggle.append(make('span', 'serp-switch-thumb'));
  const caption = make('span', 'serp-switch-state', state.organicEnabled ? 'On' : 'Off');
  const control = make('div', 'serp-switch-wrap');
  control.append(toggle, caption);
  toggle.addEventListener('click', () => void toggleGoogleRankings());
  wrap.append(labels, control);
  if (state.organicEnabled && status?.reason === 'no-organic-results' && state.scan && isGoogleFirstResultsPage(state.scan.url)) {
    wrap.append(make('p', 'serp-tool-hint', 'Organic results could not be identified reliably on this page.'));
  }
  return wrap;
}
async function toggleGoogleRankings(): Promise<void> {
  if (state.organicBusy) return;
  const previous = state.organicEnabled;
  const next = !previous;
  state.organicBusy = true;
  render();
  try {
    await chrome.storage.local.set({ [ORGANIC_RANKING_PREF]: next });
    state.organicEnabled = next;
    // Persisting the setting notifies every eligible open Google content script.
    if (state.tabId !== null && state.scan && isGoogleFirstResultsPage(state.scan.url)) {
      try { state.organicRanking = await updateOrganicRankings(state.tabId, next ? 'show' : 'hide'); }
      catch { state.organicRanking = null; } // Future Google tabs still honor the saved choice.
    } else state.organicRanking = null;
    notify(next ? 'Organic numbering turned on.' : 'Organic numbering turned off.');
  } catch {
    state.organicEnabled = previous;
    notify('Could not save the organic numbering setting.', true);
  } finally {
    state.organicBusy = false;
    render();
  }
}

function findingCard(finding: Finding, scan: ScanResult): HTMLElement {
  const el = card(`finding finding-${finding.severity}`);
  const head = make('div', 'item-head');
  const left = make('div', 'item-head-main');
  left.append(pill(finding.severity.toUpperCase(), finding.severity), make('strong', 'item-title', finding.title));
  head.append(left);
  const right = make('div', 'item-actions');
  // Invalid and special anchors have no visible Links list by design.
  const linked = finding.section === 'links' && finding.locator
    ? scan.links.find((link) => link.locator === finding.locator) : null;
  const navigable = finding.section !== 'overview' &&
    (!linked || linked.kind === 'internal' || linked.kind === 'external') &&
    !(finding.section === 'links' && !linked && !!finding.locator);
  if (navigable) {
    const canFocus = !!finding.locator && ['headings', 'images', 'links', 'structured'].includes(finding.section);
    const label = canFocus ? 'View item' : 'Open section';
    right.append(button(label, () => changeTab(finding.section === 'overview' ? 'metadata' : finding.section, canFocus ? finding.locator ?? undefined : undefined), {
      className: 'text-button', title: `Open related ${finding.section} ${canFocus ? 'item' : 'section'}`,
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
  if (!tags.length) return [pill('Not found', 'warning')];
  const badges = [pill(tags[0]?.value?.trim() ? 'Present' : 'Empty', tags[0]?.value?.trim() ? 'success' : 'warning')];
  if (tags.length > 1) badges.push(pill(`${tags.length} tags`, 'warning'));
  return badges;
}
function metadataGroup(parent: HTMLElement, title: string, entries: Array<{ key: string; value: string; locator: string }>): void {
  const section = make('details', 'accordion');
  const summary = make('summary', 'accordion-summary');
  summary.append(make('span', '', title), pill(`${entries.length}`));
  section.append(summary);
  const body = make('div', 'accordion-body');
  if (!entries.length) body.append(make('p', 'fine-print', 'No declarations found.'));
  else for (const entry of entries) body.append(field(entry.key || '(unnamed)', entry.value || '(empty)'));
  section.append(body); parent.append(section);
}
function duplicateDetails(parent: HTMLElement, label: string, rows: Array<{ value: string; locator: string }>): void {
  if (rows.length < 2) return;
  const details = make('details', 'settings-panel duplicates-panel');
  details.append(make('summary', '', `${label[0]?.toUpperCase()}${label.slice(1)} declarations (${rows.length})`));
  const content = make('div', 'settings-content');
  for (const [index, row] of rows.entries()) {
    content.append(field(`${label} #${index + 1}`, row.value || '(empty)', { locator: row.locator }));
  }
  details.append(content); parent.append(details);
}

/** Only declared meta robots values are interpreted, not HTTP X-Robots-Tag headers. */
function renderRobotsSummary(entries: Array<{ key: string; value: string }>): HTMLElement {
  const all = entries.filter((entry) => ['robots', 'googlebot'].includes(entry.key.toLowerCase())).flatMap((entry) => entry.value.toLowerCase().split(/[\s,;]+/).filter(Boolean));
  const noindex = all.includes('noindex') || all.includes('none');
  const nofollow = all.includes('nofollow') || all.includes('none');
  const root = make('div', 'robots-summary');
  const status = (label: string, blocked: boolean): HTMLElement => {
    const row = make('div', 'robots-status');
    row.append(make('span', 'robots-key', label), make('strong', `robots-value ${blocked ? 'robots-blocked' : 'robots-allowed'}`, blocked ? `No${label.toLowerCase()}` : 'Not blocked'));
    return row;
  };
  root.append(status('Index', noindex), status('Follow', nofollow));
  const note = make('p', 'robots-hint', entries.length
    ? 'Based on robots/googlebot meta tags only. HTTP headers and actual indexing are not verified.'
    : 'No robots/googlebot meta directives found. HTTP headers and actual indexing are not verified.');
  root.append(note);
  return root;
}

function renderFindingsDetails(scan: ScanResult): HTMLElement {
  const issues = scan.findings.filter((f) => f.severity !== 'info');
  const details = make('details', 'observations');
  const notes = scan.findings.length - issues.length;
  const summary = make('summary', '', `Findings · ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}, ${notes} ${notes === 1 ? 'note' : 'notes'}`);
  details.append(summary);
  if (!scan.findings.length) details.append(make('p', 'fine-print', 'No findings from the enabled checks.'));
  else for (const f of scan.findings) details.append(findingCard(f, scan));
  return details;
}

/** Toggle the preference without requesting website access. On a normal page,
 * the click that opened PageLens grants activeTab for this injection only. */
async function toggleLinkHighlights(): Promise<void> {
  if (state.linkBusy) return;
  const enable = !state.linkEnabled;
  state.linkBusy = true;
  render();
  try {
    await chrome.storage.local.set({ [LINK_HIGHLIGHT_PREF]: enable });
    state.linkEnabled = enable;
    if (enable && state.scan && state.tabId !== null) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: state.tabId }, files: ['js/extension/link-highlight-content.js'],
        });
        notify('Link outlines applied to this page.');
      } catch {
        notify('Link outlines are on. Open a supported page and click PageLens.');
      }
    } else if (enable) notify('Link outlines are on. Click PageLens on a page to apply them.');
    else notify('Link outlines turned off.');
  } catch {
    notify('Could not save the link outline setting.', true);
  } finally { state.linkBusy = false; render(); }
}

function renderSettings(parent: HTMLElement): void {
  const label = make('p', 'compact-module-name', 'Settings');
  parent.append(label);
  parent.append(renderGoogleOrganicRankings());

  const wrap = make('section', 'serp-tool link-highlighter-setting');
  const copy = make('div', 'serp-tool-copy');
  copy.append(make('p', 'serp-tool-label', 'Link outlines'));
  copy.append(make('p', 'serp-tool-description', 'Outline Follow, Nofollow, and UGC links on pages you inspect.'));
  const switcher = make('button', `serp-switch${state.linkEnabled ? ' serp-switch-on' : ''}`);
  switcher.type = 'button'; switcher.setAttribute('role', 'switch');
  switcher.setAttribute('aria-label', 'Link outlines on inspected pages');
  switcher.setAttribute('aria-checked', String(state.linkEnabled));
  switcher.title = state.linkEnabled ? 'Turn off link outlines' : 'Turn on link outlines';
  switcher.disabled = state.linkBusy;
  switcher.append(make('span', 'serp-switch-thumb'));
  switcher.addEventListener('click', () => void toggleLinkHighlights());
  const control = make('div', 'serp-switch-wrap'); control.append(switcher, make('span', 'serp-switch-state', state.linkEnabled ? 'On' : 'Off'));
  wrap.append(copy, control);
  const legend = make('div', 'link-highlighter-legend');
  for (const [key, name] of [['follow', 'Follow'], ['nofollow', 'Nofollow'], ['ugc', 'UGC']] as const) {
    legend.append(make('span', `legend-item legend-${key}`, name));
  }
  wrap.append(legend);
  wrap.append(make('p', 'serp-tool-hint', 'Open PageLens on each page to apply outlines. Turning this off removes existing outlines. Sponsored links are excluded.'));
  parent.append(wrap);

  const theme = make('div', 'setting-plain-row');
  theme.append(make('span', '', 'Appearance'));
  const themeControl = button(state.theme === 'dark' ? 'Dark' : 'Light', () => {
    state.theme = state.theme === 'dark' ? 'sepia' : 'dark';
    try { localStorage.setItem('pagelens-theme', state.theme); } catch { /* session only */ }
    render();
  }, { icon: state.theme === 'dark' ? 'moon' : 'sun', className: 'btn btn-secondary inline-action' });
  theme.append(themeControl); parent.append(theme);
  const settings = make('details', 'settings-panel');
  settings.append(make('summary', '', 'Title and description length'));
  const options = make('div', 'settings-content');
  const enabledLabel = make('label', 'checkbox-label');
  const enabled = make('input'); enabled.type = 'checkbox'; enabled.checked = state.heuristics.enabled;
  enabledLabel.append(enabled, document.createTextNode('Show length notices'));
  options.append(enabledLabel);
  const settingsFields = make('div', 'heuristic-fields');
  const numeric: Array<[keyof Heuristics, string]> = [['titleMin', 'Title minimum'], ['titleMax', 'Title maximum'], ['descriptionMin', 'Description minimum'], ['descriptionMax', 'Description maximum']];
  const inputs = new Map<keyof Heuristics, HTMLInputElement>();
  for (const [key, label] of numeric) {
    const wrap = make('label', 'number-field', label);
    const input = make('input'); input.type = 'number'; input.min = '0'; input.max = '500'; input.step = '1';
    input.value = String(state.heuristics[key]); wrap.append(input); inputs.set(key, input); settingsFields.append(wrap);
  }
  options.append(settingsFields, make('p', 'fine-print', 'These ranges are writing guidance, not Google ranking requirements.'));
  options.append(button('Save length settings', () => {
    const values = numeric.map(([key]) => Number(inputs.get(key)?.value));
    if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= 500) || (values[0] ?? 0) > (values[1] ?? 0) || (values[2] ?? 0) > (values[3] ?? 0)) {
      notify('Use whole numbers from 0 to 500. Each minimum must be no greater than its maximum.', true); return;
    }
    state.heuristics = {
      enabled: enabled.checked, titleMin: values[0] ?? 30, titleMax: values[1] ?? 65,
      descriptionMin: values[2] ?? 70, descriptionMax: values[3] ?? 165,
    };
    try { localStorage.setItem('pagelens-heuristics', JSON.stringify(state.heuristics)); } catch { /* session only */ }
    if (state.scan) state.scan.findings = evaluateRules(state.scan, state.heuristics);
    notify('Length settings saved.'); render();
  }, { className: 'btn btn-secondary' }));
  settings.append(options); parent.append(settings);
 }

/** Differentiate absent metadata from explicitly empty declarations. */
function declarationValue(entries: ReadonlyArray<{ value: string }>, value: string): string {
  return entries.length === 0 ? 'Not found' : value.trim() ? value : 'Empty';
}

function renderMetadata(parent: HTMLElement, scan: ScanResult): void {
  const m = scan.metadata;
  parent.append(renderRobotsSummary(m.robots));
  const main = card('data-table');
  const titleBadges = tagStatus(m.titleTags);
  main.append(field(`Title · ${Array.from(m.title).length} chars`, declarationValue(m.titleTags, m.title), { badges: titleBadges, locator: m.titleTags[0]?.locator }));
  main.append(field(`Meta description · ${Array.from(m.description).length} chars`, declarationValue(m.descriptions, m.description), { badges: tagStatus(m.descriptions), locator: m.descriptions[0]?.locator }));
  main.append(field('Canonical', declarationValue(m.canonicals, m.canonical), { mono: true, badges: tagStatus(m.canonicals), locator: m.canonicals[0]?.locator }));
  main.append(field('Robots', m.robots.length ? m.robots.map((v) => `${v.key}: ${v.value || '(empty)'}`).join(' · ') : 'Not found'));
  main.append(field('Viewport', declarationValue(m.viewports, m.viewport), { badges: tagStatus(m.viewports), locator: m.viewports[0]?.locator }));
  parent.append(main);
  duplicateDetails(parent, 'title', m.titleTags);
  duplicateDetails(parent, 'description', m.descriptions);
  duplicateDetails(parent, 'canonical', m.canonicals);
  duplicateDetails(parent, 'viewport', m.viewports);

  metadataGroup(parent, 'Open Graph', m.openGraph);
  metadataGroup(parent, 'X (Twitter) cards', m.twitter);
  metadataGroup(parent, 'Hreflang links', m.hreflang.map((h) => ({ key: h.language, value: h.value, locator: h.locator })));
  parent.append(renderFindingsDetails(scan));
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
  row.append(make('span', 'compact-module-name', title), action);
  return row;
}
function renderHeadings(parent: HTMLElement, scan: ScanResult): void {
  const visibleHeadings = () => scan.headings.filter((h) =>
    `${h.text} h${h.level}`.toLowerCase().includes(state.search.toLowerCase().trim()));
  const copyButton = button('Copy', () => void copyText(formatHeadingsForCopy(visibleHeadings())), {
    icon: 'copy', className: 'btn btn-secondary inline-action', title: 'Copy the filtered heading hierarchy',
  });
  parent.append(sectionHeader(`Headings · ${scan.counts.headings}`, 'Document outline in reading order.', copyButton));
  parent.append(makeSearch('Search headings…', () => update()));
  const list = make('div', 'list-stack'); parent.append(list);
  function update(): void {
    list.replaceChildren();
    const items = visibleHeadings();
    copyButton.disabled = items.length === 0;
    if (!items.length) { list.append(empty(state.search.trim() ? 'No matching headings' : 'No headings found', state.search.trim() ? 'Try another search.' : 'This page has no heading elements.')); return; }
    for (const h of items) {
      const el = card('heading-card');
      el.dataset.locator = h.locator; el.tabIndex = -1;
      el.style.paddingLeft = `${12 + Math.min(h.level - 1, 5) * 8}px`;
      const left = make('div', 'item-head-main');
      left.append(pill(`H${h.level}`, h.level === 1 ? 'info' : 'neutral'), make('span', 'heading-text', h.text || '(empty heading)'));
      if (!h.text) left.append(pill('Empty', 'warning'));
      if (h.skippedLevels.length) left.append(pill(`Skipped H${h.skippedLevels.join(', H')}`, 'warning'));
      const row = make('div', 'item-head'); row.append(left);
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
  parent.append(sectionHeader(`Images · ${scan.counts.images}`, 'Alternative text, sources and dimensions.', exportButton));
  const toolbar = make('div', 'toolbar');
  toolbar.append(filterSelect('Filter by alt status', [['all', 'All images'], ['missing', 'Missing alt'], ['empty', 'Empty alt'], ['present', 'Has alt text']], state.imageFilter,
    (value) => { state.imageFilter = value as typeof state.imageFilter; visibleLimit = 250; update(); }));
  parent.append(toolbar, makeSearch('Search images or alt text…', () => { visibleLimit = 250; update(); }));
  const list = make('div', 'list-stack'); parent.append(list);
  let visibleLimit = 250;
  function update(): void {
    list.replaceChildren();
    const items = visibleImages();
    exportButton.disabled = items.length === 0;
    if (!items.length) { list.append(empty(scan.images.length ? 'No matching images' : 'No images found', scan.images.length ? 'Adjust the search or alt filter.' : 'No image elements were found on this page.')); return; }
    const visible = items.slice(0, visibleLimit);
    for (const image of visible) list.append(imageCard(image));
    if (items.length > visible.length) list.append(button(`Show more (${visible.length} of ${items.length})`, () => { visibleLimit += 250; update(); }, { className: 'btn btn-secondary' }));
  }
  update();
}
function imageCard(image: InspectedImage): HTMLElement {
  const el = card('image-row'); el.dataset.locator = image.locator; el.tabIndex = -1;
  const preview = make('div', 'image-thumbnail');
  const fallback = make('span', 'image-thumbnail-fallback');
  fallback.append(icon('images', 23));
  preview.append(fallback);
  const src = safeImagePreviewSource(image.source);
  if (src) {
    const img = document.createElement('img');
    img.className = 'image-thumbnail-img';
    img.alt = ''; // Decorative duplicate of the adjacent, accessible data.
    img.setAttribute('aria-hidden', 'true');
    img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => { fallback.hidden = true; });
    img.addEventListener('error', () => { img.remove(); fallback.hidden = false; });
    img.src = src; preview.append(img);
  }
  const info = make('div', 'image-row-info');
  // The two visible fields are the *source filename* and the original alt text.
  // Never use an alt attribute as the filename or invent "Image 1", "Image 2".
  const name = imageFilename(image.source || image.src || image.lazySrc);
  const imageName = make('div', 'image-file-name', name || (image.source.startsWith('data:') ? 'Embedded image' : 'Filename unavailable'));
  imageName.title = name || 'The image source does not contain a filename';
  const altRow = make('div', 'image-alt-line');
  altRow.append(make('span', 'image-alt-label', 'Alt text:'));
  const altText = make('span', 'image-alt-value', image.alt?.trim() ? image.alt : '');
  // Keep the value visibly empty when the attribute is blank or absent;
  // expose that distinction only to assistive technology and the existing filter.
  if (image.altStatus !== 'present') {
    altText.setAttribute('aria-label', image.altStatus === 'missing' ? 'Alt attribute missing' : 'Alt text empty');
  }
  altRow.append(altText);
  info.append(imageName, altRow);
  el.append(preview, info);
  return el;
}
function renderLinks(parent: HTMLElement, scan: ScanResult): void {
  const visibleLinks = () => scan.links.filter((link) => link.kind === state.linkFilter &&
    `${link.text} ${link.accessibleName} ${link.href} ${link.url}`.toLowerCase().includes(state.search.trim().toLowerCase()));
  const exportButton = button('Export CSV', () => download(linksCsv(scan, visibleLinks()), 'csv', `${state.linkFilter}-links`), {
    icon: 'download', className: 'btn btn-secondary inline-action', title: 'Export selected link type to CSV',
  });
  const checkButton = button('Check all', () => void checkNow(), {
    icon: 'search', className: 'btn btn-secondary inline-action',
    title: 'Check internal and external URLs. External sites may block verification.',
  });
  const headingRow = make('div', 'section-title-row link-action-row');
  const buttons = make('div', 'link-actions'); buttons.append(checkButton, exportButton);
  headingRow.append(make('span', 'compact-module-name', `Links · ${scan.counts.internal + scan.counts.external}`), buttons);
  parent.append(headingRow);
  const switcher = make('div', 'link-switcher');
  switcher.setAttribute('role', 'tablist'); switcher.setAttribute('aria-label', 'Link type');
  const choices: Array<{ value: 'internal' | 'external'; label: string; count: number }> = [
    { value: 'internal', label: 'Internal links', count: scan.counts.internal },
    { value: 'external', label: 'External links', count: scan.counts.external },
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
  parent.append(switcher, makeSearch('Search links or URLs…', () => { visibleLimit = 300; update(); }));
  const statusNote = make('p', 'http-check-note');
  statusNote.setAttribute('role', 'status'); statusNote.setAttribute('aria-live', 'polite');
  const progress = make('progress', 'http-progress');
  progress.max = 1; progress.value = 0; progress.hidden = true;
  progress.setAttribute('aria-label', 'Link check progress');
  parent.append(statusNote, progress);
  const list = make('div', 'list-stack'); list.id = 'links-results'; list.setAttribute('role', 'tabpanel'); parent.append(list);
  let visibleLimit = 300;
  // A single click covers both Internal and External tabs, not just the current filter.
  // The cap prevents unexpectedly huge pages from issuing thousands of requests.
  const selection = collectHttpTargets(scan.links, HTTP_MAX_URLS);
  const targets = selection.urls;
  const selected = new Set(targets);
  const cleanUrl = (url: string): string => collectHttpTargets([{ url }]).urls[0] ?? '';
  async function checkNow(): Promise<void> {
    if (state.scan !== scan || state.tabId === null) return;
    if (state.httpBusy) {
      state.httpStopRequested = true;
      httpProgressSubscriber?.();
      return;
    }
    const remaining = targets.filter((url) => !state.httpChecks.has(url));
    if (!remaining.length) {
      for (const url of targets) state.httpChecks.delete(url);
    }
    const pending = targets.filter((url) => !state.httpChecks.has(url));
    if (!pending.length) return;
    state.httpStopRequested = false;
    state.httpStopped = false;
    state.httpError = '';
    state.httpBusy = true;
    const tabId = state.tabId;
    httpProgressSubscriber?.();
    try {
      const outcome = await runHttpCheckQueue(
        pending,
        (batch) => checkHttpLinks(tabId, batch, scan.url),
        (results) => {
          if (state.scan !== scan) return;
          for (const item of results) if (selected.has(item.url)) state.httpChecks.set(item.url, item);
          httpProgressSubscriber?.();
        },
        () => state.httpStopRequested || state.scan !== scan,
      );
      if (state.scan === scan) state.httpStopped = outcome.stopped;
    } catch {
      if (state.scan === scan) {
        state.httpError = 'Link checking was interrupted. Resume to check the remaining URLs.';
        notify('Link check interrupted. Completed results were kept.', true);
      }
    } finally {
      if (state.scan === scan) {
        state.httpBusy = false;
        state.httpStopRequested = false;
        httpProgressSubscriber?.();
      }
    }
  }
  function update(): void {
    list.replaceChildren();
    const items = visibleLinks();
    exportButton.disabled = items.length === 0;
    const checked = targets.filter((url) => state.httpChecks.has(url)).length;
    const unknown = targets.filter((url) => state.httpChecks.has(url) && state.httpChecks.get(url)?.state !== 'verified').length;
    const errors = targets.filter((url) => {
      const result = state.httpChecks.get(url);
      return result?.state === 'verified' && result.status !== null && result.status >= 400;
    }).length;
    const remaining = targets.length - checked;
    checkButton.disabled = !targets.length || (state.httpBusy && state.httpStopRequested);
    const label = state.httpBusy ? state.httpStopRequested ? 'Stopping…' : 'Stop' :
      remaining && checked ? 'Resume check' : remaining ? 'Check all' : 'Recheck all';
    checkButton.replaceChildren(icon('search', 16), document.createTextNode(label));
    checkButton.title = state.httpBusy ? 'Stop after in-progress requests finish' :
      'Check all internal and external URLs';
    progress.hidden = !state.httpBusy && checked === 0;
    progress.max = Math.max(1, targets.length);
    progress.value = checked;
    const parts = [
      `${checked.toLocaleString()} of ${targets.length.toLocaleString()} checked`,
      ...(errors ? [`${errors} 4xx/5xx ${errors === 1 ? 'response' : 'responses'}`] : []),
      ...(unknown ? [`${unknown} not verified`] : []),
    ];
    if (state.httpBusy) parts.push(state.httpStopRequested ? 'Stopping after current requests…' : 'Keep this popup open');
    else if (state.httpStopped) parts.push('Stopped');
    if (state.httpError) parts.push(state.httpError);
    if (selection.total > targets.length) parts.push(`Safety cap: first ${targets.length.toLocaleString()} of ${selection.total.toLocaleString()} URLs`);
    if (targets.some((url) => { try { return new URL(url).origin !== new URL(scan.url).origin; } catch { return false; } })) {
      parts.push('Some external links may be blocked by CORS');
    }
    statusNote.hidden = checked === 0 && !state.httpBusy && !state.httpStopped && !state.httpError;
    statusNote.textContent = parts.join(' · ');
    if (!items.length) { list.append(empty(state.search.trim() ? `No matching ${state.linkFilter} links` : `No ${state.linkFilter} links found`, 'Try another search or switch link type.')); return; }
    const visible = items.slice(0, visibleLimit);
    for (const link of visible) list.append(linkCard(link, state.httpChecks.get(cleanUrl(link.url))));
    if (items.length > visible.length) list.append(button(`Show more (${visible.length} of ${items.length})`, () => { visibleLimit += 300; update(); }, { className: 'btn btn-secondary' }));
  }
  httpProgressSubscriber = update;
  activate(state.linkFilter);
}
function linkCard(link: InspectedLink, check?: HttpCheckResult): HTMLElement {
  const el = card(); el.dataset.locator = link.locator; el.tabIndex = -1;
  const top = make('div', 'item-head'); const left = make('div', 'item-head-main');
  left.append(make('strong', 'item-title', truncate(link.accessibleName || link.text || '(No link text)', 95)));
  if (!link.hasAccessibleName) left.append(pill('Check name', 'warning'));
  if (check) {
    const statusText = check.state === 'verified' ? `HTTP ${check.status}` :
      check.state === 'timeout' ? 'Timed out' : check.state === 'skipped' ? 'Skipped' : 'Not verified';
    const statusPill = pill(statusText, httpStatusCategory(check.status));
    statusPill.classList.add('http-status-pill');
    statusPill.title = check.state === 'verified' ?
      `${check.method} response${check.redirected ? ' (after redirects)' : ''}. HTTP status does not prove a URL is permanently broken.` : check.reason;
    left.append(statusPill);
  }
  top.append(left); el.append(top);
  const linkUrl = make('p', 'source-url', truncate(link.url || link.href || '(No href)', 240));
  linkUrl.title = link.url || link.href || '(No href)';
  el.append(linkUrl);
  if (link.target || link.rel) el.append(make('p', 'fine-print', `${link.target ? `Target: ${link.target}` : ''}${link.target && link.rel ? ' · ' : ''}${link.rel ? `Rel: ${link.rel}` : ''}`));
  return el;
}
function renderStructured(parent: HTMLElement, scan: ScanResult): void {
  parent.append(make('p', 'compact-module-name', `JSON-LD · ${scan.counts.jsonLd}`));
  const list = make('div', 'list-stack'); parent.append(list);
  if (!scan.jsonLd.length) { list.append(empty('No JSON-LD blocks found', 'This is not necessarily an SEO issue.')); return; }
  for (const block of scan.jsonLd) {
    const el = card('jsonld-card'); el.dataset.locator = block.locator; el.tabIndex = -1; const top = make('div', 'item-head'); const left = make('div', 'item-head-main');
    left.append(make('strong', 'item-title', `JSON-LD block ${block.id + 1}`), pill(block.tooLarge ? 'Too large' : block.valid ? 'Syntax valid' : 'Syntax error', block.tooLarge ? 'info' : block.valid ? 'success' : 'warning'));
    top.append(left, button('Copy JSON', () => void copyText(block.formatted || block.source), { icon: 'copy', className: 'text-button' })); el.append(top);
    if (block.types.length) {
      const types = make('div', 'type-list'); for (const type of block.types) types.append(pill(type, 'info')); el.append(types);
    } else el.append(make('p', 'fine-print', 'No @type values found.'));
    if (!block.valid) el.append(make('p', 'error-text', block.error));
    const details = make('details', 'json-details');
    details.append(make('summary', '', 'View JSON'));
    const code = make('pre', 'json-code'); code.textContent = block.formatted || block.source;
    details.append(code); el.append(details); list.append(el);
  }
}
render();
void refresh();
