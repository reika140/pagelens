import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLink, inspectImage, headingHierarchy, inspectJsonLd, normalizeSnapshot,
} from '../dist/js/core/normalize.js';
import { DEFAULT_HEURISTICS } from '../dist/js/core/types.js';
import {
  createCsv, createMarkdown, findingsCsv, imagesCsv, linksCsv, copySummary, formatHeadingsForCopy,
} from '../dist/js/core/export.js';
const at = '2026-11-17T02:15:00.000Z';
const url = 'https://example.com/category';
function blank(overrides = {}) {
  return {
    url, title: 'PageLens Test Title With Adequate Length',
    titleTags: [{value:'PageLens Test Title With Adequate Length',locator:'html > head > title'}],
    descriptions: [{value: 'A compelling description that is long enough to fall within the customizable editorial threshold, while communicating useful value to visitors.',locator:'head > meta'}],
    canonicals: [{value:url,locator:'head > link'}],
    robots: [{key:'robots',value:'index,follow',locator:'head > meta'}],
    viewports: [{value:'width=device-width, initial-scale=1.0',locator:'head > meta'}],
    openGraph: [], twitter: [], hreflang: [], headings: [], images: [], links: [], jsonLd: [],
    counts: {headings:0,images:0,links:0,jsonLd:0},
    limits: {headings:10000,images:10000,links:10000,jsonLd:10000},
    ...overrides,
  };
}
function heading(id, level, text = `H${level}`) {return {id,level,text,locator:`main > h${level}:nth-of-type(${id+1})`};}
function image(id, alt, attrs={}) {
  return {id,alt,src:'/one.png',currentSrc:'',srcset:'',lazySrc:'',width:120,height:80,naturalWidth:null,naturalHeight:null,loading:'auto',locator:`img:nth-of-type(${id+1})`,...attrs};
}
function link(id, href, resolvedHref, accessibleName='Label') {
  return {id,href,resolvedHref,text:accessibleName,accessibleName,rel:'',target:'',locator:`a:nth-of-type(${id+1})`};
}
test('relative, same-origin, external, fragment, custom scheme, malformed and missing href', () => {
  assert.deepEqual(classifyLink(link(0, '/about','https://example.com/about'), url), {kind:'internal',url:'https://example.com/about'});
  assert.equal(classifyLink(link(1, 'https://example.com:443/','https://example.com/'), url).kind,'internal');
  assert.equal(classifyLink(link(2, '//blog.example.com/','https://blog.example.com/'), url).kind,'external');
  assert.equal(classifyLink(link(3, '#intro','https://example.com/category#intro'), url).kind,'special');
  assert.equal(classifyLink(link(4, 'mailto:x@example.com','mailto:x@example.com'), url).kind,'special');
  assert.equal(classifyLink(link(5, 'tel:1800','tel:1800'), url).kind,'special');
  assert.equal(classifyLink(link(6, 'javascript:void(0)','javascript:void(0)'), url).kind,'special');
  assert.equal(classifyLink(link(7, null,''), url).kind,'invalid');
  assert.equal(classifyLink(link(8, '   ',''), url).kind,'invalid');
  assert.equal(classifyLink(link(9, 'http://[invalid',''), url).kind,'invalid');
});
test('image alt absence differs from empty and nonempty alt; lazy and srcset candidates supported', () => {
  assert.equal(inspectImage(image(0, null), url).altStatus,'missing');
  assert.equal(inspectImage(image(1, ''), url).altStatus,'empty');
  assert.equal(inspectImage(image(2, '   '), url).altStatus,'empty');
  assert.equal(inspectImage(image(3, 'Decorative'), url).altStatus,'present');
  const lazy=inspectImage(image(4,'Lazy',{src:'',lazySrc:'/lazy.jpg'}),url);
  assert.equal(lazy.source,'https://example.com/lazy.jpg');
  assert.equal(lazy.sourceStatus,'lazy-candidate');
  const srcset=inspectImage(image(5,'Responsive',{src:'',srcset:'/one.webp 1x, /two.webp 2x'}),url);
  assert.equal(srcset.source,'https://example.com/one.webp');
  const unsafe=inspectImage(image(6,'Unsafe',{src:'javascript:alert(1)',lazySrc:''}),url);
  assert.equal(unsafe.sourceStatus,'unsafe');
  assert.equal(unsafe.source,'');
});
test('document-order heading levels and skipped level detection', () => {
  const headings = headingHierarchy([heading(0,1),heading(1,2),heading(2,4),heading(3,3),heading(4,6)]);
  assert.deepEqual(headings.map((h)=>h.skippedLevels),[[],[],[3],[],[4,5]]);
});
test('JSON-LD extracts nested @graph and array types and formats JSON safely', () => {
  const block=inspectJsonLd({id:0,locator:'head > script',tooLarge:false,text:JSON.stringify({
    '@context':'https://schema.org','@graph':[{'@type':'Article'},{'@type':['Thing','Product'], nested:{'@type':'Offer'}}],
  })});
  assert.equal(block.valid,true);
  assert.deepEqual(block.types,['Article','Thing','Product','Offer']);
  assert.match(block.formatted,/\n  "@graph":/);
  assert.equal(inspectJsonLd({id:1,locator:'x',text:'{"a":',tooLarge:false}).valid,false);
  const limited=inspectJsonLd({id:2,locator:'x',text:'{}',tooLarge:true});
  assert.match(limited.error,/skipped for safety/);
});
test('missing/empty/duplicate metadata emit evidence-based findings', () => {
  const scan=normalizeSnapshot(blank({title:'',titleTags:[],descriptions:[{value:'',locator:'a'},{value:'second',locator:'b'}],
    canonicals:[{value:'',locator:'c'},{value:'javascript:foo',locator:'d'}], viewports:[]}),DEFAULT_HEURISTICS,at);
  const ids=scan.findings.map((item)=>item.id);
  assert.ok(ids.includes('title-missing'));
  assert.ok(ids.includes('description-empty'));
  assert.ok(ids.includes('description-duplicate'));
  assert.ok(ids.includes('canonical-empty'));
  assert.ok(ids.includes('canonical-duplicate'));
  assert.ok(ids.includes('viewport-missing'));
  assert.equal(scan.findings.find((f)=>f.id==='description-duplicate').actual,'2 tags');
});
test('multiple H1 is informational; empty headings and level jumps are warnings', () => {
  const heads=[heading(0,1),heading(1,1),heading(2,3,''),heading(3,4)];
  const scan=normalizeSnapshot(blank({headings:heads,counts:{headings:4,images:0,links:0,jsonLd:0}}));
  const multiple=scan.findings.find((f)=>f.id==='h1-multiple');
  assert.equal(multiple.severity,'info');
  assert.match(multiple.description,/not inherently invalid/);
  assert.equal(scan.findings.find((f)=>f.id==='heading-empty-2').severity,'warning');
  assert.equal(scan.findings.find((f)=>f.id==='heading-jump-2').actual,'H3; skipped H2');
});
test('missing alt and unnamed links are aggregated; no claim of broken URLs', () => {
  const images=[image(0,null),image(1,''),image(2,'Photo')];
  const links=[link(0,null,'',''),link(1,'https://other.test/','https://other.test/','')];
  const scan=normalizeSnapshot(blank({images,links,counts:{headings:0,images:3,links:2,jsonLd:0}}));
  assert.equal(scan.counts.external,1);
  assert.equal(scan.counts.invalid,1);
  assert.equal(scan.findings.find((f)=>f.id==='image-alt-missing').actual,'1 / 3 images');
  assert.ok(scan.findings.find((f)=>f.id==='image-alt-empty').description.includes('decorative'));
  assert.equal(scan.findings.find((f)=>f.id==='link-name-possible').actual,'2 links to inspect');
  assert.ok(!scan.findings.some((f)=>/broken link/i.test(f.title)));
});
test('editorial limits are configurable and can be disabled completely', () => {
  const raw=blank({title:'Short',titleTags:[{value:'Short',locator:'a'}]});
  assert.ok(normalizeSnapshot(raw).findings.some((f)=>f.id==='title-length'));
  assert.ok(!normalizeSnapshot(raw,{...DEFAULT_HEURISTICS,enabled:false}).findings.some((f)=>f.id==='title-length'));
  assert.ok(!normalizeSnapshot(raw,{...DEFAULT_HEURISTICS,titleMin:0,titleMax:300}).findings.some((f)=>f.id==='title-length'));
});
test('large pages declare completeness limits rather than silently hiding elements', () => {
  const raw=blank({counts:{headings:10001,images:0,links:0,jsonLd:0},limits:{headings:10000,images:10000,links:10000,jsonLd:10000}});
  assert.ok(normalizeSnapshot(raw).findings.some((f)=>f.id==='truncated-headings'));
});
test('Markdown includes all sections, evidence, Unicode and fenced JSON', () => {
  const raw=blank({title:'Café product details',titleTags:[{value:'Café product details',locator:'title'}],
    headings:[heading(0,1,'Café product guides')],
    images:[image(0,'White café photo')],links:[link(0,'/','https://example.com/')],
    jsonLd:[{id:0,locator:'script',text:'{"@type":"Article","title":"Café résumé"}',tooLarge:false}],
    counts:{headings:1,images:1,links:1,jsonLd:1}});
  const scan=normalizeSnapshot(raw,DEFAULT_HEURISTICS,at);
  const markdown=createMarkdown(scan);
  assert.match(markdown,/# PageLens website inspection/);
  assert.match(markdown,/2026-11-17T02:15:00.000Z/);
  for (const heading of ['Overview','Metadata','Headings','Images','Links','JSON-LD blocks','Findings']) assert.ok(markdown.includes(`## ${heading}`));
  assert.ok(markdown.includes('Café résumé'));
  assert.ok(markdown.includes('White café photo'));
  assert.ok(markdown.includes('```json'));
  assert.ok(markdown.includes('H1'));
});
test('CSV uses BOM, doubles quotes, preserves newlines and mitigates formula injection', () => {
  const csv=createCsv(['Value','Text'],[
    ['Café, résumé notes','Line 1\nLine "2"'],['=SUM(1,2)','+cmd'],[' \t@name','-7'],['normal','website'],
  ]);
  assert.ok(csv.startsWith('\uFEFF"Value","Text"\r\n'));
  assert.ok(csv.includes('"Café, résumé notes","Line 1\nLine ""2"""'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"\'+cmd"'));
  assert.ok(csv.includes('"\' \t@name"'));
  assert.ok(csv.endsWith('\r\n'));
});
test('CSV exports full inspected datasets and copy summary without mutating scan', () => {
  const scan=normalizeSnapshot(blank({images:[image(0,'alt')],links:[link(0,'/','https://example.com/')],counts:{headings:0,images:1,links:1,jsonLd:0}}));
  assert.match(imagesCsv(scan),/"Alt status"/);
  assert.match(linksCsv(scan),/"Resolved URL"/);
  assert.match(findingsCsv(scan),/"Rule ID"/);
  assert.match(copySummary(scan),/PageLens scan summary/);
  assert.ok(scan.findings.length>0);
});

test('a document starting at H3 exposes skipped top-level headings', () => {
  const [head] = headingHierarchy([heading(0,3)]);
  assert.deepEqual(head.skippedLevels, [1,2]);
});
test('complete link-kind totals survive the 10,000-item inspection cap', () => {
  const raw = blank({
    links: [link(0,'/','https://example.com/')],
    counts: {headings:0,images:0,links:12000,jsonLd:0},
    linkTypeCounts: {internal:7000,external:4000,special:999,invalid:1},
  });
  const result = normalizeSnapshot(raw);
  assert.equal(result.counts.internal, 7000);
  assert.equal(result.counts.external, 4000);
  assert.equal(result.counts.special, 999);
  assert.equal(result.counts.invalid, 1);
  assert.equal(result.counts.links, 12000);
  assert.ok(result.findings.some((f)=>f.id==='truncated-links'));
});
test('oversized JSON-LD has not been syntax-validated and is not labelled invalid JSON', () => {
  const raw = blank({jsonLd:[{id:0,text:'{}',locator:'head > script',tooLarge:true}],counts:{headings:0,images:0,links:0,jsonLd:1}});
  const result = normalizeSnapshot(raw);
  const skip = result.findings.find((f)=>f.id==='jsonld-skipped-0');
  assert.equal(skip.severity,'info');
  assert.ok(result.jsonLd[0].tooLarge);
  assert.ok(!result.findings.some((f)=>f.id==='jsonld-invalid-0'));
});

import { isScriptAccessDenied } from '../dist/js/extension/permissions.js';
import { ACTION_SESSION_TTL_MS, isRecentActionScan, isActionScanReply } from '../dist/js/extension/action-session.js';
test('toolbar scan handoff expires quickly and validates result for the active tab', () => {
  assert.equal(isRecentActionScan(1000,1000),true);
  assert.equal(isRecentActionScan(1000,1000+ACTION_SESSION_TTL_MS),true);
  assert.equal(isRecentActionScan(1000,1001+ACTION_SESSION_TTL_MS),false);
  assert.equal(isRecentActionScan(1000,999),false);
  assert.equal(isActionScanReply({ok:true,tabId:31,snapshot:{url:'https://example.com/'}},31),true);
  assert.equal(isActionScanReply({ok:false,tabId:31,error:'No access'},31),true);
  assert.equal(isActionScanReply({ok:true,tabId:32,snapshot:{url:'https://example.com/'}},31),false);
  assert.equal(isActionScanReply({ok:true,tabId:31,snapshot:{}},31),false);
  assert.equal(isActionScanReply(null,31),false);
});
test('Chrome scripting host-access errors are distinguished from generic scan failures', () => {
  assert.equal(isScriptAccessDenied(new Error('Cannot access contents of the page. Extension manifest must request permission')), true);
  assert.equal(isScriptAccessDenied(new Error('Missing host permission for the tab')), true);
  assert.equal(isScriptAccessDenied(new Error('The extensions gallery cannot be scripted.')), true);
  assert.equal(isScriptAccessDenied(new Error('No tab with id: 42')), false);
  assert.equal(isScriptAccessDenied(new Error('The webpage did not return a usable scan result.')), false);
});

test('heading clipboard format preserves hierarchy, Unicode and omits DOM selectors', () => {
  const result=formatHeadingsForCopy([
    {level:1,text:'Home page',locator:'body > h1',skippedLevels:[]},
    {level:2,text:'Products, café résumé',locator:'main > h2',skippedLevels:[]},
    {level:3,text:'',locator:'main > h3',skippedLevels:[]},
  ]);
  assert.equal(result,'H1: Home page\n  H2: Products, café résumé\n    H3: (empty heading)');
  assert.ok(!result.includes('body > h1'));
  assert.equal(formatHeadingsForCopy([]),'');
});
test('section CSV exports accept a restricted subset without leaking other link types', () => {
  const scan=normalizeSnapshot(blank({
    images:[image(0,'Selected'),image(1,'Exclude')],
    links:[link(0,'/inside','https://example.com/inside'),
      link(1,'https://other.example/','https://other.example/'),
      link(2,'mailto:hi@example.com','mailto:hi@example.com'),
      link(3,null,'','Unlinked')],
    counts:{headings:0,images:2,links:4,jsonLd:0},
  }));
  const imageCsv=imagesCsv(scan,scan.images.filter((img)=>img.alt==='Selected'));
  assert.match(imageCsv,/Selected/);
  assert.doesNotMatch(imageCsv,/Exclude/);
  const internalCsv=linksCsv(scan,scan.links.filter((link)=>link.kind==='internal'));
  assert.match(internalCsv,/example.com\/inside/);
  assert.doesNotMatch(internalCsv,/other.example|mailto:|Unlinked/);
  const externalCsv=linksCsv(scan,scan.links.filter((link)=>link.kind==='external'));
  assert.match(externalCsv,/other.example/);
  assert.doesNotMatch(externalCsv,/example.com\/inside|mailto:|Unlinked/);
  assert.equal(scan.links.length,4); // never modify the scan result
});
