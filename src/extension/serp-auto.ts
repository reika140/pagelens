/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Google-only, page-local organic numbering. This file is bundled with organic-rank.ts.
 *  All decisions are local. It does not read search history or contact any server.
 */
import { isGoogleFirstResultsPage, rankOrganicResultsInPage, ORGANIC_RANKING_PREF } from './organic-rank.js';
import './browser-api.js';

(function startGoogleOrganicNumbering(): void {
  // This script is injected only on the Google Search host patterns in manifest.json.
  let enabled = true;
  let observer: MutationObserver | null = null;
  let scheduled: number | null = null;
  let appliedUrl = '';
  let lastCount = 0;

  function clearSchedule(): void {
    if (scheduled !== null) window.clearTimeout(scheduled);
    scheduled = null;
  }

  function reconcile(): void {
    scheduled = null;
    if (!enabled || !isGoogleFirstResultsPage(window.location.href)) {
      rankOrganicResultsInPage('hide');
      lastCount = 0;
      appliedUrl = '';
      return;
    }
    const url = window.location.href;
    const res = rankOrganicResultsInPage('show');
    lastCount = res.count;
    appliedUrl = url;
  }

  function schedule(delay = 240): void {
    clearSchedule();
    scheduled = window.setTimeout(reconcile, delay);
  }

  function isOwnMutation(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as Element;
    return el.hasAttribute('data-pagelens-organic-position') || el.hasAttribute('data-pagelens-overlay-root');
  }

  function startObserving(): void {
    if (observer || !document.body) return;
    observer = new MutationObserver((records) => {
      const pageChanged = records.some((record) => [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
        .some((node) => !isOwnMutation(node)));
      if (!pageChanged) return;
      if (window.location.href !== appliedUrl || records.some((record) =>
        [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) =>
          node.nodeType === Node.ELEMENT_NODE && (node as Element).querySelector?.('h3, #rso, #search')))) {
        schedule();
      } else if (lastCount === 0) {
        schedule(380);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    clearSchedule();
    if (enabled) {
      startObserving();
      schedule(0);
    } else {
      observer?.disconnect();
      observer = null;
      rankOrganicResultsInPage('hide');
      lastCount = 0;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, ORGANIC_RANKING_PREF)) return;
    setEnabled(changes[ORGANIC_RANKING_PREF]?.newValue !== false);
  });
  // An unset preference means ON. Disable immediately if previously turned off.
  void chrome.storage.local.get(ORGANIC_RANKING_PREF).then((settings) => {
    setEnabled(settings[ORGANIC_RANKING_PREF] !== false);
  }).catch(() => {
    // If preferences are unavailable, do not silently ignore a previous OFF setting.
    setEnabled(false);
  });
  window.addEventListener('popstate', () => schedule(0));
  window.addEventListener('pageshow', () => schedule(0));
})();
