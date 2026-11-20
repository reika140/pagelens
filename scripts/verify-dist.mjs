#!/usr/bin/env node
// Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
/** Check that an unpacked distribution is internally consistent before release. */
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const dist = resolve('dist');
const manifest = JSON.parse(await readFile(join(dist,'manifest.json'),'utf8'));
const assert = (truth, message) => { if (!truth) throw new Error(message); };
assert(manifest.manifest_version === 3,'Must use Chrome MV3');
assert(manifest.minimum_chrome_version === '116','Chrome 116 minimum required for supported popup behavior');
assert(manifest.action.default_popup === 'popup.html','The toolbar action must open the popup');
assert(!manifest.background && !manifest.side_panel,'Popup build must not include Side Panel or background service worker');
assert(JSON.stringify([...manifest.permissions].sort()) === JSON.stringify(['activeTab','scripting','storage'].sort()),'Unexpected permissions');
const autoScripts = manifest.content_scripts ?? [];
assert(autoScripts.length === 1 && autoScripts[0].js?.[0] === 'js/extension/google-serp-content.js',
  'Automatic Google numbering must use one restricted content script');
assert(JSON.stringify([...autoScripts[0].matches].sort()) === JSON.stringify([
  'https://www.google.com/*','https://google.com/*',
  'https://www.google.com.vn/*','https://google.com.vn/*'].sort()),
  'Persistent site access must be restricted to Google Search hosts');
assert(!manifest.host_permissions?.length,'No broad host permissions allowed');
assert(!manifest.optional_host_permissions?.length, 'Optional all-sites permission is not allowed');
assert(manifest.content_security_policy.extension_pages === "script-src 'self'; object-src 'self'",'Unexpected CSP');
assert(manifest.version === '1.5.0','Expected the current maintenance release version');
assert(manifest.version_name === manifest.version, 'Display and package versions must match');
const license = await readFile(join(dist, 'LICENSE'), 'utf8');
assert(license.includes('Copyright (c) 2026 reika140'), 'Release missing owner attribution');
const files = [manifest.action.default_popup,
  'styles/popup.css','styles/inspector.css','styles/popup-window.css','js/popup/main.js',
  'js/core/extract.js','js/core/normalize.js','js/core/rules.js','js/core/export.js'];
for (const name of files) { const info = await stat(join(dist,name)); assert(info.isFile(),`File missing: ${name}`); }
const typography = await readFile(join(dist, 'styles/popup.css'), 'utf8');
assert(typography.includes('font-family: "Be Vietnam Pro"'), 'Bundled font is not selected');
assert(!/https?:\/\/[^)]+\.(?:woff2?|ttf|otf)/.test(typography), 'Remote font URL forbidden');
for (const file of ['BeVietnamPro-Regular.ttf', 'BeVietnamPro-Medium.ttf', 'BeVietnamPro-SemiBold.ttf']) {
  assert((await stat(join(dist, 'fonts', file))).size > 10000, `Bundled font missing or invalid: ${file}`);
}
const fontLicense = await readFile(join(dist, 'fonts/OFL.txt'), 'utf8');
assert(fontLicense.includes('SIL OPEN FONT LICENSE Version 1.1'), 'Font license missing');
// Highlighting was removed from the product, not merely hidden in the UI.
const popupScript = await readFile(join(dist,'js/popup/main.js'), 'utf8');
const tabScript = await readFile(join(dist,'js/extension/locate.js'), 'utf8');
const rankingScript = await readFile(join(dist, 'js/extension/organic-rank.js'), 'utf8');
assert(rankingScript.includes('rankOrganicResultsInPage'), 'Organic ranking feature missing from distribution');
assert(rankingScript.includes('data-pagelens-overlay-root') && rankingScript.includes('createElementNS'), 'SVG root-level organic overlay missing');
assert(!/fetch\(|XMLHttpRequest|sendBeacon/.test(rankingScript), 'Unexpected outbound network calls in organic numbering');
const linkScript = await readFile(join(dist, 'js/extension/link-highlight-content.js'), 'utf8');
assert(linkScript.includes('classifyAnchorRel') && linkScript.includes('storage.onChanged'), 'Dynamic link-highlighter bundle incomplete');
assert((linkScript.match(/outline: 2px dashed/g) ?? []).length === 3, 'Link outline width must be 2px for all three types');
assert(!/^(?:import|export)\s/m.test(linkScript), 'Dynamic link highlighter must be a classic content script');
assert(!/fetch\(|XMLHttpRequest|sendBeacon|eval\(|new Function\(/.test(linkScript), 'Link highlighter must not transmit content or execute dynamic code');
const automaticScript = await readFile(join(dist,'js/extension/google-serp-content.js'), 'utf8');
assert(automaticScript.includes('rankOrganicResultsInPage') && automaticScript.includes('storage.onChanged'),
  'Automatic Google ranking script or toggle listener is missing');
assert(!/^(?:import|export)\s/m.test(automaticScript), 'Chrome content script must not use ES module syntax');
assert(!/fetch\(|XMLHttpRequest|sendBeacon|eval\(|new Function\(/.test(automaticScript),
  'Content script must not execute remote code or make requests');
const httpScript = await readFile(join(dist,'js/extension/http-status.js'), 'utf8');
const queueScript = await readFile(join(dist,'js/extension/http-queue.js'), 'utf8');
assert(queueScript.includes('runHttpCheckQueue') && queueScript.includes('HTTP_MAX_URLS'), 'Bulk scan scheduler missing');
assert(httpScript.includes('checkHttpUrlsInPage') && httpScript.includes('AbortController'), 'HTTP quick-check module missing');
assert(!manifest.optional_host_permissions?.length && !manifest.host_permissions?.length, 'HTTP checker must not add website permissions');
assert(popupScript.includes('image-file-name') && popupScript.includes('Alt text:'), 'Two-field image inspector missing');
assert(!/highlightTab|highlightInPage|pagelens-target-overlay|locateButton/.test(popupScript + tabScript),
  'Unexpected page highlighting code in the release');
const html = await readFile(join(dist,'popup.html'),'utf8');
assert(html.includes('src="/js/popup/main.js"'),'Popup must load compiled JS');
assert(html.includes('href="/styles/popup.css"'),'Popup must load CSS');
assert(html.includes('href="/styles/inspector.css"'),'Popup must load redesigned UI');
assert(html.includes('href="/styles/popup-window.css"'), 'Popup must load bounded popup dimensions');
const sizingCss = await readFile(join(dist, 'styles/popup-window.css'), 'utf8');
assert(/min-width:\s*448px/.test(sizingCss) && /min-height:\s*568px/.test(sizingCss),
  'Popup must expose fixed intrinsic dimensions for Chrome auto-sizing');
assert(!/\b(?:min|max)-(?:width|height):\s*[^;]*(?:\b(?:vw|vh|dvh)\b)/.test(sizingCss),
  'Do not clamp Chrome popup root dimensions to viewport units');
const layoutCss = await readFile(join(dist, 'styles/inspector.css'), 'utf8');
assert(!/\bheight:\s*100d?vh/.test(layoutCss), 'Popup root must not depend on viewport-height units');
assert(!/[0-9]+(?:\.[0-9]+)?(?:d?vh|vw)\b/.test(typography + layoutCss + sizingCss),
  'Popup CSS should not use viewport-relative lengths');
for (const size of [16,32,48,128]) {
  const path = join(dist,manifest.icons[String(size)]);
  const png = await readFile(path);
  assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid PNG signature '+path);
  assert(png.readUInt32BE(16) === size && png.readUInt32BE(20) === size,'Wrong icon size '+path);
}
console.log('Distribution audit passed: MV3, Google-only organic content script, toolbar-triggered link highlighting, local preferences, popup, CSP and assets.');
