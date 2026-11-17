#!/usr/bin/env python3
"""Side-panel UI interaction smoke tests with real DOM fixture extraction.

This composes the *compiled* production modules in one browser test script and
adapts Chrome APIs to an iframe. It does not purport to test extension install.
The collected data is real DOM data from tests/fixtures/complete.html, not mock.
"""
from html import escape
import base64
from pathlib import Path
import os
import re
import csv
import io
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'dist'
SOURCE_FILES=[
    'core/types.js','core/rules.js','core/normalize.js','core/export.js',
    'core/extract.js','extension/permissions.js','extension/action-session.js','extension/locate.js','panel/main.js',
]

def compiled_test_bundle():
    parts=[]
    for file in SOURCE_FILES:
        source=(DIST/'js'/file).read_text('utf8')
        source=re.sub(r'^import\s+.*?;\s*$', '', source, flags=re.M)
        source=re.sub(r'^export\s+(?=(?:function|async function|const|class|let)\b)', '', source, flags=re.M)
        parts.append('// '+file+'\n'+source)
    return '\n'.join(parts)

ADAPTER=r'''
// Test adapter, not a privileged browser extension: verify compiled UI and
// action-scan handoff with real DOM extraction from an HTML fixture.
window.__mockAction = { granted: true, forbidden: false, blocked: false, url: 'https://fixture.example.test/complete' };
window.__mockTabActivated = null;
window.__mockTabUpdated = null;
window.__mockMessageListener = null;
window.chrome = {
  tabs: {
    query: async () => [{id:19,url:window.__mockAction.url}],
    onActivated: {addListener:(fn)=>{window.__mockTabActivated=fn;}},
    onUpdated: {addListener:(fn)=>{window.__mockTabUpdated=fn;}},
  },
  runtime: {
    onMessage: {addListener:(fn)=>{window.__mockMessageListener=fn;}},
    sendMessage: async (message) => {
      if (message.type !== 'pagelens:get-action-scan' || !window.__mockAction.granted) return null;
      if (window.__mockAction.forbidden) return {ok:false,tabId:19,error:'Cannot access contents of the page.'};
      const docWindow=document.getElementById('fixture').contentWindow;
      const snapshot=docWindow.eval('('+extractPageSnapshot.toString()+')()');
      // srcdoc has an about:srcdoc URL. Assign the fixture's intended HTTPS
      // origin so link classification mimics a real navigated webpage.
      snapshot.url=window.__mockAction.url;
      delete snapshot.linkTypeCounts; // Recompute kinds from the fixture's real hrefs.
      return {ok:true,tabId:19,snapshot};
    },
  },
  scripting: {
    executeScript: async ({func,args}) => {
      if (window.__mockAction.blocked || window.__mockAction.forbidden) {
        throw new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.');
      }
      const docWindow=document.getElementById('fixture').contentWindow;
      const serialized='('+func.toString()+')('+((args||[]).map((arg)=>JSON.stringify(arg)).join(','))+')';
      const result=docWindow.eval(serialized);
      if (result && typeof result==='object' && 'links' in result && 'counts' in result) {
        result.url=window.__mockAction.url;
        delete result.linkTypeCounts;
      }
      return [{result}];
    },
  },
};
'''

def main():
    fixture=(ROOT/'tests/fixtures/complete.html').read_text('utf8')
    css=(ROOT/'styles/panel.css').read_text('utf8')
    # Inline the exact bundled font bytes for this about:blank-based fixture.
    # The production Side Panel instead loads the same local files from dist/fonts/.
    for weight in ('Regular', 'Medium', 'SemiBold'):
        font_file=ROOT/'assets/fonts'/f'BeVietnamPro-{weight}.ttf'
        embedded=base64.b64encode(font_file.read_bytes()).decode('ascii')
        css=css.replace(f'../fonts/BeVietnamPro-{weight}.ttf',f'data:font/ttf;base64,{embedded}')
    skeleton=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><style>{css}</style>
      <style>iframe#fixture{{position:fixed;top:-2000px;left:-2000px;width:600px;height:700px;pointer-events:none}}</style>
      </head><body><div id="app"></div><iframe id="fixture" srcdoc="{escape(fixture,quote=True)}"></iframe></body></html>'''
    with sync_playwright() as p:
        browser=p.chromium.launch(**({'executable_path': os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'} if (os.environ.get('PAGELENS_CHROMIUM') or Path('/usr/bin/chromium').exists()) else {}),
            headless=True, args=['--no-sandbox','--disable-gpu'])
        try:
            page=browser.new_page(viewport={'width':440,'height':900}, device_scale_factor=1, color_scheme='light')
            page.set_default_timeout(6000)
            errors=[]
            page.on('pageerror',lambda err:errors.append(str(err)))
            page.set_content(skeleton)
            # Managed Chromium blocks navigation and about:blank localStorage.
            # Model extension-page localStorage without claiming a real install.
            page.evaluate('''() => {
              const values = new Map();
              Object.defineProperty(window, 'localStorage', {
                configurable: true,
                value: {
                  getItem: (key) => values.has(key) ? values.get(key) : null,
                  setItem: (key, value) => { values.set(key, String(value)); },
                  removeItem: (key) => { values.delete(key); }
                }
              });
              window.__copiedText = null;
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: async (value) => { window.__copiedText = value; } }
              });
            }''')
            page.locator('#fixture').evaluate('(element)=>new Promise(resolve=>element.contentDocument?.readyState==="complete"?resolve():element.addEventListener("load",resolve,{once:true}))')
            page.add_script_tag(content=ADAPTER+compiled_test_bundle())
            page.get_by_text('PageLens Test: Website Inspection, Metadata, Headings, and JSON-LD').wait_for(timeout=10000)
            # Verify the shipped font was loaded, not merely declared as a fallback.
            loaded=page.evaluate("document.fonts.load('400 14px \"Be Vietnam Pro\"').then(f=>f.length)")
            assert loaded>=1 and page.evaluate("document.fonts.check('400 14px \"Be Vietnam Pro\"')")
            assert page.evaluate("getComputedStyle(document.body).fontFamily.includes('Be Vietnam Pro')")
            assert page.locator('.module-tile .tile-value strong').all_text_contents()[0:2] == ['6','5']
            assert page.get_by_text('PageLens').count()>=1
            assert page.get_by_text('Café products, articles & guides').count()==0  # Overview does not repeat the complete heading tree
            assert page.locator('.evidence').first.is_visible() is False  # Evidence is progressive disclosure
            assert page.locator('.technical-location').first.is_visible() is False # Selectors are hidden by default
            assert page.evaluate('document.documentElement.dataset.theme') == 'sepia'
            assert page.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(255, 255, 255)'
            findings_y = page.locator('.findings-heading').first.bounding_box()['y']
            assert findings_y < 620, f'Overview navigation is not compact enough: findings start at y={findings_y:.1f}px'
            assert page.locator('.nav-tabs').count()==0
            assert page.locator('#module-switch option').count()==6
            assert page.get_by_label('Choose inspector').input_value()=='overview'
            assert page.get_by_role('button',name='Inspect Headings, 6 found').count()==1
            assert page.locator('.export-footer').count() == 0
            assert page.get_by_role('button',name='Markdown').count()==0
            assert page.get_by_role('button',name='Findings CSV').count()==0
            # Native selector stays usable at narrow Chrome Side Panel widths.
            for width in (320, 360, 440):
                page.set_viewport_size({'width': width, 'height': 900})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Horizontal overflow at {width}px'
            page.set_viewport_size({'width': 440, 'height': 900})
            print(f'PASS compact white+sepia layout: findings begin at {findings_y:.0f}px, no footer or overflow at 320/360/440px')
            shot = ROOT / 'docs/screenshots/overview-fixture-preview.png'
            shot.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(shot), full_page=True)
            print('PASS overview: scan results rendered and metrics match real DOM extraction')
            print('PASS streamlined overview: no persistent download controls')
            # Overview counts are real navigation targets, not decorative KPIs.
            page.get_by_role('button',name='Inspect Headings, 6 found').click()
            assert page.get_by_label('Choose inspector').input_value()=='headings'
            page.get_by_title('Back to Overview').click()
            assert page.get_by_label('Choose inspector').input_value()=='overview'
            assert page.get_by_role('button',name='Inspect metadata').count()==1
            # A finding opens the exact related image, not only the Images tab.
            finding=page.locator('.finding').filter(has_text='Images without alt attributes').first
            if finding.count():
                finding.get_by_role('button',name='View item').click()
                assert page.get_by_label('Choose inspector').input_value()=='images'
                assert page.locator('.item-card[data-focused="true"]').count()==1
                assert page.evaluate('document.activeElement.dataset.locator')
                page.get_by_title('Back to Overview').click()
            # Technical selectors do not appear until Evidence / DOM location opens.
            assert page.locator('.selector:visible').count()==0
            print('PASS navigation: module selector, clickable metrics, Overview shortcut and deep-linked findings')
            page.get_by_label('Choose inspector').select_option('metadata')
            assert page.get_by_text('Robots directives').count() == 1
            assert page.get_by_text('Primary OG title').count()==1
            assert page.get_by_text('Twitter property fallback').count()==1
            assert page.get_by_text('vi-VN').count()==1
            print('PASS metadata tab: robots, Open Graph, Twitter and hreflang')
            page.get_by_label('Choose inspector').select_option('headings')
            assert page.locator('.heading-card').count() == 6
            assert page.get_by_text('Café products, articles & guides').count() == 1
            # The actual highlight function runs against the fixture iframe's DOM.
            page.get_by_title('Highlight H1 heading on the webpage').first.click()
            assert page.locator('#fixture').evaluate('(f)=>!!f.contentDocument.getElementById("pagelens-target-overlay")')
            assert page.get_by_role('button',name='Export CSV').count()==0
            page.get_by_role('button',name='Copy',exact=True).click()
            copied=page.evaluate('window.__copiedText')
            assert copied.startswith('H1: Café products, articles & guides')
            assert '  H2: Metadata overview' in copied
            assert 'main > h1' not in copied
            page.get_by_label('Search heading text…').fill('Metadata overview')
            page.get_by_role('button',name='Copy',exact=True).click()
            assert page.evaluate('window.__copiedText')=='  H2: Metadata overview'
            page.get_by_label('Choose inspector').select_option('metadata')
            page.get_by_label('Choose inspector').select_option('headings')
            assert page.get_by_label('Search heading text…').input_value()=='Metadata overview'
            print('PASS navigation preserves module search state')
            page.get_by_label('Search heading text…').fill('')
            page.set_viewport_size({'width':440,'height':300})
            page.evaluate('document.getElementById("view").scrollTop=120')
            before_scroll=page.evaluate('document.getElementById("view").scrollTop')
            assert before_scroll > 0
            page.get_by_label('Choose inspector').select_option('metadata')
            page.get_by_label('Choose inspector').select_option('headings')
            after_scroll=page.evaluate('document.getElementById("view").scrollTop')
            assert after_scroll == before_scroll, f'Heading scroll position not preserved: {before_scroll} -> {after_scroll}'
            page.set_viewport_size({'width':440,'height':900})
            print('PASS navigation preserves per-module reading position')
            page.evaluate('document.getElementById("toast")?.remove(); document.activeElement?.blur()')
            headings_shot=ROOT / 'docs/screenshots/headings-fixture-preview.png'
            page.screenshot(path=str(headings_shot),full_page=True)
            print('PASS heading tab: hierarchy, highlight, copy full and filtered headings without selectors')
            page.get_by_label('Choose inspector').select_option('images')
            assert page.locator('.list-stack > .item-card').count()==5
            page.get_by_label('Filter by alt status').select_option('empty')
            assert page.locator('.list-stack > .item-card').count()==1
            page.get_by_label('Filter by alt status').select_option('all')
            page.get_by_label('Search source or alt text…').fill('Lazy image')
            assert page.locator('.list-stack > .item-card').count()==1
            with page.expect_download(timeout=8000) as image_download:
                page.get_by_role('button',name='Export CSV').click()
            image_csv=Path(image_download.value.path()).read_text('utf-8-sig')
            image_rows=list(csv.DictReader(io.StringIO(image_csv)))
            assert len(image_rows)==1
            assert image_rows[0]['Alt text']=='Lazy image'
            assert 'lazy-original.jpg' in image_rows[0]['Lazy src']
            print('PASS image tab: alt filter, search, lazy source, filtered CSV export')
            page.get_by_label('Choose inspector').select_option('links')
            assert page.get_by_role('tab',name='Internal links').count()==1
            assert page.get_by_role('tab',name='External links').count()==1
            assert page.get_by_role('tab',name='Internal links').get_attribute('aria-selected')=='true'
            assert page.locator('.list-stack > .item-card').count()==3
            assert page.get_by_label('Filter links by kind').count()==0
            assert page.get_by_text('mailto:',exact=False).count()==0
            assert page.locator('#links-results').get_attribute('aria-labelledby')=='links-internal'
            page.evaluate('document.getElementById("toast")?.remove(); document.activeElement?.blur()')
            for width in (320,360,440):
                page.set_viewport_size({'width':width,'height':900})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Links overflow at {width}px'
            page.set_viewport_size({'width':440,'height':900})
            links_shot=ROOT / 'docs/screenshots/links-fixture-preview.png'
            page.screenshot(path=str(links_shot),full_page=True)
            with page.expect_download(timeout=8000) as internal_download:
                page.get_by_role('button',name='Export CSV').click()
            internal_rows=list(csv.DictReader(io.StringIO(Path(internal_download.value.path()).read_text('utf-8-sig'))))
            assert len(internal_rows)==3 and all(row['Kind']=='internal' for row in internal_rows)
            page.get_by_role('tab',name='External links').click()
            assert page.get_by_role('tab',name='External links').get_attribute('aria-selected')=='true'
            assert page.locator('.list-stack > .item-card').count()==1
            assert page.locator('#links-results').get_attribute('aria-labelledby')=='links-external'
            page.get_by_role('tab',name='External links').press('ArrowLeft')
            assert page.get_by_role('tab',name='Internal links').get_attribute('aria-selected')=='true'
            page.get_by_role('tab',name='Internal links').press('ArrowRight')
            assert page.get_by_role('tab',name='External links').get_attribute('aria-selected')=='true'
            page.get_by_label('Search anchor text or URL…').fill('External resource')
            assert page.locator('.list-stack > .item-card').count()==1
            with page.expect_download(timeout=8000) as external_download:
                page.get_by_role('button',name='Export CSV').click()
            external_rows=list(csv.DictReader(io.StringIO(Path(external_download.value.path()).read_text('utf-8-sig'))))
            assert len(external_rows)==1 and external_rows[0]['Kind']=='external'
            assert 'external.example.org' in external_rows[0]['Resolved URL']
            page.get_by_label('Search anchor text or URL…').fill('no matching destination')
            assert page.get_by_text('No external links found').count()==1
            assert page.get_by_role('button',name='Export CSV').is_disabled()
            print('PASS link tab: two category tabs only, keyboard-ready state, search and type-scoped CSV')
            page.get_by_label('Choose inspector').select_option('structured')
            assert page.get_by_text('Valid JSON').count()==1
            assert page.get_by_text('BreadcrumbList').count()>=1
            page.get_by_text('View formatted/source JSON').click()
            assert page.locator('pre.json-code').is_visible()
            assert page.get_by_role('button',name='Export CSV').count()==0
            print('PASS JSON-LD tab: nested types and formatted JSON')
            page.get_by_label('Choose inspector').select_option('overview')
            page.get_by_title('Switch to dark theme').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='dark'
            assert page.evaluate('getComputedStyle(document.body).backgroundColor')=='rgb(23, 26, 26)'
            darkshot = ROOT / 'docs/screenshots/overview-fixture-dark-preview.png'
            page.evaluate('document.querySelector("#toast")?.remove()')
            page.mouse.move(2, 450)  # Remove hover overlay from the theme icon.
            page.screenshot(path=str(darkshot), full_page=True)
            page.get_by_title('Switch to light theme').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='sepia'
            assert page.evaluate('localStorage.getItem("pagelens-theme")')=='sepia'
            page.get_by_title('Switch to dark theme').click()
            page.get_by_label('Choose inspector').select_option('metadata')
            page.get_by_text('Length heuristics · configurable').click()
            assert page.get_by_text('Apply preferences').is_visible()
            print('PASS UI: sepia/dark theme switching, persistence and configurable heuristics')
            page.get_by_label('Choose inspector').select_option('overview')
            malicious = '<img src=x onerror=window.__pagelens_pwned=1>'
            page.locator('#fixture').evaluate('(f, payload)=>{f.contentDocument.title=payload}',malicious)
            page.get_by_title('Refresh current scan').click()
            page.get_by_text(malicious,exact=True).wait_for(timeout=10000)
            assert page.locator('#app img').count()==0  # untrusted title is text, not inserted HTML
            assert page.evaluate('window.__pagelens_pwned') is None
            print('PASS UI sanitization: page-owned HTML-looking metadata remains text')

            # Switching tabs never grants site access or starts a new scan.
            page.evaluate('window.__mockAction.granted=false; window.__mockAction.blocked=true; window.__mockTabActivated({tabId:20,windowId:1})')
            page.get_by_role('heading',name='Ready to inspect').wait_for(timeout=10000)
            assert page.locator('.module-tile').count()==0
            print('PASS minimal permission: tab switch clears results without scanning or asking for host access')
            # Without a toolbar gesture, manually refreshing cannot grant activeTab.
            page.get_by_title('Refresh current scan').click()
            page.get_by_role('heading',name='Unable to inspect this page').wait_for(timeout=10000)
            assert page.get_by_text('Click the PageLens toolbar icon',exact=False).count()>=1
            assert page.get_by_text('Allow access to this website').count()==0
            print('PASS minimal permission: denied scan explains how to activate the toolbar')
            # A toolbar click grants activeTab, and a background notification
            # hands off its live DOM result without any permissions.request().
            page.evaluate('window.__mockAction.granted=true;window.__mockAction.blocked=false;window.__mockMessageListener({type:"pagelens:action-scan-ready",tabId:19},null,()=>{})')
            page.get_by_text(malicious,exact=True).wait_for(timeout=10000)
            print('PASS toolbar handoff: automatically renders the scan after action activation')
            page.evaluate('window.__mockAction.forbidden=true;window.__mockMessageListener({type:"pagelens:action-scan-ready",tabId:19},null,()=>{})')
            page.get_by_role('heading',name='Unable to inspect this page').wait_for(timeout=10000)
            print('PASS restricted pages: Chrome injection denial stays recoverable')
            if errors: raise AssertionError('Page runtime errors: '+repr(errors))
            print('PASS panel UI smoke: no unhandled JavaScript errors')
        finally: browser.close()

if __name__=='__main__':main()
