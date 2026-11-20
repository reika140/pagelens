# Screenshot guidance

Images in `docs/screenshots` are Playwright renders of local HTML fixtures
using compiled PageLens code. They demonstrate real UI behavior and organic
classification logic but **are not screenshots of an installed extension or
live Google Search**. Do not submit them to Chrome Web Store as live captures.

## Recommended real Chrome screenshots

1. Install the reviewed v1.5.0 extension in Chrome Desktop.
2. Open a public webpage without private user or customer information.
   Capture the default Metadata popup and, where useful, Headings/Images/Links.
3. Open an ordinary Google Search page one with a visible organic result
   beneath an AI Overview. Capture correct 1, 2, 3 organic numbering.
4. Open the popup and capture the On/Off preference control.
5. Show the effect of switching Off only when the screenshots represent real
   behavior; never fabricate Google result markup or review dialogs.
6. Use the current Chrome Web Store screenshot sizes and keep originals.

The bundled Be Vietnam Pro font is local. The fixture screenshots here must
be clearly described as test previews rather than production screenshots.

## SVG organic numeral regression previews

`google-serp-svg-organic-fixture-preview.png` shows the isolated vector glyphs
on a compiled DOM fixture. `google-serp-svg-css-hostile-preview.png` is the same
fixture after adding CSS that rotates/mirrors spans and changes writing mode.
The unit tests compare cropped SVG badge PNG bytes to confirm the digits do
not change. These previews are **not** live Google Search screenshots.

## v1.5.0 compact UI previews

`metadata-fixture-preview.png` and `settings-fixture-preview.png` show the updated compact UI using a locally rendered HTML test page. They are development evidence only. Do not submit them as installed-Chrome or live-site screenshots.

`images-fixture-preview.png` shows a deliberately local 2×2 raster preview beside its image metadata; other rows exercise missing-image fallbacks. It is not a screenshot of an installed extension.

## On-demand HTTP checks (v1.5.0)

`links-http-status-fixture-preview.png` shows status labels from the popup
Chrome API adapter. For production screenshots, use a real test server
that returns representative 200, 401, 402, 403 and 501 responses. Do not present
adapter-generated responses as validation of any third-party website.

## Real Chrome screenshots for README (v1.5.0)

These five WebP files were converted **losslessly** from original user-supplied
Chrome screenshots of an installed PageLens v1.5.0 extension on a public Google
Search Central page. They retain their original pixel dimensions and use
lowercase, hyphen-separated descriptive filenames.

| File | Subject |
| --- | --- |
| `real/pagelens-metadata-index-follow-google-search-central.webp` | Index/Follow, title and metadata overview |
| `real/pagelens-heading-structure-google-search-central.webp` | H1-H3 heading outline |
| `real/pagelens-image-alt-text-preview-google-search-central.webp` | Image thumbnails and alt text |
| `real/pagelens-json-ld-structured-data-google-search-central.webp` | JSON-LD type and formatted data |
| `real/pagelens-extension-settings-organic-link-outlines.webp` | Organic numbering and link-outline preferences |

The filename and descriptive Markdown alt text are meant for clarity and
accessibility; they do not constitute a claim that GitHub README images will
rank in search results. These are authentic Chrome screenshots, not fixture
renders. Check screenshot layout and Chrome Web Store asset size requirements
separately before submission.
