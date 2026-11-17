#!/usr/bin/env python3
"""Test the compiled automatic Google-only content script with a storage adapter.

Test URLs are mocked because the managed Chromium sandbox cannot open a real
Google Search page. DOM extraction/ranking/rendering uses production code.
"""
from pathlib import Path
import os
import time
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
CONTENT=(ROOT/'dist/js/extension/google-serp-content.js').read_text('utf8')
CONTENT=CONTENT.replace('window.location.href','(window.__testUrl || window.location.href)')
STORAGE_ADAPTER=r'''
window.__testUrl='https://www.google.com/search?q=bigcommerce+to+shopify';
window.__enabled=true;
window.__onChange=[];
window.chrome={storage:{
  local:{
    get:async name=>({[name]:window.__enabled}),
    set:async values=>{
      const name='pagelens-organic-ranking-enabled';
      const previous=window.__enabled;
      window.__enabled=values[name];
      for (const listener of window.__onChange) listener({[name]:{oldValue:previous,newValue:window.__enabled}},'local');
    }
  },
  onChanged:{addListener:fn=>window.__onChange.push(fn)}
}};
'''
COUNT="document.querySelector('pagelens-organic-overlay')?.shadowRoot.querySelectorAll('[data-pagelens-organic-position]').length ?? 0"
RANKS="[...document.querySelector('pagelens-organic-overlay')?.shadowRoot.querySelectorAll('[data-pagelens-organic-position]')??[]].map(el=>el.dataset.pagelensOrganicPosition)"

def expect_count(page,n):
    page.wait_for_function('(expected) => ('+COUNT+') === expected',arg=n,timeout=10000)

with sync_playwright() as p:
    browser=p.chromium.launch(**({'executable_path':os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'} if (os.environ.get('PAGELENS_CHROMIUM') or Path('/usr/bin/chromium').exists()) else {}),headless=True,args=['--no-sandbox','--disable-gpu'])
    try:
        fixture=(ROOT/'tests/fixtures/google-serp-ai-interleaved.html').read_text('utf8')
        page=browser.new_page(viewport={'width':1360,'height':900})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        hostile=fixture.replace('</head>','''<style>#rso span,#rso pagelens-organic-number {transform:rotate(180deg) scaleX(-1)!important;direction:rtl!important;writing-mode:vertical-rl!important;}</style></head>''')
        page.set_content(hostile)
        page.add_script_tag(content=STORAGE_ADAPTER)
        page.add_script_tag(content=CONTENT)
        expect_count(page,2)
        assert page.evaluate(RANKS)==['1','2']
        assert page.evaluate("document.querySelector('pagelens-organic-overlay').parentElement===document.documentElement")
        assert page.locator('#shopify [data-pagelens-organic-position]').count()==0
        assert page.locator('#ai-container [data-pagelens-organic-position]').count()==0
        path=ROOT/'docs/screenshots/google-auto-organic-first-page-fixture.png';path.parent.mkdir(exist_ok=True,parents=True)
        page.screenshot(path=str(path),full_page=True)
        print('PASS automatic Google page-load numbering without popup: SVG 1 Shopify, 2 LitExtension')
        page.evaluate("chrome.storage.local.set({'pagelens-organic-ranking-enabled':false})")
        expect_count(page,0)
        page.evaluate("chrome.storage.local.set({'pagelens-organic-ranking-enabled':true})")
        expect_count(page,2)
        assert page.evaluate(RANKS)==['1','2']
        print('PASS persistent On/Off toggle removes/restores SVG overlay')
        page.evaluate('''() => {
          const newGroup=document.createElement('div');newGroup.className='MjjYud';newGroup.id='extra-organic';
          const inner=document.createElement('div');inner.className='headline';
          const a=document.createElement('a');a.href='https://third.example/article';
          const h=document.createElement('h3');h.textContent='Third organic article';
          a.append(h);inner.append(a);newGroup.append(inner);document.getElementById('rso').append(newGroup);
        }''')
        expect_count(page,3)
        assert page.evaluate(RANKS)==['1','2','3']
        time.sleep(.5)
        assert page.locator('pagelens-organic-overlay').count()==1
        print('PASS dynamic Google DOM updates add exactly one SVG rank (no feedback loop)')
        page.evaluate('''() => {
          window.__testUrl='https://www.google.com/search?q=bigcommerce+to+shopify&start=10';
          const h=document.createElement('h3');h.textContent='New Google page';document.getElementById('rso').append(h);
        }''')
        expect_count(page,0)
        assert page.locator('[data-pagelens-position-original]').count()==0
        print('PASS later-page navigation clears the overlay')
        assert not errors,errors
        page.close()

        # DOM order can differ from visible vertical order. The rank must be 1
        # for the first visual result (not the first DOM child).
        reordered=browser.new_page(viewport={'width':1200,'height':700})
        reordered.set_content('''<!doctype html><html><head><style>
          #rso{display:flex;flex-direction:column}.MjjYud{padding:10px}
          #visually-last{order:2}#visually-first{order:1}
          </style></head><body><div id="rso">
          <div class="MjjYud" id="visually-last"><div class="headline"><a href="https://second.example/"><h3>Second visible result</h3></a></div></div>
          <div class="MjjYud" id="visually-first"><div class="headline"><a href="https://first.example/"><h3>First visible result</h3></a></div></div>
          </div></body></html>''')
        reordered.add_script_tag(content=STORAGE_ADAPTER)
        reordered.add_script_tag(content=CONTENT)
        expect_count(reordered,2)
        ranks=reordered.evaluate('''() => [...document.querySelector('pagelens-organic-overlay').shadowRoot.querySelectorAll('[data-pagelens-organic-position]')].map((el,i) => ({
          rank: el.dataset.pagelensOrganicPosition,
          y: el.getBoundingClientRect().top,
          h3: document.querySelector(i===0?'#visually-first h3':'#visually-last h3').getBoundingClientRect().top
        }))''')
        assert [el['rank'] for el in ranks]==['1','2'] and ranks[0]['y']<ranks[1]['y'],ranks
        print('PASS visual ordering even when DOM order is reversed')
        reordered.close()

        disabled=browser.new_page(viewport={'width':1200,'height':700})
        disabled.set_content(fixture)
        disabled.add_script_tag(content=STORAGE_ADAPTER.replace('window.__enabled=true;','window.__enabled=false;'))
        disabled.add_script_tag(content=CONTENT)
        disabled.wait_for_timeout(550)
        assert disabled.locator('pagelens-organic-overlay').count()==0
        disabled.evaluate("chrome.storage.local.set({'pagelens-organic-ranking-enabled':true})")
        expect_count(disabled,2)
        assert disabled.evaluate(RANKS)==['1','2']
        print('PASS disabled preference: no SVG labels until switched On')
        disabled.close()
    finally:browser.close()
