# PageLens Privacy Policy

**Effective date:** November 20, 2026  
**Publisher:** [reika140](https://github.com/reika140)  
**Product:** PageLens — Website Inspector

## What the extension does

PageLens has three inspection/annotation features and an optional link-checking action:

1. **On-demand inspection.** Clicking the extension icon opens a popup and reads the selected HTTP(S) page's metadata, headings, image attributes, anchor attributes, and JSON-LD to display findings and prepare user-requested Copy/CSV exports.
2. **Automatic organic numbering.** On supported Google Search pages (`google.com` and `google.com.vn`), PageLens reads result titles, links and nearby structure to identify recognized organic results on page one. This feature is On by default and can be disabled in Settings.
3. **On-demand link outlines.** When enabled in Settings, PageLens reads anchor destinations and `rel` on a webpage only after you click its toolbar icon. Dashed colors identify Follow, Nofollow and UGC links. No all-sites permission is requested and this feature is Off by default.
4. **Optional HTTP status checks.** When you explicitly press **Check all** in the Links inspector, PageLens progressively checks up to 2,000 distinct HTTP(S) URLs from the current page, including both Internal and External links. Requests use two concurrent batches of up to 16 URLs, with at most ten total requests in flight. No requests are made until you click. HEAD is used first; for same-origin HEAD 405 or 501, it may try a lightweight GET. Requests follow redirects, use no Referer header and do not include credentials for external domains. Destination servers may log requests, your IP address and user agent. A progress display and Stop control allow you to interrupt the remaining work. This is not a private/offline operation; the check is never launched automatically and stops when the popup closes.

## Collection, processing and retention

The inspection and annotation features process page information locally in the browser. PageLens does not upload scan results, inspected URLs, search queries or exported files to the publisher or a developer server. Image thumbnails may request their original URL from the image host; that host may receive an ordinary image request. On-demand HTTP checks contact the linked hosts directly. Those hosts may receive your IP address and request details, but PageLens itself receives no telemetry. It has no analytics, user accounts, remote executable code, or ads. PageLens does not sell user data or use it for advertising, profiling, or unrelated purposes.

- Popup inspection and HTTP check results stay in memory until the popup closes.
- Google ranking labels and on-demand link annotations exist only as temporary DOM additions on the displayed page and disappear when disabled or on navigation.
- On/Off preferences are saved with Chrome `storage.local`. Theme and editorial length preferences are stored locally in the popup. No browsing history is retained.
- CSV files are saved to the user's computer only when exported. These files can contain website data, so review them before sharing.
- PageLens does not intentionally read form field values, cookies, passwords, or private browser history. It may still encounter public page text or URLs that contain personal information; these are not transmitted.

## Chrome permissions

| Permission or site access | Reason |
| --- | --- |
| `activeTab` | Temporary access to inspect the page after the user clicks the icon |
| `scripting` | Run DOM extraction and link annotation only after toolbar activation |
| `storage` | Save local On/Off settings |
| Declared Google content scripts | Automatic organic numbering only on the supported Google domains |

There are no all-site `host_permissions` or `optional_host_permissions`. The Google-only content script has narrow site matches for automatic organic numbers. Other webpages are inspected and annotated only after a toolbar click grants `activeTab`. Link status checks need an additional explicit button click and are subject to normal CORS limits on external destinations; unavailable responses are never represented as confirmed HTTP errors. There is no `tabs` permission or background service worker.

## Your controls

Open **Settings** in the PageLens popup to switch organic numbering or link highlighting On or Off. Turning link highlighting Off removes the outlines from previously activated tabs that are still open. Other tabs are not annotated until PageLens is clicked on each of them.

Uninstalling PageLens removes its extension storage. Manually downloaded CSV files remain yours until you delete them.

## Chrome Web Store Limited Use

PageLens's use of browsing activity, website content, and related technical page information complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use/), including the Limited Use requirements.

PageLens processes this information only as necessary to provide or improve its disclosed single purpose: inspecting and annotating technical properties of the current webpage and supported Google Search results. Inspection results, search queries, and exported data are not transmitted to the publisher or to a developer-operated server.

PageLens does not sell user data, share it with advertising networks or data brokers, or use it for personalized advertising, profiling, unrelated purposes, creditworthiness assessments, or lending. The publisher cannot access locally processed inspection data. If you voluntarily provide information in a public support issue, that issue's contents are visible to its readers.

The only routine third-party network contacts are those already described above: image previews may load from the original image hosts, and an explicit **Check all** action sends HTTP requests to the URLs on the inspected page. Those third-party websites may observe standard request information, including your IP address. PageLens does not send these results to the publisher.

## Contact

For questions or privacy concerns, open a [GitHub Issue](https://github.com/reika140/pagelens/issues). Do not post private credentials, customer details or sensitive URLs in public reports. This policy will be updated before any material change in data handling.
