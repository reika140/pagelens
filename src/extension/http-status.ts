/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/**
 * User-triggered, bounded HTTP link checks. Runs inside the inspected tab so
 * same-origin URLs can be checked with the existing activeTab grant. External
 * URLs are best-effort and obey ordinary browser CORS. No host permissions,
 * proxy, backend, persistent crawler or network request is made until clicked.
 */
import './browser-api.js';

export type HttpCheckMethod = 'HEAD' | 'GET';
export type HttpCheckState = 'verified' | 'unavailable' | 'timeout' | 'skipped';

export interface HttpCheckResult {
  url: string;
  state: HttpCheckState;
  status: number | null;
  method: HttpCheckMethod | null;
  redirected: boolean;
  finalUrl: string;
  reason: string;
}

/** A status is an HTTP observation, not proof that a link is permanently broken. */
export function httpStatusCategory(status: number | null): 'success' | 'warning' | 'error' | 'info' {
  if (status === null) return 'info';
  if (status >= 200 && status <= 299) return 'success';
  if (status >= 400 && status <= 599) return 'error';
  return 'warning';
}

/**
 * This function is serialized by chrome.scripting.executeScript. Keep it
 * self-contained: it cannot capture any variables from this module.
 * Requests are intentionally bound to URLs supplied from the current DOM.
 */
export async function checkHttpUrlsInPage(urls: string[], pageUrl: string): Promise<HttpCheckResult[]> {
  type Entry = HttpCheckResult;
  const limited: string[] = [];
  const seen = new Set<string>();
  for (const value of urls) {
    if (typeof value !== 'string' || seen.has(value)) continue;
    seen.add(value);
    limited.push(value);
    if (limited.length >= 16) break;
  }
  let origin = '';
  try { origin = new URL(pageUrl).origin; } catch { /* No origin means no check. */ }
  const output: Entry[] = new Array(limited.length);
  let cursor = 0;

  const result = (url: string, state: Entry['state'], reason: string, method: Entry['method'] = null): Entry => ({
    url, state, reason, method, status: null, redirected: false, finalUrl: '',
  });
  const localAddress = (hostname: string): boolean => {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
    const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ip) return false;
    const octets = ip.slice(1).map(Number);
    const a = octets[0] ?? 999;
    const b = octets[1] ?? 999;
    const c = octets[2] ?? 999;
    const d = octets[3] ?? 999;
    if ([a,b,c,d].some((n) => n > 255)) return true;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
  };

  const runOne = async (url: string): Promise<Entry> => {
    let target: URL;
    try { target = new URL(url); }
    catch { return result(url, 'skipped', 'Invalid URL'); }
    if (!origin || !['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
      return result(url, 'skipped', 'Not a checkable HTTP(S) URL');
    }
    const sameOrigin = target.origin === origin;
    if (!sameOrigin && localAddress(target.hostname)) return result(url, 'skipped', 'Local network destinations are not probed');
    // A cross-origin redirect may be blocked by CORS even if the initial URL
    // responds. Such cases must never be presented as a 4xx/5xx response.
    const request = async (method: HttpCheckMethod): Promise<Entry> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(target.href, {
          method, mode: 'cors', credentials: sameOrigin ? 'same-origin' : 'omit',
          redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
          ...(method === 'GET' && sameOrigin ? { headers: { Range: 'bytes=0-0' } } : {}),
        });
        // Never intentionally download an entire resource during a status check.
        if (response.body) void response.body.cancel().catch(() => {});
        return { url, state: 'verified', status: response.status, method,
          redirected: response.redirected, finalUrl: response.url, reason: '' };
      } catch {
        return result(url, controller.signal.aborted ? 'timeout' : 'unavailable',
          controller.signal.aborted ? 'Request timed out' : 'CORS restriction, network error or connection blocked', method);
      } finally { clearTimeout(timer); }
    };
    const head = await request('HEAD');
    // 405 and 501 sometimes mean only HEAD is unsupported. A same-origin
    // lightweight GET can distinguish this from a genuinely failing URL.
    if (sameOrigin && head.state === 'verified' && (head.status === 405 || head.status === 501)) {
      return request('GET');
    }
    return head;
  };

  const worker = async (): Promise<void> => {
    while (cursor < limited.length) {
      const index = cursor++;
      const url = limited[index];
      if (url) output[index] = await runOne(url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, limited.length) }, () => worker()));
  return output.filter((item): item is Entry => !!item);
}

export async function checkHttpLinks(tabId: number, urls: string[], pageUrl: string): Promise<HttpCheckResult[]> {
  if (!Number.isInteger(tabId) || urls.length > 16 || !urls.every((url) => typeof url === 'string')) {
    throw new Error('Invalid HTTP check batch.');
  }
  const results = await chrome.scripting.executeScript<HttpCheckResult[], [string[], string]>({
    target: { tabId }, func: checkHttpUrlsInPage, args: [urls, pageUrl],
  });
  const result = results[0]?.result;
  if (!Array.isArray(result)) throw new Error('The webpage did not return HTTP status results.');
  return result;
}
