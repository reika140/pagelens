/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
import type { RawSnapshot } from '../core/types.js';

export type ActionScanReply =
  | { ok: true; tabId: number; snapshot: RawSnapshot }
  | { ok: false; tabId: number; error: string };

/** Short-lived in-memory handoff from the toolbar action to an opening panel. */
export const ACTION_SESSION_TTL_MS = 120_000;
export function isRecentActionScan(startedAt: number, now: number): boolean {
  return Number.isFinite(startedAt) && Number.isFinite(now) && now >= startedAt && now - startedAt <= ACTION_SESSION_TTL_MS;
}
export function isActionScanReply(value: unknown, tabId: number): value is ActionScanReply {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Partial<ActionScanReply>;
  return reply.tabId === tabId && (reply.ok === true && !!reply.snapshot?.url || reply.ok === false && typeof reply.error === 'string');
}
