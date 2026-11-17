# Screenshot preparation

**Important:** `docs/screenshots/*-fixture-preview.png` images are generated
from compiled PageLens code and a local HTML fixture via Playwright. They show
UI behavior but are **not real Chrome installation screenshots** and must not
be submitted to the Chrome Web Store as genuine screenshots.

## Capture genuine screenshots

1. Install the `1.0.0` extension ZIP on an unrestricted desktop Chrome profile
   via `chrome://extensions` > Developer mode > Load unpacked.
2. Open a public test website. Avoid private account data, sensitive URLs and
   customer records.
3. Click the PageLens toolbar icon. Confirm that the Side Panel scans the page.
4. Capture the genuine Chrome browser and extension UI, showing the Overview,
   Inspector selector, finding drill-down and the Metadata, Headings, Images,
   Links and Structured Data inspectors where useful.
5. Demonstrate native Copy and Export actions using real page results. Preserve
   the actual appearance of the extension; do not fabricate browser chrome,
   permission dialogs or scan data.
6. Crop or resize genuine captures to the dimensions accepted by the Chrome
   Web Store. Use original PNG/JPEG files.
7. Keep approved shots separate from the `*-fixture-preview.png` files, such as
   `01-overview-chrome.png` and `02-images-chrome.png`.

Screenshots must match the exact tagged source/extension build and current
Chrome Web Store image requirements.
