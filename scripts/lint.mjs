#!/usr/bin/env node
// Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
/** Lightweight offline static audit in addition to TypeScript strict mode. */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root = resolve('src');
const patterns = [
  [/\b(?:eval|Function)\s*\(/, 'dynamic code evaluation'],
  [/\binnerHTML\s*=/, 'untrusted HTML sinks'],
  [/\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(/, 'network transmission in extension source'],
  [/\bconsole\.log\s*\(/, 'debug logging'],
];
const violations = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith('.ts')) {
      const code = await readFile(path, 'utf8');
      for (const [pattern, label] of patterns) if (pattern.test(code)) violations.push(`${path}: ${label}`);
    }
  }
}
await walk(root);
if (violations.length) { console.error(violations.join('\n')); process.exit(1); }
console.log('Static source checks: pass (no dynamic evaluation, HTML sinks, network transmission, or debug logging)');
