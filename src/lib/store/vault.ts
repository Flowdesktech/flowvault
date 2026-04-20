/**
 * In-memory state for the currently open vault. Intentionally not persisted:
 * leaving the tab should forget everything, which is what users expect from
 * a zero-knowledge notepad.
 */
import { create } from "zustand";
import type { DeadmanRecord } from "@/lib/firebase/sites";

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
  content: string;
  /** Snapshot of the deadman config at open time (refreshed on save). */
  deadman: DeadmanRecord | null;
  /** True if the beneficiary opened a released vault. UI uses this to mark the vault read-only. */
  beneficiary: boolean;
}

interface VaultState {
  open: OpenVault | null;
  setOpen: (v: OpenVault) => void;
  updateContent: (content: string) => void;
  updateAfterSave: (patch: {
    blob: Uint8Array;
    version: number;
    content: string;
  }) => void;
  setVersion: (version: number) => void;
  setDeadman: (deadman: DeadmanRecord | null) => void;
  close: () => void;
}

export const useVault = create<VaultState>((set) => ({
  open: null,
  setOpen: (v) => set({ open: v }),
  updateContent: (content) =>
    set((s) => (s.open ? { open: { ...s.open, content } } : s)),
  updateAfterSave: ({ blob, version, content }) =>
    set((s) =>
      s.open ? { open: { ...s.open, blob, version, content } } : s,
    ),
  setVersion: (version) =>
    set((s) => (s.open ? { open: { ...s.open, version } } : s)),
  setDeadman: (deadman) =>
    set((s) => (s.open ? { open: { ...s.open, deadman } } : s)),
  close: () => set({ open: null }),
}));
