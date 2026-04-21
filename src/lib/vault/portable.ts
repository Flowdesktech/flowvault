/**
 * Portable vault backup codec (`.fvault`).
 *
 * A backup captures everything the server stores for a single site:
 * the fixed-size ciphertext blob, the Argon2id salt, the KDF
 * parameters, and the hidden-volume layout. That is sufficient to
 * fully recreate the Firestore row on any instance of Flowvault (the
 * official hosted deployment or a self-hosted fork) without loss of
 * readability for the holders of any password.
 *
 * Zero-knowledge property: a backup file is exactly as zero-knowledge
 * as the live vault. Nothing inside it is plaintext content. Without a
 * password it is indistinguishable from random bytes (modulo the thin
 * JSON envelope that wraps format/version metadata).
 *
 * Wire format: a single JSON envelope, UTF-8 encoded. We deliberately
 * chose JSON over a packed binary format so that:
 *   - Power users can `cat` / inspect / diff an export.
 *   - Future format versions are trivially additive.
 *   - No endianness or alignment bugs.
 *   - Corruption is detected by the JSON parser and our explicit
 *     shape checks below, not a brittle manual CRC.
 *
 * The ~33% base64url overhead is immaterial for the 512 KiB default
 * blob (export lands around 680 KiB) and an acceptable tradeoff for
 * debuggability.
 *
 * The `slugHint` is informational only: the slug is already the public
 * URL segment. Restore takes a fresh slug from the user and does not
 * rely on the hint, so restoring to a new URL is one click away.
 */
import { fromBase64Url, toBase64Url } from "@/lib/utils/bytes";
import type {
  KdfParamsRecord,
  VolumeParamsRecord,
} from "@/lib/firebase/sites";

/** Version of the .fvault envelope format. */
export const BACKUP_VERSION = 1;

/**
 * Magic string stamped in the outer envelope. Lets us distinguish a
 * Flowvault backup from an arbitrary JSON blob without inspecting the
 * file extension. Paired with `version`.
 */
export const BACKUP_KIND = "flowvault-backup" as const;

export interface BackupEnvelope {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  /** Unix ms the backup was written. Informational only. */
  exportedAt: number;
  /**
   * Optional hint so the restore UI can prefill a sensible slug. Not
   * trusted on restore: the user always confirms or picks a new one.
   */
  slugHint: string | null;
  kdfSalt: Uint8Array;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
  ciphertext: Uint8Array;
}

interface WireEnvelope {
  kind: string;
  version: number;
  exportedAt: number;
  slugHint: string | null;
  kdfSalt: string;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
  ciphertext: string;
}

/**
 * Serialize a backup to the bytes that will be written to disk. The
 * returned Uint8Array is UTF-8 encoded JSON. We do NOT include a
 * trailing newline — disk writers that want one can add it.
 */
export function encodeBackup(envelope: BackupEnvelope): Uint8Array {
  const wire: WireEnvelope = {
    kind: envelope.kind,
    version: envelope.version,
    exportedAt: envelope.exportedAt,
    slugHint: envelope.slugHint,
    kdfSalt: toBase64Url(envelope.kdfSalt),
    kdfParams: envelope.kdfParams,
    volume: envelope.volume,
    ciphertext: toBase64Url(envelope.ciphertext),
  };
  return new TextEncoder().encode(JSON.stringify(wire));
}

/**
 * Decode a `.fvault` file. Throws a user-facing Error with a short,
 * actionable message on any shape or invariant violation. Callers
 * (the restore UI) can surface `err.message` directly.
 */
export function decodeBackup(bytes: Uint8Array): BackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(
      "This file does not look like a Flowvault backup (not valid JSON).",
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup file is malformed.");
  }
  const p = parsed as Partial<WireEnvelope>;

  if (p.kind !== BACKUP_KIND) {
    throw new Error(
      "This file is not a Flowvault backup — missing or wrong envelope kind.",
    );
  }
  if (typeof p.version !== "number") {
    throw new Error("Backup file is missing a version.");
  }
  if (p.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${p.version}. This build understands version ${BACKUP_VERSION}.`,
    );
  }
  if (typeof p.kdfSalt !== "string" || typeof p.ciphertext !== "string") {
    throw new Error("Backup is missing the encrypted payload or salt.");
  }
  if (!p.kdfParams || typeof p.kdfParams !== "object") {
    throw new Error("Backup is missing KDF parameters.");
  }
  if (!p.volume || typeof p.volume !== "object") {
    throw new Error("Backup is missing volume parameters.");
  }

  let kdfSalt: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    kdfSalt = fromBase64Url(p.kdfSalt);
    ciphertext = fromBase64Url(p.ciphertext);
  } catch {
    throw new Error("Backup payload is not valid base64url.");
  }

  const kdfParams = p.kdfParams as KdfParamsRecord;
  const volume = p.volume as VolumeParamsRecord;

  if (
    typeof volume.slotCount !== "number" ||
    typeof volume.slotSize !== "number" ||
    typeof volume.frameVersion !== "number" ||
    volume.slotCount <= 0 ||
    volume.slotSize <= 0
  ) {
    throw new Error("Backup has invalid volume parameters.");
  }
  if (ciphertext.length !== volume.slotCount * volume.slotSize) {
    throw new Error(
      "Backup is corrupted: ciphertext size does not match the declared volume layout.",
    );
  }

  if (
    kdfParams.algorithm !== "argon2id" ||
    typeof kdfParams.memoryKiB !== "number" ||
    typeof kdfParams.iterations !== "number"
  ) {
    throw new Error("Backup uses unsupported KDF parameters.");
  }

  if (kdfSalt.length < 16 || kdfSalt.length > 64) {
    throw new Error("Backup salt has an unexpected length.");
  }

  const exportedAt = typeof p.exportedAt === "number" ? p.exportedAt : 0;
  const slugHint = typeof p.slugHint === "string" ? p.slugHint : null;

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt,
    slugHint,
    kdfSalt,
    kdfParams,
    volume,
    ciphertext,
  };
}

/**
 * Suggest a filename for a backup. Keeps slugs visible (they are
 * already the public URL) and includes the ISO date for easy sorting
 * across multiple snapshots.
 */
export function suggestedBackupFilename(
  slugHint: string | null,
  when: Date = new Date(),
): string {
  const iso = when.toISOString().slice(0, 10); // YYYY-MM-DD
  const safeSlug = (slugHint ?? "vault").replace(/[^a-z0-9_-]/gi, "-");
  return `flowvault-${safeSlug}-${iso}.fvault`;
}
