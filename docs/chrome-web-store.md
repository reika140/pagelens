# Chrome Web Store listing — PageLens v1.5.0

PageLens is a Chrome extension for on-page inspection. This document contains public-facing listing copy and a review checklist. It does **not** mean that the extension has been submitted or approved.

## Store listing

**Name:** PageLens — Website Inspector

**Category:** Developer Tools

**Language:** English

**Short description:** Inspect webpage metadata, headings, images, links, and JSON-LD in a simple popup. Check links and view organic results.

**Detailed description (ready to paste):**

PageLens lets you take a closer look at the webpage you are viewing, without opening developer tools. Click the PageLens icon and get a clean, readable view of the page's technical details.

Use PageLens to:
- Review the page title, meta description, Index/Follow directives, canonical URL, social tags, and hreflang links.
- Explore H1–H6 headings in reading order and copy the heading outline.
- Preview images alongside their filenames and alt text, then export the results.
- Browse internal and external links, export CSV, and check HTTP responses with a single Check all action.
- Read JSON-LD structured data with detected types and formatted JSON.
- Optionally show organic result numbers on supported Google Search pages or outline Follow, Nofollow, and UGC links on pages you inspect.

No account is required. The extension does not send inspected page content to a PageLens server. Preferences are saved locally. On-demand HTTP checks contact the linked websites directly, and some responses may be unavailable because of browser CORS restrictions.

PageLens focuses on observable page information. It does not provide arbitrary SEO scores, claim every empty alt attribute is an error, or verify Google rich-result eligibility.

PageLens is free, open source, and currently in beta.

**Project website:** https://github.com/reika140/pagelens

**Support:** https://github.com/reika140/pagelens/issues

**Privacy policy:** https://github.com/reika140/pagelens/blob/main/docs/privacy.md

## Privacy practices and permission justifications

**Single purpose:** Inspect and annotate technical properties of the current webpage and supported Google Search results, using local browser processing.

- **activeTab:** Temporarily inspect the current webpage after the user clicks the toolbar icon.
- **scripting:** Read DOM attributes and optionally outline link types in the user-activated tab.
- **storage:** Save the user's organic-numbering and link-outline preferences locally.
- **Google-only content scripts:** Display optional organic result numbers on declared Google Search domains without requiring a toolbar click.

No all-sites host permission or optional all-sites host permission is requested. PageLens does not transmit inspected page content or search queries to a developer server and does not load remote executable code. Image previews may load images from their original hosts. A user-initiated HTTP status check sends bounded HEAD/GET requests to link destinations, which may observe normal request metadata (including IP address). Do not describe those requests as offline.

These disclosures must match the privacy policy and installed manifest.

## Graphics and screenshots

The listing requires a **128 × 128 icon** and at least one genuine screenshot **1280 × 800** (or 640 × 400). Up to five screenshots can be provided. Small promo tile 440 × 280 and marquee 1400 × 560 are optional.

Suggested order for the five real Chrome screenshots:
1. Metadata and Index/Follow
2. Headings
3. Image previews and alt text
4. JSON-LD structured data
5. Settings

Use **PNG or JPEG** for Store screenshots, not the WebP files optimized for GitHub README. Do not substitute Playwright HTML fixtures for captures from a real installed extension. Check each screenshot for account details, browser profile information, misleading claims, or unrelated visual clutter.

## Reviewer steps

1. Install the extension ZIP and open a public HTTP(S) page.
2. Click PageLens in Chrome's toolbar. The popup should open to Metadata, with Index/Follow at the top.
3. Browse Headings, Images, Links, JSON-LD and Settings. Check Copy and CSV export.
4. Open Links and click Check all. Status codes can be displayed where the browser can read them; CORS failures show Not verified.
5. Use a supported first-page Google Web Search to see optional organic numbering; toggle it in Settings.
6. Enable link outlines in Settings and open PageLens on a page with Follow, Nofollow, and UGC links. The colored outlines should appear without asking for all-site access.
7. No account, API key, subscription, or payment is needed.

## Before submission

- Confirm the ZIP is v1.5.0 and its Manifest V3 permissions match these claims.
- Verify all principal features and the extension toolbar flow on a real Chrome Desktop profile.
- Check the current Developer Dashboard for graphic sizes and required privacy disclosures.
- Ensure the public privacy policy, screenshots, listing copy, and tested ZIP describe the same behavior.
- Do not claim Chrome Web Store approval until Google actually approves the listing.

Official guidance:
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/best-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
