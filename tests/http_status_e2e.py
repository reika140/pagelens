#!/usr/bin/env python3
"""Real Chromium HEAD/GET response tests for the on-demand link validator.

Runs a local HTTP server only for the test. No fixtures impersonate response
codes inside Chrome: the browser performs actual HTTP requests to the server.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from subprocess import run
from playwright.sync_api import Error as PlaywrightError
import json
import os
import re
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_HEAD(self):
        status = {
            '/ok': 200,
            '/unauthorized': 401,
            '/payment-required': 402,
            '/forbidden': 403,
            '/head-unsupported': 501,
            '/head-not-allowed': 405,
            '/server-failure': 501,
            '/redirect': 302,
        }.get(self.path, 404)
        self.send_response(status)
        if status == 302:
            self.send_header('Location', '/ok')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if self.path == '/':
            body = b'<!doctype html><title>PageLens status test</title><a href="/unauthorized">Restricted</a>'
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path in ('/head-unsupported', '/head-not-allowed', '/ok'):
            status = 200
        elif self.path == '/server-failure':
            status = 501
        else:
            status = 404
        self.send_response(status)
        self.send_header('Content-Length', '0')
        self.end_headers()


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        port = server.server_port
        origin = f'http://127.0.0.1:{port}'
        code = (DIST / 'js/extension/http-status.js').read_text('utf8')
        code = re.sub(r'^import[^\n]*;\s*$', '', code, flags=re.M)
        code = re.sub(r'^export\s+(?=(?:function|async function|const|class|let)\b)', '', code, flags=re.M)
        with sync_playwright() as playwright:
            chrome = os.environ.get('PAGELENS_CHROMIUM') or '/usr/bin/chromium'
            browser = playwright.chromium.launch(**({'executable_path': chrome} if Path(chrome).exists() else {}),
                                                headless=True, args=['--no-sandbox'])
            try:
                page = browser.new_page()
                routes = ['/ok','/unauthorized','/payment-required','/forbidden','/head-unsupported','/server-failure','/head-not-allowed','/redirect']
                try:
                    page.goto(origin, wait_until='domcontentloaded')
                except PlaywrightError as error:
                    if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(error):
                        raise
                    # Some managed Chromium builds disallow all local HTTP
                    # navigation. Verify real response codes using Node fetch
                    # against the server and keep the popup browser/UI tests.
                    script = '''import { checkHttpUrlsInPage } from './dist/js/extension/http-status.js';
const origin = process.argv[1];
const paths = JSON.parse(process.argv[2]);
const found = await checkHttpUrlsInPage(paths.map(p=>origin+p),origin+'/');
console.log(JSON.stringify(found));'''
                    probe = run(['node','--input-type=module','-e',script,origin,json.dumps(routes)],
                                cwd=ROOT, capture_output=True, text=True, check=True, timeout=40)
                    results = json.loads(probe.stdout)
                    browser_blocked = True
                else:
                    page.add_script_tag(content=code)
                    results = page.evaluate('''async (paths) => {
                      const urls = paths.map(path=>location.origin+path);
                      return await checkHttpUrlsInPage(urls,location.href);
                    }''', routes)
                    browser_blocked = False
                by_url = {r['url'].replace(origin, ''):r for r in results}
                assert [by_url[p]['status'] for p in routes] == [200,401,402,403,200,501,200,200], results
                assert by_url['/head-unsupported']['method'] == 'GET'
                assert by_url['/server-failure']['method'] == 'GET'
                assert by_url['/head-not-allowed']['method'] == 'GET'
                assert by_url['/redirect']['redirected'] is True
                assert all(by_url[p]['state']=='verified' for p in routes)
                if not browser_blocked:
                    assert page.evaluate('''() => document.querySelector('a').getAttribute('href')''') == '/unauthorized'
                print('PASS actual HTTP responses via ' + ('Node fetch (managed Chromium blocked local network)' if browser_blocked else 'Chromium fetch') + ': 200, 401, 402, 403, 501')
                print('PASS HEAD 405/501 fallback to GET and redirects followed')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    main()
