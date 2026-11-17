#!/usr/bin/env node
// Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT.
/** Check that an unpacked distribution is internally consistent before release. */
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const dist = resolve('dist');
const manifest = JSON.parse(await readFile(join(dist,'manifest.json'),'utf8'));
const assert = (truth, message) => { if (!truth) throw new Error(message); };
assert(manifest.manifest_version === 3,'Must use Chrome MV3');
assert(manifest.minimum_chrome_version === '116','Chrome 116 minimum required for toolbar side panel behavior');
assert(manifest.background.type === 'module','Background must be an ES module');
assert(!manifest.action.default_popup,'Popup would prevent side panel behavior');
assert(JSON.stringify([...manifest.permissions].sort()) === JSON.stringify(['activeTab','scripting','sidePanel'].sort()),'Unexpected permissions');
assert(!manifest.content_scripts,'Unexpected persistent content scripts');
assert(!manifest.host_permissions?.length,'Host access must be temporary via activeTab only');
assert(!manifest.optional_host_permissions,'Unexpected runtime permission prompts');
assert(manifest.content_security_policy.extension_pages === "script-src 'self'; object-src 'self'",'Unexpected CSP');
assert(manifest.version === '1.0.1','Expected the current maintenance release version');
const license = await readFile(join(dist, 'LICENSE'), 'utf8');
assert(license.includes('Copyright (c) 2026 reika140'), 'Release missing owner attribution');
const files = [manifest.background.service_worker,manifest.side_panel.default_path,
  'styles/panel.css','js/panel/main.js','js/core/extract.js','js/core/normalize.js','js/core/rules.js','js/core/export.js'];
for (const name of files) { const info = await stat(join(dist,name)); assert(info.isFile(),`File missing: ${name}`); }
const typography = await readFile(join(dist, 'styles/panel.css'), 'utf8');
assert(typography.includes('font-family: "Be Vietnam Pro"'), 'Bundled font is not selected');
assert(!/https?:\/\/[^)]+\.(?:woff2?|ttf|otf)/.test(typography), 'Remote font URL forbidden');
for (const file of ['BeVietnamPro-Regular.ttf', 'BeVietnamPro-Medium.ttf', 'BeVietnamPro-SemiBold.ttf']) {
  assert((await stat(join(dist, 'fonts', file))).size > 10000, `Bundled font missing or invalid: ${file}`);
}
const fontLicense = await readFile(join(dist, 'fonts/OFL.txt'), 'utf8');
assert(fontLicense.includes('SIL OPEN FONT LICENSE Version 1.1'), 'Font license missing');
const html = await readFile(join(dist,'panel.html'),'utf8');
assert(html.includes('src="/js/panel/main.js"'),'Panel must load compiled JS');
assert(html.includes('href="/styles/panel.css"'),'Panel must load CSS');
for (const size of [16,32,48,128]) {
  const path = join(dist,manifest.icons[String(size)]);
  const png = await readFile(path);
  assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Invalid PNG signature '+path);
  assert(png.readUInt32BE(16) === size && png.readUInt32BE(20) === size,'Wrong icon size '+path);
}
console.log('Distribution audit passed: MV3, minimal permissions, CSP, backgrounds, panel, JS and all icon sizes.');
