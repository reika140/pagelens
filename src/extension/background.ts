/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import { extractPageSnapshot } from '../core/extract.js';
import type { RawSnapshot } from '../core/types.js';
import { isSupportedPage } from './locate.js';
import type { ActionScanReply } from './action-session.js';
import { ACTION_SESSION_TTL_MS, isRecentActionScan } from './action-session.js';
import './browser-api.js';

/**
 * A toolbar click is the user gesture that grants activeTab. Capture the page
 * in that gesture, rather than trying to obtain permissions from the panel.
 * No host_permissions, tabs, storage or persistent content scripts required.
 */
const actionScans = new Map<number, { startedAt: number; pending: Promise<ActionScanReply> }>();

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    // Must be initiated directly by the click handler (not after awaiting a scan).
    void chrome.sidePanel.open({ windowId: tab.windowId })
      .catch((error: unknown) => console.warn('PageLens: could not open Side Panel', error));
  }
  if (tab.id === undefined) return;
  const tabId = tab.id;
  const startedAt = Date.now();
  const pending: Promise<ActionScanReply> = tab.url && !isSupportedPage(tab.url)
    ? Promise.resolve({ ok: false, tabId, error: 'Open a regular HTTP(S) page to inspect it.' })
    : chrome.scripting.executeScript({ target: { tabId }, func: extractPageSnapshot })
        .then((injections): ActionScanReply => {
          const raw: RawSnapshot | undefined = injections[0]?.result;
          return raw?.url
            ? { ok: true, tabId, snapshot: raw }
            : { ok: false, tabId, error: 'No scan result was returned by the page.' };
        })
        .catch((error: unknown): ActionScanReply => ({
          ok: false, tabId, error: error instanceof Error ? error.message : String(error),
        }));
  // Keep one transient result for each toolbar-invoked tab; never write scans to disk.
  for (const [id, session] of actionScans) {
    if (!isRecentActionScan(session.startedAt, startedAt)) actionScans.delete(id);
  }
  actionScans.set(tabId, { startedAt, pending });
  void pending.then(() => {
    // If the panel was already open, this notifies it. If not, it requests
    // the cached result once it loads. A missing listener is harmless.
    void chrome.runtime.sendMessage({ type: 'pagelens:action-scan-ready', tabId })
      .catch(() => undefined);
  });
});

// Never replay a cached inspection after navigation to another document.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading' || change.url) actionScans.delete(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => actionScans.delete(tabId));

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'pagelens:get-action-scan') return false;
  if (!('tabId' in message) || typeof message.tabId !== 'number') { sendResponse(null); return false; }
  const session = actionScans.get(message.tabId);
  if (!session || !isRecentActionScan(session.startedAt, Date.now())) {
    sendResponse(null);
    return false;
  }
  void session.pending.then(sendResponse, () => sendResponse(null));
  return true; // Keep the message channel open until the async scan completes.
});
