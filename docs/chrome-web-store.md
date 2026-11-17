# Chrome Web Store submission guide - PageLens v1.3.3

**Publisher:** [reika140](https://github.com/reika140)  
**Status:** Beta; not submitted or approved.

## Single purpose

Provide local, human-readable technical inspection of a webpage and optional
organic position labels for the first ordinary Google Search results page.
The website inspector is invoked from Chrome's toolbar popup. Organic numbering
runs automatically on supported Google Search pages unless disabled.

## Suggested English listing

**Name:** PageLens - Website Inspector

**Short description:** Inspect website metadata, headings, images, links and JSON-LD. Optionally number Google organic search results.

**Full description:**

> PageLens is a compact, local-first website inspection extension for Chrome.
> Open its toolbar popup to inspect metadata, headings, image alternative text,
> internal and external links and JSON-LD. Navigate findings, copy headings or
> JSON-LD and export filtered image and link lists as CSV.
>
> On supported Google Search pages, PageLens automatically labels the visible
> organic results on page one, ignoring recognizable advertising and rich
> modules. Turn this feature On or Off in the popup at any time.
>
> PageLens does not require an account, crawl full sites, check backlinks,
> query an external ranking provider, track browsing activity or transmit
> scanned pages to developer servers. Results are generated locally.

**Category:** Developer Tools (or the nearest available category)  
**Language:** English  
**Website:** https://github.com/reika140/pagelens  
**Support:** https://github.com/reika140/pagelens/issues  
**Privacy policy:** https://github.com/reika140/pagelens/blob/main/docs/privacy.md

**Before submission:** Confirm that the ZIP, published source, privacy policy, screenshots and reviewer instructions all describe the same approved version. Do not submit fixture screenshots as live Chrome captures.

## Permission justifications

| Permission or site pattern | Justification |
| --- | --- |
| `activeTab` | Read only the selected tab after the user opens the popup. |
| `scripting` | Run an on-demand DOM extractor when inspecting the selected page. |
| `storage` | Persist the On/Off preference for automatic Google organic numbering. |
| `content_scripts.matches`: `google.com`, `google.com.vn` | Automatically label first-page organic Google Search results without needing a toolbar click. |

The Google host access is an intentional new permission compared with v1.3.0.
The Chrome Web Store listing and privacy practices must disclose it. Chrome
may display a site-access warning on installation or upgrade. There are no
broad all-sites permissions, external analytics, remote code or background
service workers. The feature observes only local result-page DOM updates and
makes no additional network requests.

## Privacy questionnaire

Do not claim that the extension never reads page content. The on-demand
inspector reads metadata and page elements locally. On matching Google
Search results, the content script reads result headings, links and page
structure to place number labels. Scan data and Google queries are not
uploaded, sold, or shared with the publisher. Only the preference and theme/
heuristic settings are kept locally in Chrome.

## Media assets and QA

- Product icon: `assets/icons/icon-128.png`.
- Capture 1-5 screenshots of the actual extension installed in Chrome at
  dimensions supported by the current Chrome Web Store Dashboard.
- Consider demonstrating the PageLens popup and the numbered organic results
  in separate genuine screenshots. Never use local HTML fixture screenshots as
  if they came from a live Google result page.
- Confirm correct labels on Google Search page one with AI Overview and
  sponsored results, with and without the automatic switch enabled.

## Reviewer test instructions

1. Install PageLens and open a normal public HTTPS webpage.
2. Click the PageLens toolbar icon to inspect the page in a 448 x 568 popup.
3. Test all six inspectors, Headings Copy, Images/Links Export CSV and JSON-LD.
4. Without clicking the PageLens toolbar icon, open a Google Search on
   `https://www.google.com/search?q=bigcommerce+to+shopify`.
5. Verify organic numbers appear on page one. Ads, AI Overview citations,
   People Also Ask and Top Stories should not receive numbers.
6. Click PageLens and toggle **Automatic organic ranking numbers** Off;
   number labels should disappear. Toggle On to restore them.
7. Verify page-two and Images results are not numbered.
8. No account, secret API key, backend configuration or payment is required.

## Release gates

Run `npm run check`, `npm run test:browser`, `npm run test:ui`,
`npm run test:serp`, `npm run test:auto-serp` and `npm run package`.
A successful fixture test is not equivalent to real Google DOM QA. Publish only
once Chrome installation and permission behavior have been verified.

Official references:

- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- https://developer.chrome.com/docs/extensions/reference/api/storage
