# Security policy

## Supported versions

Security fixes target the latest PageLens release. Pre-1.0 versions are not
supported. See the changelog for security-affecting changes.

## Report a vulnerability

Use GitHub **Private vulnerability reporting** if the repository enables it.
Otherwise request a private reporting channel through a public issue without
posting exploit payloads, credentials, private URLs or user data. Include the
version, OS/Chrome version, impact and redacted reproduction steps.

## Security boundaries

- Manifest permissions are restricted to `activeTab`, `scripting` and
  `sidePanel`; no all-sites host grants, `tabs`, `storage`, permanent content
  scripts or background site monitoring.
- Toolbar click initiates the activeTab-scoped DOM scan. A brief volatile
  service-worker action session transfers results to the Side Panel; session
  entries are invalidated on navigation and tab close.
- DOM extraction reads site data and returns structured values only. It makes
  no network requests and does not execute site-provided JSON-LD as code.
- Website values are always rendered as text, never inserted as executable
  HTML. Chrome MV3 CSP prohibits remote code.
- CSV and Markdown escaping, resource caps, and size-limited JSON parsing
  mitigate untrusted output and memory risk.
- Automated regression tests do not substitute for a manual Chrome
  security review or a clean-profile installation test.
