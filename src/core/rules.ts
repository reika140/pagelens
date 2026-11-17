/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import type { Finding, Heuristics, ScanResult, Section, Severity } from './types.js';

/** Rules use qualified language and return evidence, never an arbitrary SEO score. */
export function evaluateRules(scan: ScanResult, heuristics: Heuristics): Finding[] {
  const findings: Finding[] = [];
  const add = (id: string, severity: Severity, section: Section, title: string, description: string, actual: string, locator: string | null = null) => {
    findings.push({ id, severity, section, title, description, actual, locator });
  };
  const m = scan.metadata;
  const len = (value: string) => Array.from(value).length;
  if (m.titleTags.length === 0) {
    add('title-missing', 'error', 'metadata', 'Title element missing', 'No <title> element was found in the document head.', '0 title elements');
  } else {
    if (!m.title.trim()) add('title-empty', 'error', 'metadata', 'Document title is empty', 'A title element exists but the current document title is empty.', 'Empty title', m.titleTags[0]?.locator);
    if (m.titleTags.length > 1) add('title-duplicate', 'warning', 'metadata', 'Multiple title elements', 'Multiple <title> elements may lead to ambiguous metadata.', `${m.titleTags.length} title elements`, m.titleTags[1]?.locator);
    if (heuristics.enabled && m.title.trim() && (len(m.title) < heuristics.titleMin || len(m.title) > heuristics.titleMax)) {
      add('title-length', 'info', 'metadata', 'Title length outside preferred range', 'This is a configurable editorial heuristic, not a ranking rule or guaranteed display limit.', `${len(m.title)} characters; preferred ${heuristics.titleMin}–${heuristics.titleMax}`, m.titleTags[0]?.locator);
    }
  }
  if (m.descriptions.length === 0) add('description-missing', 'warning', 'metadata', 'Meta description missing', 'No meta description element was found.', '0 description elements');
  else {
    if (!m.description.trim()) add('description-empty', 'warning', 'metadata', 'Meta description is empty', 'A meta description tag exists, but its content is empty.', 'Empty content', m.descriptions[0]?.locator);
    if (m.descriptions.length > 1) add('description-duplicate', 'warning', 'metadata', 'Multiple meta descriptions', 'Multiple description tags may cause inconsistent interpretation.', `${m.descriptions.length} tags`, m.descriptions[1]?.locator);
    if (heuristics.enabled && m.description.trim() && (len(m.description) < heuristics.descriptionMin || len(m.description) > heuristics.descriptionMax)) {
      add('description-length', 'info', 'metadata', 'Description length outside preferred range', 'A configurable writing heuristic; search engines may display or rewrite snippets differently.', `${len(m.description)} characters; preferred ${heuristics.descriptionMin}–${heuristics.descriptionMax}`, m.descriptions[0]?.locator);
    }
  }
  if (m.canonicals.length === 0) add('canonical-missing', 'info', 'metadata', 'No canonical link declared', 'A canonical link is not always required, but its absence may be worth reviewing.', '0 canonical elements');
  else {
    if (!m.canonical.trim()) add('canonical-empty', 'warning', 'metadata', 'Canonical URL is empty', 'The canonical link has no target URL.', 'Empty href', m.canonicals[0]?.locator);
    if (m.canonicals.length > 1) add('canonical-duplicate', 'warning', 'metadata', 'Multiple canonicals', 'Conflicting canonical declarations can be ambiguous.', `${m.canonicals.length} links`, m.canonicals[1]?.locator);
    if (m.canonical.trim()) {
      try {
        const value = new URL(m.canonical, scan.url);
        if (!['http:', 'https:'].includes(value.protocol)) throw new Error('Unsupported protocol');
      } catch {
        add('canonical-invalid', 'warning', 'metadata', 'Canonical URL may be invalid', 'The canonical should resolve to an HTTP(S) URL.', m.canonical, m.canonicals[0]?.locator);
      }
    }
  }
  if (m.viewports.length === 0) add('viewport-missing', 'info', 'metadata', 'Viewport meta absent', 'Responsive pages commonly declare viewport settings.', '0 viewport tags');
  if (m.viewports.length > 1) add('viewport-duplicate', 'warning', 'metadata', 'Multiple viewport tags', 'Multiple viewport declarations may conflict.', `${m.viewports.length} tags`, m.viewports[1]?.locator);
  const duplicates = (entries: { key: string; locator: string }[], label: string) => {
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.key.toLowerCase(), (counts.get(entry.key.toLowerCase()) ?? 0) + 1);
    for (const [key, count] of counts) {
      if (count > 1) add(`${label}-${key}-duplicate`, 'info', 'metadata', `Repeated ${label} field: ${key}`, 'Repeated social metadata can have intentional uses; review the values.', `${count} occurrences`, entries.find((entry) => entry.key.toLowerCase() === key)?.locator);
    }
  };
  duplicates(m.openGraph, 'Open Graph');
  duplicates(m.twitter, 'Twitter/X');
  if (!scan.headings.some((item) => item.level === 1)) add('h1-absent', 'warning', 'headings', 'No H1 found', 'Review whether the page has a clear top-level heading; this is not a universal pass/fail rule.', '0 H1 elements');
  const h1count = scan.headings.filter((item) => item.level === 1).length;
  if (h1count > 1) add('h1-multiple', 'info', 'headings', 'Multiple H1 headings', 'Multiple H1 elements are not inherently invalid; assess the document outline in context.', `${h1count} H1 elements`, scan.headings.filter((item) => item.level === 1)[1]?.locator);
  for (const h of scan.headings) {
    if (!h.text) add(`heading-empty-${h.id}`, 'warning', 'headings', 'Empty heading', `An H${h.level} has no visible text content.`, `H${h.level} at item ${h.id + 1}`, h.locator);
    if (h.skippedLevels.length) add(`heading-jump-${h.id}`, 'warning', 'headings', 'Heading level jump', 'A heading follows a higher level without intermediate levels; check the hierarchy.', `H${h.level}; skipped H${h.skippedLevels.join(', H')}`, h.locator);
  }
  const missingAlt = scan.images.filter((i) => i.altStatus === 'missing');
  if (missingAlt.length) add('image-alt-missing', 'warning', 'images', 'Images without alt attributes', 'These img elements have no alt attribute. Review their purpose and accessibility requirements.', scan.counts.images > scan.images.length ? `${missingAlt.length} of first ${scan.images.length} inspected (${scan.counts.images} total)` : `${missingAlt.length} / ${scan.counts.images} images`, missingAlt[0]?.locator);
  const emptyAlt = scan.images.filter((i) => i.altStatus === 'empty');
  if (emptyAlt.length) add('image-alt-empty', 'info', 'images', 'Images with empty alt attributes', 'Empty alt text may be intentional for decorative imagery; inspect context rather than treating all as defects.', `${emptyAlt.length} images`, emptyAlt[0]?.locator);
  const withoutSrc = scan.images.filter((i) => i.sourceStatus === 'missing' || i.sourceStatus === 'unsafe');
  if (withoutSrc.length) add('image-src-unavailable', 'info', 'images', 'Images without usable source URLs', 'Some images are lazy-loaded or rendered dynamically; inspect their attributes.', `${withoutSrc.length} images`, withoutSrc[0]?.locator);
  const invalidLinks = scan.links.filter((l) => l.kind === 'invalid');
  if (invalidLinks.length) add('link-href-invalid', 'warning', 'links', 'Anchors without valid hrefs', 'These anchor elements have no usable navigation destination; some may be JavaScript controls.', `${invalidLinks.length} links`, invalidLinks[0]?.locator);
  const unnamedLinks = scan.links.filter((l) => !l.hasAccessibleName);
  if (unnamedLinks.length) add('link-name-possible', 'warning', 'links', 'Potentially unnamed links', 'Accessible names are approximated from DOM attributes and descendants, not computed from the accessibility tree.', `${unnamedLinks.length} links to inspect`, unnamedLinks[0]?.locator);
  for (const block of scan.jsonLd) {
    if (block.tooLarge) add(`jsonld-skipped-${block.id}`, 'info', 'structured', 'JSON-LD block too large to inspect', 'Parsing was skipped for resource safety; the JSON syntax has not been evaluated.', block.error, block.locator);
    else if (!block.valid) add(`jsonld-invalid-${block.id}`, 'warning', 'structured', 'JSON-LD parsing failed', 'This check covers JSON syntax only, not Google Rich Results eligibility.', block.error, block.locator);
  }
  for (const key of ['headings', 'images', 'links', 'jsonLd'] as const) {
    if (scan.counts[key] > scan.limits[key]) add(`truncated-${key}`, 'info', 'overview', `Large ${key} collection truncated`, 'The page exceeded the per-category display limit; the count is complete but inspected items are capped.', `${scan.counts[key]} total; first ${scan.limits[key]} scanned`);
  }
  return findings;
}
