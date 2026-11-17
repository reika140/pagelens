# Contributing to PageLens

Thanks for your interest in PageLens. The most useful contributions make the inspector more accurate, more accessible, or easier to use without expanding its access to browsing data.

## Before you begin

Search [existing issues](https://github.com/reika140/pagelens/issues) to check whether someone has already reported the problem. For large changes, open an issue first so we can discuss the approach.

Bug reports should include the PageLens and Chrome versions, clear reproduction steps, and an expected result. Use a public test page whenever possible; please don't include passwords, account details, sensitive URLs, or customer data.

## Working on the code

1. Fork the repository and create a branch for your change.
2. Install dependencies with `npm ci`.
3. Run `npm run check` before opening a pull request.
4. If you changed DOM extraction, Google Search numbering, or popup interactions, also run the applicable browser tests:
   - `npm run test:browser`
   - `npm run test:ui`
   - `npm run test:serp`
   - `npm run test:auto-serp`
5. Add or update a fixture or behavioral test when fixing a regression.
6. Explain *why* the change is needed in your pull request, and include before/after screenshots for visual changes.

Browser tests require Python Playwright and Chromium. See the [architecture notes](docs/architecture.md) for component boundaries and the [README](README.md) for build instructions.

## A few project principles

- Keep findings evidence-based. Heuristics must be described as heuristics, not Google rules.
- Treat webpage content as untrusted. Avoid executable HTML and sanitize anything copied or exported.
- Keep local processing and the current limited-permission model. Any new site access or data retention needs a documented reason and privacy review.
- Don't add unsolicited analytics, remote scripts, accounts, or network collection.
- Keep interfaces and public documentation in English. Screenshots must not contain personal information or internal project notes.
- Clearly label fixture screenshots as test previews; never present them as installed-Chrome or live Google captures.

Small, well-tested pull requests are easier to review than large bundles of unrelated changes.

## Releases

Use Semantic Versioning. Update [CHANGELOG.md](CHANGELOG.md) when the behavior changes, and verify the compiled extension before requesting a release. Chrome Web Store publication is separate from merging a pull request.

PageLens source is MIT-licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled font licenses.
