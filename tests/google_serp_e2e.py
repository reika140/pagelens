#!/usr/bin/env python3
"""Validate Google SERP organic-only SVG numbering with real browser pixels.

The fixtures are representative DOMs, not a live Google Search test. The old
inline badges inherited page CSS and could render mirrored/rotated numerals.
This regression verifies SVG glyphs mounted outside result-card CSS subtrees,
with pixel-identical glyphs on plain and CSS-hostile versions of the same page.
"""
from pathlib import Path
import os
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
js=(ROOT/'dist/js/extension/organic-rank.js').read_text('utf-8')
js=re.sub(r'^import\s+.*?;\s*$', '', js, flags=re.M)
js=re.sub(r'^export\s+(?=(?:function|async function|const|class|let)\b)', '', js, flags=re.M)
js=js.replace('window.location.href', '(window.__pagelensTestLocation || window.location.href)')

HOSTILE_CSS='''<style>
  #rso span, #rso pagelens-organic-number, #rso .MjjYud > span {
    transform: rotate(180deg) scaleX(-1) !important;
    direction: rtl !important;
    writing-mode: vertical-rl !important;
    font-family: cursive !important;
  }
</style>'''

def ranks(page):
    return page.evaluate('''() => {
      const host = document.querySelector('pagelens-organic-overlay[data-pagelens-overlay-root]');
      if (!host) return [];
      return [...host.shadowRoot.querySelectorAll('[data-pagelens-organic-position]')].map(el => ({
        rank: el.dataset.pagelensOrganicPosition,
        y: el.getBoundingClientRect().top,
        x: el.getBoundingClientRect().left,
        paths: el.querySelectorAll('svg path').length,
        transform: getComputedStyle(el).transform,
        hasVisibleText: !!el.textContent.trim(),
        svgWidth: el.querySelector('svg')?.getAttribute('width'),
      }));
    }''')

def assert_placement(page, selectors):
    geometry=page.evaluate('''(selectors) => {
      const host=document.querySelector('pagelens-organic-overlay');
      const badges=[...host.shadowRoot.querySelectorAll('[data-pagelens-organic-position]')];
      return selectors.map((selector,index) => {
        const heading=document.querySelector(selector+' h3').getBoundingClientRect();
        const badge=badges[index].getBoundingClientRect();
        return {rank:badges[index].dataset.pagelensOrganicPosition,
                topDelta:Math.abs(heading.top+heading.height/2-(badge.top+badge.height/2)),
                horizontalGap:heading.left-badge.right};
      });
    }''', selectors)
    assert [v['rank'] for v in geometry]==[str(i) for i in range(1,len(selectors)+1)], geometry
    assert all(v['topDelta']<=2 and 1<=v['horizontalGap']<=8 for v in geometry),geometry

with sync_playwright() as p:
    browser=p.chromium.launch(**({'executable_path': os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'} if (os.environ.get('PAGELENS_CHROMIUM') or Path('/usr/bin/chromium').exists()) else {}),headless=True,args=['--no-sandbox','--disable-gpu'])
    try:
        for name,url,expected in [
          ('google-serp-page1.html','https://www.google.com/search?q=bigcommerce+to+shopify',4),
          ('google-serp-variant.html','https://www.google.com.vn/search?q=chuyen+shopify&udm=14',2),
          ('google-serp-ai-interleaved.html','https://www.google.com/search?q=bigcommerce+to+shopify',2),
        ]:
            page=browser.new_page(viewport={'width':1400,'height':850})
            fixture=(ROOT/'tests/fixtures'/name).read_text('utf-8')
            page.set_content(fixture)
            page.evaluate('(value)=>{window.__pagelensTestLocation=value}',url)
            page.add_script_tag(content=js)
            rank=lambda mode:page.evaluate('(mode)=>rankOrganicResultsInPage(mode)',mode)
            assert rank('status')['count']==0
            enabled=rank('show');assert enabled['count']==expected and enabled['active'],enabled
            observed=ranks(page)
            assert [v['rank'] for v in observed]==[str(n) for n in range(1,expected+1)],observed
            assert all(v['paths']>=1 and v['transform']=='none' and
                       not v['hasVisibleText'] and v['svgWidth']=='28' for v in observed),observed
            assert page.evaluate('''() => {
              const el=document.querySelector('pagelens-organic-overlay');
              return el.parentElement === document.documentElement &&
                el.shadowRoot.querySelectorAll('svg path').length>=2 &&
                getComputedStyle(el).transform==='none';
            }''')
            assert page.locator('#rso [data-pagelens-organic-position]').count()==0
            assert page.locator('[data-pagelens-position-original]').count()==0
            if name=='google-serp-ai-interleaved.html':
                assert_placement(page,['#shopify','#litextension'])
                page.screenshot(path=str(ROOT/'docs/screenshots/google-serp-svg-organic-fixture-preview.png'),full_page=True)
                # The badge's actual rendered PNG must not change when Google
                # adds adversarial span/transform/writing-mode CSS to results.
                glyph=page.locator('pagelens-organic-overlay [data-pagelens-organic-position="1"]')
                clean_png=glyph.screenshot()
                page.add_style_tag(content=HOSTILE_CSS.split('<style>')[1].split('</style>')[0])
                # CSS may reflow Google content; recalculate geometry first.
                # The vector glyph itself must remain pixel-identical.
                assert rank('show')['count']==2
                glyph=page.locator('pagelens-organic-overlay [data-pagelens-organic-position="1"]')
                hostile_png=glyph.screenshot()
                assert clean_png==hostile_png, 'Ranking glyph pixels changed under hostile SERP CSS'
                assert_placement(page,['#shopify','#litextension'])
                page.screenshot(path=str(ROOT/'docs/screenshots/google-serp-svg-css-hostile-preview.png'),full_page=True)
                print('PASS actual SVG glyph pixels: upright, identical under hostile CSS and no parent-card transforms')
                # Scrolling must keep a stable alignment (no floating detached badge).
                page.evaluate('''() => {document.body.style.minHeight='2100px';window.scrollTo(0,360)}''')
                page.wait_for_timeout(80)
                assert_placement(page,['#shopify','#litextension'])
                print('PASS SVG overlay follows document scroll and stays aligned with results')
            if name=='google-serp-page1.html':
                page.screenshot(path=str(ROOT/'docs/screenshots/google-serp-organic-fixture-preview.png'))
            assert rank('show')['count']==expected,'Repeated scan must replace, not duplicate, the overlay'
            assert page.locator('pagelens-organic-overlay').count()==1
            assert rank('status')['count']==expected
            assert rank('hide')['count']==0
            assert page.locator('pagelens-organic-overlay').count()==0
            assert page.locator('[data-pagelens-organic-position]').count()==0
            print('PASS organic only:',name,expected,'ranks; no ads/AI/PAA/sitelinks labels')
            page.close()
        page=browser.new_page()
        fixture=(ROOT/'tests/fixtures/google-serp-page1.html').read_text('utf8')
        for url in ['https://www.google.com/search?q=foo&start=10','https://www.google.com/search?q=foo&udm=2']:
            page.set_content(fixture)
            page.evaluate('(value)=>{window.__pagelensTestLocation=value}',url)
            page.add_script_tag(content=js)
            result=page.evaluate("rankOrganicResultsInPage('show')")
            assert not result['eligible'] and result['count']==0,result
            assert page.locator('pagelens-organic-overlay').count()==0
            print('PASS unsupported result types are not numbered:',url)
        page.close()
    finally: browser.close()
