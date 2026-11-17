# Changelog

PageLens follows [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.2] - 2026-11-17

### Fixed

- Replaced confusing idle and permission-error screens with a two-line toolbar instruction.
- Removed ineffective Retry/Refresh controls when no scan is active.
- Cleared outdated inspection UI after a tab switch or navigation.

## [1.0.1] - 2026-11-17

### Changed

- Refined the interface with the locally bundled Be Vietnam Pro typeface.
- Reduced heavy bold weights while preserving clear heading hierarchy.
- Removed project coordination notes from the public source distribution.
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

