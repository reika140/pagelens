# PageLens Privacy Policy

**Effective date:** November 17, 2026  
**Publisher:** [reika140](https://github.com/reika140)  
**Product:** PageLens - Website Inspector

## What PageLens does

PageLens has two distinct, local browser features:

1. **Website inspection:** When you click the PageLens toolbar icon, the popup
   inspects the active HTTP(S) webpage's URL, metadata, heading elements, image
   attributes, link attributes and JSON-LD structured data. It generates
   findings and lets you copy or export selected information.
2. **Automatic Google organic numbering:** When the setting is on (the default),
   a small content script operates on Google Search results at `google.com` and
   `google.com.vn`. On the first ordinary Web results page, it identifies
   supported organic result links and inserts local numeric labels. It excludes
   advertising and recognizable AI/rich-result modules. It may observe local
   changes to Google Search result markup so numbers stay in order. It never
   contacts Google separately or queries rankings from another service.

Automatic numbering runs **without opening the popup**. Use the **Automatic
organic ranking numbers** On/Off switch in the popup to disable it. The choice
is saved in the browser. The feature is not a live ranking tracker, cannot
verify Google's internal result classification and might skip layouts it
cannot confidently recognize.

PageLens does not intentionally inspect form input values, passwords, or
private browsing history. Search queries may appear in the Google Search URL
and page DOM, but PageLens does not retain or transmit them to the publisher.

## Local processing and retention

- No login, cloud service, analytics SDK, advertising, telemetry or external
  network requests are used by PageLens.
- Popup scan data is processed in local memory and discarded when the popup
  closes. Ranking numbers are DOM elements on the current Google results page
  and disappear when that page is closed, changed or the feature is switched off.
- The automatic ranking setting is stored using Chrome `storage.local`. The
  light/dark theme and editorial heuristics remain in the popup's localStorage.
- PageLens does not sell, upload or share inspected content, URLs, search
  queries or exported files with the developer or third parties.
- Copy and CSV export are user-initiated; export files are saved locally by
  Chrome and can contain data from the inspected page.

## Chrome permissions and access

| Permission or site scope | Purpose |
| --- | --- |
| `activeTab` | Temporarily inspect the active website after clicking the icon |
| `scripting` | Run one-time, user-triggered DOM extraction in the selected tab |
| `storage` | Remember the On/Off preference for automatic organic numbering |
| Google content-script access | Automatically add and remove rank numbers on `google.com` and `google.com.vn` |

The Google access is declared in `content_scripts.matches`. Chrome may display
an access warning for those domains during installation or upgrade. It is
restricted to those Google domains, not every website. The content script
checks that the page is the first ordinary Web results page before numbering.
Chrome may also allow you to manage site access under extension details.

There is no `tabs` permission, broad `host_permissions`, Side Panel permission,
persistent background service worker, or remote executable code. PageLens
stays local-first and is not a full-site crawler.

## User controls

The automatic Google numbering preference can be switched on or off in the
PageLens popup. Turning it off removes PageLens number labels on Google tabs
where its content script is running. Users can also remove the extension,
clear its site data in Chrome or delete any exported files manually.

Review exported URLs and page metadata before distributing them, as webpage
content can contain personal information.

## Contact and changes

Use [GitHub Issues](https://github.com/reika140/pagelens/issues) for questions
or privacy concerns. Do not post private pages, account details, credentials
or sensitive URLs in public issues. Any material changes to data practices
will be reflected in this policy before publication.
