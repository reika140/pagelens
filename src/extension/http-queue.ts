/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** One-click, progressive checking of links from the current inspected page.
 *
 * Keep the network calls in http-status.ts. This queue never fetches URLs;
 * it only schedules small, bounded batches with a fixed concurrency limit.
 */
import type { HttpCheckResult } from './http-status.js';

export const HTTP_BATCH_SIZE = 16;
export const HTTP_PARALLEL_BATCHES = 2;
export const HTTP_MAX_URLS = 2000;

export interface HttpTargets {
  urls: string[];
  total: number;
}

/** Scan both link categories, preserving encounter order and stripping fragments. */
export function collectHttpTargets(links: ReadonlyArray<{ url: string }>, limit = HTTP_MAX_URLS): HttpTargets {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const { url } of links) {
    if (typeof url !== 'string') continue;
    try {
      const target = new URL(url);
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) continue;
      target.hash = '';
      if (seen.has(target.href)) continue;
      seen.add(target.href);
      if (urls.length < limit) urls.push(target.href);
    } catch { /* Malformed URLs are not candidates for HTTP checks. */ }
  }
  return { urls, total: seen.size };
}

export interface HttpQueueProgress {
  completed: number;
  total: number;
}
export interface HttpQueueOutcome extends HttpQueueProgress {
  stopped: boolean;
}

/**
 * Start one bulk scan and report progress after each completed batch.
 * `shouldStop` prevents new batches; in-flight HTTP requests finish safely.
 */
export async function runHttpCheckQueue(
  urls: readonly string[],
  checkBatch: (batch: string[]) => Promise<HttpCheckResult[]>,
  onBatch: (results: HttpCheckResult[], progress: HttpQueueProgress) => void,
  shouldStop: () => boolean,
): Promise<HttpQueueOutcome> {
  if (!urls.length) return { completed: 0, total: 0, stopped: false };
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += HTTP_BATCH_SIZE) {
    chunks.push(urls.slice(i, i + HTTP_BATCH_SIZE));
  }
  let next = 0;
  let completed = 0;
  let failure: unknown = null;
  const worker = async (): Promise<void> => {
    while (!failure && !shouldStop() && next < chunks.length) {
      const batch = chunks[next++];
      if (!batch) return;
      try {
        const returned = await checkBatch(batch);
        const returnedUrls = new Set(returned.map((item) => item.url));
        if (returned.length !== batch.length || batch.some((url) => !returnedUrls.has(url))) {
          throw new Error('Incomplete HTTP response batch.');
        }
        completed += returned.length;
        onBatch(returned, { completed, total: urls.length });
      } catch (error) {
        failure ??= error;
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(HTTP_PARALLEL_BATCHES, chunks.length) }, () => worker()));
  if (failure) throw failure;
  return { completed, total: urls.length, stopped: completed < urls.length };
}
