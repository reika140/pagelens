#!/usr/bin/env python3
"""Test the compiled PageLens popup with real DOM fixtures and a Chrome API adapter.

The mock API is only a test driver; the inspected metadata is extracted from
an actual HTML document in Chromium, not invented in the popup.
"""
from html import escape
from pathlib import Path
import base64
import os
import re
import csv
import io
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
SOURCES = ['core/types.js','core/rules.js','core/normalize.js','core/export.js',
           'core/extract.js','extension/permissions.js','extension/locate.js',
           'extension/organic-rank.js','extension/link-highlighter.js','extension/http-status.js','extension/http-queue.js','popup/main.js']

def compiled_bundle():
    parts=[]
    for filename in SOURCES:
        code=(DIST/'js'/filename).read_text('utf8')
        code=re.sub(r'^import\s+.*?;\s*$', '', code, flags=re.M)
        code=re.sub(r'^export\s+(?=(?:function|async function|const|class|let)\b)', '', code, flags=re.M)
        parts.append('// '+filename+'\n'+code)
    return '\n'.join(parts)

ADAPTER = r'''
window.__mockAction = { tabId:19, url:'https://fixture.example.test/complete', blocked:false };
window.__pageInjectionCount = 0;
window.__preferences = {
  'pagelens-organic-ranking-enabled': true,
  'pagelens-link-highlighting-enabled': false
};
window.__granted = false;
window.__grantNext = true;
window.__registered = [];
window.__requestedPermissions = [];
window.__storageListeners = [];
window.chrome = {
  storage: {
    local: {
      get: async key => ({[key]:window.__preferences[key]}),
      set: async values => {
        const changes={};
        for(const [key,val] of Object.entries(values)){
          changes[key]={oldValue:window.__preferences[key],newValue:val};
          window.__preferences[key]=val;
        }
        for(const fn of window.__storageListeners)fn(changes,'local');
      }
    },
    onChanged:{addListener:fn=>window.__storageListeners.push(fn)}
  },
  permissions: {
    contains: async () => window.__granted,
    request: async request => {
      window.__requestedPermissions.push(request);
      if(window.__grantNext)window.__granted=true;
      return window.__grantNext;
    }
  },
  tabs:{query:async()=>[{id:window.__mockAction.tabId,url:window.__mockAction.url}]},
  scripting:{
    getRegisteredContentScripts:async()=>[...window.__registered],
    registerContentScripts:async items=>{window.__registered.push(...items)},
    unregisterContentScripts:async({ids})=>{window.__registered=window.__registered.filter(item=>!ids.includes(item.id))},
    executeScript:async({func,args,files})=>{
      if(window.__mockAction.blocked)throw new Error('Cannot access contents of the page.');
      window.__pageInjectionCount++;
      if(files){window.__lastInjectedFiles=files;return [{result:null}]}
      const frame=document.querySelector('#fixture').contentWindow;
      frame.__pagelensTestLocation=window.__mockAction.url;
      if (func.name === 'checkHttpUrlsInPage') {
        if(!window.__trackBulk)frame.__statusRequests=[];
        if(window.__trackBulk)window.__httpBatchCalls++;
        frame.fetch=async (url,options)=>{
          if(window.__slowHttp)await new Promise(resolve=>setTimeout(resolve,60));
          frame.__statusRequests.push({url,method:options.method});
          if (new URL(url).origin!=='https://fixture.example.test') throw new TypeError('CORS blocked');
          const path=new URL(url).pathname;
          const code=path==='/about'?403:path==='/image-link'?401:path==='/labelled'&&options.method==='HEAD'?501:200;
          return {status:code,url,redirected:false,body:null};
        };
      }
      const callable=func.name==='rankOrganicResultsInPage'
        ? func.toString().replaceAll('window.location.href','(window.__pagelensTestLocation || window.location.href)')
        : func.toString();
      const result=await frame.eval('('+callable+')('+((args||[]).map(arg=>JSON.stringify(arg)).join(','))+')');
      if(result && typeof result==='object' && 'links' in result && 'counts' in result){
        result.url=window.__mockAction.url;delete result.linkTypeCounts;
      }
      return [{result}];
    }
  }
};
'''

def main():
    fixture=(ROOT/'tests/fixtures/complete.html').read_text('utf8')
    # Replace only the smoke-test hero source with a valid inline PNG, so the
    # preview is verifiably rendered without requiring network access.
    import struct, zlib
    def png_chunk(kind, payload):
        return struct.pack('!I', len(payload)) + kind + payload + struct.pack('!I', zlib.crc32(kind + payload) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n' +
           png_chunk(b'IHDR', struct.pack('!2I5B', 2, 2, 8, 2, 0, 0, 0)) +
           png_chunk(b'IDAT', zlib.compress((b'\x00\x2a\x81\xd6'*2))) +
           png_chunk(b'IEND', b''))
    fixture=fixture.replace('src="/images/hero.png"', 'src="data:image/png;base64,'+base64.b64encode(png).decode('ascii')+'"')
    css=(ROOT/'styles/popup.css').read_text('utf8')
    for weight in ('Regular','Medium','SemiBold'):
        font=ROOT/'assets/fonts'/f'BeVietnamPro-{weight}.ttf'
        css=css.replace(f'../fonts/BeVietnamPro-{weight}.ttf',
                        f'data:font/ttf;base64,{base64.b64encode(font.read_bytes()).decode("ascii")}')
    css += '\n'+(ROOT/'styles/inspector.css').read_text('utf8')
    css += '\n'+(ROOT/'styles/popup-window.css').read_text('utf8')
    html=('<!doctype html><html lang="en"><head><meta charset="utf-8"><style>'+css+'</style>'
          '<style>iframe#fixture{position:fixed;top:-2000px;left:-2000px;width:600px;height:700px;pointer-events:none}</style>'
          '</head><body><div id="app"></div><iframe id="fixture" srcdoc="'+escape(fixture,quote=True)+'"></iframe></body></html>')
    chrome=os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(**({'executable_path':chrome} if Path(chrome).exists() else {}),headless=True,args=['--no-sandbox'])
        try:
            sizing=browser.new_page(viewport={'width':25,'height':25})
            sizing.set_content(html)
            assert sizing.evaluate('''() => [document.documentElement.offsetWidth,document.documentElement.offsetHeight]''')==[448,568]
            sizing.close()
            print('PASS intrinsic popup sizing at 25x25 initial viewport')
            page=browser.new_page(viewport={'width':448,'height':568},accept_downloads=True)
            page.set_default_timeout(11000)
            errors=[]
            page.on('pageerror',lambda err:errors.append(str(err)))
            page.set_content(html)
            page.evaluate('''() => {
              const data=new Map();
              Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>data.has(key)?data.get(key):null,setItem:(k,v)=>data.set(k,String(v))}});
              Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__copiedText=value}});
            }''')
            page.locator('#fixture').evaluate('(f)=>new Promise(done=>f.contentDocument.readyState==="complete"?done():f.addEventListener("load",done,{once:true}))')
            page.add_script_tag(content=ADAPTER+compiled_bundle())
            page.get_by_text('PageLens Test: Website Inspection, Metadata, Headings, and JSON-LD',exact=False).first.wait_for()
            assert page.locator('.rail-button').count()==6
            assert page.locator('.rail-button[data-section="overview"]').count()==0
            assert page.locator('.rail-button[data-section="metadata"]').get_attribute('aria-current')=='page'
            assert page.get_by_text('Page declarations and sharing tags.').count()==0
            assert page.locator('.robots-summary').count()==1
            # Interface-copy regression checks: clear declarations and no implied indexing guarantee.
            assert page.evaluate("declarationValue([], '')")=='Not found'
            assert page.evaluate("declarationValue([{value:''}], '')")=='Empty'
            assert page.evaluate("declarationValue([{value:'Example'}], 'Example')")=='Example'
            badges=page.evaluate("Array.from(tagStatus([{value:'First'},{value:'Second'}])).map(el=>el.textContent)")
            assert badges==['Present','2 tags'],badges
            assert 'headers' in page.locator('.robots-hint').inner_text().lower()
            assert page.get_by_text('Allowed',exact=True).count()==0
            assert page.locator('.robots-status').count()==2
            robots=page.evaluate('''() => Array.from(renderRobotsSummary([
              {key:'robots',value:'noindex,nofollow'}]).querySelectorAll('.robots-value')).map(e=>e.textContent)''')
            assert robots==['Noindex','Nofollow'],robots
            only_bing=page.evaluate('''() => Array.from(renderRobotsSummary([{key:'bingbot',value:'noindex'}]).querySelectorAll('.robots-value')).map(e=>e.textContent)''')
            assert only_bing==['Not blocked','Not blocked'],only_bing
            assert page.get_by_role('switch',name='Organic result numbering').count()==0
            assert page.locator('.observations').count()==1
            assert page.locator('.observations').get_attribute('open') is None
            page.screenshot(path=str(ROOT/'docs/screenshots/metadata-fixture-preview.png'),full_page=True)
            assert page.evaluate('document.getElementById("app").scrollWidth<=448')
            print('PASS Metadata first, Index/Follow summary, collapsed findings and compact layout')
            page.locator('.rail-button[data-section="headings"]').click()
            assert page.locator('.heading-card').count()==6
            page.get_by_role('button',name='Copy',exact=True).click()
            assert page.evaluate('window.__copiedText').startswith('H1: Café products')
            page.screenshot(path=str(ROOT/'docs/screenshots/headings-fixture-preview.png'),full_page=True)
            print('PASS Headings Copy and hierarchy')
            page.locator('.rail-button[data-section="images"]').click()
            assert page.locator('.list-stack > .item-card').count()==5
            assert page.locator('.image-thumbnail').count()==5
            assert page.locator('.image-thumbnail').first.evaluate('(el)=>Math.round(el.getBoundingClientRect().width)')==68
            assert page.locator('.image-row').first.evaluate('(el)=>getComputedStyle(el).display')=='grid'
            preview_image=page.locator('.image-thumbnail-img').first
            preview_image.wait_for(timeout=10000)
            assert page.locator('.image-file-name').count()==5
            assert page.locator('.image-alt-label').count()==5
            assert page.locator('.image-alt-value').count()==5
            assert page.locator('.image-file-name').first.inner_text()=='Embedded image'
            assert page.locator('.image-alt-value').first.inner_text()=='Blue café product photograph'
            assert page.locator('.image-file-name').nth(1).inner_text()=='decorative.svg'
            assert page.locator('.image-alt-value').nth(1).inner_text()==''
            assert page.locator('.image-row-heading, .image-source, .image-specs, .image-row .pill').count()==0
            visual=page.locator('.image-row').first.evaluate('''(e)=>{
              const name=getComputedStyle(e.querySelector('.image-file-name'));
              const alt=getComputedStyle(e.querySelector('.image-alt-value'));
              return {nameSize:name.fontSize,altSize:alt.fontSize,nameWeight:name.fontWeight,altWeight:alt.fontWeight};
            }''')
            assert visual=={'nameSize':'12px','altSize':'12px','nameWeight':'400','altWeight':'400'},visual
            assert page.locator('.image-row').nth(1).get_by_text('Image 2').count()==0
            missing=page.evaluate("""() => {
              const node=imageCard({id:77,alt:null,altStatus:'missing',source:'https://example.com/photo.jpg',
                sourceStatus:'present',src:'',lazySrc:'',srcset:'',locator:'img',loading:'lazy',
                width:null,height:null,naturalWidth:null,naturalHeight:null,currentSrc:''});
              return {name:node.querySelector('.image-file-name')?.textContent,
                      alt:node.querySelector('.image-alt-value')?.textContent,
                      aria:node.querySelector('.image-alt-value')?.getAttribute('aria-label')};
            }""")
            assert missing=={'name':'photo.jpg','alt':'','aria':'Alt attribute missing'},missing
            assert preview_image.get_attribute('loading')=='lazy'
            assert preview_image.get_attribute('referrerpolicy')=='no-referrer'
            page.wait_for_function('document.querySelector(".image-thumbnail-img")?.complete === true && document.querySelector(".image-thumbnail-img")?.naturalWidth === 2')
            page.evaluate('document.querySelector("#toast")?.style.setProperty("display", "none")')
            page.screenshot(path=str(ROOT/'docs/screenshots/images-fixture-preview.png'),full_page=True)
            print('PASS Images: two visible fields, filename from source, empty/missing alt left blank, 68px thumbnail')
            page.get_by_label('Filter by alt status').select_option('empty')
            assert page.locator('.list-stack > .item-card').count()==1
            with page.expect_download() as downloaded:page.get_by_role('button',name='Export CSV').click()
            rows=list(csv.DictReader(io.StringIO(Path(downloaded.value.path()).read_text('utf-8-sig'))))
            assert len(rows)==1
            print('PASS Images filter and CSV export')
            page.locator('.rail-button[data-section="links"]').click()
            assert page.get_by_role('tab',name='Internal links').count()==1
            assert page.get_by_role('tab',name='External links').count()==1
            with page.expect_download() as downloaded:page.get_by_role('button',name='Export CSV').click()
            rows=list(csv.DictReader(io.StringIO(Path(downloaded.value.path()).read_text('utf-8-sig'))))
            assert len(rows)==3 and all(row['Kind']=='internal' for row in rows)
            # A single click checks all URLs across both link categories.
            assert page.locator('.http-status-pill').count()==0
            assert page.locator('.http-check-note').is_hidden()
            page.get_by_role('button',name='Check all').click()
            page.get_by_text('HTTP 403',exact=True).wait_for(timeout=10000)
            assert page.locator('.http-check-note').is_visible()
            assert 'of 4 checked' in page.locator('.http-check-note').inner_text()
            assert page.get_by_text('HTTP 401',exact=True).count()==1
            assert page.get_by_text('HTTP 200',exact=True).count()==1
            page.wait_for_function("document.querySelector('.http-check-note')?.textContent.includes('of 4 checked')")
            assert page.locator('.http-status-pill').count()==3
            assert page.locator('.http-progress').get_attribute('max')=='4'
            page.screenshot(path=str(ROOT/'docs/screenshots/links-http-status-fixture-preview.png'),full_page=True)
            print('PASS Links: one click checks Internal and External with progress and CORS-safe outcomes')
            page.get_by_role('tab',name='External links').click()
            assert page.get_by_role('button',name='Recheck all').count()==1
            page.get_by_text('Not verified',exact=True).wait_for(timeout=10000)
            assert page.locator('.http-status-pill').count()==1
            print('PASS Links: external CORS restriction displayed as Not verified without another click')
            assert page.locator('.list-stack > .item-card').count()==1
            page.screenshot(path=str(ROOT/'docs/screenshots/links-fixture-preview.png'),full_page=True)
            print('PASS Links two filters and scoped CSV')
            # A real fixture DOM with 320 newly inserted links must scan in one
            # click, not require 20 user clicks for 16-link batches.
            page.evaluate('''() => {
              const doc=document.querySelector('#fixture').contentDocument;
              const group=doc.createElement('section');group.id='bulk-http-fixture';
              for(let i=0;i<320;i++){
                const link=doc.createElement('a');link.href='/bulk-'+i;
                link.textContent='Product '+i;group.append(link);
              }
              doc.body.append(group);
              window.__httpBatchCalls=0;
              window.__statusCodes=[];
              window.__trackBulk=true;
            }''')
            page.evaluate('refresh()')
            page.locator('.rail-button[data-section="links"]').click()
            page.get_by_role('button',name='Check all').click()
            page.wait_for_function("document.querySelector('.http-check-note')?.textContent.includes('324 of 324 checked')",timeout=20000)
            assert page.get_by_role('button',name='Recheck all').count()==1
            assert page.locator('.http-progress').get_attribute('max')=='324'
            assert page.evaluate('window.__httpBatchCalls')==21
            print('PASS Links bulk scan: 324 distinct URLs in one click, 21 automatic 16-URL batches')
            # Simulate an in-progress batch and press Stop. The current request
            # finishes; the queue must not issue the remaining work.
            page.evaluate('window.__slowHttp=true;window.__httpBatchCalls=0')
            page.get_by_role('button',name='Recheck all').click()
            page.get_by_role('button',name='Stop').click()
            page.get_by_role('button',name='Resume check').wait_for(timeout=20000)
            assert page.evaluate('window.__httpBatchCalls')<=2
            page.evaluate('window.__slowHttp=false')
            page.get_by_role('button',name='Resume check').click()
            page.wait_for_function("document.querySelector('.http-check-note')?.textContent.includes('324 of 324 checked')",timeout=20000)
            assert page.get_by_role('button',name='Recheck all').count()==1
            print('PASS Links stop/resume: completed 324 after stopping without repeating prior results')

            page.locator('.rail-button[data-section="structured"]').click()
            assert page.get_by_text('Syntax valid').count()==1
            page.get_by_text('View JSON').click()
            assert page.locator('pre.json-code').is_visible()
            print('PASS JSON-LD inspector')
            page.locator('.rail-button[data-section="settings"]').click()
            assert page.get_by_role('switch',name='Organic result numbering').get_attribute('aria-checked')=='true'
            link=page.get_by_role('switch',name='Link outlines on inspected pages')
            assert link.get_attribute('aria-checked')=='false'
            assert page.get_by_text('Follow',exact=True).count()>0
            assert page.get_by_text('Nofollow',exact=True).count()>0
            assert page.get_by_text('UGC',exact=True).count()>0
            page.screenshot(path=str(ROOT/'docs/screenshots/settings-fixture-preview.png'),full_page=True)
            link.click()
            page.wait_for_function("window.__preferences['pagelens-link-highlighting-enabled']===true")
            page.wait_for_function("window.__lastInjectedFiles?.[0]==='js/extension/link-highlight-content.js'")
            assert page.get_by_role('switch',name='Link outlines on inspected pages').get_attribute('aria-checked')=='true'
            assert page.evaluate('window.__requestedPermissions.length')==0
            assert page.evaluate('window.__registered.length')==0
            page.get_by_role('switch',name='Link outlines on inspected pages').click()
            page.wait_for_function("window.__preferences['pagelens-link-highlighting-enabled']===false")
            assert page.get_by_role('switch',name='Link outlines on inspected pages').get_attribute('aria-checked')=='false'
            assert page.evaluate('window.__requestedPermissions.length')==0
            print('PASS activeTab-only highlights: toggle works without a broad-site permission prompt')
            page.get_by_role('switch',name='Organic result numbering').click()
            assert page.get_by_role('switch',name='Organic result numbering').get_attribute('aria-checked')=='false'
            assert page.evaluate('window.__preferences["pagelens-organic-ranking-enabled"]')==False
            page.get_by_role('switch',name='Organic result numbering').click()
            assert page.get_by_role('switch',name='Organic result numbering').get_attribute('aria-checked')=='true'
            print('PASS Google organic On/Off moved to Settings')
            page.get_by_role('button',name='Light').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='dark'
            page.get_by_role('button',name='Dark').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='sepia'
            page.get_by_text('Title and description length').click()
            assert page.get_by_text('Save length settings').is_visible()
            print('PASS Settings: theme and configurable heuristics')
            page.locator('.rail-button[data-section="metadata"]').click()
            page.evaluate('window.__mockAction.blocked=true')
            page.get_by_title('Scan page again').click()
            assert page.get_by_text('Unable to inspect this page.').count()==1
            page.locator('.rail-button[data-section="settings"]').click()
            assert page.get_by_role('switch',name='Organic result numbering').count()==1
            assert not errors,errors
            print('PASS unsupported access: Settings still reachable; no JavaScript errors')
        finally:browser.close()

if __name__=='__main__':main()
