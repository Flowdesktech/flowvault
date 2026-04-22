/**
 * Firestore implementation of `VaultStorageAdapter`.
 *
 * This is a thin wrapper over `@/lib/firebase/sites`; the heavy lifting
 * (Firestore transactions, CAS semantics, deadman heartbeat on save)
 * already lives there and is preserved verbatim. Separating the interface
 * from the implementation lets us introduce alternative backends
 * (LocalFile, S3, WebDAV) without branching the call sites.
 */
import {
  createSite,
  fetchSite,
  fetchSiteRefresh,
  restoreSite,
  updateSiteCiphertext,
} from "@/lib/firebase/sites";
import type {
  CreateVaultInput,
  RestoreVaultInput,
  VaultRecord,
  VaultRefreshResult,
  VaultStorageAdapter,
  WriteCiphertextInput,
  WriteResult,
} from "./adapter";

export const firestoreVaultStorage: VaultStorageAdapter = {
  async create(input: CreateVaultInput): Promise<void> {
    await createSite({
      siteId: input.siteId,
      ciphertext: input.ciphertext,
      kdfSalt: input.kdfSalt,
    });
  },

  async restore(input: RestoreVaultInput): Promise<void> {
    await restoreSite({
      siteId: input.siteId,
      ciphertext: input.ciphertext,
      kdfSalt: input.kdfSalt,
      kdfParams: input.kdfParams,
      volume: input.volume,
    });
  },

  async read(siteId: string): Promise<VaultRecord | null> {
    const site = await fetchSite(siteId);
    if (!site) return null;
    return {
      ciphertext: site.ciphertext,
      kdfSalt: site.kdfSalt,
      kdfParams: site.kdfParams,
      volume: site.volume,
      version: site.version,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      deadman: site.deadman,
    };
  },

  async refresh(siteId: string): Promise<VaultRefreshResult | null> {
    const fresh = await fetchSiteRefresh(siteId);
    if (!fresh) return null;
    return {
      version: fresh.version,
      ciphertext: fresh.ciphertext,
      deadman: fresh.deadman,
    };
  },

  async writeCiphertext(input: WriteCiphertextInput): Promise<WriteResult> {
    return updateSiteCiphertext({
      siteId: input.siteId,
      ciphertext: input.ciphertext,
      expectedVersion: input.expectedVersion,
    });
  },
};
