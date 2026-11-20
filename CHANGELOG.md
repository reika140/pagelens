# Changelog

PageLens follows [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.5.0] - 2026-11-20

### Improved

- Reviewed and standardized all user-facing English copy across the popup,
  including navigation, settings, findings, empty states, tooltips, HTTP
  checking progress, and scan/error feedback.
- Corrected misleading status language: meta robots settings show "Not blocked"
  rather than implying that indexing is allowed; JSON-LD badges identify
  syntax validity, not Google Rich Results eligibility.
- Distinguished missing versus empty metadata, and displayed the total number
  of duplicate declarations rather than incorrectly labeling all tags duplicates.
- Removed redundant HTTP progress text until a link check actually begins.
- Added language regression checks covering key labels and status wording.

### Unchanged

- Popup layout and inspection functionality, Google organic numbering,
  local-only link highlighting, image previews, and bulk HTTP checks.
- Permissions: activeTab, scripting, storage, plus Google-only content scripts.

## [1.4.4] - 2026-11-20

### Fixed

- Replaced repeated 16-link manual checks with a single **Check all** action
  that covers both Internal and External links on the inspected page.
- Added progressive completion counts, a compact progress bar, Stop/Resume,
  and a way to recheck all completed URLs.
- De-duplicated fragment variants across both tabs and kept partially
  checked results when the scan is stopped or interrupted.
- Limited the user-initiated scan to 2,000 distinct URLs and no more than
  10 concurrent HEAD/GET requests, without adding website permissions.
- Added 320-link queue regression tests and a compiled popup bulk-scan test.

### Notes

- Keep the popup open while checking. Chrome closes extension popups when
  focus moves away; there is no background crawler.
- External links remain subject to browser CORS restrictions. Failed
  verification is not automatically classified as a broken link.

## [1.4.3] - 2026-11-20

### Changed

- Unified image filenames and alternative text at 12px Regular weight, preserving original capitalization.
- Added a user-triggered, bounded HTTP checker to Internal and External Links (16 unique links per click).
- Reports 2xx/3xx/4xx/5xx responses as observations; a CORS or network restriction is shown as Not verified.
- Uses same-origin HEAD, falling back to a lightweight GET on HEAD 405/501; redirects are followed.
- No new host permissions, background crawler, analytics or server proxy.
- Added unit, popup and real-response regression tests.

## [1.4.2] - 2026-11-20

### Changed

- Simplified Image Inspector rows to a thumbnail plus the actual source filename and Alt Text only.
- Left empty and missing alt values visually blank; the existing filter still distinguishes the two cases.
- Removed image-index placeholders, status badges, source URLs, dimensions, loading metadata and srcset controls from image rows.
- Increased Follow, Nofollow and UGC dashed outline widths from 1.5px to 2.5px for improved visibility, without affecting page layout.
- Added browser and unit regression tests for filenames, empty alt text and outline widths.

## [1.4.1] - 2026-11-20

### Changed

- Switched link outlines to temporary `activeTab` access. Enabling the option no longer requests all-sites permission or registers a persistent site-wide content script.
- Added compact image previews (68 px) beside alt text, source, dimensions and loading details.
- Kept Google-only automatic organic numbering unchanged.

### Notes

- Link outlines require opening PageLens on each webpage. Automatic all-site highlighting without a click would need broader site access.
- Lazy-loaded thumbnails may request an image from its original host, with no referrer sent.

## [1.4.0] - 2026-11-20

### Changed

- Open Metadata directly and remove the Overview destination.
- Show Index/Follow indications based on meta robots declarations first.
- Move Google organic numbering, appearance, and editorial length preferences into Settings at the end of the navigation rail.
- Reduce inspector heading height and remove redundant descriptions and ornamental dashboard blocks.
- Keep findings accessible as collapsed, evidence-backed observations in Metadata.

### Added

- Optional, automatic Follow/Nofollow/UGC link highlighting on HTTP(S) pages.
- User-initiated host permission request only when the feature is first enabled.
- Persistent On/Off state with dynamic content-script registration, local DOM annotation and removal.
- Unit and Chromium regression tests for link classification, dynamic rel changes, privacy, and permission denial.

### Notes

- Link highlighting is **Off by default**; automatic Google organic numbering remains independently configurable.
- Sponsored links are not classified as Follow. No network transfer or additional mandatory host access.

## [1.3.3] - 2026-11-17

### Fixed

- Removed organic rank labels from inside Google's result cards entirely.
- Rendered upright organic numerals using font-independent SVG vector paths
  in a single document-root overlay, outside page-specific span/transform CSS.
- Kept numbering, exclusion rules and persistent On/Off unchanged.
- Added pixel-level browser regression tests for CSS mirroring/rotation and
  scrolling alignment, plus automatic-content-script tests.

### Verification

- Live Google Search acceptance testing is still required before publication.

## [1.3.2] - 2026-11-17

### Fixed

- Prevented mirrored or rotated organic rank numerals caused by inherited
  or site-specific Google Search CSS. The numeral is now rendered in a
  Shadow DOM isolated from the search page's styles.
- Added a browser regression test that deliberately rotates result-page
  `span` elements by 180 degrees and checks that PageLens numbers remain upright.
- Preserved organic-only detection, automatic numbering and the On/Off setting.

## [1.3.1] - 2026-11-17

### Fixed

- Made page-one Google organic numbering run automatically without opening
  the extension popup, limited to Google .com and .com.vn.
- Corrected results to number from top to bottom in visible order, skipping
  recognizable AI Overview citations, advertisements and rich modules.
- Added a single persistent On/Off control in the popup, with immediate
  removal of labels when disabled.
- Added coverage for delayed Google results and in-page navigation.

### Security and permissions

- Added Chrome `storage` permission for the local On/Off setting.
- Added a Google-only declarative content script; Chrome may display a site
  access warning. No all-sites permission or external network requests.

## [1.2.2] - 2026-11-17

### Changed

- Removed page highlighting from Headings, Images, Links and Overview findings.
- Removed highlight script injection, visual overlays and popup-closing behavior.
- Findings still navigate to related items inside the popup.
- Updated regression tests, privacy policy, README and Chrome Web Store guidance.

## [1.2.1] - 2026-11-17

### Fixed

- Fixed the action popup collapsing into a tiny, clipped window during Chrome's initial auto-size pass.
- Replaced viewport-dependent sizing with intrinsic 448 × 568 CSS-pixel dimensions.
- Added an auto-size regression test that starts from a 25 × 25 viewport.

## [1.2.0] - 2026-11-17

### Changed

- Replaced the Chrome Side Panel with a 448×568 toolbar action popup.
- Reduced Chrome permissions to `activeTab` and `scripting` only.
- Removed the toolbar background service worker and transient scan handoff.
- Scans automatically when the user opens the popup; every open is fresh.
- Kept the compact icon navigation rail, progressive findings, Light/Dark
  themes, filtered Copy/CSV and all six inspection modules.
- Successful page highlights close the popup to reveal the target element.
- Updated public documentation, Chrome Web Store guidance and QA fixtures.

### Verification

- Strict TypeScript, static checks, unit tests and Chromium UI/DOM fixtures.
- Real installed-Chrome acceptance QA and Chrome Web Store review remain pending.

## [1.0.2] - 2026-11-17

### Fixed

- Replaced confusing idle and permission-error screens with a two-line toolbar instruction.
- Removed ineffective Retry/Refresh controls when no scan is active.
- Cleared outdated inspection UI after a tab switch or navigation.

## [1.0.1] - 2026-11-17

### Changed

- Refined the interface with the locally bundled Be Vietnam Pro typeface.
- Reduced heavy bold weights while preserving clear heading hierarchy.
- Updated third-party font licensing and distribution validation.

## [1.0.0] - 2026-11-17

### Added

- Native Chrome Manifest V3 extension using a Side Panel and temporary
  toolbar-activated `activeTab` access.
- Overview with clickable inspector shortcuts, finding severity filters,
  progressive disclosure of technical evidence and exact-item navigation.
- Accessible Inspector selector, direct return to Overview, and per-module
  search/scroll preservation.
- Metadata, Headings, Images, Links and Structured Data inspectors.
- Heading highlighting and Copy; filtered Images CSV; filtered Internal and
  External Links CSV; JSON-LD format and Copy JSON.
- White-first Light theme with sepia accents, Dark theme and compact layouts.
- Strict TypeScript, local extraction and rule evaluation with no analytics,
  no permanent host permissions and no runtime dependencies.
- MIT license, copyright attribution to reika140, GitHub maintenance files,
  security/privacy documentation and Chrome Web Store submission materials.
- Unit tests, Chromium DOM fixtures and compiled UI browser smoke tests.

### Verification

- Automated checks and distribution build pass in the development environment.
- Actual installation and toolbar-to-Side-Panel operation on unrestricted
  desktop Chrome remain pending final acceptance QA.

