/**
 * High-level vault operations that orchestrate crypto and storage access.
 *
 * All calls here run in the browser. The server never sees passwords, derived
 * keys, or plaintext content. Storage is abstracted behind
 * `getVaultStorage(siteId)` so the same service API works for Firestore-hosted
 * vaults and Bring-Your-Own-Storage backends (currently: local file).
 */
import { deriveMasterKey } from "@/lib/crypto/kdf";
import { deriveSiteId } from "@/lib/crypto/siteId";
import {
  freshBlob,
  openWithKey,
  slotIndexFor,
  writeSlot,
  VOLUME_DEFAULTS,
  slotCapacity,
  type VolumeParams,
} from "@/lib/crypto/volume";
import { randomBytes } from "@/lib/crypto/random";
import { utf8Decode, utf8Encode } from "@/lib/utils/bytes";
import {
  getVaultStorage,
  registerVaultStorageAdapter,
} from "@/lib/storage";
import type {
  DeadmanRecord,
  KdfParamsRecord,
  VaultStorageAdapter,
} from "@/lib/storage";
import {
  createBundle,
  deserializeBundle,
  serializeBundle,
  type NotebookBundle,
} from "@/lib/vault/notebooks";
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  type BackupEnvelope,
} from "@/lib/vault/portable";
import { KDF_PARAMS } from "@/lib/crypto/kdf";
import {
  decodeLocalVaultFile,
  looksLikeLocalVaultFile,
} from "@/lib/storage/localFile/format";
import { createLocalFileVaultStorage } from "@/lib/storage/localFile/adapter";
import {
  ensurePermission,
  rememberHandle,
  touchOpened,
} from "@/lib/storage/localFile/handleRegistry";
import type { StorageKind } from "@/lib/store/vault";

export const SALT_BYTES = 16;

export interface OpenResult {
  kind: "opened";
  /** Null for BYOS vaults that have no slug. */
  slug: string | null;
  siteId: string;
  storageKind: StorageKind;
  /** File name for local vaults; slug for Firestore vaults. Always set. */
  displayLabel: string;
  masterKey: Uint8Array;
  kdfSalt: Uint8Array;
  volume: VolumeParams;
  slotIndex: number;
  blob: Uint8Array;
  version: number;
  bundle: NotebookBundle;
  deadman: DeadmanRecord | null;
}

export interface WrongPasswordResult {
  kind: "wrong-password";
}

export interface NotFoundResult {
  kind: "not-found";
}

export type TryOpenResult = OpenResult | WrongPasswordResult | NotFoundResult;

/**
 * Shared opener: given an already-resolved siteId and a live storage
 * adapter, attempt to decrypt the vault under `password`. The caller is
 * responsible for registering the adapter against `siteId` in the
 * dispatcher before invoking this so that subsequent save calls route
 * to the same backend.
 */
async function tryOpenVaultWithAdapter(args: {
  siteId: string;
  slug: string | null;
  storageKind: StorageKind;
  displayLabel: string;
  password: string;
}): Promise<TryOpenResult> {
  const { siteId, slug, storageKind, displayLabel, password } = args;
  const site = await getVaultStorage(siteId).read(siteId);
  if (!site) return { kind: "not-found" };

  const masterKey = await deriveMasterKey(password, site.kdfSalt);
  const volume: VolumeParams = {
    slotCount: site.volume.slotCount,
    slotSize: site.volume.slotSize,
  };
  const found = await openWithKey(site.ciphertext, masterKey, volume);
  if (!found) return { kind: "wrong-password" };

  return {
    kind: "opened",
    slug,
    siteId,
    storageKind,
    displayLabel,
    masterKey,
    kdfSalt: site.kdfSalt,
    volume,
    slotIndex: found.index,
    blob: site.ciphertext,
    version: site.version,
    bundle: deserializeBundle(utf8Decode(found.content)),
    deadman: site.deadman,
  };
}

/** Attempt to open an existing Firestore-hosted vault. */
export async function tryOpenVault(
  slug: string,
  password: string,
): Promise<TryOpenResult> {
  const siteId = await deriveSiteId(slug);
  return tryOpenVaultWithAdapter({
    siteId,
    slug,
    storageKind: "firestore",
    displayLabel: slug,
    password,
  });
}

/**
 * Create a brand-new Firestore-hosted vault with the first password. The
 * creator's notebook lands in the deterministic slot for that password;
 * all other slots stay as random bytes so future decoy/real passwords
 * can claim their own slots.
 */
export async function createVault(
  slug: string,
  password: string,
  initialBundle?: NotebookBundle,
): Promise<OpenResult> {
  const siteId = await deriveSiteId(slug);
  const existing = await getVaultStorage(siteId).read(siteId);
  if (existing) {
    throw new Error("That vault already exists. Try opening it instead.");
  }

  const { blob, masterKey, kdfSalt, volume, slotIndex, bundle } =
    await mintFreshVault(password, initialBundle);

  await getVaultStorage(siteId).create({ siteId, ciphertext: blob, kdfSalt });

  return {
    kind: "opened",
    slug,
    siteId,
    storageKind: "firestore",
    displayLabel: slug,
    masterKey,
    kdfSalt,
    volume,
    slotIndex,
    blob,
    version: 1,
    bundle,
    deadman: null,
  };
}

/**
 * Derive the material for a freshly-minted vault. Shared by `createVault`
 * (Firestore) and `createLocalVault` (local file) so the two paths stay
 * byte-for-byte identical aside from where the ciphertext lands.
 */
async function mintFreshVault(
  password: string,
  initialBundle?: NotebookBundle,
): Promise<{
  kdfSalt: Uint8Array;
  masterKey: Uint8Array;
  volume: VolumeParams;
  slotIndex: number;
  bundle: NotebookBundle;
  blob: Uint8Array;
}> {
  const kdfSalt = randomBytes(SALT_BYTES);
  const masterKey = await deriveMasterKey(password, kdfSalt);
  const volume: VolumeParams = {
    slotCount: VOLUME_DEFAULTS.slotCount,
    slotSize: VOLUME_DEFAULTS.slotSize,
  };
  const slotIndex = await slotIndexFor(masterKey, volume);

  const bundle = initialBundle ?? createBundle();
  const blank = freshBlob(volume);
  const initialBytes = utf8Encode(serializeBundle(bundle));
  if (initialBytes.length > slotCapacity(volume)) {
    throw new Error("initial content exceeds slot capacity");
  }
  const blob = await writeSlot(blank, masterKey, slotIndex, initialBytes, volume);
  return { kdfSalt, masterKey, volume, slotIndex, bundle, blob };
}

/** Mint a fresh UUID for a local vault's opaque site identity. */
function mintLocalSiteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const b = randomBytes(16);
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a brand-new BYOS vault backed by a user-picked local file.
 *
 * The file handle must point at an empty file (Save-As flow); the adapter
 * refuses to overwrite non-empty contents. On success we register the
 * adapter in the dispatcher and stamp the handle into IndexedDB so the
 * user can return to this vault later via `/local/<localSiteId>`.
 */
export async function createLocalVault(args: {
  handle: FileSystemFileHandle;
  password: string;
  initialBundle?: NotebookBundle;
}): Promise<OpenResult> {
  const granted = await ensurePermission(args.handle, "readwrite");
  if (!granted) {
    throw new Error(
      "Permission to write to the selected file was not granted.",
    );
  }

  const siteId = mintLocalSiteId();
  const adapter = createLocalFileVaultStorage(args.handle, siteId);
  registerVaultStorageAdapter(siteId, adapter);

  const { blob, masterKey, kdfSalt, volume, slotIndex, bundle } =
    await mintFreshVault(args.password, args.initialBundle);

  await adapter.create({ siteId, ciphertext: blob, kdfSalt });
  await rememberHandle(siteId, args.handle);
  await touchOpened(siteId);

  return {
    kind: "opened",
    slug: null,
    siteId,
    storageKind: "localFile",
    displayLabel: args.handle.name,
    masterKey,
    kdfSalt,
    volume,
    slotIndex,
    blob,
    version: 1,
    bundle,
    deadman: null,
  };
}

/**
 * Attempt to open an existing BYOS vault backed by a user-picked local
 * file.
 *
 * Reads the file header to discover its `localSiteId`, wires up a
 * storage adapter for that id, and defers to the shared opener for key
 * derivation and slot decryption. Re-stamps the handle into IndexedDB on
 * success so future sessions can recall it by id.
 */
export async function tryOpenLocalVault(args: {
  handle: FileSystemFileHandle;
  password: string;
}): Promise<TryOpenResult & { siteId?: string }> {
  const granted = await ensurePermission(args.handle, "readwrite");
  if (!granted) {
    throw new Error(
      "Permission to read the selected file was not granted.",
    );
  }

  const file = await args.handle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) return { kind: "not-found" };
  if (!looksLikeLocalVaultFile(bytes)) {
    throw new Error(
      "That file is not a Flowvault local vault. If you meant to restore a .fvault backup, use the Restore page instead.",
    );
  }
  const parsed = decodeLocalVaultFile(bytes);
  const siteId = parsed.localSiteId;

  const adapter = createLocalFileVaultStorage(args.handle, siteId);
  registerVaultStorageAdapter(siteId, adapter);

  const result = await tryOpenVaultWithAdapter({
    siteId,
    slug: null,
    storageKind: "localFile",
    displayLabel: args.handle.name,
    password: args.password,
  });

  if (result.kind === "opened") {
    await rememberHandle(siteId, args.handle);
    await touchOpened(siteId);
  }
  return { ...result, siteId };
}

/**
 * Open a BYOS vault from an already-bound adapter (e.g. a handle the
 * caller recalled from IndexedDB for a known siteId). Distinct from
 * `tryOpenLocalVault` because the caller has already peeked the file
 * and knows its identity.
 */
export async function openLocalVaultWithAdapter(args: {
  siteId: string;
  displayLabel: string;
  adapter: VaultStorageAdapter;
  password: string;
}): Promise<TryOpenResult> {
  registerVaultStorageAdapter(args.siteId, args.adapter);
  return tryOpenVaultWithAdapter({
    siteId: args.siteId,
    slug: null,
    storageKind: "localFile",
    displayLabel: args.displayLabel,
    password: args.password,
  });
}

export interface SaveInput {
  siteId: string;
  masterKey: Uint8Array;
  slotIndex: number;
  volume: VolumeParams;
  previousBlob: Uint8Array;
  expectedVersion: number;
  bundle: NotebookBundle;
}

export type SaveResult =
  | { kind: "saved"; blob: Uint8Array; version: number }
  | { kind: "conflict"; currentVersion: number }
  | { kind: "too-large"; maxBytes: number };

/**
 * Save the current notebook bundle back into its slot. The entire
 * bundle (all tabs, titles, contents) is serialized as JSON and stored
 * as the slot's plaintext frame. Other slots in the blob are copied
 * verbatim so any decoy/secondary passwords remain intact.
 */
export async function saveVault(input: SaveInput): Promise<SaveResult> {
  const contentBytes = utf8Encode(serializeBundle(input.bundle));
  const max = slotCapacity(input.volume);
  if (contentBytes.length > max) {
    return { kind: "too-large", maxBytes: max };
  }

  const nextBlob = await writeSlot(
    input.previousBlob,
    input.masterKey,
    input.slotIndex,
    contentBytes,
    input.volume,
  );
  const res = await getVaultStorage(input.siteId).writeCiphertext({
    siteId: input.siteId,
    ciphertext: nextBlob,
    expectedVersion: input.expectedVersion,
  });
  if (!res.ok) {
    return { kind: "conflict", currentVersion: res.currentVersion };
  }
  return { kind: "saved", blob: nextBlob, version: res.newVersion };
}

/**
 * Package an already-open vault into a portable backup envelope. The
 * caller provides the live ciphertext/kdfSalt/volume (from the store)
 * plus the (typically current) KDF params. We intentionally take the
 * KDF params as an argument rather than reading them from the live
 * `fetchSite` again: callers already have the authoritative copy in
 * memory if they want it, and re-fetching would expose the export to
 * a race where a beneficiary release between the editor open and the
 * export click would flip the document to read-only.
 */
export interface BuildBackupInput {
  /** Informational slug hint; may be null for BYOS vaults. */
  slug: string | null;
  ciphertext: Uint8Array;
  kdfSalt: Uint8Array;
  volume: { slotCount: number; slotSize: number; frameVersion?: number };
  kdfParams?: KdfParamsRecord;
}

export function buildBackupFromOpenVault(
  input: BuildBackupInput,
): BackupEnvelope {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    slugHint: input.slug,
    kdfSalt: input.kdfSalt,
    kdfParams: input.kdfParams ?? { ...KDF_PARAMS },
    volume: {
      slotCount: input.volume.slotCount,
      slotSize: input.volume.slotSize,
      frameVersion: input.volume.frameVersion ?? 1,
    },
    ciphertext: input.ciphertext,
  };
}

export type RestoreResult =
  | { kind: "restored"; siteId: string }
  | { kind: "slug-taken" }
  | { kind: "rejected"; reason: string };

/**
 * Restore a decoded backup to a fresh slug. The caller is responsible
 * for presenting the `slug-taken` case to the user (we intentionally
 * refuse to overwrite rather than require re-authentication; a plain
 * refusal is safer and simpler than any clobber flow).
 *
 * Failures from the underlying `restoreSite` call are surfaced as
 * `rejected` with a human-readable message; the most common cause is
 * a permission-denied from the Firestore rules (size mismatch, stale
 * KDF params, etc.), which means the backup is malformed.
 */
export async function restoreVaultFromBackup(input: {
  slug: string;
  backup: BackupEnvelope;
}): Promise<RestoreResult> {
  const siteId = await deriveSiteId(input.slug);
  const existing = await getVaultStorage(siteId).read(siteId);
  if (existing) return { kind: "slug-taken" };

  // Defensive: re-check the size invariant even though decodeBackup
  // already did. If we add in-memory munging later, this is a second
  // line of defense before the server refuses the write.
  const expected = input.backup.volume.slotCount * input.backup.volume.slotSize;
  if (input.backup.ciphertext.length !== expected) {
    return {
      kind: "rejected",
      reason: "Backup ciphertext size does not match its declared volume.",
    };
  }

  try {
    await getVaultStorage(siteId).restore({
      siteId,
      ciphertext: input.backup.ciphertext,
      kdfSalt: input.backup.kdfSalt,
      kdfParams: input.backup.kdfParams,
      volume: input.backup.volume,
    });
    return { kind: "restored", siteId };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const reason =
      err?.code === "permission-denied"
        ? "The server rejected this backup. It may be from an incompatible version."
        : (err?.message ?? "Restore failed.");
    return { kind: "rejected", reason };
  }
}

export interface AddPasswordInput {
  siteId: string;
  currentBlob: Uint8Array;
  currentVersion: number;
  currentSlotIndex: number;
  kdfSalt: Uint8Array;
  volume: VolumeParams;
  newPassword: string;
  /** Content of the first notebook in the new slot's bundle. */
  newContent: string;
  /** Title of that first notebook. Defaults to "Notebook 1". */
  newNotebookTitle?: string;
}

export type AddPasswordResult =
  | { kind: "added"; blob: Uint8Array; version: number; slotIndex: number }
  | { kind: "collides-with-current" }
  | { kind: "already-set-up"; slotIndex: number }
  | { kind: "conflict"; currentVersion: number }
  | { kind: "too-large"; maxBytes: number };

/**
 * Register an additional password on an existing vault. This derives the new
 * master key, picks its deterministic slot, and writes the new content there
 * while preserving every other slot byte-for-byte.
 *
 * Safety checks performed:
 *
 * 1. If the new password's slot equals the currently-open notebook's slot,
 *    writing would destroy the caller's own notebook. We refuse and ask the
 *    user to choose a different password.
 *
 * 2. If the new password already decrypts a slot (i.e. this password was
 *    previously set up), we report that instead of silently overwriting it.
 *
 * We intentionally cannot detect collisions with *other* hidden notebooks
 * (those belonging to passwords the caller does not know) because doing so
 * would require storing per-slot metadata, which would break deniability.
 * Callers must surface the residual collision risk in UX copy.
 */
export async function addDecoyPassword(
  input: AddPasswordInput,
): Promise<AddPasswordResult> {
  const key = await deriveMasterKey(input.newPassword, input.kdfSalt);
  const slotIdx = await slotIndexFor(key, input.volume);

  if (slotIdx === input.currentSlotIndex) {
    return { kind: "collides-with-current" };
  }

  // Detect re-adding an already-registered password (replace semantics).
  const existing = await openWithKey(input.currentBlob, key, input.volume);
  if (existing) {
    return { kind: "already-set-up", slotIndex: existing.index };
  }

  const newBundle = createBundle({
    title: input.newNotebookTitle,
    content: input.newContent,
  });
  const bytes = utf8Encode(serializeBundle(newBundle));
  const max = slotCapacity(input.volume);
  if (bytes.length > max) return { kind: "too-large", maxBytes: max };

  const nextBlob = await writeSlot(
    input.currentBlob,
    key,
    slotIdx,
    bytes,
    input.volume,
  );
  const res = await getVaultStorage(input.siteId).writeCiphertext({
    siteId: input.siteId,
    ciphertext: nextBlob,
    expectedVersion: input.currentVersion,
  });
  if (!res.ok) return { kind: "conflict", currentVersion: res.currentVersion };
  return {
    kind: "added",
    blob: nextBlob,
    version: res.newVersion,
    slotIndex: slotIdx,
  };
}
