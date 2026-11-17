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
await cp(join(root, 'styles/panel.css'), join(dist, 'styles/panel.css'));
await cp(join(root, 'src/panel/index.html'), join(dist, 'panel.html'));
await cp(join(root, 'manifest.json'), join(dist, 'manifest.json'));
await cp(join(root, 'LICENSE'), join(dist, 'LICENSE'));
await cp(join(root, 'assets/icons'), join(dist, 'icons'), { recursive: true });
await cp(join(root, 'assets/fonts'), join(dist, 'fonts'), { recursive: true });
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf-8'));
if (manifest.manifest_version !== 3 || manifest.side_panel?.default_path !== 'panel.html') throw new Error('Unexpected Chrome manifest configuration');
const required = ['activeTab', 'scripting', 'sidePanel'];
if (JSON.stringify([...manifest.permissions].sort()) !== JSON.stringify(required.sort())) throw new Error('Unexpected permissions');
if (manifest.content_scripts?.length) throw new Error('Unexpected persistent content scripts');
if (manifest.host_permissions?.length) throw new Error('Unexpected persistent host permissions');
if (manifest.optional_host_permissions) throw new Error('Unexpected runtime site permission flow');
console.log(`Chrome MV3 extension built: ${dist}`);
