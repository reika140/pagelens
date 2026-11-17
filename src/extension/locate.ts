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
    return 'Click the PageLens toolbar icon to grant temporary access and scan this tab. Chrome internal pages, the Web Store and managed pages may remain restricted.';
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

/** Runs inside the tab. A transient DOM overlay lives at most 2.5 seconds. */
export function highlightInPage(selector: string): { ok: boolean; reason: string } {
  let element: Element | null;
  try { element = document.querySelector(selector); }
  catch { return { ok: false, reason: 'The stored CSS selector could not be resolved.' }; }
  if (!element) return { ok: false, reason: 'This element is no longer in the webpage. Refresh the scan.' };
  if (!document.body) return { ok: false, reason: 'The webpage has no visible body.' };
  const target = element;
  const rect = target.getBoundingClientRect();
  if (!rect.width && !rect.height) return { ok: false, reason: 'The target is hidden or has no visual bounds.' };
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  const markerId = 'pagelens-target-overlay';
  const previous = document.getElementById(markerId);
  previous?.remove();
  const overlay = document.createElement('div');
  overlay.id = markerId;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.position = 'fixed';
  overlay.style.zIndex = '2147483647';
  overlay.style.pointerEvents = 'none';
  overlay.style.border = '3px solid #487aff';
  overlay.style.borderRadius = '5px';
  overlay.style.background = 'rgba(72,122,255,0.10)';
  overlay.style.boxShadow = '0 0 0 4px rgba(72,122,255,0.24)';
  overlay.style.boxSizing = 'border-box';
  const position = () => {
    if (!overlay.isConnected) return;
    const bounds = target.getBoundingClientRect();
    overlay.style.top = `${bounds.top - 3}px`;
    overlay.style.left = `${bounds.left - 3}px`;
    overlay.style.width = `${bounds.width + 6}px`;
    overlay.style.height = `${bounds.height + 6}px`;
  };
  document.body.append(overlay);
  position();
  // Scroll animation can take time, so update while scrolling and remove all listeners.
  const onScroll = () => position();
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  const timer = window.setInterval(position, 100);
  window.setTimeout(() => {
    window.clearInterval(timer);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
    overlay.remove();
  }, 2500);
  return { ok: true, reason: 'Element highlighted on the webpage.' };
}

export async function highlightTab(tabId: number, selector: string): Promise<{ ok: boolean; reason: string }> {
  const result = await chrome.scripting.executeScript({ target: { tabId }, func: highlightInPage, args: [selector] });
  return result[0]?.result ?? { ok: false, reason: 'No highlight result returned by Chrome.' };
}
