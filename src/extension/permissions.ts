/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Interpret denied Chrome scripting calls; access can still be limited by browser policy. */
export function isScriptAccessDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cannot access contents|cannot access a chrome|cannot be scripted|missing host permission|permission to access|permission denied|host permission|not allowed to access|extensions gallery/i.test(message);
}
