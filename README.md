# PageLens

**Understand any webpage in one click.**

PageLens is an open-source Chrome website inspector created by
[reika140](https://github.com/reika140). Click the extension's toolbar icon to
inspect the active webpage in a compact Side Panel. PageLens focuses on
observable evidence rather than an arbitrary SEO score.

> **Version 1.0.2 · Release candidate.** The code builds and passes the
> automated tests listed below. Installation and end-to-end interaction in an
> unrestricted Chrome profile must be verified before a public Chrome Web Store
> submission. The Chrome Web Store listing is not yet published.

## Features

| Inspector | Capabilities |
| --- | --- |
| **Overview** | Concise page summary, severity-based observations and clickable shortcuts to inspector modules |
| **Metadata** | Title, description, canonical, viewport, robots, Open Graph, Twitter/X and hreflang; missing/empty/duplicate detection |
| **Headings** | H1–H6 hierarchy, empty and skipped headings, on-page highlight and Copy |
| **Images** | Image alt status, source, dimensions, lazy/source-set information, highlight, search, filters and CSV export |
| **Links** | Separate Internal and External lists, search, accessible-name observations, highlight and CSV export |
| **Structured Data** | JSON-LD syntax parsing, nested `@type` discovery, formatted JSON and Copy JSON |

### A navigation-first interface

- A single **Inspector** selector replaces the cramped horizontal six-tab bar.
- Overview shortcuts take you directly to the relevant inspector.
- The **View item** action on an observation opens and focuses the matching
  heading, image or supported link where a DOM locator exists. Observations
  about elements intentionally excluded from the Links list retain a
  page-highlight action and expandable evidence instead.
- Search values and reading positions are preserved when switching modules.
- Long CSS selectors and raw evidence are hidden until requested.
- Light mode uses white as the main surface with restrained sepia accents;
  Dark mode uses neutral charcoal backgrounds. Theme preferences stay local.
- Be Vietnam Pro is bundled for clean, readable typography; headings use
  lighter SemiBold rather than heavy Bold. No remote font requests are made.
- No persistent footer actions. Headings has Copy; Images and Links have
  contextual CSV export actions. Only Internal and External links are listed.

## Installation from the extension ZIP

**Requirements:** Google Chrome 116 or newer on desktop.

1. Download and extract `pagelens-v1.0.2-chrome-extension.zip`.
2. Visit `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and point Chrome to the extracted directory
   containing `manifest.json`.
4. Open a normal HTTP(S) webpage and click the **PageLens toolbar icon**.
   That click provides temporary access to this tab, starts a local scan and
   opens PageLens in the Side Panel.
5. Choose a module from the **Inspector** selector, use the Overview shortcuts
   or open an observation's related item. Copy or export where available.

Opening the panel from Chrome's built-in Side Panel selector **without**
clicking the PageLens toolbar icon does not grant `activeTab` access. In that
case, click PageLens's toolbar icon. If you navigate to a different origin,
Chrome may revoke access; click the toolbar icon again on the new page.
When no scan is available, the Side Panel shows a concise instruction rather
than retry buttons that cannot grant the temporary permission.

## Permissions and privacy

PageLens requests exactly three Chrome permissions:

```json
"permissions": ["activeTab", "scripting", "sidePanel"]
```

- `activeTab` provides temporary access when you click the extension icon.
- `scripting` performs one-shot DOM extraction and element highlighting.
- `sidePanel` shows the inspection interface alongside the webpage.

PageLens does **not** declare permanent host permissions, optional site
permissions, persistent content scripts, `tabs` or `storage`. It does not
contain analytics or send page content to an external service. The extension
reads the URL, document metadata, headings, image/link attributes and JSON-LD
locally to provide its inspection features. It does not read form input values.
Be cautious when sharing manually copied or exported webpage information.

Read the [full privacy policy](docs/privacy.md) and
[security policy](SECURITY.md).

## Development

**Requirements:** Node.js 20+, npm, Python 3.10+ for ZIP packaging, and Python
Playwright + Chromium for the optional browser tests.

```bash
npm ci
npm run check
npm run package
```

For Chromium DOM and UI tests:

```bash
python -m pip install playwright
python -m playwright install chromium
npm run test:browser
npm run test:ui
```

- `dist/`: ready-to-load unpacked Manifest V3 extension.
- `releases/pagelens-v1.0.2-source.zip`: public repository source archive.
- `releases/pagelens-v1.0.2-chrome-extension.zip`: Chrome extension ZIP.
- `releases/SHA256SUMS.txt`: checksums for both archives.

The test suite uses Node's built-in test runner for unit/regression tests and
Playwright's browser automation for DOM/UI smoke tests. The browser UI tests
use a Chrome API adapter and actual fixture DOM extraction. They do not prove
that Chrome has installed or granted access to the extension successfully.

### Technology and dependencies

PageLens uses native Manifest V3 ES modules, strict TypeScript, CSS variables
and browser DOM APIs. It has **no JavaScript runtime dependencies**.
The interface includes locally hosted Be Vietnam Pro font files under OFL-1.1. TypeScript
5.8.3 is the only development dependency. The extension uses a dependency-minimal native UI and does not include a
framework runtime.

The committed npm lockfile pins TypeScript 5.8.3. GitHub Actions runs
`npm ci`, static checks, unit tests and Chromium-based UI tests on every push.

## Repository layout

```text
pagelens/
├── .github/              # CI, CODEOWNERS and contribution templates
├── assets/               # Extension icons and OFL-licensed local fonts
├── docs/                 # Architecture, privacy, Store review and QA
├── scripts/              # Build, lint, package and distribution audit
├── src/
│   ├── core/             # Extraction, normalization, findings, reports
│   ├── extension/        # Toolbar action, scan handoff, highlight
│   └── panel/            # Side Panel presentation and navigation
├── styles/               # Light/Dark design tokens and component styles
├── tests/                # Unit tests, DOM fixtures, Chromium smoke tests
├── LICENSE
└── manifest.json
```

## Quality status and limitations

Automated checks run for this candidate: TypeScript strict compilation, static
safety audit, all unit tests, three real-DOM Chromium fixtures, compiled UI
smoke tests, CSV export, heading clipboard, element highlight, responsive
widths (320/360/440px), both themes and a Manifest V3 distribution audit.

**Not yet verified:** Genuine Chrome installation, toolbar activation and Side
Panel interaction on a non-managed desktop Chrome profile, including real
browser permission handling. See the [release checklist](docs/release-checklist.md)
before tagging a public GitHub release or uploading to the Chrome Web Store.

PageLens intentionally does not crawl entire sites, check link HTTP status,
validate Google Rich Results eligibility, inspect cross-origin frames or
closed shadow roots, or provide keyword rankings or SEO scores. Large DOM
collections are capped for display and report a completeness observation.

## Ownership, licensing and contribution

Copyright © 2026 **[reika140](https://github.com/reika140)**.
Released under the [MIT License](LICENSE). The repository identifies the
maintainer in [AUTHORS.md](AUTHORS.md) and
[.github/CODEOWNERS](.github/CODEOWNERS). Third-party license details are
listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull requests and
[SECURITY.md](SECURITY.md) for responsible security disclosures.
