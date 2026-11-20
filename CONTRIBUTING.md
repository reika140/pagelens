# Contributing to PageLens

Contributions are welcome when they improve correctness, accessibility,
security, usability, or maintainability without adding unnecessary access
permissions. The project intentionally avoids arbitrary SEO scores.

## Development

1. Fork the repository and create a short-lived branch.
2. Run `npm install`, `npm run lint`, and `npm test`.
3. Add a behavioral test for new or changed rule logic; use or extend the
   HTML fixtures for DOM extraction changes.
4. Run Playwright DOM/UI smoke tests if you changed extraction, dynamic link annotations, HTTP checking or
   visual interactions (`python tests/browser_e2e.py`, `python tests/popup_smoke.py` and `npm run test:http`).
5. Update English documentation and the changelog when changing user behavior.
6. Submit a pull request with motivation, screenshots for UI changes, test
   results and any new permissions / privacy implications.

## Engineering guidelines

- TypeScript strict mode; no `any` where a narrow contract is possible.
- Do not use network calls to upload webpage content, screenshots, metadata or
  user reports. Do not add remote scripts or third-party analytics.
- Treat all page-derived fields as untrusted. Render with `textContent`, never
  executable HTML; sanitize CSV output against spreadsheet formula injection.
- Do not mislabel heuristics as Google's rules or link categories as HTTP
  validation. Each finding needs a concrete observation and qualified advice.
- Use only the toolbar-triggered `activeTab` grant; link annotations work after a user toolbar click; new site access requires a privacy review.
- Keep locators transient and acknowledge stale DOM.
- Avoid large runtime dependencies if a browser API suffices.

## Versioning

Use Semantic Versioning. Add a changelog entry and retest the release ZIP on a
clean Chromium/Chrome profile before tagging a GitHub release.
