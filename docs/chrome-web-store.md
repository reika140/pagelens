# Chrome Web Store submission notes — PageLens v1.5.0

**Publisher:** [reika140](https://github.com/reika140)  
**Status:** Beta, not submitted or approved.

## Single purpose

Local inspection and annotation of website and search-result technical properties, including metadata, links and Google organic result positions. All analysis takes place in the user's browser.

## Listing text (English)

**Name:** PageLens — Website Inspector

**Short description:** Inspect metadata, headings, images, links and JSON-LD, with optional link highlighting and Google organic numbering.

**Description:**

PageLens makes page inspection easier. Open its compact toolbar popup to review title, robots meta directives, canonical URL, heading structure, image alt attributes, internal and external links, and JSON-LD. Copy headings, inspect evidence and export filtered image/link lists as CSV. The Check all action inspects link response status codes on demand, with no permanent crawling.

For supported Google Search results, PageLens can number recognized organic results automatically. Optionally enable color-coded Follow, Nofollow and UGC link annotations on webpages. The two features can be switched On or Off independently in Settings. Link outlines are applied after the user clicks the PageLens toolbar icon on a page; there is no all-sites permission request.

PageLens is free and open-source, has no login, and does not upload webpage data to a developer server. The optional Check HTTP action sends limited HEAD/GET requests directly to destination websites when clicked. It does not provide arbitrary SEO scores, full-site crawling or remote ranking data.

**Language:** English  
**Website:** https://github.com/reika140/pagelens  
**Support:** https://github.com/reika140/pagelens/issues  
**Privacy:** https://github.com/reika140/pagelens/blob/main/docs/privacy.md

## Permission justification

| Permission | Justification |
| --- | --- |
| `activeTab` | On-demand access after opening PageLens |
| `scripting` | Inspect a user-activated tab, annotate links and run bounded HTTP checks after a separate explicit click |
| `storage` | Remember two independent On/Off settings |
| Google-only content script | Automatically annotate recognized organic results |

PageLens declares **no** HTTP(S) `host_permissions` or `optional_host_permissions`. Outside the separately authorized Google Search domains, PageLens can inspect or annotate a webpage only following a deliberate toolbar click. Chrome may make image requests to display remote thumbnails. The optional, user-triggered HTTP checker processes distinct URLs in 16-URL batches, with at most 10 concurrent requests and a 2,000-URL safety cap per user click. The user can Stop/Resume and see progress; external checks obey CORS. No scanned data is uploaded to a PageLens server.

## Reviewer instructions

1. Install v1.5.0 and open a regular public webpage.
2. Click the PageLens toolbar icon; confirm Metadata opens first, Index/Follow appear above title/description and the five other navigation destinations work.
3. Verify Headings Copy, Images/Links filtered CSV and formatted JSON-LD; Image filename and alt text use equal font sizes and Regular weight.
4. In Links, select Check all on a test page with HTTP 200/401/402/403/501 responses. Confirm status labels and that cross-origin CORS failures are Not verified, not broken.
5. Visit a supported Google Search page-one query; organic number labels should appear when enabled without opening the popup.
6. Open the **Settings** destination (last rail icon). Turn organic numbering Off and On.
7. Verify link outlines are Off by default. Turn it On, visit a page with Follow, Nofollow and UGC links, and click the PageLens toolbar icon.
8. Confirm the colored dashed outlines, then disable highlighting and verify they disappear. Opening a new website without clicking PageLens should not add outlines.
9. No account, server, API key or payment is needed.

## Submission requirements

- Use the **compiled extension ZIP**, not the source ZIP.
- Test with an unrestricted Chrome Desktop installation. Fixture tests do not validate permission dialogs.
- Submit genuine screenshots of the installed extension, not HTML fixtures or mockups; ensure all visible content is English and contains no account data.
- Audit required permissions and content-script matches against the installed manifest.
- Ensure the public GitHub repository and privacy policy describe exactly the same version as the submitted ZIP.
- Recheck the current Chrome Web Store policy and privacy practices at submission time.

Official references:

- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/extensions/reference/api/permissions
- https://developer.chrome.com/docs/extensions/reference/api/scripting
