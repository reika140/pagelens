# PageLens architecture (v1.5.0)

PageLens is a dependency-minimal TypeScript extension on Chrome Manifest V3. It uses a compact popup for on-demand inspection and a narrowly scoped Google content script plus a user-activated link annotation script.

## Inspection pipeline

```text
Toolbar click → temporary activeTab grant → popup scan → DOM snapshot
              → normalization → evidence-based rules → compact inspectors
```

The popup opens with **Metadata**, placing observed Index/Follow indications at the top. Other destinations are Headings, Images, Links, JSON-LD and Settings. The previous Overview destination is removed. Findings remain available under a collapsed Metadata section.

Source boundaries:

| Module | Role |
| --- | --- |
| `src/core/extract.ts` | Bounded one-shot webpage DOM snapshot |
| `src/core/normalize.ts` | Types, link classification, image sources and JSON-LD parsing |
| `src/core/rules.ts` | Evidence-qualified findings and editorial heuristics |
| `src/core/export.ts` | Unicode-safe heading Copy and filtered CSV output |
| `src/popup/main.ts` | Popup inspector navigation, Settings and controls |
| `src/extension/organic-rank.ts` | Conservative Google organic result classifier and SVG position overlays |
| `src/extension/serp-auto.ts` | Google-only automatic startup and preference changes |
| `src/extension/link-highlighter.ts` | Follow/Nofollow/UGC classification, reversible link underlines and DOM observer |
| `src/extension/link-auto.ts` | Dynamic link-highlighter startup |
| `src/extension/http-status.ts` | Bounded page-context HEAD/GET status checks |
| `src/extension/http-queue.ts` | Deduplication, progress and cancel/resume scheduling across batches |

## Automatic Google organic numbering

A declarative content script runs on the four Google Search host patterns defined in the manifest. It reads the local On/Off setting and only annotates supported first-page Web search results. It tries to exclude ads, AI Overview citations and other recognizable rich modules. Numbers are SVG paths rendered outside the result cards, not inserted into their text or links.

This code does not crawl, query a rank API or send search terms to the publisher. Google's changing markup requires live QA for each release.

## Link outlines with temporary tab access

Link highlighting starts Off and saves only a local On/Off preference. It does not ask for persistent HTTP(S) website access or register an all-sites content script. A click on PageLens grants `activeTab` access for the active webpage. When the option is On, the popup injects the bundled `link-highlight-content.js` into that page.

The script examines `<a href>` and `rel`, applying a reversible data attribute and a dashed outline for Follow, Nofollow or UGC. UGC takes precedence over Nofollow; Sponsored-only links are not represented as Follow. It never changes link destinations, `rel`, accessible names or click handlers. An observer updates newly added links and attribute changes. Turning the option Off removes the outlines via `chrome.storage.onChanged`.

Navigating to a different page does **not** annotate it automatically. This is the intentional trade-off for avoiding all-sites access while preserving Chrome's permission model.

## Quick HTTP status checks

The Links inspector has a single **Check all** action covering both Internal and External links, regardless of the currently selected tab or text filter. A dedicated queue deduplicates fragment variants and processes up to 2,000 distinct HTTP(S) URLs per user-initiated scan. The cap is disclosed in the UI on pages that exceed it. The queue launches a maximum of two 16-URL batches simultaneously. Each injected batch has at most five concurrent requests, with a 3.5-second timeout per request. Thus the total network concurrency is at most 10. A compact progress bar displays completed/total; Stop prevents future batches, allows already-running batches to finish, and retains partial results for Resume. A new scan can explicitly Recheck all.

The scan runs while the Chrome action popup is open. Chrome closes popups when focus moves outside, so the current queue and its in-memory results do not continue in a background service. This is an intentional trade-off for retaining `activeTab`-only website access.

The checker is injected only when requested through the existing `activeTab` and `scripting` permissions. Same-origin requests use `HEAD` with current-page credentials; 405 or 501 can fall back to a lightweight `GET` with `Range: bytes=0-0` and prompt body cancellation. Cross-origin requests do not include credentials and are limited by the page's normal CORS policy. All requests use `referrerPolicy: 'no-referrer'`. URLs on a different private/local network host are not probed.

Response badges display *observed* HTTP statuses, including 401, 402, 403 and 501. For redirects, they show the final response. Timeout and network/CORS failures are **Not verified**, never a claim of a broken link. This feature intentionally contacts the link destinations, so it cannot be described as offline-only. No broad host permissions, proxy, analytics or persistent crawler are used.

## Image previews

Images are displayed as two-column rows: a 68 × 68 thumbnail on the left and two text fields (filename, alt text) on the right. Both use 12px Regular weight. Safe raster data URLs and HTTP(S) URLs may be used. Unsafe or unavailable URLs fall back to a placeholder. Thumbnails use lazy loading and `referrerPolicy='no-referrer'`. Their source hosts may receive ordinary requests for the images.

## Security

All inspected page strings are untrusted. The popup renders data with `textContent`, never page-controlled HTML. Source collection is bounded; JSON-LD parser output is formatted safely; CSV includes UTF-8 BOM and formula-injection protection. No analytics, upload API or remote scripts are used; image previews and explicit HTTP checks may contact image/link destinations. Those requests do not go to PageLens servers. Content scripts run only in their declared or explicitly granted scope.

## Testing and release

- `npm run check`: TypeScript strict checks, static audit, unit tests, build validation.
- `npm run test:browser`: real DOM fixture extraction via Chromium.
- `npm run test:ui`: compiled popup UI with a Chrome API adapter, including on-demand link toggling and preview layout.
- `npm run test:serp` and `npm run test:auto-serp`: Google organic classifier / On-Off behavior.
- `npm run test:links`: compiled on-demand link script on native DOM with dynamic mutations.
- `npm run test:http`: actual local HTTP responses via Chromium (or Node fetch when managed Chromium blocks local HTTP), plus popup adapter and unit tests.

Browser adapters do **not** prove the Chrome permission prompt or toolbar interaction works on an unrestricted installed extension. Those are mandatory acceptance steps for the Chrome Web Store release.

## Image display and link outline

The image list presents only the source filename and literal alt text next to a safe thumbnail; raw source and dimensions remain in scan data and CSV export. Link highlighter outlines are 2px dashed and use the existing temporary active-tab model.
