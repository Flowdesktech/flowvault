/**
 * Vault storage adapter contract.
 *
 * All vault-blob reads and writes go through an implementation of
 * `VaultStorageAdapter`. Today Flowvault ships with one adapter backed by
 * Firestore (`FirestoreVaultStorageAdapter`); future adapters may persist the
 * blob in the user's own S3-compatible bucket, WebDAV server, or a local
 * file handle (Bring Your Own Storage).
 *
 * ----------------------------------------------------------------------
 *  Scope
 * ----------------------------------------------------------------------
 *
 * The adapter is responsible for *vault blobs only*:
 *
 *   - Fixed-size ciphertext (the hidden-volume blob).
 *   - KDF salt + KDF params + volume params needed to reconstruct the key
 *     schedule for opening a notebook.
 *   - Optimistic-concurrency `version` counter.
 *   - `deadman` record when the concrete adapter supports server-side
 *     dead-man's-switch scheduling. Adapters that cannot drive the sweep
 *     (e.g. BYOS backends) must always return `deadman: null`.
 *
 * Features that are *not* storage primitives &mdash; time-locked notes,
 * Encrypted Send, configuring or releasing a deadman &mdash; continue to
 * flow through their own services and are not part of this contract. A
 * BYOS vault may still use Flowvault-hosted time-locks and sends; it
 * simply cannot use a deadman because the sweep is bound to the Flowvault
 * backend.
 *
 * ----------------------------------------------------------------------
 *  CAS semantics
 * ----------------------------------------------------------------------
 *
 * `writeCiphertext` is a conditional write. It must succeed only if the
 * stored `version` still equals the caller-provided `expectedVersion`. On
 * success the stored `version` is incremented by one and that new value is
 * returned. On mismatch the adapter returns the current stored version so
 * the caller can reconcile.
 */
import type {
  DeadmanRecord,
  KdfParamsRecord,
  VolumeParamsRecord,
} from "@/lib/firebase/sites";
import type { Timestamp } from "firebase/firestore";

export type {
  DeadmanRecord,
  KdfParamsRecord,
  VolumeParamsRecord,
};

export interface VaultRecord {
  ciphertext: Uint8Array;
  kdfSalt: Uint8Array;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
  version: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  /**
   * Dead-man's-switch record. Only non-null for adapters that can schedule
   * the release sweep server-side (currently only the Firestore adapter).
   */
  deadman: DeadmanRecord | null;
}

export interface VaultRefreshResult {
  version: number;
  ciphertext: Uint8Array;
  deadman: DeadmanRecord | null;
}

export interface CreateVaultInput {
  siteId: string;
  ciphertext: Uint8Array;
  kdfSalt: Uint8Array;
}

export interface RestoreVaultInput {
  siteId: string;
  ciphertext: Uint8Array;
  kdfSalt: Uint8Array;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
}

export interface WriteCiphertextInput {
  siteId: string;
  ciphertext: Uint8Array;
  expectedVersion: number;
}

export type WriteResult =
  | { ok: true; newVersion: number }
  | { ok: false; currentVersion: number };

export interface VaultStorageAdapter {
  /**
   * Create a brand-new vault document. Must fail if a vault already
   * exists at `siteId` (no silent overwrite).
   */
  create(input: CreateVaultInput): Promise<void>;

  /**
   * Create a vault from a decoded backup envelope. Like `create` but
   * preserves the KDF params and volume layout from the backup verbatim.
   * Must fail if a vault already exists at `siteId`.
   */
  restore(input: RestoreVaultInput): Promise<void>;

  /**
   * Fetch the full vault record. Returns `null` if no vault exists at
   * `siteId`. Used on open, restore precheck, and beneficiary unlock.
   */
  read(siteId: string): Promise<VaultRecord | null>;

  /**
   * Lightweight read for CAS recovery. Returns only the fields needed to
   * rebuild state after a save conflict: current version, full ciphertext,
   * and current deadman snapshot. Returns `null` if the vault is gone.
   */
  refresh(siteId: string): Promise<VaultRefreshResult | null>;

  /**
   * Compare-and-swap write of the ciphertext blob. Succeeds only if the
   * stored version matches `expectedVersion`; returns `{ ok: false,
   * currentVersion }` on mismatch so the caller can trigger a refresh
   * and retry. On success the stored version is incremented and the new
   * value is returned.
   *
   * Adapters that carry a deadman record should atomically bump the
   * deadman heartbeat timestamp on successful write; this is an
   * implementation detail of the concrete adapter, not a parameter here.
   */
  writeCiphertext(input: WriteCiphertextInput): Promise<WriteResult>;
}
