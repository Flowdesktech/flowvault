"use client";

import { useCallback, useSyncExternalStore } from "react";

export type EditorViewMode = "edit" | "preview" | "split";

const STORAGE_KEY = "flowvault.editor.viewMode";
const SPLIT_MIN_WIDTH = 900;

function isViewMode(v: unknown): v is EditorViewMode {
  return v === "edit" || v === "preview" || v === "split";
}

/**
 * Mode preference store backed by localStorage.
 *
 * We use `useSyncExternalStore` instead of the classic
 * `useState + useEffect(readStorage)` pattern because the latter
 * trips the project's `set-state-in-effect` lint rule (and, more
 * importantly, causes a flash of the wrong default on every mount).
 *
 * Subscribers are notified both when another tab writes the key (via
 * the native `storage` event) and when this tab writes the key (via
 * our in-memory `modeListeners` set). The native `storage` event
 * does NOT fire in the writing tab, which is why we need both.
 */
const modeListeners = new Set<() => void>();

function subscribeMode(cb: () => void): () => void {
  modeListeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", cb);
  }
  return () => {
    modeListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function getModeSnapshot(): EditorViewMode {
  if (typeof window === "undefined") return "edit";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isViewMode(raw)) return raw;
  } catch {
    // localStorage disabled (private-mode Safari, sandboxed iframe);
    // fall through to the default.
  }
  return "edit";
}

function getModeServerSnapshot(): EditorViewMode {
  // Server-render assumption: "edit" is the safest default for both
  // first-time visitors (no preference yet) and for matching the
  // hook's initial client snapshot before rehydration.
  return "edit";
}

function writeMode(next: EditorViewMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage failures; notify subscribers anyway so the
    // in-memory UI still updates for this session.
  }
  modeListeners.forEach((cb) => cb());
}

/**
 * Split-capable viewport store backed by `matchMedia`.
 *
 * Assumes `true` on the server so that initial SSR output matches
 * the common wide-viewport client case; narrow clients will repaint
 * once on hydration.
 */
function subscribeCanSplit(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getCanSplitSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`).matches;
}

function getCanSplitServerSnapshot(): boolean {
  return true;
}

/**
 * Editor view mode: edit / preview / split.
 *
 * `mode` is the persisted preference. `effectiveMode` collapses
 * "split" to "preview" when the viewport is narrower than
 * `SPLIT_MIN_WIDTH`, since side-by-side below that breakpoint
 * produces unreadable columns. The persisted preference is left
 * alone so resizing back to a wide viewport restores split view
 * without the user re-selecting it.
 */
export function useEditorViewMode(): {
  mode: EditorViewMode;
  effectiveMode: EditorViewMode;
  setMode: (next: EditorViewMode) => void;
  canSplit: boolean;
} {
  const mode = useSyncExternalStore(
    subscribeMode,
    getModeSnapshot,
    getModeServerSnapshot,
  );
  const canSplit = useSyncExternalStore(
    subscribeCanSplit,
    getCanSplitSnapshot,
    getCanSplitServerSnapshot,
  );

  const setMode = useCallback((next: EditorViewMode) => {
    writeMode(next);
  }, []);

  const effectiveMode: EditorViewMode =
    mode === "split" && !canSplit ? "preview" : mode;

  return { mode, effectiveMode, setMode, canSplit };
}
