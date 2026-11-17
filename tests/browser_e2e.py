#!/usr/bin/env python3
"""Playwright browser tests for actual DOM extraction (no invented scan data).

This suite uses about:blank + set_content so it can execute in restricted CI
browsers with URL navigation disabled. It does not claim to test extension
installation or the Chrome action popup flow.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
COMPILED = (ROOT / 'dist/js/core/extract.js').read_text(encoding='utf8')
EXTRACTOR = COMPILED.replace('export function extractPageSnapshot()', 'function extractPageSnapshot()', 1)
EXTRACTOR += '\nwindow.__pageLensExtract = extractPageSnapshot;'


def verify_complete(page):
    html = (ROOT / 'tests/fixtures/complete.html').read_text(encoding='utf8')
    page.set_content(html)
    page.add_script_tag(content=EXTRACTOR)
    scan = page.evaluate('window.__pageLensExtract()')
    assert scan['counts'] == {'headings': 6, 'images': 5, 'links': 7, 'jsonLd': 1}, scan['counts']
    assert scan['title'].startswith('PageLens Test')
    assert scan['descriptions'][0]['value'].startswith('Inspect metadata')
    assert len(scan['openGraph']) == 2
    assert {x['key'] for x in scan['twitter']} == {'twitter:card','twitter:title'}
    assert len(scan['hreflang']) == 2
    assert scan['robots'][1]['key'] == 'googlebot'
    assert [h['level'] for h in scan['headings']] == [1,2,3,2,3,2]
    assert scan['headings'][0]['text'] == 'Café products, articles & guides'
    assert scan['images'][0]['alt'] == 'Blue café product photograph'
    assert scan['images'][1]['alt'] == ''
    assert scan['images'][2]['alt'] == 'Lazy image' and scan['images'][2]['lazySrc'].endswith('lazy-original.jpg')
    assert '2x' in scan['images'][3]['srcset']
    assert scan['links'][5]['accessibleName'] == 'Product photo'
    assert scan['links'][6]['accessibleName'] == 'An accessible labelled link'
    assert 'BreadcrumbList' in scan['jsonLd'][0]['text']
    assert not scan['jsonLd'][0]['tooLarge']
    for section in ['headings','images','links','jsonLd','descriptions','canonicals']:
        for item in scan[section]:
            assert page.evaluate('(sel) => !!document.querySelector(sel)',item['locator']), (section,item['locator'])
    return scan


def verify_invalid(page):
    page.set_content((ROOT / 'tests/fixtures/missing-invalid.html').read_text(encoding='utf8'))
    page.add_script_tag(content=EXTRACTOR)
    scan = page.evaluate('window.__pageLensExtract()')
    assert scan['titleTags'] == []
    assert len(scan['descriptions']) == 2
    assert scan['descriptions'][0]['value'] == ''
    assert len(scan['canonicals']) == 2
    assert scan['counts']['headings'] == 4
    assert scan['headings'][1]['text'] == ''
    assert scan['images'][0]['alt'] is None
    assert scan['images'][1]['alt'] == ''
    assert scan['links'][0]['href'] is None
    assert scan['links'][1]['href'] == ''
    assert scan['links'][2]['accessibleName'] == ''
    assert scan['jsonLd'][0]['text'].endswith(',')
    return scan


def verify_duplicate(page):
    page.set_content((ROOT / 'tests/fixtures/duplicate.html').read_text(encoding='utf8'))
    page.add_script_tag(content=EXTRACTOR)
    scan = page.evaluate('window.__pageLensExtract()')
    assert len(scan['titleTags']) == 2
    assert len(scan['descriptions']) == 2
    assert len(scan['openGraph']) == 2
    assert scan['openGraph'][0]['key'] == scan['openGraph'][1]['key'] == 'og:title'
    return scan


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(**({'executable_path': os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'} if (os.environ.get('PAGELENS_CHROMIUM') or Path('/usr/bin/chromium').exists()) else {}),
            headless=True, args=['--no-sandbox','--disable-gpu'])
        try:
            page = browser.new_page(viewport={'width': 420,'height': 780})
            complete = verify_complete(page)
            print(f"PASS complete DOM fixture: {complete['counts']}; selectors verified")
            invalid = verify_invalid(page)
            print(f"PASS missing/malformed DOM fixture: {invalid['counts']}")
            duplicate = verify_duplicate(page)
            print(f"PASS duplicate DOM fixture: {duplicate['counts']}")
            page.close()
        finally:
            browser.close()
    print('PASS Playwright: 3 DOM fixtures (actual Chromium DOM)')

if __name__ == '__main__': main()
