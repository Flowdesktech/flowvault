/**
 * In-memory state for the currently open vault. Intentionally not persisted:
 * leaving the tab should forget everything, which is what users expect from
 * a zero-knowledge notepad.
 *
 * The slot-of-notebooks model: the vault state carries an entire
 * `NotebookBundle` (one active + N tabs), not just one string. All
 * notebook-level mutations (type, rename, add, delete, switch tab) go
 * through the bundle helpers so serialization stays consistent.
 *
 * BYOS (Bring Your Own Storage) fields:
 *   - `storageKind` tags whether the vault lives in Firestore (the hosted
 *     default) or in a user-provided backend (currently: local file). The
 *     editor uses it to gate features whose implementation is
 *     server-dependent, most notably the Trusted Handover sweep.
 *   - `slug` is `null` for local-file vaults, which have no public URL
 *     segment. Chrome that needs to identify the vault should use
 *     `displayLabel` instead so it renders something sensible regardless
 *     of backend.
 */
import { create } from "zustand";
import type { DeadmanRecord } from "@/lib/firebase/sites";
import { unregisterVaultStorageAdapter } from "@/lib/storage";
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

export type StorageKind = "firestore" | "localFile";

export interface OpenVault {
  /** Null for BYOS vaults without a public slug. */
  slug: string | null;
  siteId: string;
  storageKind: StorageKind;
  /**
   * Human-readable identifier shown in the editor chrome. For Firestore
   * vaults this mirrors `slug`; for local-file vaults this is the file
   * name the user picked. Always non-null so the UI never has to branch.
   */
  displayLabel: string;
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
  close: () =>
    set((s) => {
      // Locking a BYOS vault: drop the per-site adapter override so a
      // subsequent visit goes through the recall + re-prompt flow
      // (including a fresh File System Access permission grant) rather
      // than silently reusing the in-memory handle. Firestore vaults
      // have no override to unregister; the call is a no-op.
      if (s.open && s.open.storageKind !== "firestore") {
        unregisterVaultStorageAdapter(s.open.siteId);
      }
      return { open: null };
    }),
}));

/** Convenience selector: the currently active notebook. */
export function useActiveNotebook() {
  return useVault((s) => (s.open ? getActive(s.open.bundle) : null));
}
