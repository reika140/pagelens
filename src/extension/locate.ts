/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import { extractPageSnapshot } from '../core/extract.js';
import type { RawSnapshot } from '../core/types.js';
import './browser-api.js';
import { isScriptAccessDenied } from './permissions.js';

export function isSupportedPage(url: string | undefined): boolean {
  if (!url) return false;
  try { return ['http:', 'https:'].includes(new URL(url).protocol); }
  catch { return false; }
}

export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (isScriptAccessDenied(error)) {
    return 'Chrome denied access to this tab. Check the PageLens site-access setting and reopen the popup.';
  }
  if (/No tab with id|tab was closed|frame .* removed/i.test(message)) return 'The tab changed or closed before the scan completed. Try scanning again.';
  return `Scan failed: ${message}`;
}

export async function currentActiveTab(): Promise<{ id: number; url?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('No active browser tab is available.');
  return { id: tab.id, url: tab.url };
}

export async function scanTab(tabId: number): Promise<RawSnapshot> {
  const result = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageSnapshot });
  if (!result[0]?.result || !result[0].result.url) throw new Error('The webpage did not return a usable scan result.');
  return result[0].result;
}
