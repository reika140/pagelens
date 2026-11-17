# PageLens Privacy Policy

**Effective date:** November 17, 2026  
**Publisher / maintainer:** [reika140](https://github.com/reika140)  
**Product:** PageLens — Website Inspector

## What PageLens accesses

When you click the PageLens toolbar icon, Chrome provides temporary access to
that active tab. PageLens locally inspects its page URL, document title and
metadata, heading elements, image attributes, link attributes and JSON-LD
structured data. It also derives DOM locations used only for user-triggered
highlighting. It does not intentionally inspect form field values, passwords,
private browser history or other tabs in the background.

Websites can include sensitive information in URLs or metadata. Review any
copied or exported output before distributing it to another person.

## Why it accesses these values

The data is used only to provide PageLens's visible single purpose: on-demand
technical inspection of a webpage, evidence-based observations, navigation to
relevant elements and user-requested exports.

## Storage, sharing and transmission

- Scan data is processed locally by the extension and is not sent to the
  developer, advertisers, analytics providers or any other server.
- PageLens makes no background requests to fetch or validate website links.
- The service worker may retain an in-memory scan for up to two minutes to
  deliver it to the Side Panel. Entries are cleared on navigation or tab close.
- Results displayed in the Side Panel reside in memory, not in an account or
  remote database.
- Light/Dark theme and optional editorial thresholds are saved only in
  extension-local `localStorage`.
- Copy and CSV export actions are initiated by you. Exported files remain in
  locations controlled by your browser and operating system. PageLens does
  not upload these files.

## Requested Chrome permissions

| Permission | Reason |
| --- | --- |
| `activeTab` | Temporary access after clicking the toolbar icon |
| `scripting` | Read the chosen page's DOM and briefly highlight selected elements |
| `sidePanel` | Present the inspection interface next to the website |

PageLens does not request permanent access to all websites, `host_permissions`,
`tabs`, `storage`, background site monitoring or a persistent content script.
The browser may revoke its temporary access after a navigation to a different
origin. Click the toolbar icon again to inspect the new site.

## User control and retention

Close PageLens to remove its displayed results. Closing/restarting the browser
also clears transient runtime state. You may clear theme/editorial preferences
through Chrome's extension site-data controls. Remove exported files through
your own file manager. You can uninstall PageLens at any time.

## Children and third parties

PageLens does not offer accounts, advertising or social features, and does not
intentionally collect information about children. There are no third-party
tracking SDKs or analytics services.

## Questions and updates

For privacy questions, use the GitHub repository's Issues page once published:
https://github.com/reika140/pagelens/issues. Do not include private webpage
content, credentials or sensitive URLs in public issues.

Material changes to data practices require an updated policy and appropriate
user-facing disclosure before publication.
