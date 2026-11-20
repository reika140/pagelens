# PageLens v1.5.0 release checklist

Maintainer: [reika140](https://github.com/reika140)

## Automated checks

- [ ] Run `npm ci && npm run check && npm run package`.
- [ ] Run `npm run test:browser`, `npm run test:ui`, `npm run test:serp`, `npm run test:auto-serp`, and `npm run test:links` and `npm run test:http`.
- [ ] Verify extension ZIP root manifest is v1.5.0, permissions are expected, CSP is local-only, and SHA-256 matches.
- [ ] Confirm no internal documentation, generated node_modules, or private screenshots in distribution.

## Desktop Chrome acceptance

- [ ] Install unpacked v1.5.0 in a clean, unrestricted Chrome profile.
- [ ] Metadata opens by default; Index/Follow are first; oversized module descriptions are absent.
- [ ] Validate robots meta `index,follow`, `noindex,nofollow`, `none`, missing directives and Googlebot-specific declarations. Do not mistake HTTP X-Robots headers for verified data.
- [ ] Headings Copy, Images/Links exports, JSON-LD and nested finding navigation work.
- [ ] Google Search organic numbering is automatic and can be switched off/on in Settings.
- [ ] Link outlining starts Off; switching it On does not request broad website permission.
- [ ] Open PageLens on a test page with Follow, Nofollow, UGC and Sponsored links. Check dashed colors and unchanged link targets/layout.
- [ ] Dynamically add links or edit `rel`; verify that markers update and reinjection does not duplicate listeners.
- [ ] Turn highlighting Off and confirm markers disappear. A separate tab must remain unannotated until clicked.
- [ ] Images display 68 × 68 thumbnails, filename and literal Alt Text at 12px Regular weight; empty alt stays empty.
- [ ] Links Check all runs only after clicking, covers Internal and External together, shows real HTTP codes (200, 401, 402, 403, 501), follows redirects and indicates fallback GET when HEAD is unsupported.
- [ ] External CORS errors/timeouts show Not verified. Verify one click automatically checks 320+ distinct URLs in progressive batches, displays progress, and supports Stop/Resume. Confirm the 2,000-URL per-scan safety cap, at most 10 concurrent requests, and no broad permissions or third-party status proxy.
- [ ] Confirm the Manifest includes no `host_permissions` or `optional_host_permissions`.
- [ ] Verify layout, keyboard focus, light/dark mode and 448×568 popup sizing.
- [ ] Capture genuine English-only screenshots for README and Chrome Web Store.

## Publishing

- [ ] Publish public v1.5.0 source and updated privacy documentation only after user acceptance.
- [ ] Create an official GitHub release and attach the verified extension ZIP.
- [ ] Submit the matching extension to Chrome Web Store after permission and privacy disclosure review.

Playwright fixtures and API adapters do not validate actual installed-Chrome toolbar permission behavior on all websites.
