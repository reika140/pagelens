/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Optional, local-only visual annotations for webpage anchor rel attributes. */
export const LINK_HIGHLIGHT_PREF = 'pagelens-link-highlighting-enabled';
export type LinkHighlightKind = 'follow' | 'nofollow' | 'ugc';

/** Explicit rel values take precedence over the default follow classification. */
export function classifyAnchorRel(rel: string): LinkHighlightKind | null {
  const tokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokens.has('ugc')) return 'ugc';
  if (tokens.has('nofollow')) return 'nofollow';
  // Sponsored has a distinct Google meaning; never mislabel it as Follow.
  if (tokens.has('sponsored')) return null;
  return 'follow';
}

export function classifyAnchorForHighlight(anchor: HTMLAnchorElement): LinkHighlightKind | null {
  const href = anchor.getAttribute('href')?.trim();
  if (!href || href.startsWith('#')) return null;
  try {
    const resolved = new URL(href, anchor.ownerDocument.baseURI);
    if (!['http:', 'https:'].includes(resolved.protocol)) return null;
    return classifyAnchorRel(anchor.getAttribute('rel') ?? '');
  } catch { return null; }
}

const STYLE_ID = 'pagelens-link-highlight-style';
const MARKER = 'data-pagelens-link-kind';
const STYLE = `
/* Reversible dashed outlines with zero layout shift; focus indicators take priority. */
a[${MARKER}="follow"] { outline: 2px dashed #398365 !important; outline-offset: 2px !important; }
a[${MARKER}="nofollow"] { outline: 2px dashed #bf5b48 !important; outline-offset: 2px !important; }
a[${MARKER}="ugc"] { outline: 2px dashed #8664b6 !important; outline-offset: 2px !important; }
a[${MARKER}]:focus-visible { outline: 2px solid currentColor !important; outline-offset: 3px !important; }
`;

export function clearLinkHighlights(doc: Document = document): void {
  doc.getElementById(STYLE_ID)?.remove();
  for (const anchor of Array.from(doc.querySelectorAll(`[${MARKER}]`))) anchor.removeAttribute(MARKER);
}

/** Safe, bounded, idempotent pass; never changes href/rel/title/text. */
export function applyLinkHighlights(doc: Document = document): { follow: number; nofollow: number; ugc: number } {
  const counts = { follow: 0, nofollow: 0, ugc: 0 };
  let stylesheet = doc.getElementById(STYLE_ID);
  if (!stylesheet) {
    stylesheet = doc.createElement('style');
    stylesheet.id = STYLE_ID;
    stylesheet.textContent = STYLE;
    (doc.head || doc.documentElement).append(stylesheet);
  }
  // Include old markers in cleanup when anchors change destination or rel.
  for (const anchor of Array.from(doc.querySelectorAll(`[${MARKER}]`))) anchor.removeAttribute(MARKER);
  const anchors = doc.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (let i = 0; i < Math.min(anchors.length, 10000); i += 1) {
    const anchor = anchors[i];
    if (!anchor || anchor.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    const kind = classifyAnchorForHighlight(anchor);
    if (!kind) continue;
    anchor.setAttribute(MARKER, kind);
    counts[kind] += 1;
  }
  return counts;
}

/** Started only after the user invokes the toolbar popup (activeTab grant). */
export function startAutomaticLinkHighlighting(): void {
  const flag = '__pagelensLinkHighlighterV1';
  const global = window as unknown as Record<string, unknown>;
  if (global[flag]) return; // prevent duplicate observers after re-enabling.
  global[flag] = true;
  let enabled = false;
  let observer: MutationObserver | null = null;
  let timer: number | null = null;
  const schedule = (): void => {
    if (!enabled || timer !== null) return;
    timer = window.setTimeout(() => { timer = null; if (enabled) applyLinkHighlights(); }, 140);
  };
  const setEnabled = (next: boolean): void => {
    enabled = next;
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    observer?.disconnect(); observer = null;
    if (!enabled) { clearLinkHighlights(); return; }
    applyLinkHighlights();
    observer = new MutationObserver((records) => {
      // The observer ignores our own data attribute to avoid feedback loops.
      if (records.some((r) => r.type === 'childList' || r.type === 'attributes')) schedule();
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'rel'] });
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.prototype.hasOwnProperty.call(changes, LINK_HIGHLIGHT_PREF)) {
      setEnabled(changes[LINK_HIGHLIGHT_PREF]?.newValue === true);
    }
  });
  void chrome.storage.local.get(LINK_HIGHLIGHT_PREF).then((data) => {
    setEnabled(data[LINK_HIGHLIGHT_PREF] === true);
  }).catch(() => setEnabled(false));
}
