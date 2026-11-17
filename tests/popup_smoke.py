#!/usr/bin/env python3
"""Popup UI interaction smoke tests with real DOM fixture extraction.

This composes the *compiled* production modules in one browser test script and
adapts Chrome APIs to an iframe. It does not claim to test an installed extension.
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
    'core/extract.js','extension/permissions.js','extension/locate.js','extension/organic-rank.js','popup/main.js',
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
// the popup startup scan with real DOM extraction from an HTML fixture.
window.__mockAction = { granted: true, forbidden: false, blocked: false, tabId: 19, url: 'https://fixture.example.test/complete' };
window.__pageInjectionCount = 0;
window.__rankingPreference = true;
window.__rankingListeners = [];
window.chrome = {
  storage: {
    local: {
      get: async (key) => ({ [key]: window.__rankingPreference }),
      set: async (values) => {
        const key = 'pagelens-organic-ranking-enabled';
        const previous = window.__rankingPreference;
        window.__rankingPreference = values[key];
        const change = { [key]: {oldValue:previous, newValue:window.__rankingPreference} };
        for (const fn of window.__rankingListeners) fn(change, 'local');
      },
    },
    onChanged: { addListener: (fn) => window.__rankingListeners.push(fn) },
  },
  tabs: {
    query: async () => [{id:window.__mockAction.tabId,url:window.__mockAction.url}],
  },
  scripting: {
    executeScript: async ({func,args}) => {
      if (window.__mockAction.blocked || window.__mockAction.forbidden) {
        throw new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.');
      }
      window.__pageInjectionCount++;
      const docWindow=document.getElementById('fixture').contentWindow;
      // Test-only location override for Google fixture: restricted CI Chromium
      // blocks navigation to real Google hosts even with route interception.
      const callable=func.name==='rankOrganicResultsInPage'
        ? func.toString().replaceAll('window.location.href','(window.__pagelensTestLocation || window.location.href)')
        : func.toString();
      docWindow.__pagelensTestLocation=window.__mockAction.url;
      const serialized='('+callable+')('+((args||[]).map((arg)=>JSON.stringify(arg)).join(','))+')';
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
    css=(ROOT/'styles/popup.css').read_text('utf8')
    # Inline the exact bundled font bytes for this about:blank-based fixture.
    # The production popup instead loads the same local files from dist/fonts/.
    for weight in ('Regular', 'Medium', 'SemiBold'):
        font_file=ROOT/'assets/fonts'/f'BeVietnamPro-{weight}.ttf'
        embedded=base64.b64encode(font_file.read_bytes()).decode('ascii')
        css=css.replace(f'../fonts/BeVietnamPro-{weight}.ttf',f'data:font/ttf;base64,{embedded}')
    css += '\n' + (ROOT/'styles/inspector.css').read_text('utf8')
    css += '\n' + (ROOT/'styles/popup-window.css').read_text('utf8')
    skeleton=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><style>{css}</style>
      <style>iframe#fixture{{position:fixed;top:-2000px;left:-2000px;width:600px;height:700px;pointer-events:none}}</style>
      </head><body><div id="app"></div><iframe id="fixture" srcdoc="{escape(fixture,quote=True)}"></iframe></body></html>'''
    with sync_playwright() as p:
        browser=p.chromium.launch(**({'executable_path': os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'} if (os.environ.get('PAGELENS_CHROMIUM') or Path('/usr/bin/chromium').exists()) else {}),
            headless=True, args=['--no-sandbox','--disable-gpu'])
        try:
            # Actual Chrome action popups start with an auto-size layout pass.
            # Reproduce the minimum host viewport (25x25) before the real UI
            # smoke test; a 100vw/100vh CSS loop would collapse to 25x25.
            sizing=browser.new_page(viewport={'width':25,'height':25}, device_scale_factor=1)
            sizing.set_content(skeleton)
            intrinsic=sizing.evaluate('''() => ({
                htmlWidth: document.documentElement.getBoundingClientRect().width,
                htmlHeight: document.documentElement.getBoundingClientRect().height,
                bodyWidth: document.body.getBoundingClientRect().width,
                appWidth: document.getElementById('app').getBoundingClientRect().width,
                appHeight: document.getElementById('app').getBoundingClientRect().height,
                scrollWidth: document.documentElement.scrollWidth
            })''')
            assert intrinsic['htmlWidth']==448 and intrinsic['htmlHeight']==568, f'Popup autosize collapsed: {intrinsic}'
            assert intrinsic['bodyWidth']==448 and intrinsic['appWidth']==448 and intrinsic['appHeight']==568, intrinsic
            assert intrinsic['scrollWidth']>=448, intrinsic
            sizing.close()
            print('PASS Chrome autosize regression: 25x25 initial viewport yields 448x568 intrinsic popup')

            page=browser.new_page(viewport={'width':448,'height':568}, device_scale_factor=1, color_scheme='light')
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
            assert page.evaluate('document.documentElement.getBoundingClientRect().width') == 448
            assert page.evaluate('document.documentElement.getBoundingClientRect().height') == 568
            assert page.evaluate('document.getElementById("app").scrollWidth <= document.getElementById("app").clientWidth')
            assert page.get_by_title('Refresh current scan').count() == 1
            assert page.get_by_role('button', name='Show numbers').count() == 0, 'Google-only tool must not appear on regular websites'
            print('PASS popup boot: automatic scan from current tab and bounded 448x568 window')
            # Verify the shipped font was loaded, not merely declared as a fallback.
            loaded=page.evaluate("document.fonts.load('400 14px \"Be Vietnam Pro\"').then(f=>f.length)")
            assert loaded>=1 and page.evaluate("document.fonts.check('400 14px \"Be Vietnam Pro\"')")
            assert page.evaluate("getComputedStyle(document.body).fontFamily.includes('Be Vietnam Pro')")
            assert page.locator('.module-row').count() == 5
            assert page.get_by_role('button',name='Inspect Headings, 6 found').count() == 1
            assert page.get_by_role('button',name='Inspect Images, 5 found').count() == 1
            assert page.get_by_text('PageLens').count()>=1
            assert page.get_by_text('Café products, articles & guides').count()==0  # Overview does not repeat the complete heading tree
            assert page.locator('.evidence').first.is_visible() is False  # Evidence is progressive disclosure
            assert page.locator('.technical-location').first.is_visible() is False # Selectors are hidden by default
            assert page.evaluate('document.documentElement.dataset.theme') == 'sepia'
            assert page.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(255, 255, 255)'
            findings_y = page.locator('.findings-heading').first.bounding_box()['y']
            assert findings_y < 390, f'Overview navigation is not compact enough: findings start at y={findings_y:.1f}px'
            assert page.locator('.nav-tabs').count()==0
            assert page.locator('.rail-button').count()==6
            assert page.get_by_role('navigation',name='Inspector navigation').count()==1
            assert page.locator('.rail-button[aria-current="page"]').count()==1
            assert page.locator('.module-grid').count()==0
            assert page.locator('.module-row').first.evaluate('(el)=>getComputedStyle(el).borderTopWidth') == '0px'
            assert page.locator('.rail-button[aria-current="page"]').get_attribute('data-section')=='overview'
            assert page.get_by_role('button',name='Inspect Headings, 6 found').count()==1
            rail = page.get_by_role('navigation',name='Inspector navigation')
            rail.get_by_role('button',name='Overview').focus()
            rail.get_by_role('button',name='Overview').press('ArrowDown')
            assert rail.get_by_role('button',name='Metadata').evaluate('(el)=>document.activeElement===el')
            rail.get_by_role('button',name='Metadata').press('Enter')
            assert page.locator('.rail-button[aria-current="page"]').get_attribute('data-section')=='metadata'
            rail.get_by_role('button',name='Overview').click()
            assert page.locator('.rail-button[aria-current="page"]').get_attribute('data-section')=='overview'
            print('PASS icon rail: navigation landmark, active state, keyboard arrows and Enter')
            assert page.locator('.export-footer').count() == 0
            assert page.get_by_role('button',name='Markdown').count()==0
            assert page.get_by_role('button',name='Findings CSV').count()==0
            # Chrome popup width is intrinsically fixed to 448px. Test the
            # content columns against the actual popup box, not a tab viewport.
            for host_width in (448, 480, 640):
                page.set_viewport_size({'width': host_width, 'height': 568})
                assert page.evaluate('document.documentElement.getBoundingClientRect().width')==448
                assert page.evaluate('document.getElementById("app").scrollWidth <= 448'), f'Popup content overflow with host {host_width}px'
            page.set_viewport_size({'width': 448, 'height': 568})
            print(f'PASS redesigned fixed-size popup layout: findings start at {findings_y:.0f}px, no internal horizontal overflow')
            shot = ROOT / 'docs/screenshots/overview-fixture-preview.png'
            shot.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(shot), full_page=True)
            print('PASS overview: scan results rendered and metrics match real DOM extraction')
            print('PASS streamlined overview: no persistent download controls')
            # Overview counts are real navigation targets, not decorative KPIs.
            page.get_by_role('button',name='Inspect Headings, 6 found').click()
            assert page.locator('.rail-button[aria-current="page"]').get_attribute('data-section')=='headings'
            page.locator('.rail-button[data-section="overview"]').click()
            assert page.locator('.rail-button[aria-current="page"]').get_attribute('data-section')=='overview'
            assert page.get_by_role('button',name='Inspect Metadata').count()==1
            # A finding opens the exact related image, not only the Images tab.
            finding=page.locator('.finding').filter(has_text='Images without alt attributes').first
            if finding.count():
                finding.get_by_role('button',name='View item').click()
                assert page.locator('.rail-button[aria-current="page"]').get_attribute('data-section')=='images'
                assert page.locator('.item-card[data-focused="true"]').count()==1
                assert page.evaluate('document.activeElement.dataset.locator')
                page.locator('.rail-button[data-section="overview"]').click()
            # Technical selectors do not appear until Evidence / DOM location opens.
            assert page.locator('.selector:visible').count()==0
            assert page.locator('[title^="Highlight"]').count()==0
            print('PASS navigation: accessible icon rail, Overview shortcuts and deep-linked findings')
            page.locator('.rail-button[data-section="metadata"]').click()
            assert page.get_by_text('Robots directives').count() == 1
            assert page.get_by_text('Primary OG title').count()==1
            assert page.get_by_text('Twitter property fallback').count()==1
            assert page.get_by_text('vi-VN').count()==1
            print('PASS metadata tab: robots, Open Graph, Twitter and hreflang')
            page.locator('.rail-button[data-section="headings"]').click()
            assert page.locator('.heading-card').count() == 6
            assert page.get_by_text('Café products, articles & guides').count() == 1
            assert page.locator('[title^="Highlight"]').count()==0
            assert page.locator('.locate-btn').count()==0
            assert page.evaluate('window.__pageInjectionCount')==1, 'Navigation must not inject page scripts'
            assert page.get_by_role('button',name='Export CSV').count()==0
            page.get_by_role('button',name='Copy',exact=True).click()
            copied=page.evaluate('window.__copiedText')
            assert copied.startswith('H1: Café products, articles & guides')
            assert '  H2: Metadata overview' in copied
            assert 'main > h1' not in copied
            page.get_by_label('Search heading text…').fill('Metadata overview')
            page.get_by_role('button',name='Copy',exact=True).click()
            assert page.evaluate('window.__copiedText')=='  H2: Metadata overview'
            page.locator('.rail-button[data-section="metadata"]').click()
            page.locator('.rail-button[data-section="headings"]').click()
            assert page.get_by_label('Search heading text…').input_value()=='Metadata overview'
            print('PASS navigation preserves module search state')
            page.get_by_label('Search heading text…').fill('')
            # Force an overflowing inspector viewport without mutating the
            # popup's fixed intrinsic window size.
            scroll_limit_style=page.add_style_tag(content='.main-content { max-height: 220px !important; }')
            page.evaluate('document.getElementById("view").scrollTop=120')
            before_scroll=page.evaluate('document.getElementById("view").scrollTop')
            assert before_scroll > 0
            page.locator('.rail-button[data-section="metadata"]').click()
            page.locator('.rail-button[data-section="headings"]').click()
            after_scroll=page.evaluate('document.getElementById("view").scrollTop')
            assert after_scroll == before_scroll, f'Heading scroll position not preserved: {before_scroll} -> {after_scroll}'
            scroll_limit_style.evaluate('(el)=>el.remove()')
            page.evaluate('document.getElementById("view").scrollTop=0')
            print('PASS navigation preserves per-module reading position')
            page.evaluate('document.getElementById("toast")?.remove(); document.activeElement?.blur()')
            headings_shot=ROOT / 'docs/screenshots/headings-fixture-preview.png'
            page.screenshot(path=str(headings_shot),full_page=True)
            print('PASS heading tab: hierarchy and Copy, without page highlight controls')
            page.locator('.rail-button[data-section="images"]').click()
            assert page.locator('.list-stack > .item-card').count()==5
            assert page.locator('.locate-btn').count()==0
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
            page.locator('.rail-button[data-section="links"]').click()
            assert page.get_by_role('tab',name='Internal links').count()==1
            assert page.locator('.locate-btn').count()==0
            assert page.get_by_role('tab',name='External links').count()==1
            assert page.get_by_role('tab',name='Internal links').get_attribute('aria-selected')=='true'
            assert page.locator('.list-stack > .item-card').count()==3
            assert page.get_by_label('Filter links by kind').count()==0
            assert page.get_by_text('mailto:',exact=False).count()==0
            assert page.locator('#links-results').get_attribute('aria-labelledby')=='links-internal'
            page.evaluate('document.getElementById("toast")?.remove(); document.activeElement?.blur()')
            for host_width in (448, 480, 640):
                page.set_viewport_size({'width':host_width,'height':568})
                assert page.evaluate('document.getElementById("app").scrollWidth <= 448'), f'Links overflow inside the 448px popup at host width {host_width}px'
            page.set_viewport_size({'width':448,'height':568})
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
            page.locator('.rail-button[data-section="structured"]').click()
            assert page.get_by_text('Valid JSON').count()==1
            assert page.get_by_text('BreadcrumbList').count()>=1
            page.get_by_text('View formatted/source JSON').click()
            assert page.locator('pre.json-code').is_visible()
            assert page.get_by_role('button',name='Export CSV').count()==0
            print('PASS JSON-LD tab: nested types and formatted JSON')
            page.locator('.rail-button[data-section="overview"]').click()
            page.get_by_title('Switch to dark theme').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='dark'
            assert page.evaluate('getComputedStyle(document.body).backgroundColor')=='rgb(23, 27, 30)'
            darkshot = ROOT / 'docs/screenshots/overview-fixture-dark-preview.png'
            page.evaluate('document.querySelector("#toast")?.remove()')
            page.mouse.move(2, 450)  # Remove hover overlay from the theme icon.
            page.screenshot(path=str(darkshot), full_page=True)
            page.get_by_title('Switch to light theme').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='sepia'
            assert page.evaluate('localStorage.getItem("pagelens-theme")')=='sepia'
            page.get_by_title('Switch to dark theme').click()
            page.locator('.rail-button[data-section="metadata"]').click()
            page.get_by_text('Length heuristics · configurable').click()
            assert page.get_by_text('Apply preferences').is_visible()
            print('PASS UI: sepia/dark theme switching, persistence and configurable heuristics')
            page.locator('.rail-button[data-section="overview"]').click()
            malicious = '<img src=x onerror=window.__pagelens_pwned=1>'
            page.locator('#fixture').evaluate('(f, payload)=>{f.contentDocument.title=payload}',malicious)
            page.get_by_title('Refresh current scan').click()
            page.get_by_text(malicious,exact=True).wait_for(timeout=10000)
            assert page.locator('#app img').count()==0  # untrusted title is text, not inserted HTML
            assert page.evaluate('window.__pagelens_pwned') is None
            print('PASS UI sanitization: page-owned HTML-looking metadata remains text')

            # A tab navigation while the popup is still rendered can make a
            # Refresh fail. No dead Retry button should be shown.
            page.evaluate('window.__mockAction.blocked=true;window.__mockAction.url="https://other.example.test/"')
            page.get_by_title('Refresh current scan').click()
            hint=page.locator('.activation-hint')
            hint.wait_for(timeout=10000)
            assert hint.locator('p').count()==2
            assert page.get_by_text('PageLens could not inspect this tab.',exact=True).count()==1
            assert page.get_by_role('button',name='Try again').count()==0
            assert page.get_by_title('Refresh current scan').count()==0
            assert page.locator('.rail-button[data-section="images"]').is_disabled()
            assert page.locator('.module-row').count()==0
            page.get_by_title('Switch to light theme').click()
            page.screenshot(path=str(ROOT / 'docs/screenshots/activation-hint-fixture-preview.png'), full_page=True)
            print('PASS revoked activeTab access: concise message and no ineffective actions')

            # Every action click creates a new popup, which immediately scans
            # that newly invoked tab without the popup's message cache.
            second=browser.new_page(viewport={'width':448,'height':568}, device_scale_factor=1)
            second_errors=[]
            second.on('pageerror',lambda err:second_errors.append(str(err)))
            second.set_content(skeleton)
            second.locator('#fixture').evaluate('(element)=>new Promise(resolve=>element.contentDocument?.readyState==="complete"?resolve():element.addEventListener("load",resolve,{once:true}))')
            fresh_adapter=ADAPTER.replace("'https://fixture.example.test/complete'", "'https://another.example.test/'")
            second.add_script_tag(content=fresh_adapter+compiled_test_bundle())
            second.get_by_text('another.example.test',exact=False).first.wait_for(timeout=10000)
            assert second.get_by_title('Refresh current scan').count()==1
            assert second.locator('.rail-button[data-section="images"]').is_enabled()
            assert not second_errors, second_errors
            print('PASS next toolbar click: fresh popup automatically scans the new tab')
            second.close()

            # Chrome-internal pages must not be injected; the new popup displays
            # a clear two-line explanation, not a fake retry button.
            unsupported=browser.new_page(viewport={'width':448,'height':568})
            unsupported_errors=[]
            unsupported.on('pageerror',lambda err:unsupported_errors.append(str(err)))
            unsupported.set_content(skeleton)
            forbidden_adapter=ADAPTER.replace("'https://fixture.example.test/complete'", "'chrome://extensions/'")
            unsupported.add_script_tag(content=forbidden_adapter+compiled_test_bundle())
            unsupported.get_by_text('This browser page cannot be inspected.',exact=True).wait_for(timeout=10000)
            assert unsupported.locator('.activation-hint p').count()==2
            assert unsupported.get_by_title('Refresh current scan').count()==0
            assert unsupported.get_by_role('button',name='Try again').count()==0
            assert not unsupported_errors,unsupported_errors
            unsupported.close()
            print('PASS unsupported Chrome page: clear message, no injection or retry')
            # The popup is a preference UI; Google-only content script does the
            # actual automatic numbering on page load without an icon click.
            serp_fixture=(ROOT/'tests/fixtures/google-serp-page1.html').read_text('utf8')
            serp_popup=browser.new_page(viewport={'width':448,'height':568}, device_scale_factor=1)
            serp_popup.set_content(skeleton.replace(escape(fixture,quote=True),escape(serp_fixture,quote=True)))
            serp_popup.locator('#fixture').evaluate('(f)=>new Promise(done=>f.contentDocument.readyState==="complete"?done():f.addEventListener("load",done,{once:true}))')
            serp_adapter=ADAPTER.replace("'https://fixture.example.test/complete'", "'https://www.google.com/search?q=bigcommerce+to+shopify'")
            serp_popup.add_script_tag(content=serp_adapter+compiled_test_bundle())
            toggle=serp_popup.get_by_role('switch',name='Automatic organic ranking numbers')
            toggle.wait_for(timeout=10000)
            assert toggle.get_attribute('aria-checked')=='true'
            assert serp_popup.locator('.rail-button').count()==6
            # The popup never adds numbers just by opening.
            assert serp_popup.locator('#fixture').evaluate("(f)=>Number(f.contentDocument.querySelector('pagelens-organic-overlay')?.dataset.pagelensOrganicCount||0)")==0
            toggle.click()
            assert toggle.get_attribute('aria-checked')=='false'
            assert serp_popup.evaluate('window.__rankingPreference') is False
            toggle.click()
            assert toggle.get_attribute('aria-checked')=='true'
            assert serp_popup.evaluate('window.__rankingPreference') is True
            assert serp_popup.locator('#fixture').evaluate("(f)=>Number(f.contentDocument.querySelector('pagelens-organic-overlay')?.dataset.pagelensOrganicCount||0)")==4
            serp_popup.evaluate('document.getElementById("view").scrollTop=0; document.querySelector("#toast")?.remove()')
            serp_popup.screenshot(path=str(ROOT / 'docs/screenshots/google-serp-popup-fixture-preview.png'),full_page=True)
            serp_popup.close()
            print('PASS popup: saved On/Off preference, no startup injection, six unchanged modules')
            if errors: raise AssertionError('Page runtime errors: '+repr(errors))
            print('PASS popup UI smoke: no unhandled JavaScript errors')
        finally: browser.close()

if __name__=='__main__':main()
