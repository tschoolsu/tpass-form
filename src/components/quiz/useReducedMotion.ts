"use client";

// 尊重系統的「減少動態效果」：特效層（burst / scene / 選中動畫）一律不掛。
// 這是唯一的開關——CSS 那邊還有一道保險（globals.css）。
import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // SSR fallback：動畫只在點擊後才觸發（那時已 hydrate 完），不會閃一下。
    () => false,
  );
}
