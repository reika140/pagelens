#!/usr/bin/env node
// Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
/** Offline-capable zero-runtime-dependency build of the production Chrome MV3 package. */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const result = spawnSync('tsc', ['-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(join(dist, 'styles'), { recursive: true });
await cp(join(root, 'styles/popup.css'), join(dist, 'styles/popup.css'));
await cp(join(root, 'styles/inspector.css'), join(dist, 'styles/inspector.css'));
await cp(join(root, 'styles/popup-window.css'), join(dist, 'styles/popup-window.css'));
await cp(join(root, 'src/popup/index.html'), join(dist, 'popup.html'));
await cp(join(root, 'manifest.json'), join(dist, 'manifest.json'));
await cp(join(root, 'LICENSE'), join(dist, 'LICENSE'));
await cp(join(root, 'assets/icons'), join(dist, 'icons'), { recursive: true });
await cp(join(root, 'assets/fonts'), join(dist, 'fonts'), { recursive: true });
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf-8'));
if (manifest.manifest_version !== 3 || manifest.action?.default_popup !== 'popup.html' || manifest.side_panel || manifest.background) throw new Error('Unexpected Chrome popup-only manifest configuration');
const required = ['activeTab', 'scripting', 'storage'];
if (JSON.stringify([...manifest.permissions].sort()) !== JSON.stringify(required.sort())) throw new Error('Unexpected permissions');
const scripts = manifest.content_scripts ?? [];
if (scripts.length !== 1 || scripts[0].js?.join(',') !== 'js/extension/google-serp-content.js' ||
    scripts[0].run_at !== 'document_idle' || scripts[0].all_frames !== false) {
  throw new Error('Expected one narrowly scoped Google-only content script');
}
const domains = ['https://www.google.com/*', 'https://google.com/*',
  'https://www.google.com.vn/*', 'https://google.com.vn/*'];
if (JSON.stringify(scripts[0].matches.slice().sort()) !== JSON.stringify(domains.sort())) {
  throw new Error('Unexpected site access in the content script');
}
// Chrome MV3 declarative content scripts are classic scripts, not ES modules.
// Bundle the two audited, TypeScript-compiled modules without a runtime library.
const stripModuleSyntax = (code) => code.replace(/^import[^\n]*;\s*$/gm, '')
  .replace(/^export\s+(?=(?:function|async function|const|class|let)\b)/gm, '');
const rankCode = stripModuleSyntax(await readFile(join(dist, 'js/extension/organic-rank.js'), 'utf8'));
const autoCode = stripModuleSyntax(await readFile(join(dist, 'js/extension/serp-auto.js'), 'utf8'));
if (/^(?:import|export)\s/m.test(rankCode + autoCode)) throw new Error('Unbundled module syntax in Google content script');
await writeFile(join(dist, 'js/extension/google-serp-content.js'),
  '/* PageLens local Google SERP content script. Copyright (c) 2026 reika140. */\n' +
  rankCode + '\n' + autoCode + '\n');
if (manifest.host_permissions?.length) throw new Error('No broad host_permissions are required');
if (manifest.optional_host_permissions?.length) throw new Error('Broad optional website access is not allowed');
const linkCode = stripModuleSyntax(await readFile(join(dist, 'js/extension/link-highlighter.js'), 'utf8'));
const linkAutoCode = stripModuleSyntax(await readFile(join(dist, 'js/extension/link-auto.js'), 'utf8'));
if (/^(?:import|export)\s/m.test(linkCode + linkAutoCode)) throw new Error('Unbundled module in dynamic link highlighter');
await writeFile(join(dist, 'js/extension/link-highlight-content.js'),
  '/* PageLens optional local link highlighter. Copyright (c) 2026 reika140. */\n(function () {\n' + linkCode + '\n' + linkAutoCode + '\n})();\n');
console.log(`Chrome MV3 extension built: ${dist}`);
