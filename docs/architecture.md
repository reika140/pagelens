# PageLens architecture (v1.3.3)

## Browser surfaces

PageLens uses a Chrome Manifest V3 popup for on-demand inspection and a
narrowly scoped declarative content script for Google organic numbering.
There is no background service worker or Side Panel.

### On-demand website inspection

```text
Click the PageLens toolbar icon
    -> Chrome opens popup.html and grants temporary activeTab access
    -> chrome.tabs.query identifies the active tab
    -> chrome.scripting.executeScript runs the DOM extractor once
    -> normalize data and evaluate evidence-based findings
    -> display six inspectors with Copy and filtered CSV controls
```

### Automatic Google first-page numbering

```text
Open a Google Search page (google.com or google.com.vn)
    -> Chrome injects js/extension/google-serp-content.js at document_idle
    -> the script reads the stored On/Off setting (default: On)
    -> confirm standard page-one Web results URL
    -> classify visible organic result cards conservatively
    -> number by visual top-to-bottom order, not arbitrary DOM order
    -> observe local result-card updates while enabled; renumber as needed

Switch Off in the popup
    -> chrome.storage.local saves the preference
    -> existing Google content scripts receive storage.onChanged
    -> number labels are removed and DOM observers stop
```

The content script is built from strict TypeScript modules `organic-rank.ts`
and `serp-auto.ts`. The build script bundles the compiled code into a **classic
content script** without importing JavaScript modules at runtime. Both popup
and content script use the same classification function; no duplicate ranking
heuristic or remote service is involved.

## Modules

| Component | Responsibility |
| --- | --- |
| `src/core/extract.ts` | One-shot DOM snapshot |
| `src/core/normalize.ts` | Typed metadata, headings, images, links, JSON-LD |
| `src/core/rules.ts` | Evidence-based findings |
| `src/core/export.ts` | Copy and escaped CSV/Markdown serializers |
| `src/extension/locate.ts` | Popup's temporary activeTab extraction |
| `src/extension/organic-rank.ts` | Self-contained Google organic classifier and rank labels |
| `src/extension/serp-auto.ts` | Content-script startup, settings and page-local DOM observer |
| `src/popup/main.ts` | Six inspectors and global On/Off switch |

## Security and privacy

Permissions: `activeTab`, `scripting`, and `storage`. The `content_scripts`
match patterns grant page access **only** on `google.com` and
`google.com.vn`; other pages are only inspected after an explicit toolbar
click. There are no broad host permissions, remote scripts, analytics,
external network calls, background crawler or background service worker.

Organic results are annotated through a single dedicated
`pagelens-organic-overlay` attached directly to the document root, outside
Google's result cards. Labels are locally rendered as SVG paths derived from
the bundled OFL-1.1 Be Vietnam Pro font, not from live HTML text. PageLens
never changes the result card's `position`, `transform`, fonts or markup.
Turning the setting Off or navigating away removes the whole overlay.
The content script does not modify search links, submit forms, read cookies,
make network requests or alter Google's actual result order.

The popup uses `textContent` for page-owned strings, never executable HTML.
The extractor limits oversized DOM collections. CSV export includes UTF-8
and spreadsheet formula protection. JSON-LD parsing is bounded.

## Popup constraints

The popup retains fixed 448 x 568 CSS-pixel intrinsic dimensions and a 54-pixel
navigation rail. Its UI has six inspectors and does not highlight elements on
the webpage. Chrome closes the popup when focus changes.

## Verification scope

- Strict TypeScript and no-runtime-dependency build.
- DOM fixtures for metadata, headings and link/image classification.
- Google Search fixtures covering AI Overview citations, sponsored links,
  visual order, delayed results, Off/On changes and unsupported result types.
- Playwright tests execute compiled PageLens code with Chrome API adapters.

The environment cannot currently confirm actual installed-Chrome Google
results. Verify that live Google variations display correct positions before
publishing the release or uploading it to the Chrome Web Store.

References:

- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- https://developer.chrome.com/docs/extensions/reference/api/storage
