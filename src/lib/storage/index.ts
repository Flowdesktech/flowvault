/**
 * Active vault-storage adapter selection.
 *
 * Every call site that needs to read or write a vault blob should go
 * through `getVaultStorage(siteId)` rather than importing a concrete
 * adapter directly.
 *
 * ----------------------------------------------------------------
 *  Dispatch model
 * ----------------------------------------------------------------
 *
 * The overwhelming majority of vaults are addressed by a slug that
 * hashes to a Firestore document id, and for those the
 * `firestoreVaultStorage` singleton is the correct adapter. But for
 * Bring-Your-Own-Storage vaults (currently: local-file, with
 * S3/WebDAV on the roadmap) the adapter is bound to a specific
 * resource the user just picked, and we can only build it once we
 * have the user gesture (picker / permission grant).
 *
 * We handle this with a per-siteId override map that the BYOS open /
 * create flow populates before calling any service-layer function.
 * Lookup priority:
 *
 *   1. `adapterOverrides.get(siteId)` if present → BYOS adapter.
 *   2. fall through to the Firestore singleton.
 *
 * This keeps every existing call site unchanged (they already have a
 * siteId in scope) and makes the BYOS case explicit at the precise
 * point where a picker was consumed, with no ambient global state.
 *
 * ----------------------------------------------------------------
 *  Lifetime
 * ----------------------------------------------------------------
 *
 * The override map lives only in the current page's JS heap. A tab
 * reload or navigation to another site wipes it. That is the correct
 * behavior: BYOS handles themselves only persist in IndexedDB, and
 * the File System Access permission is re-prompted on every session
 * anyway. Callers on the BYOS route are responsible for re-registering
 * the adapter after recalling the handle.
 */
import { firestoreVaultStorage } from "./firestore";
import type { VaultStorageAdapter } from "./adapter";

export type {
  CreateVaultInput,
  DeadmanRecord,
  KdfParamsRecord,
  RestoreVaultInput,
  VaultRecord,
  VaultRefreshResult,
  VaultStorageAdapter,
  VolumeParamsRecord,
  WriteCiphertextInput,
  WriteResult,
} from "./adapter";

const adapterOverrides = new Map<string, VaultStorageAdapter>();

/**
 * Return the storage adapter to use for the given vault siteId.
 *
 * If `siteId` is omitted or not present in the override map, returns
 * the Firestore adapter. The omitted-siteId case exists so legacy
 * callers that read module-level site state (not tied to a specific
 * vault) keep compiling; prefer to pass siteId whenever you have one.
 */
export function getVaultStorage(siteId?: string): VaultStorageAdapter {
  if (siteId) {
    const override = adapterOverrides.get(siteId);
    if (override) return override;
  }
  return firestoreVaultStorage;
}

/**
 * Install a BYOS adapter for a specific siteId. Must be called before
 * any service-layer operation on that siteId.
 *
 * Safe to call repeatedly with the same siteId; later calls replace the
 * previously-registered adapter. This matters for BYOS flows where the
 * user re-opens a local vault in a new session: a fresh adapter is
 * built against a re-recalled file handle and the old one is dropped.
 */
export function registerVaultStorageAdapter(
  siteId: string,
  adapter: VaultStorageAdapter,
): void {
  adapterOverrides.set(siteId, adapter);
}

/**
 * Remove the override for a siteId, reverting lookups to the Firestore
 * adapter. Useful on vault-close to free the reference to the file
 * handle / adapter closure and keep the heap tidy.
 */
export function unregisterVaultStorageAdapter(siteId: string): void {
  adapterOverrides.delete(siteId);
}

/**
 * True iff a non-Firestore adapter is currently registered for this
 * siteId. UI code uses this (indirectly, via `storageKind` on the
 * vault store) to gate BYOS-incompatible features like the hosted
 * trusted handover sweep.
 */
export function hasAdapterOverride(siteId: string): boolean {
  return adapterOverrides.has(siteId);
}
