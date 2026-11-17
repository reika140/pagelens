# PageLens v1.3.3 release acceptance checklist

Maintainer: [reika140](https://github.com/reika140)

## Automated QA

- [ ] Run `npm ci`, `npm run check`, `npm run test:browser`, `npm run test:ui`.
- [ ] Run `npm run test:serp` and `npm run test:auto-serp`.
- [ ] Verify the extension and source ZIPs and SHA-256 checksums.
- [ ] Review extension permissions: `activeTab`, `scripting`, `storage`.
- [ ] Verify declared content scripts match only Google .com and .com.vn hosts.
- [ ] Confirm no remote code, unexpected network calls or sensitive fixtures.

## Real Chrome acceptance QA - mandatory

- [ ] Install the unpacked extension in a clean Chrome profile.
- [ ] Accept/verify narrow Google site access after the update.
- [ ] Google Search first page shows correct organic numbering without opening PageLens.
- [ ] Verify the first two organic positions on queries including AI Overview,
      Ads, sitelinks and People Also Ask. Compare visual order top to bottom.
- [ ] Verify the first organic result starts at 1, not after AI citations.
- [ ] Verify upright 1/2/3 on real Google Search (not mirrored or rotated),
      including scrolling, zoom, and a Google result card rerender.
- [ ] Verify the SVG labels appear once, remain aligned with result titles,
      and disappear immediately when disabled.
- [ ] Switch Off in the popup and confirm labels disappear on Google pages.
- [ ] Reload Google while Off; labels must stay hidden.
- [ ] Switch On, reload Google and verify labels return automatically.
- [ ] Verify no numbering on Images/Shopping/News and search results page 2.
- [ ] Verify switching search queries does not duplicate or leave stale badges.
- [ ] Verify popup still scans ordinary sites, six inspectors and Copy/Export.
- [ ] Verify popup intrinsic 448 x 568 sizing and keyboard accessibility.
- [ ] Inspect privacy, data use and permission warnings in Chrome.
- [ ] Capture real Chrome screenshots for Store submission.

## Publication

- [ ] Review MIT, OFL, AUTHORS, CODEOWNERS and public ownership details.
- [ ] Publish the approved source and privacy policy before Store submission.
- [ ] Do not upload internal project notes or private customer/website data.
- [ ] Publish the v1.3.3 GitHub Release only after acceptance QA.
- [ ] Review current Chrome Web Store policies and privacy practices forms.
- [ ] Submit the compiled extension ZIP, not the source ZIP.

Passing fixture tests does not prove success on a live Google Search page.
