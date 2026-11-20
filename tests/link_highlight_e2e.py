#!/usr/bin/env python3
"""Execute the actual compiled link-highlighting content script in Chromium.

A Chrome storage shim stands in for privileged extension APIs; the script
itself is the production content script, running against real page DOM.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
HTML=(ROOT/'tests/fixtures/link-highlighting.html').read_text('utf8')
CONTENT=(ROOT/'dist/js/extension/link-highlight-content.js').read_text('utf8')

ADAPTER='''
window.__setting=true;
window.__listeners=[];
window.chrome={storage:{
  local:{get:async(key)=>({[key]:window.__setting})},
  onChanged:{addListener:cb=>window.__listeners.push(cb)}
}};
window.__changeLinks=(value)=>{
  const previous=window.__setting;
  window.__setting=value;
  for(const cb of window.__listeners) cb({'pagelens-link-highlighting-enabled':{oldValue:previous,newValue:value}},'local');
};
'''

def main():
    binary=os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(**({'executable_path':binary} if Path(binary).exists() else {}),headless=True,args=['--no-sandbox'])
        try:
            page=browser.new_page(viewport={'width':900,'height':500})
            errs=[]
            page.on('pageerror',lambda e:errs.append(str(e)))
            page.set_content(HTML)
            old=page.locator('#follow').evaluate('(a)=>({href:a.getAttribute("href"),rel:a.getAttribute("rel"),box:a.getBoundingClientRect().toJSON()})')
            page.add_script_tag(content=ADAPTER)
            page.add_script_tag(content=CONTENT)
            page.wait_for_function('document.querySelector("#ugc").dataset.pagelensLinkKind === "ugc"')
            def marker(id):return page.locator('#'+id).get_attribute('data-pagelens-link-kind')
            assert marker('follow')=='follow'
            assert marker('nofollow')=='nofollow'
            assert marker('ugc')=='ugc'
            assert marker('mixed')=='follow'
            for id in ('sponsored','mailto','fragment','missing'):
                assert marker(id) is None, (id,marker(id))
            after=page.locator('#follow').evaluate('(a)=>({href:a.getAttribute("href"),rel:a.getAttribute("rel"),box:a.getBoundingClientRect().toJSON()})')
            assert old==after, (old,after)
            for name in ('follow','nofollow','ugc'):
                css=page.locator('#'+name).evaluate('(a)=>({style:getComputedStyle(a).outlineStyle,width:getComputedStyle(a).outlineWidth,color:getComputedStyle(a).outlineColor})')
                assert css['style']=='dashed' and css['width']=='2px',(name,css)
            print('PASS on-demand link classification, dashed outlines and non-invasive layout')
            page.locator('#nofollow').evaluate('(a)=>a.setAttribute("rel","ugc")')
            page.wait_for_function('document.querySelector("#nofollow").dataset.pagelensLinkKind === "ugc"')
            page.locator('main').evaluate('(el)=>el.insertAdjacentHTML("beforeend", "<a id=dynamic href=/later rel=nofollow>Dynamic link</a>")')
            page.wait_for_function('document.querySelector("#dynamic").dataset.pagelensLinkKind === "nofollow"')
            print('PASS mutation observer reacts to rel changes and dynamic anchors')
            page.evaluate('window.__changeLinks(false)')
            page.wait_for_function('document.querySelectorAll("[data-pagelens-link-kind]").length===0')
            assert page.locator('#pagelens-link-highlight-style').count()==0
            page.locator('main').evaluate('(el)=>el.insertAdjacentHTML("beforeend","<a id=offlink href=/off>Off link</a>")')
            page.wait_for_timeout(300)
            assert marker('offlink') is None
            page.evaluate('window.__changeLinks(true)')
            page.wait_for_function('document.querySelector("#offlink").dataset.pagelensLinkKind === "follow"')
            print('PASS local Off removes highlights; On resumes and handles new links')
            page.add_script_tag(content=CONTENT)
            assert page.evaluate('window.__listeners.length')==1,'Duplicate injection must not add another observer'
            assert not errs,errs
            print('PASS duplicate injection guard; no runtime exceptions')
        finally:browser.close()

if __name__=='__main__':main()
