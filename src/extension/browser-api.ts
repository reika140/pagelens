/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Typed, minimal Chrome API declarations for the popup-only MV3 extension. */
declare global {
  const chrome: {
    tabs: {
      query: (options: { active: boolean; currentWindow: boolean }) => Promise<Array<{ id?: number; url?: string; title?: string }>>;
    };
    storage: {
      local: {
        get: (keys: string) => Promise<Record<string, unknown>>;
        set: (values: Record<string, unknown>) => Promise<void>;
      };
      onChanged: {
        addListener: (callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void) => void;
      };
    };
    scripting: {
      executeScript: <T, A extends unknown[]>(options: {
        target: { tabId: number };
        func: (...args: A) => T;
        args?: A;
      }) => Promise<Array<{ result: T }>>;
    };
  };
}
export {};
