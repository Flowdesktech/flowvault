/**
 * In-memory state for the currently open vault. Intentionally not persisted:
 * leaving the tab should forget everything, which is what users expect from
 * a zero-knowledge notepad.
 *
 * The slot-of-notebooks model: the vault state carries an entire
 * `NotebookBundle` (one active + N tabs), not just one string. All
 * notebook-level mutations (type, rename, add, delete, switch tab) go
 * through the bundle helpers so serialization stays consistent.
 */
import { create } from "zustand";
import type { DeadmanRecord } from "@/lib/firebase/sites";
import {
  addNotebook,
  getActive,
  moveNotebook,
  removeNotebook,
  renameNotebook,
  setActive,
  updateActiveContent,
  type NotebookBundle,
} from "@/lib/vault/notebooks";

export interface OpenVault {
  slug: string;
  siteId: string;
  slotIndex: number;
  masterKey: Uint8Array;
  kdfSalt: Uint8Array;
  volume: { slotCount: number; slotSize: number };
  /** Latest ciphertext blob fetched or written. Needed for slot-preserving updates. */
  blob: Uint8Array;
  version: number;
  bundle: NotebookBundle;
  /** Snapshot of the deadman config at open time (refreshed on save). */
  deadman: DeadmanRecord | null;
  /** True if the beneficiary opened a released vault. UI uses this to mark the vault read-only. */
  beneficiary: boolean;
}

interface VaultState {
  open: OpenVault | null;
  setOpen: (v: OpenVault) => void;
  /** Update the active notebook's content. All other tabs are untouched. */
  updateActive: (content: string) => void;
  /** Rename any notebook by id. */
  rename: (id: string, title: string) => void;
  /** Add a new notebook and make it active. No-op if at the cap. */
  add: (title?: string) => void;
  /** Remove a notebook. Keeps at least one (no-op if that's the last). */
  remove: (id: string) => void;
  /** Switch active tab. */
  switchTo: (id: string) => void;
  /** Reorder a notebook from one index to another. */
  move: (fromIndex: number, toIndex: number) => void;
  /** After a successful save: update blob/version, bundle is already fresh. */
  updateAfterSave: (patch: {
    blob: Uint8Array;
    version: number;
  }) => void;
  /**
   * After a conflict-recovery refetch: sync blob/version/deadman from
   * the server without disturbing the in-memory `bundle` (which holds
   * the user's unsaved edits) or `masterKey` (which the server never
   * sees).
   */
  syncFromServer: (patch: {
    blob: Uint8Array;
    version: number;
    deadman: DeadmanRecord | null;
  }) => void;
  setVersion: (version: number) => void;
  setDeadman: (deadman: DeadmanRecord | null) => void;
  close: () => void;
}

export const useVault = create<VaultState>((set) => ({
  open: null,
  setOpen: (v) => set({ open: v }),
  updateActive: (content) =>
    set((s) =>
      s.open
        ? { open: { ...s.open, bundle: updateActiveContent(s.open.bundle, content) } }
        : s,
    ),
  rename: (id, title) =>
    set((s) =>
      s.open
        ? { open: { ...s.open, bundle: renameNotebook(s.open.bundle, id, title) } }
        : s,
    ),
  add: (title) =>
    set((s) =>
      s.open
        ? { open: { ...s.open, bundle: addNotebook(s.open.bundle, title) } }
        : s,
    ),
  remove: (id) =>
    set((s) =>
      s.open
        ? { open: { ...s.open, bundle: removeNotebook(s.open.bundle, id) } }
        : s,
    ),
  switchTo: (id) =>
    set((s) =>
      s.open
        ? { open: { ...s.open, bundle: setActive(s.open.bundle, id) } }
        : s,
    ),
  move: (fromIndex, toIndex) =>
    set((s) =>
      s.open
        ? { open: { ...s.open, bundle: moveNotebook(s.open.bundle, fromIndex, toIndex) } }
        : s,
    ),
  updateAfterSave: ({ blob, version }) =>
    set((s) =>
      s.open ? { open: { ...s.open, blob, version } } : s,
    ),
  syncFromServer: ({ blob, version, deadman }) =>
    set((s) =>
      s.open ? { open: { ...s.open, blob, version, deadman } } : s,
    ),
  setVersion: (version) =>
    set((s) => (s.open ? { open: { ...s.open, version } } : s)),
  setDeadman: (deadman) =>
    set((s) => (s.open ? { open: { ...s.open, deadman } } : s)),
  close: () => set({ open: null }),
}));

/** Convenience selector: the currently active notebook. */
export function useActiveNotebook() {
  return useVault((s) => (s.open ? getActive(s.open.bundle) : null));
}
