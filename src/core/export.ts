/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import type { Finding, Heading, InspectedImage, InspectedLink, ScanResult } from './types.js';

/** Excel-safe UTF-8 CSV: BOM, RFC-style doubled quotes, guard spreadsheet formulas. */
function safeCell(value: unknown): string {
  let string = value === null || value === undefined ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(string)) string = `'${string}`;
  return `"${string.replace(/"/g, '""')}"`;
}
export function createCsv(columns: string[], rows: unknown[][]): string {
  return '\uFEFF' + [columns, ...rows].map((row) => row.map(safeCell).join(',')).join('\r\n') + '\r\n';
}
const show = (value: string | null | undefined) => value === null || value === undefined || value === '' ? '(empty)' : value;
const md = (value: unknown) => String(value ?? '').replace(/([\\`*_{}\[\]<>|])/g, '\\$1').replace(/\r\n?|\n/g, ' ⏎ ');
const item = (label: string, value: unknown) => `- **${md(label)}:** ${md(show(String(value ?? '')))}\n`;

export function createMarkdown(scan: ScanResult): string {
  const { metadata: m, counts: c } = scan;
  let out = '# PageLens website inspection\n\n';
  out += item('URL', scan.url) + item('Scanned at (UTC)', scan.scannedAt) + item('Schema version', scan.schemaVersion);
  out += '\n## Overview\n\n';
  for (const [key, value] of Object.entries(c)) out += item(key, value);
  out += item('Errors', scan.findings.filter((f) => f.severity === 'error').length);
  out += item('Warnings', scan.findings.filter((f) => f.severity === 'warning').length);
  out += item('Information', scan.findings.filter((f) => f.severity === 'info').length);
  out += '\n## Metadata\n\n';
  out += item('Title', m.title) + item('Title length', Array.from(m.title).length);
  out += item('Title element count', m.titleTags.length);
  out += item('Description', m.description) + item('Description length', Array.from(m.description).length);
  out += item('Description element count', m.descriptions.length);
  out += item('Canonical', m.canonical) + item('Canonical element count', m.canonicals.length);
  out += item('Viewport', m.viewport);
  // Preserve every declaration, not only the selected first value. Duplicates can conflict.
  for (const [name, declarations] of [
    ['Title elements', m.titleTags], ['Meta descriptions', m.descriptions],
    ['Canonical links', m.canonicals], ['Viewport elements', m.viewports],
  ] as const) {
    out += `\n### ${name}\n\n`;
    if (!declarations.length) out += 'None found.\n';
    for (const [index, declaration] of declarations.entries()) {
      out += `- ${index + 1}: ${md(show(declaration.value))} (${md(declaration.locator)})\n`;
    }
  }
  const metaSection = (title: string, rows: { key: string; value: string; locator: string }[]) => {
    out += `\n### ${title}\n\n`;
    if (!rows.length) { out += 'None found.\n'; return; }
    for (const row of rows) out += `- ${md(row.key)}: ${md(show(row.value))} (${md(row.locator)})\n`;
  };
  metaSection('Robots directives', m.robots);
  metaSection('Open Graph', m.openGraph);
  metaSection('Twitter/X', m.twitter);
  metaSection('Hreflang', m.hreflang.map((h) => ({ key: h.language, value: h.value, locator: h.locator })));
  out += '\n## Headings\n\n';
  if (!scan.headings.length) out += 'None found.\n';
  for (const h of scan.headings) out += `- H${h.level}: ${md(show(h.text))} — ${md(h.locator)}\n`;
  out += '\n## Images\n\n';
  if (!scan.images.length) out += 'None found.\n';
  for (const image of scan.images) {
    out += `- Image ${image.id + 1}: ${md(show(image.source))}\n`;
    out += `  - Alt (${md(image.altStatus)}): ${md(image.alt === null ? '(attribute absent)' : show(image.alt))}\n`;
    out += `  - Dimensions: ${image.naturalWidth ?? image.width ?? '?'} x ${image.naturalHeight ?? image.height ?? '?'}; loading: ${md(image.loading)}; selector: ${md(image.locator)}\n`;
  }
  out += '\n## Links\n\n';
  if (!scan.links.length) out += 'None found.\n';
  for (const link of scan.links) out += `- [${md(link.kind)}] ${md(show(link.accessibleName || link.text))}: ${md(show(link.url || link.href))} — ${md(link.locator)}\n`;
  out += '\n## JSON-LD blocks\n\n';
  if (!scan.jsonLd.length) out += 'None found.\n';
  for (const block of scan.jsonLd) {
    out += `### Block ${block.id + 1}\n\n`;
    out += item('Syntax', block.tooLarge ? `Not checked: ${block.error}` : block.valid ? 'Valid JSON syntax' : `JSON syntax error: ${block.error}`);
    out += item('Types', block.types.join(', ') || '(none)');
    out += item('Location', block.locator) + '\n';
    const content = block.formatted || block.source;
    const longest = Math.max(2, ...((content.match(/`+/g) ?? []).map((part) => part.length)));
    const fence = '`'.repeat(longest + 1);
    out += `${fence}json\n${content}\n${fence}\n\n`;
  }
  out += '## Findings\n\n';
  if (!scan.findings.length) out += 'No findings under the enabled checks. This does not certify SEO or accessibility compliance.\n';
  for (const finding of scan.findings) {
    out += `### ${md(finding.severity.toUpperCase())}: ${md(finding.title)}\n\n`;
    out += item('Category', finding.section) + item('Evidence', finding.actual) + item('Explanation', finding.description);
    if (finding.locator) out += item('Selector', finding.locator);
    out += '\n';
  }
  out += '---\n\nPageLens checks document DOM and JSON syntax only; it does not validate HTTP status codes, Rich Results eligibility, or the accessibility tree.\n';
  return out;
}

export function findingsCsv(scan: ScanResult): string {
  return createCsv(['Severity', 'Category', 'Rule ID', 'Finding', 'Description', 'Actual value', 'CSS selector', 'Page URL', 'Scanned at'],
    scan.findings.map((f: Finding) => [f.severity, f.section, f.id, f.title, f.description, f.actual, f.locator, scan.url, scan.scannedAt]));
}
export function linksCsv(scan: ScanResult, links: InspectedLink[] = scan.links): string {
  return createCsv(['Kind', 'Accessible name (approx.)', 'Text', 'Raw href', 'Resolved URL', 'Target', 'Rel', 'CSS selector', 'Page URL'],
    links.map((l) => [l.kind, l.accessibleName, l.text, l.href, l.url, l.target, l.rel, l.locator, scan.url]));
}
export function imagesCsv(scan: ScanResult, images: InspectedImage[] = scan.images): string {
  return createCsv(['ID', 'Alt status', 'Alt text', 'Source URL', 'Source status', 'Raw src', 'srcset', 'Lazy src', 'Width', 'Height', 'Natural width', 'Natural height', 'Loading', 'CSS selector', 'Page URL'],
    images.map((i) => [i.id + 1, i.altStatus, i.alt, i.source, i.sourceStatus, i.src, i.srcset, i.lazySrc, i.width, i.height, i.naturalWidth, i.naturalHeight, i.loading, i.locator, scan.url]));
}
/** Readable clipboard hierarchy without technical DOM selectors. */
export function formatHeadingsForCopy(headings: readonly Heading[]): string {
  return headings.map((h) => `${'  '.repeat(Math.max(0, h.level - 1))}H${h.level}: ${h.text || '(empty heading)'}`).join('\n');
}
export function headingsCsv(scan: ScanResult): string {
  return createCsv(['Level', 'Text', 'Skipped levels', 'CSS selector', 'Page URL'],
    scan.headings.map((h) => [`H${h.level}`, h.text, h.skippedLevels.join(','), h.locator, scan.url]));
}
export function structuredCsv(scan: ScanResult): string {
  return createCsv(['Block', 'Valid JSON', 'Types', 'Parse error', 'Raw JSON', 'Formatted JSON', 'CSS selector', 'Page URL'],
    scan.jsonLd.map((b) => [b.id + 1, b.valid, b.types.join(', '), b.error, b.source, b.formatted, b.locator, scan.url]));
}
export function copySummary(scan: ScanResult): string {
  const c = scan.counts;
  const errors = scan.findings.filter((f) => f.severity === 'error').length;
  const warnings = scan.findings.filter((f) => f.severity === 'warning').length;
  const info = scan.findings.filter((f) => f.severity === 'info').length;
  return [
    'PageLens scan summary',
    `URL: ${scan.url}`,
    `Scanned: ${scan.scannedAt}`,
    `Title: ${scan.metadata.title || '(missing/empty)'}`,
    `Meta description: ${scan.metadata.description || '(missing/empty)'}`,
    `Canonical: ${scan.metadata.canonical || '(missing/empty)'}`,
    `Headings: ${c.headings}; Images: ${c.images}; Internal links: ${c.internal}; External links: ${c.external}; JSON-LD: ${c.jsonLd}`,
    `Findings: ${errors} errors; ${warnings} warnings; ${info} informational`,
    ...scan.findings.map((f) => `[${f.severity.toUpperCase()}] ${f.title} — ${f.actual}`),
  ].join('\n');
}
