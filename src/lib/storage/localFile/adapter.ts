/**
 * Bring-Your-Own-Storage adapter backed by a local file on disk.
 *
 * Each adapter instance is bound to one `FileSystemFileHandle`. The
 * factory `createLocalFileVaultStorage(handle)` produces an adapter that
 * treats that file as the entire persistence layer for a single vault.
 * A browser tab typically holds exactly one of these at a time (the
 * vault the user is currently editing).
 *
 * -----------------------------------------------------------------
 *  CAS model for a local file
 * -----------------------------------------------------------------
 *
 * The File System Access API does not offer an atomic compare-and-swap.
 * We synthesize one by reading the current file header, comparing its
 * `vaultVersion` against the caller's `expectedVersion`, and — only if
 * they match — writing a new file whose header advances `vaultVersion`
 * by one. Between the read and the write, another tab on the same
 * origin could race us; when the loser's write lands it will still see
 * a smaller version on its next read and recover via the normal
 * conflict flow. This is strictly weaker than Firestore's transactional
 * CAS but matches the practical threat model of a single user on their
 * own machine, where "two tabs stomped each other" is the worst case
 * and is already handled by the editor's conflict-resolution UX.
 *
 * -----------------------------------------------------------------
 *  Server-only features
 * -----------------------------------------------------------------
 *
 * A local file cannot participate in the Flowvault-hosted dead-man's
 * switch (there is no server here to sweep). The adapter always
 * returns `deadman: null`, which upstream surfaces as "Trusted handover
 * is unavailable for local vaults" in the UI. Time-locks and Encrypted
 * Send are unaffected — they are client-side uses of external services
 * (drand for time-locks, Flowvault's send endpoint for one-shot notes).
 */
import {
  decodeLocalVaultFile,
  encodeLocalVaultFile,
  LOCAL_VAULT_FORMAT_VERSION,
  type LocalVaultFile,
} from "./format";
import { ensurePermission } from "./handleRegistry";
import { KDF_PARAMS } from "@/lib/crypto/kdf";
import { VOLUME_DEFAULTS } from "@/lib/crypto/volume";
import type {
  CreateVaultInput,
  RestoreVaultInput,
  VaultRecord,
  VaultRefreshResult,
  VaultStorageAdapter,
  WriteCiphertextInput,
  WriteResult,
} from "../adapter";

/**
 * Build a `VaultStorageAdapter` bound to a specific local file handle.
 *
 * The `localSiteId` is the identity we expect to find inside the file
 * on read. It must match the UUID that was (or will be) stamped into
 * the file header. Passing a mismatched pair is a programmer error and
 * the adapter will throw clearly when it detects the divergence.
 */
export function createLocalFileVaultStorage(
  handle: FileSystemFileHandle,
  localSiteId: string,
): VaultStorageAdapter {
  async function readFileBytes(mode: "read" | "readwrite"): Promise<Uint8Array> {
    const ok = await ensurePermission(handle, mode);
    if (!ok) {
      throw new Error(
        "Permission to access the local vault file was not granted.",
      );
    }
    const file = await handle.getFile();
    const buf = await file.arrayBuffer();
    return new Uint8Array(buf);
  }

  async function writeFileBytes(bytes: Uint8Array): Promise<void> {
    const ok = await ensurePermission(handle, "readwrite");
    if (!ok) {
      throw new Error(
        "Permission to write to the local vault file was not granted.",
      );
    }
    // `createWritable` without `{ keepExistingData: true }` truncates on
    // open, which is what we want: every save rewrites the file. The
    // browser-internal temp file + rename (when available) protects us
    // from partial writes.
    const writable = await handle.createWritable();
    try {
      // Cast to BufferSource: TS 5.7+ narrows `FileSystemWriteChunkType`
      // to `Uint8Array<ArrayBuffer>` specifically, while our encoder
      // returns `Uint8Array<ArrayBufferLike>`. The bytes are always
      // backed by a fresh ArrayBuffer (minted inside `encodeLocalVaultFile`),
      // so the runtime assignment is safe.
      await writable.write(bytes as BufferSource);
      await writable.close();
    } catch (err) {
      try {
        await writable.abort();
      } catch {
        // ignore
      }
      throw err;
    }
  }

  async function readCurrent(): Promise<LocalVaultFile | null> {
    const bytes = await readFileBytes("read");
    if (bytes.length === 0) return null;
    const parsed = decodeLocalVaultFile(bytes);
    if (parsed.localSiteId !== localSiteId) {
      throw new Error(
        `Local vault file identity mismatch (expected ${localSiteId}, found ${parsed.localSiteId}).`,
      );
    }
    return parsed;
  }

  function assertSiteId(siteId: string): void {
    if (siteId !== localSiteId) {
      throw new Error(
        `Local vault adapter bound to ${localSiteId}; got request for ${siteId}.`,
      );
    }
  }

  return {
    async create(input: CreateVaultInput): Promise<void> {
      assertSiteId(input.siteId);
      // Refuse to clobber an existing vault. A freshly picked Save-As
      // file is typically zero bytes, so any content here means either
      // the user pointed at the wrong file or we already wrote one.
      const existing = await readFileBytes("readwrite");
      if (existing.length > 0) {
        throw new Error(
          "Local vault file is not empty; refusing to overwrite.",
        );
      }
      const now = Date.now();
      const payload = encodeLocalVaultFile({
        formatVersion: LOCAL_VAULT_FORMAT_VERSION,
        localSiteId,
        vaultVersion: 1,
        createdAt: now,
        updatedAt: now,
        kdfSalt: input.kdfSalt,
        kdfParams: { ...KDF_PARAMS },
        volume: { ...VOLUME_DEFAULTS },
        ciphertext: input.ciphertext,
      });
      await writeFileBytes(payload);
    },

    async restore(input: RestoreVaultInput): Promise<void> {
      assertSiteId(input.siteId);
      const existing = await readFileBytes("readwrite");
      if (existing.length > 0) {
        throw new Error(
          "Local vault file is not empty; refusing to overwrite during restore.",
        );
      }
      const now = Date.now();
      const payload = encodeLocalVaultFile({
        formatVersion: LOCAL_VAULT_FORMAT_VERSION,
        localSiteId,
        vaultVersion: 1,
        createdAt: now,
        updatedAt: now,
        kdfSalt: input.kdfSalt,
        kdfParams: { ...input.kdfParams },
        volume: { ...input.volume },
        ciphertext: input.ciphertext,
      });
      await writeFileBytes(payload);
    },

    async read(siteId: string): Promise<VaultRecord | null> {
      assertSiteId(siteId);
      const current = await readCurrent();
      if (!current) return null;
      return {
        ciphertext: current.ciphertext,
        kdfSalt: current.kdfSalt,
        kdfParams: current.kdfParams,
        volume: current.volume,
        version: current.vaultVersion,
        // Firestore-typed Timestamps don't make sense for a local file,
        // and no consumer currently reads these fields off the record.
        createdAt: null,
        updatedAt: null,
        // BYOS vaults cannot participate in the hosted handover sweep.
        deadman: null,
      };
    },

    async refresh(siteId: string): Promise<VaultRefreshResult | null> {
      assertSiteId(siteId);
      const current = await readCurrent();
      if (!current) return null;
      return {
        version: current.vaultVersion,
        ciphertext: current.ciphertext,
        deadman: null,
      };
    },

    async writeCiphertext(input: WriteCiphertextInput): Promise<WriteResult> {
      assertSiteId(input.siteId);
      const current = await readCurrent();
      if (!current) {
        throw new Error(
          "Cannot update a local vault file that no longer exists.",
        );
      }
      if (current.vaultVersion !== input.expectedVersion) {
        return { ok: false, currentVersion: current.vaultVersion };
      }
      const nextVersion = current.vaultVersion + 1;
      const payload = encodeLocalVaultFile({
        ...current,
        vaultVersion: nextVersion,
        updatedAt: Date.now(),
        ciphertext: input.ciphertext,
      });
      await writeFileBytes(payload);
      return { ok: true, newVersion: nextVersion };
    },
  };
}
