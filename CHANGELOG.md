# Changelog

PageLens follows [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

