# Architecture

**Version:** 1.0.0  
**Maintainer:** [reika140](https://github.com/reika140)

## Runtime flow

```text
User clicks PageLens toolbar icon
    |
    v
chrome.action.onClicked (MV3 service worker)
    |--- chrome.sidePanel.open()
    |--- chrome.scripting.executeScript(extractPageSnapshot)
    |--- Keep a short-lived, tab-scoped result in memory
    v
Side Panel receives the action scan
    |--- Normalize snapshot and classify elements
    |--- Evaluate findings with qualified evidence
    |--- Render Overview and inspector navigation
    |--- User may highlight, copy or export filtered lists
```

Only the toolbar action generates a new `activeTab` grant. An ordinary Side
Panel button does not provide the browser gesture needed to access a new site.
The Side Panel's Refresh action works only while the temporary grant still
applies. Changing active tabs clears old scan results; navigating invalidates
the corresponding service-worker handoff.

## Functional modules

| Module | Implementation | Responsibility |
| --- | --- | --- |
| Extraction | `src/core/extract.ts` | Safe top-level DOM snapshot; no network operations |
| Normalization | `src/core/normalize.ts` | Heading hierarchy, image source/alt states, link classification, JSON-LD parsing |
| Rule engine | `src/core/rules.ts` | Errors, warnings and qualified information observations |
| Report tools | `src/core/export.ts` | Reusable Markdown/CSV serializers and heading copy format |
| Communication | `src/extension/background.ts`, `action-session.ts` | Toolbar action, scan handoff and navigation invalidation |
| Highlighting | `src/extension/locate.ts` | Revalidate active tab and briefly highlight selected DOM element |
| Side Panel | `src/panel/main.ts` | Inspector selector, finding drill-down, filters, theme and contextual actions |

The Side Panel builds safe DOM nodes with `textContent`, rather than inserting
site-origin content as HTML. Search/filter values and scroll positions are kept
per module in volatile panel memory. A finding with a valid locator can focus a
matching heading, image, internal/external link or JSON-LD block. Special or
invalid anchors intentionally remain outside the visible Links lists; their
findings retain evidence and page highlight functionality.

## Data and security boundaries

- Manifest V3, Chrome 116 minimum, exact permissions: `activeTab`, `scripting`,
  `sidePanel`. No permanent host access or extension `tabs` permission.
- One-shot extraction reads the active document's light DOM. Cross-origin
  frames and closed shadow roots are out of scope.
- Page-derived values are untrusted: never used as executable HTML or remote
  code. JSON-LD is parsed as data, not executed.
- No user-content network transmission, external analytics or dynamic code.
- Default resource limits cap displayed collections and oversized JSON-LD
  parsing; complete high-level counts include truncation notices.
- CSV export includes UTF-8 BOM, quote/newline escaping and mitigation of
  spreadsheet formula injection.
- On-page highlighting uses ephemeral DOM markers; rescanning or navigation
  can invalidate selectors without breaking the Side Panel.
- Empty image alt can be intentional; multiple H1 elements are not
  categorically errors. Editorial title lengths are configurable heuristics.
- JSON syntax validity is not Google Rich Results eligibility. Link type is
  not an HTTP health or broken-link check.

## Build and testing

Native strict TypeScript and zero runtime JS dependencies enable a small MV3
bundle. Node's built-in test runner covers normalization, findings, exports and
toolbar behavior. Playwright covers fixture DOM extraction and the compiled
Side Panel with a Chrome API adapter. See `README.md` for exact commands.

The original WXT/React/Vitest proposal is not implemented; the codebase uses
native DOM UI and Node tests. Chrome installation and toolbar-to-panel
behavior still require an unrestricted desktop Chrome acceptance test.

References: [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab),
[Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel),
[Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).

## User interface font assets

Be Vietnam Pro Regular, Medium and SemiBold are distributed under OFL-1.1
and are packaged in `dist/fonts/` for offline Side Panel rendering. The
source and full license are maintained in `assets/fonts/`. No font service
requests are made at runtime.
