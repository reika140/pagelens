#!/usr/bin/env node
// Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
/** Select an installed Python that has Playwright; supports Windows/macOS/Linux. */
import { spawnSync } from 'node:child_process';
const script = process.argv[2];
if (!script) { console.error('Usage: node scripts/run-python.mjs <test-script.py>'); process.exit(2); }
const candidates = [...new Set([process.env.PAGELENS_PYTHON, '/opt/pyvenv/bin/python', 'python3', 'python'].filter(Boolean))];
let interpreter;
for (const binary of candidates) {
  const probe = spawnSync(binary, ['-c','import playwright'], { stdio: 'ignore' });
  if (!probe.error && probe.status === 0) { interpreter = binary; break; }
}
if (!interpreter) {
  console.error('Python Playwright is not installed. Run: python -m pip install playwright && python -m playwright install chromium');
  process.exit(2);
}
const result = spawnSync(interpreter, [script], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
