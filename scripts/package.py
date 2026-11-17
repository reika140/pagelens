#!/usr/bin/env python3
# Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
"""Package both PageLens release archives and compute SHA-256 checksums."""

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'releases'
OUT.mkdir(exist_ok=True)
VERSION = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
SOURCE = OUT / f'pagelens-v{VERSION}-source.zip'
EXTENSION = OUT / f'pagelens-v{VERSION}-chrome-extension.zip'
EXCLUDE = {
    'dist', 'node_modules', '.git', '.wxt', '.output', 'releases',
    '__pycache__', '.pytest_cache', 'test-results', 'playwright-report',
    '.coverage', 'internal', 'private',
}
EXCLUDE_NAMES = {'docs/portfolio-sync.md', 'docs/internal.md'}

with ZipFile(SOURCE, 'w', ZIP_DEFLATED, compresslevel=8) as archive:
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if any(part in EXCLUDE or part.startswith('.internal') for part in relative.parts):
            continue
        if relative.as_posix() in EXCLUDE_NAMES or relative.name.endswith('.internal.md'):
            continue
        archive.write(path, relative)

with ZipFile(EXTENSION, 'w', ZIP_DEFLATED, compresslevel=8) as archive:
    for path in sorted((ROOT / 'dist').rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(ROOT / 'dist'))

lines = []
for path in (SOURCE, EXTENSION):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f'{digest}  {path.name}')
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError(f'Corrupted ZIP entry in {path}')
    print(f'{path.name}: {path.stat().st_size:,} bytes (SHA-256 {digest})')
(OUT / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
