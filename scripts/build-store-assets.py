#!/usr/bin/env python3
"""Create Chrome Web Store screenshots from authentic Chrome captures (no AI)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/screenshots/real"
DEST = ROOT / "docs/chrome-web-store/assets"
SPECS = [
    ("pagelens-metadata-index-follow-google-search-central.webp", "01-metadata-overview.png",
     "Metadata overview", "Review indexing directives, metadata, and technical tags at a glance."),
    ("pagelens-heading-structure-google-search-central.webp", "02-heading-structure.png",
     "Heading structure", "Read H1-H6 in page order to understand the content outline."),
    ("pagelens-image-alt-text-preview-google-search-central.webp", "03-image-details.png",
     "Image details", "Preview image filenames and alt text in one place."),
    ("pagelens-json-ld-structured-data-google-search-central.webp", "04-structured-data.png",
     "Structured data", "Explore detected schema types and formatted JSON-LD."),
    ("pagelens-extension-settings-organic-link-outlines.webp", "05-settings-and-controls.png",
     "Settings and controls", "Customize numbering, link outlines, and appearance."),
]

def get_font(size, bold=False):
    filename = "BeVietnamPro-SemiBold.ttf" if bold else "BeVietnamPro-Regular.ttf"
    return ImageFont.truetype(str(ROOT / "assets/fonts" / filename), size)

def render(source, destination, title, summary):
    with Image.open(source) as image:
        screenshot = image.convert("RGB")
    # Crop only page area outside the extension: never redraw popup text or UI.
    width, height = screenshot.size
    x, y, card_width, card_height = 126, 146, 1028, 629
    crop_height = min(height, round(width * card_height / card_width))
    crop_width = min(width, round(crop_height * card_width / card_height))
    left = (width - crop_width) // 2
    screenshot = screenshot.crop((left, 0, left + crop_width, crop_height))
    screenshot = screenshot.resize((card_width, card_height), Image.Resampling.LANCZOS)

    artwork = Image.new("RGBA", (1280, 800), "#f7f8fb")
    d = ImageDraw.Draw(artwork)
    d.text((80, 19), title, font=get_font(45, True), fill="#202a40")
    d.text((82, 84), summary, font=get_font(22), fill="#596272")

    shadow = Image.new("RGBA", (1280, 800), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x, y + 9, x + card_width, y + card_height + 9),
                         radius=17, fill=(21, 32, 56, 55))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    artwork = Image.alpha_composite(artwork, shadow)

    mask = Image.new("L", (card_width, card_height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, card_width - 1, card_height - 1),
                                            radius=17, fill=255)
    artwork.paste(screenshot.convert("RGBA"), (x, y), mask)
    ImageDraw.Draw(artwork).rounded_rectangle(
        (x, y, x + card_width - 1, y + card_height - 1),
        radius=17, outline=(199, 208, 221, 255), width=2)
    destination.parent.mkdir(parents=True, exist_ok=True)
    artwork.convert("RGB").save(destination, "PNG", optimize=True)
    with Image.open(destination) as check:
        assert check.size == (1280, 800)

if __name__ == "__main__":
    for name, filename, title, description in SPECS:
        render(SOURCE / name, DEST / filename, title, description)
        print(f"Created {DEST / filename}")
