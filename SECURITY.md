# Security policy

## Supported versions

Security fixes target the latest published PageLens release. See `CHANGELOG.md`
for relevant changes.

## Reporting vulnerabilities

Use GitHub Private vulnerability reporting when enabled. Otherwise request a
private reporting channel without publishing exploit payloads, credentials,
private URLs or personal data. Include the PageLens version, Chrome version,
impact and redacted reproduction steps.

## Security model

- The extension declares only `activeTab` and `scripting`; no all-sites host
  grants, persistent content scripts, `tabs`, `storage`, `sidePanel`, or
  background service worker.
- Clicking the toolbar icon grants temporary access to the chosen page and
  opens a popup that performs a fresh one-shot DOM extraction.
- Scan results remain in popup memory until it closes. The extension does not
  transmit website data, emit analytics or request remote executable code.
- Site-origin fields are rendered as text and never evaluated as HTML or code.
- JSON-LD parsing, resource caps, CSV escaping and spreadsheet formula-safety
  mitigate untrusted input and export risks.
- Highlighting injects a temporary DOM overlay; after successful injection,
  the popup closes to reveal the webpage.
- Automated regression tests are not a substitute for manual Chrome
  installation, privacy review and acceptance testing.
