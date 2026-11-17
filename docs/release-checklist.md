# PageLens v1.0.1 release acceptance checklist

Maintainer: [reika140](https://github.com/reika140)

## Automated checks

- [ ] `npm ci` in a clean networked environment, using `package-lock.json`.
- [ ] `npm run check` (TypeScript, static audit, unit tests, build integrity).
- [ ] `npm run test:browser` (real Chromium DOM extraction and highlights).
- [ ] `npm run test:ui` (compiled panel, navigation, exports, themes).
- [ ] Verify `npm run package` and ZIP SHA-256 checksums.
- [ ] GitHub Actions pass on the final tagged commit.

## Required real Chrome checks (not yet verified)

- [ ] Clean Chrome 116+ desktop profile can load the unpacked ZIP with no
      manifest or service-worker errors.
- [ ] Toolbar click on normal HTTPS sites scans immediately and opens Side Panel.
- [ ] Opening from Chrome's Side Panel selector alone shows clear guidance if
      there is no temporary `activeTab` access.
- [ ] A navigation to another origin does not reuse stale results; clicking
      PageLens again starts a scan on the new site.
- [ ] Inspector selector exposes six destinations and works at 320px width and
      at 200% browser zoom.
- [ ] Overview metric shortcuts navigate to the correct inspector.
- [ ] An error/warning's **View item** action focuses a related real element.
- [ ] Headings Copy respects search; Images and Links CSV match active filters.
- [ ] Internal/External link tab navigation works with keyboard arrow keys.
- [ ] Highlighting, Light/Dark modes, JSON-LD source view and missing/invalid
      page states behave correctly.
- [ ] No unexpected outbound extension requests; no remote code execution.
- [ ] Inspect accessibility: keyboard focus, contrast, names and responsive
      scrolling. No serious UI or security defects remain.
- [ ] Capture real Chrome screenshots; keep fixture previews out of Store images.

## Publication and ownership

- [ ] Public GitHub repository `reika140/pagelens` exists and the owner confirms
      the `LICENSE`, `AUTHORS.md` and CODEOWNERS attribution.
- [ ] `docs/privacy.md` is reachable at a stable public HTTPS URL.
- [ ] Publish `v1.0.1` Git tag and release assets only after Chrome QA.
- [ ] Verify the project is not exposing secrets, private URLs or customer data.
- [ ] Review current Chrome Web Store policies and listing content.
- [ ] Fill the Store privacy practices form consistently with the policy.
- [ ] Provide genuine screenshots, icon and detailed reviewer instructions.
- [ ] Submit from a Chrome Web Store developer account with 2-Step Verification.

A successful local build alone does not imply successful Web Store review or
production readiness. Keep publication blocked until the required real Chrome
checks and public privacy-policy hosting are complete.
