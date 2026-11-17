/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import type {
  Heading, InspectedImage, InspectedLink, JsonLdBlock, LinkKind, Metadata,
  RawImage, RawJsonLd, RawLink, RawSnapshot, ScanResult,
} from './types.js';
import { evaluateRules } from './rules.js';
import { DEFAULT_HEURISTICS } from './types.js';
import type { Heuristics } from './types.js';

const first = (items: { value: string }[]): string => items[0]?.value ?? '';

export function classifyLink(link: Pick<RawLink, 'href' | 'resolvedHref'>, pageUrl: string): { kind: LinkKind; url: string } {
  const raw = link.href;
  if (raw === null || raw.trim() === '') return { kind: 'invalid', url: '' };
  if (raw.trim().startsWith('#')) return { kind: 'special', url: raw.trim() };
  try {
    // The DOM-resolved href respects a <base> element and is what a click uses.
    const resolved = new URL(link.resolvedHref || raw, pageUrl);
    if (!['http:', 'https:'].includes(resolved.protocol)) return { kind: 'special', url: resolved.href };
    const page = new URL(pageUrl);
    return { kind: resolved.origin === page.origin ? 'internal' : 'external', url: resolved.href };
  } catch {
    return { kind: 'invalid', url: raw };
  }
}

function absoluteResource(input: string, pageUrl: string): string {
  if (!input.trim()) return '';
  try {
    const url = new URL(input.trim(), pageUrl);
    // Display the source as plain text. Never render page-controlled URLs as side-panel images.
    return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function inspectImage(image: RawImage, pageUrl: string): InspectedImage {
  const firstSrcset = image.srcset.trim().split(',')[0]?.trim().split(/\s+/)[0] ?? '';
  const candidates = [image.currentSrc, image.src, firstSrcset, image.lazySrc];
  let source = '';
  let sourceStatus: InspectedImage['sourceStatus'] = 'missing';
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i] ?? '';
    if (!value) continue;
    const resolved = absoluteResource(value, pageUrl);
    if (resolved) {
      source = resolved;
      sourceStatus = i === 3 ? 'lazy-candidate' : 'present';
      break;
    }
    sourceStatus = 'unsafe';
  }
  return { ...image, source, sourceStatus, altStatus: image.alt === null ? 'missing' : !image.alt.trim() ? 'empty' : 'present' };
}

export function headingHierarchy(items: RawSnapshot['headings']): Heading[] {
  let lastLevel = 0;
  return items.map((heading) => {
    const skippedLevels: number[] = [];
    if (heading.level > lastLevel + 1) {
      for (let level = lastLevel + 1; level < heading.level; level += 1) skippedLevels.push(level);
    }
    lastLevel = heading.level;
    return { ...heading, skippedLevels };
  });
}

function collectTypes(payload: unknown): string[] {
  const types = new Set<string>();
  let visited = 0;
  const visit = (value: unknown, depth: number): void => {
    if (depth > 60 || ++visited > 20000 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const object = value as Record<string, unknown>;
    const declared = object['@type'];
    if (typeof declared === 'string' && declared.trim()) types.add(declared.trim());
    if (Array.isArray(declared)) {
      for (const item of declared) if (typeof item === 'string' && item.trim()) types.add(item.trim());
    }
    // Nested @graph and other JSON-LD objects may carry their own @type.
    for (const item of Object.values(object)) if (item && typeof item === 'object') visit(item, depth + 1);
  };
  visit(payload, 0);
  return [...types];
}

export function inspectJsonLd(block: RawJsonLd): JsonLdBlock {
  if (block.tooLarge) {
    return { id: block.id, locator: block.locator, source: block.text, formatted: '', types: [], valid: false,
      error: 'Block exceeds 1,000,000 characters; parsing skipped for safety.', tooLarge: true };
  }
  try {
    const parsed: unknown = JSON.parse(block.text);
    return { id: block.id, locator: block.locator, source: block.text, formatted: JSON.stringify(parsed, null, 2),
      types: collectTypes(parsed), valid: true, error: '', tooLarge: false };
  } catch (error) {
    return { id: block.id, locator: block.locator, source: block.text, formatted: block.text, types: [], valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON', tooLarge: false };
  }
}

export function normalizeSnapshot(raw: RawSnapshot, options: Heuristics = DEFAULT_HEURISTICS, scannedAt = new Date().toISOString()): ScanResult {
  const metadata: Metadata = {
    title: raw.title, titleTags: raw.titleTags,
    description: first(raw.descriptions), descriptions: raw.descriptions,
    canonical: first(raw.canonicals), canonicals: raw.canonicals,
    robots: raw.robots, viewport: first(raw.viewports), viewports: raw.viewports,
    openGraph: raw.openGraph, twitter: raw.twitter, hreflang: raw.hreflang,
  };
  const headings = headingHierarchy(raw.headings);
  const images = raw.images.map((img) => inspectImage(img, raw.url));
  const links: InspectedLink[] = raw.links.map((link) => ({
    ...link, ...classifyLink(link, raw.url), hasAccessibleName: link.accessibleName.trim().length > 0,
  }));
  const jsonLd = raw.jsonLd.map(inspectJsonLd);
  const result: ScanResult = {
    schemaVersion: 1,
    scannedAt,
    url: raw.url,
    metadata,
    headings,
    images,
    links,
    jsonLd,
    counts: {
      ...raw.counts,
      internal: raw.linkTypeCounts?.internal ?? links.filter((item) => item.kind === 'internal').length,
      external: raw.linkTypeCounts?.external ?? links.filter((item) => item.kind === 'external').length,
      special: raw.linkTypeCounts?.special ?? links.filter((item) => item.kind === 'special').length,
      invalid: raw.linkTypeCounts?.invalid ?? links.filter((item) => item.kind === 'invalid').length,
    },
    limits: raw.limits,
    findings: [],
  };
  result.findings = evaluateRules(result, options);
  return result;
}
