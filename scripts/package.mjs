#!/usr/bin/env node
// Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
/** Creates source and ready-to-load distribution ZIPs with Python's stdlib. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve('.');
const available = ['python3','python'];
let res;
for (const executable of available) {
  res = spawnSync(executable, [resolve('scripts/package.py')], { cwd: root, stdio: 'inherit' });
  if (!res.error) break;
}
if (res?.error) throw res.error;
if (res?.status !== 0) process.exit(res?.status ?? 1);
