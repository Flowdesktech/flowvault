/**
 * On-disk format for a live local vault file (`.flowvault`).
 *
 * This is NOT the same as the `.fvault` portable backup:
 *
 *   - `.fvault`    = snapshot for backup / migration, full JSON envelope,
 *                    base64url-encoded everywhere, sized for human
 *                    inspection and cross-instance restore. Does not
 *                    track a mutable CAS counter.
 *   - `.flowvault` = the live store for a Bring-Your-Own-Storage vault.
 *                    Rewritten in place on every save, so we keep the
 *                    large ciphertext as raw bytes (no base64 tax) and
 *                    carry the `vaultVersion` CAS counter plus the
 *                    `localSiteId` identity tag directly in the file.
 *
 * Wire layout (little-endian):
 *
 *     offset  size  field
 *     ------  ----  -----
 *     0       4     magic         = "FVLV" (46 56 4C 56)
 *     4       4     headerLen     u32, length of the JSON header in bytes
 *     8       N     headerJson    UTF-8 JSON, exactly `headerLen` bytes
 *     8+N     M     ciphertext    raw bytes, length implied by header.volume
 *
 * Why a hybrid binary+JSON layout?
 *
 *   - The ciphertext is ~512 KiB on default settings; base64ing it would
 *     add ~170 KiB of fat to every save. Raw is strictly better.
 *   - Everything else (salt, KDF params, volume params, version,
 *     timestamps, localSiteId) is small, rarely inspected, and much
 *     easier to version as JSON than as packed structs.
 *   - The JSON header is human-readable for debugging, and additive
 *     future fields require no new format version.
 *
 * The `localSiteId` is a random UUID minted when the file is first
 * created. It exists so the adapter can sanity-check that a handle
 * actually points to the vault the caller thinks it does (the user
 * could repoint the handle at an unrelated file and we should notice
 * before we try to write). It is NOT a secret and NOT a derivation
 * input; it is opaque identity for the local backend only.
 */
import { fromBase64Url, toBase64Url } from "@/lib/utils/bytes";
import type {
  KdfParamsRecord,
  VolumeParamsRecord,
} from "@/lib/firebase/sites";

/** ASCII "FVLV" — distinguishes live local vaults from `.fvault` backups. */
const MAGIC = new Uint8Array([0x46, 0x56, 0x4c, 0x56]);

/** Current on-disk format version for `.flowvault`. */
export const LOCAL_VAULT_FORMAT_VERSION = 1;

/** Hard cap on the JSON header size. Anything larger is almost certainly corruption. */
const MAX_HEADER_LEN = 64 * 1024;

export interface LocalVaultFile {
  /** Format revision. Bumps only for breaking layout changes. */
  formatVersion: number;
  /** Random UUID identifying this local vault across renames / moves. */
  localSiteId: string;
  /** CAS counter. Starts at 1 on create, increments on every successful write. */
  vaultVersion: number;
  /** Unix ms when the file was first written. Informational. */
  createdAt: number;
  /** Unix ms of the most recent successful write. Informational. */
  updatedAt: number;
  kdfSalt: Uint8Array;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
  ciphertext: Uint8Array;
}

interface WireHeader {
  formatVersion: number;
  localSiteId: string;
  vaultVersion: number;
  createdAt: number;
  updatedAt: number;
  kdfSalt: string;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
  /** Declared ciphertext length. Must equal slotCount * slotSize; redundant but lets us reject truncation cleanly. */
  ciphertextLen: number;
}

/**
 * Serialize a local vault to the bytes that will be written to disk.
 *
 * The returned buffer is exactly `8 + headerLen + ciphertextLen` bytes,
 * ready to hand to `FileSystemWritableFileStream.write`.
 */
export function encodeLocalVaultFile(file: LocalVaultFile): Uint8Array {
  const header: WireHeader = {
    formatVersion: file.formatVersion,
    localSiteId: file.localSiteId,
    vaultVersion: file.vaultVersion,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    kdfSalt: toBase64Url(file.kdfSalt),
    kdfParams: file.kdfParams,
    volume: file.volume,
    ciphertextLen: file.ciphertext.length,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));

  const total = 4 + 4 + headerBytes.length + file.ciphertext.length;
  const out = new Uint8Array(total);
  out.set(MAGIC, 0);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(4, headerBytes.length, true);
  out.set(headerBytes, 8);
  out.set(file.ciphertext, 8 + headerBytes.length);
  return out;
}

/**
 * Decode a `.flowvault` file. Throws a user-facing Error with a short,
 * actionable message on any shape or invariant violation.
 */
export function decodeLocalVaultFile(bytes: Uint8Array): LocalVaultFile {
  if (bytes.length < 8) {
    throw new Error("Local vault file is truncated (no header).");
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new Error(
        "This file is not a Flowvault local vault — wrong magic bytes.",
      );
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLen = view.getUint32(4, true);
  if (headerLen === 0 || headerLen > MAX_HEADER_LEN) {
    throw new Error("Local vault file has an implausible header length.");
  }
  if (bytes.length < 8 + headerLen) {
    throw new Error("Local vault file is truncated in the header region.");
  }

  const headerBytes = bytes.subarray(8, 8 + headerLen);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(headerBytes));
  } catch {
    throw new Error("Local vault header is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Local vault header is malformed.");
  }
  const h = parsed as Partial<WireHeader>;

  if (typeof h.formatVersion !== "number") {
    throw new Error("Local vault header is missing a format version.");
  }
  if (h.formatVersion !== LOCAL_VAULT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported local vault format version ${h.formatVersion}. This build understands version ${LOCAL_VAULT_FORMAT_VERSION}.`,
    );
  }
  if (typeof h.localSiteId !== "string" || h.localSiteId.length === 0) {
    throw new Error("Local vault header is missing localSiteId.");
  }
  if (typeof h.vaultVersion !== "number" || h.vaultVersion < 1) {
    throw new Error("Local vault header has an invalid vaultVersion.");
  }
  if (typeof h.kdfSalt !== "string") {
    throw new Error("Local vault header is missing kdfSalt.");
  }
  if (!h.kdfParams || typeof h.kdfParams !== "object") {
    throw new Error("Local vault header is missing kdfParams.");
  }
  if (!h.volume || typeof h.volume !== "object") {
    throw new Error("Local vault header is missing volume params.");
  }
  if (typeof h.ciphertextLen !== "number" || h.ciphertextLen < 0) {
    throw new Error("Local vault header has an invalid ciphertextLen.");
  }

  const volume = h.volume as VolumeParamsRecord;
  if (
    typeof volume.slotCount !== "number" ||
    typeof volume.slotSize !== "number" ||
    typeof volume.frameVersion !== "number" ||
    volume.slotCount <= 0 ||
    volume.slotSize <= 0
  ) {
    throw new Error("Local vault header has invalid volume parameters.");
  }
  const expectedCiphertextLen = volume.slotCount * volume.slotSize;
  if (h.ciphertextLen !== expectedCiphertextLen) {
    throw new Error(
      "Local vault header is inconsistent: ciphertextLen disagrees with volume layout.",
    );
  }

  const bodyStart = 8 + headerLen;
  const bodyEnd = bodyStart + h.ciphertextLen;
  if (bytes.length < bodyEnd) {
    throw new Error(
      "Local vault file is truncated: ciphertext region is shorter than declared.",
    );
  }

  let kdfSalt: Uint8Array;
  try {
    kdfSalt = fromBase64Url(h.kdfSalt);
  } catch {
    throw new Error("Local vault kdfSalt is not valid base64url.");
  }
  if (kdfSalt.length < 16 || kdfSalt.length > 64) {
    throw new Error("Local vault kdfSalt has an unexpected length.");
  }

  const kdfParams = h.kdfParams as KdfParamsRecord;
  if (
    kdfParams.algorithm !== "argon2id" ||
    typeof kdfParams.memoryKiB !== "number" ||
    typeof kdfParams.iterations !== "number"
  ) {
    throw new Error("Local vault uses unsupported KDF parameters.");
  }

  // Copy the ciphertext into a standalone buffer so the caller can
  // drop the outer byte array without leaking the backing ArrayBuffer.
  const ciphertext = bytes.slice(bodyStart, bodyEnd);

  return {
    formatVersion: h.formatVersion,
    localSiteId: h.localSiteId,
    vaultVersion: h.vaultVersion,
    createdAt: typeof h.createdAt === "number" ? h.createdAt : 0,
    updatedAt: typeof h.updatedAt === "number" ? h.updatedAt : 0,
    kdfSalt,
    kdfParams,
    volume,
    ciphertext,
  };
}

/**
 * Quick check: does this file look like a Flowvault local vault?
 *
 * Used by the open-file picker flow to give a better error message
 * ("this is a .fvault backup, not a live local vault") before we try
 * to fully decode. Does NOT validate the JSON header.
 */
export function looksLikeLocalVaultFile(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}
