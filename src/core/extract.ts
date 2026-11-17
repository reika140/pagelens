/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import type { RawSnapshot } from './types.js';

/**
 * Executed with chrome.scripting.executeScript({func}). EVERYTHING referenced at
 * runtime MUST be local to this function: Chrome serializes the function rather
 * than its module/lexical environment. Unit tests and browser E2E exercise it.
 *
 * Only ordinary document DOM is inspected, not shadow roots or iframes.
 */
export function extractPageSnapshot(): RawSnapshot {
  const MAX_ITEMS = 10000;
  const MAX_JSON_CHARS = 1_000_000;
  const loc = (element: Element): string => {
    const parts: string[] = [];
    let current: Element | null = element;
    while (current) {
      const name = current.tagName.toLowerCase();
      if (!/^[a-z][a-z0-9-]*$/.test(name)) return '';
      const parent: Element | null = current.parentElement;
      let nth = 1;
      if (parent) {
        let previous: Element | null = current.previousElementSibling;
        while (previous) {
          if (previous.tagName === current.tagName) nth += 1;
          previous = previous.previousElementSibling;
        }
      }
      parts.unshift(`${name}:nth-of-type(${nth})`);
      current = parent;
    }
    return parts.join(' > ');
  };
  const valueElements = (nodes: Element[]): { value: string; locator: string }[] =>
    nodes.slice(0, MAX_ITEMS).map((node) => ({
      value: node.getAttribute('content') ?? node.getAttribute('href') ?? (node.textContent ?? ''),
      locator: loc(node),
    }));
  const metas = Array.from(document.querySelectorAll('meta'));
  const links = Array.from(document.querySelectorAll('link'));
  const byName = (name: string) => metas.filter((meta) => (meta.getAttribute('name') ?? '').trim().toLowerCase() === name);
  const hasRel = (element: Element, token: string) =>
    (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).includes(token);
  const metaEntries = (elements: Element[], attribute: 'name' | 'property') =>
    elements.slice(0, MAX_ITEMS).map((element) => ({
      key: (element.getAttribute(attribute) ?? '').trim(),
      value: element.getAttribute('content') ?? '',
      locator: loc(element),
    }));
  const headingElements = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const imageElements = Array.from(document.querySelectorAll('img'));
  const anchorElements = Array.from(document.querySelectorAll('a'));
  const scriptElements = Array.from(document.querySelectorAll('script')).filter(
    (script) => (script.getAttribute('type') ?? '').split(';')[0]?.trim().toLowerCase() === 'application/ld+json',
  );
  const dimension = (value: number | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const classifyForTotals = (anchor: HTMLAnchorElement): 'internal' | 'external' | 'special' | 'invalid' => {
    const href = anchor.getAttribute('href');
    if (href === null || !href.trim()) return 'invalid';
    if (href.trim().startsWith('#')) return 'special';
    try {
      const resolved = new URL(anchor.href || href, location.href);
      if (!['http:', 'https:'].includes(resolved.protocol)) return 'special';
      return resolved.origin === location.origin ? 'internal' : 'external';
    } catch { return 'invalid'; }
  };
  const linkTypeCounts = { internal: 0, external: 0, special: 0, invalid: 0 };
  for (const anchor of anchorElements) linkTypeCounts[classifyForTotals(anchor as HTMLAnchorElement)] += 1;
  const accessibleName = (anchor: HTMLAnchorElement): string => {
    const labelledBy = (anchor.getAttribute('aria-labelledby') ?? '').trim();
    if (labelledBy) {
      const labels = labelledBy.split(/\s+/).map((id) => {
        // getElementById avoids CSS injection from page-supplied IDs.
        const node = document.getElementById(id);
        return node ? text(node) : '';
      }).filter(Boolean).join(' ');
      if (labels) return labels;
    }
    const aria = (anchor.getAttribute('aria-label') ?? '').trim();
    if (aria) return aria;
    const ownText = text(anchor);
    if (ownText) return ownText;
    const imageAlts = Array.from(anchor.querySelectorAll('img[alt]'))
      .map((img) => img.getAttribute('alt') ?? '').filter(Boolean).join(' ').trim();
    if (imageAlts) return imageAlts;
    return (anchor.getAttribute('title') ?? '').trim();
  };
  return {
    url: location.href,
    title: document.title,
    titleTags: valueElements(Array.from(document.querySelectorAll('head title'))),
    descriptions: valueElements(byName('description')),
    canonicals: valueElements(links.filter((link) => hasRel(link, 'canonical'))),
    robots: metaEntries(metas.filter((m) => /^(robots|googlebot|bingbot)$/i.test((m.getAttribute('name') ?? '').trim())), 'name'),
    viewports: valueElements(byName('viewport')),
    openGraph: metaEntries(metas.filter((m) => (m.getAttribute('property') ?? '').toLowerCase().startsWith('og:')), 'property'),
    twitter: metas.filter((m) => {
      const key = (m.getAttribute('name') ?? m.getAttribute('property') ?? '').toLowerCase();
      return key.startsWith('twitter:');
    }).slice(0, MAX_ITEMS).map((m) => ({
      key: (m.getAttribute('name') ?? m.getAttribute('property') ?? '').trim(),
      value: m.getAttribute('content') ?? '',
      locator: loc(m),
    })),
    hreflang: links.filter((link) => hasRel(link, 'alternate') && link.hasAttribute('hreflang'))
      .slice(0, MAX_ITEMS).map((link) => ({ language: link.getAttribute('hreflang') ?? '', value: link.getAttribute('href') ?? '', locator: loc(link) })),
    headings: headingElements.slice(0, MAX_ITEMS).map((element, id) => ({
      id,
      level: Number(element.tagName.slice(1)),
      text: text(element),
      locator: loc(element),
    })),
    images: imageElements.slice(0, MAX_ITEMS).map((element, id) => {
      const img = element as HTMLImageElement;
      return {
        id,
        alt: img.hasAttribute('alt') ? img.getAttribute('alt') : null,
        src: img.getAttribute('src') ?? '',
        currentSrc: img.currentSrc ?? '',
        srcset: img.getAttribute('srcset') ?? '',
        lazySrc: img.getAttribute('data-src') ?? img.getAttribute('data-lazy-src') ?? img.getAttribute('data-original') ?? '',
        width: dimension(img.width),
        height: dimension(img.height),
        naturalWidth: dimension(img.naturalWidth),
        naturalHeight: dimension(img.naturalHeight),
        loading: img.getAttribute('loading') ?? 'auto',
        locator: loc(img),
      };
    }),
    links: anchorElements.slice(0, MAX_ITEMS).map((element, id) => {
      const anchor = element as HTMLAnchorElement;
      return {
        id,
        text: text(anchor),
        href: anchor.hasAttribute('href') ? anchor.getAttribute('href') : null,
        resolvedHref: anchor.href || '',
        accessibleName: accessibleName(anchor),
        target: anchor.getAttribute('target') ?? '',
        rel: anchor.getAttribute('rel') ?? '',
        locator: loc(anchor),
      };
    }),
    jsonLd: scriptElements.slice(0, MAX_ITEMS).map((script, id) => {
      const content = script.textContent ?? '';
      return { id, text: content.slice(0, MAX_JSON_CHARS), tooLarge: content.length > MAX_JSON_CHARS, locator: loc(script) };
    }),
    counts: { headings: headingElements.length, images: imageElements.length, links: anchorElements.length, jsonLd: scriptElements.length },
    linkTypeCounts,
    limits: { headings: MAX_ITEMS, images: MAX_ITEMS, links: MAX_ITEMS, jsonLd: MAX_ITEMS },
  };
}
