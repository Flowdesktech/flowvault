"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a ticking clock. Returns `Date.now()` on every tick so
 * countdown UIs stay fresh without the caller reaching for an impure
 * `Date.now()` in render (which React lints flag).
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
