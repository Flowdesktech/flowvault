/**
 * High-level vault operations that orchestrate crypto and Firestore access.
 *
 * All calls here run in the browser. The server never sees passwords, derived
 * keys, or plaintext content.
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
  createSite,
  fetchSite,
  updateSiteCiphertext,
  type DeadmanRecord,
} from "@/lib/firebase/sites";
import {
  createBundle,
  deserializeBundle,
  serializeBundle,
  type NotebookBundle,
} from "@/lib/vault/notebooks";

export const SALT_BYTES = 16;

export interface OpenResult {
  kind: "opened";
  slug: string;
  siteId: string;
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

/** Attempt to open an existing vault. */
export async function tryOpenVault(
  slug: string,
  password: string,
): Promise<TryOpenResult> {
  const siteId = await deriveSiteId(slug);
  const site = await fetchSite(siteId);
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

/**
 * Create a brand-new vault with the first password. The creator's notebook
 * lands in the deterministic slot for that password; all other slots stay as
 * random bytes so future decoy/real passwords can claim their own slots.
 */
export async function createVault(
  slug: string,
  password: string,
  initialBundle?: NotebookBundle,
): Promise<OpenResult> {
  const siteId = await deriveSiteId(slug);
  const existing = await fetchSite(siteId);
  if (existing) {
    throw new Error("That vault already exists. Try opening it instead.");
  }

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

  await createSite({ siteId, ciphertext: blob, kdfSalt });

  return {
    kind: "opened",
    slug,
    siteId,
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
  const res = await updateSiteCiphertext({
    siteId: input.siteId,
    ciphertext: nextBlob,
    expectedVersion: input.expectedVersion,
  });
  if (!res.ok) {
    return { kind: "conflict", currentVersion: res.currentVersion };
  }
  return { kind: "saved", blob: nextBlob, version: res.newVersion };
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
  const res = await updateSiteCiphertext({
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
