# Chrome Web Store submission preparation

**Product:** PageLens — Website Inspector  
**Maintainer:** [reika140](https://github.com/reika140)  
**Version:** 1.0.2 (release candidate)

These details are proposed for the Chrome Web Store Developer Dashboard; they
are not a claim that the extension has been submitted or approved.

## Single purpose

User-triggered local technical inspection of the active webpage through a
Chrome Side Panel, including metadata, headings, images, links and JSON-LD.

## Listing copy (English)

**Name:** PageLens — Website Inspector  
**Short description:** Inspect metadata, headings, images, links and JSON-LD in one click. Private, local-first and easy to navigate.

**Full description:**

> PageLens is a lightweight, local-first website inspector for Chrome. Click
> the extension icon to inspect the active webpage in the Side Panel.
>
> Browse metadata, H1–H6 headings, image alt text, internal/external links and
> JSON-LD structured data. Overview provides evidence-based observations and
> shortcuts that open the relevant inspector or page element. Highlight
> elements on the website, copy heading hierarchies and export filtered image
> and link CSV lists.
>
> PageLens does not crawl sites, assign arbitrary SEO scores, fetch external
> link health checks, require an account or transmit inspected content to an
> analytics service. Website inspection starts only when you click the PageLens
> toolbar icon.

**Category:** Developer Tools (or closest available category)  
**Language:** English  
**Website:** https://github.com/reika140/pagelens (verify live before submission)  
**Support:** https://github.com/reika140/pagelens/issues (verify live before submission)  
**Privacy policy:** https://github.com/reika140/pagelens/blob/main/docs/privacy.md (verify live before submission)

Do not enter planned URLs in the Dashboard before they are publicly reachable.

## Permission justifications

| Permission | Reviewer explanation |
| --- | --- |
| `activeTab` | Temporarily reads only the tab whose PageLens toolbar button is clicked. |
| `scripting` | Injects an on-demand, one-shot DOM extractor and user-requested highlight. |
| `sidePanel` | Shows collected results beside the inspected webpage. |

No `host_permissions`, `tabs`, `storage`, persistent content scripts or
optional broad site access are used. The bundled typeface is loaded only
from extension files, never from a remote font service. Chrome may revoke `activeTab` when the
user changes origins. This is intentional. No remotely hosted code is loaded.

## Privacy questionnaire guidance

PageLens **accesses webpage content and URLs locally** as necessary to provide
its functionality. Do not answer as though the extension cannot access page
content. State accurately that scanned information is not sold, transferred
or sent off-device. No account identifiers, payments, analytics IDs, user
tracking or advertising SDKs are implemented. Local preference values only
include theme and editorial thresholds.

The Chrome Web Store's limited-use and disclosure policies require accurate,
current descriptions of data use and a publicly accessible privacy policy
when user data is handled. Review the developer form categories carefully and
align them with `docs/privacy.md` and actual runtime behavior.

## Store media and metadata

- Icon: `assets/icons/icon-128.png` (128×128 PNG).
- Capture at least one genuine installed-extension screenshot of the current
  version at 1280×800 or 640×400, ideally 1280×800.
- Prepare a 440×280 promotional tile to satisfy the current image guidance.
- Do **not** submit fixture previews from `docs/screenshots/` as genuine Chrome
  product screenshots. See `docs/screenshots.md`.
- Verify name, developer display name, categories, descriptions and screenshots
  all refer to PageLens without keyword stuffing or unsupported claims.
- No subscriptions, advertisements, accounts or paid features are present.
- 2-Step Verification is required for the developer account.

## Reviewer test instructions

1. Open a normal public HTTPS website in Chrome.
2. Click the PageLens toolbar icon (not only Chrome's Side Panel selector).
3. Confirm the Side Panel opens and Overview loads a scan without a domain
   permission prompt.
4. Select each inspector; test Headings Copy, filtered Images/Links CSV,
   contextual finding drill-down and temporary page highlighting.
5. Try an unsupported Chrome internal page and verify a helpful message.
6. No credentials, test accounts or server configuration are required.

## Release gates

Before uploading the **extension ZIP** (not the source ZIP), complete
[the acceptance checklist](release-checklist.md), publish the privacy policy,
review current developer policies and make sure the Chrome profile has passed
real installation testing.

Official references:

- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements)
- [Store listing documentation](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Chrome extension activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
