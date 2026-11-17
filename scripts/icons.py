#!/usr/bin/env python3
# Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
"""Create original PageLens icon assets using Pillow (no remote images/fonts)."""
from pathlib import Path
from PIL import Image, ImageDraw

DEST = Path(__file__).resolve().parent.parent / 'assets' / 'icons'
DEST.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    scale = 4
    s = size * scale
    image = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    margin = int(s * 0.07)
    d.rounded_rectangle((margin, margin, s-margin, s-margin), radius=int(s*.21), fill=(117, 83, 51, 255))
    white = (255, 250, 239, 255)
    # Lens and handle form a geometric P-like symbol, scalable at 16 px.
    cx, cy = int(.47*s), int(.44*s)
    r = int(.21*s)
    thickness = max(int(.085*s), 2)
    d.ellipse((cx-r, cy-r, cx+r, cy+r), outline=white, width=thickness)
    d.line((cx+int(r*.70), cy+int(r*.70), int(.80*s), int(.80*s)), fill=white, width=thickness)
    image.resize((size,size), Image.Resampling.LANCZOS).save(DEST / f'icon-{size}.png')
