/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Minimal native MV3 API declarations for a dependency-free TypeScript build. */
declare global {
  const chrome: {
    action: {
      onClicked: { addListener: (callback: (tab: { id?: number; windowId?: number; url?: string }) => void) => void };
    };
    sidePanel: {
      open: (options: { windowId: number }) => Promise<void>;
    };
    runtime: {
      sendMessage: (message: unknown) => Promise<unknown>;
      onMessage: { addListener: (callback: (message: unknown, sender: unknown, sendResponse: (reply: unknown) => void) => boolean | void) => void };
    };
    tabs: {
      query: (options: { active: boolean; currentWindow: boolean }) => Promise<Array<{ id?: number; url?: string; title?: string }>>;
      onActivated: {
        addListener: (callback: (info: { tabId: number; windowId: number }) => void) => void;
      };
      onUpdated: {
        addListener: (callback: (tabId: number, changeInfo: { status?: string; url?: string }, tab: { active?: boolean }) => void) => void;
      };
      onRemoved: {
        addListener: (callback: (tabId: number) => void) => void;
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
