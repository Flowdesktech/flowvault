/**
 * Firestore read/write for the `sites` collection.
 *
 * Data model (zero-knowledge): the server sees only opaque ciphertext plus
 * the KDF + volume parameters required to reconstruct the key schedule.
 *
 *   sites/{siteId} {
 *     ciphertext:  bytes        // fixed-size hidden-volume blob
 *     kdfSalt:     bytes        // per-site Argon2 salt
 *     kdfParams:   { ... }      // algorithm + cost parameters
 *     volume:      { slotCount, slotSize, frameVersion }
 *     version:     number       // monotonically increasing write counter (CAS)
 *     createdAt:   Timestamp
 *     updatedAt:   Timestamp
 *     deadman?: {               // optional dead-man's-switch config
 *       wrappedKey:        bytes      // AES-GCM(beneficiaryKey, masterKey)
 *       beneficiarySalt:   bytes      // Argon2 salt for the beneficiary
 *       intervalMs:        number     // expected check-in interval
 *       graceMs:           number     // additional grace before release
 *       lastHeartbeatAt:   Timestamp  // server-set on every save
 *       released:          boolean    // server-set by deadmanSweep function
 *       releasedAt?:       Timestamp  // server-set when released
 *     }
 *   }
 */
import {
  Bytes,
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./client";
import { KDF_PARAMS } from "@/lib/crypto/kdf";
import { VOLUME_DEFAULTS } from "@/lib/crypto/volume";

export interface KdfParamsRecord {
  algorithm: string;
  version: number;
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  keyLengthBytes: number;
}

export interface VolumeParamsRecord {
  slotCount: number;
  slotSize: number;
  frameVersion: number;
}

export interface DeadmanRecord {
  wrappedKey: Uint8Array;
  beneficiarySalt: Uint8Array;
  intervalMs: number;
  graceMs: number;
  lastHeartbeatAt: Timestamp | null;
  released: boolean;
  releasedAt: Timestamp | null;
}

export interface SiteRecord {
  ciphertext: Uint8Array;
  kdfSalt: Uint8Array;
  kdfParams: KdfParamsRecord;
  volume: VolumeParamsRecord;
  version: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  deadman: DeadmanRecord | null;
}

interface DeadmanWire {
  wrappedKey: Bytes;
  beneficiarySalt: Bytes;
  intervalMs: number;
  graceMs: number;
  lastHeartbeatAt: Timestamp | null;
  released: boolean;
  releasedAt?: Timestamp | null;
}

const COLLECTION = "sites";

function siteRef(siteId: string) {
  return doc(db(), COLLECTION, siteId);
}

/**
 * Lightweight read that returns only fields needed to recover from a
 * save conflict: the current `version`, the full `ciphertext` (so the
 * client can re-derive the open slot and re-encrypt), and the current
 * deadman record (so the editor can keep its release/heartbeat state
 * in sync). Intentionally smaller than a full `fetchSite` to make
 * clear this is a hot-path recovery call.
 */
export interface SiteRefreshResult {
  version: number;
  ciphertext: Uint8Array;
  deadman: DeadmanRecord | null;
}

export async function fetchSiteRefresh(
  siteId: string,
): Promise<SiteRefreshResult | null> {
  const snap = await getDoc(siteRef(siteId));
  if (!snap.exists()) return null;
  const data = snap.data() as {
    ciphertext: Bytes;
    version: number;
    deadman?: DeadmanWire | null;
  };
  return {
    version: data.version,
    ciphertext: data.ciphertext.toUint8Array(),
    deadman: data.deadman
      ? {
          wrappedKey: data.deadman.wrappedKey.toUint8Array(),
          beneficiarySalt: data.deadman.beneficiarySalt.toUint8Array(),
          intervalMs: data.deadman.intervalMs,
          graceMs: data.deadman.graceMs,
          lastHeartbeatAt: data.deadman.lastHeartbeatAt ?? null,
          released: data.deadman.released,
          releasedAt: data.deadman.releasedAt ?? null,
        }
      : null,
  };
}

export async function fetchSite(siteId: string): Promise<SiteRecord | null> {
  const snap = await getDoc(siteRef(siteId));
  if (!snap.exists()) return null;
  const data = snap.data() as {
    ciphertext: Bytes;
    kdfSalt: Bytes;
    kdfParams: KdfParamsRecord;
    volume: VolumeParamsRecord;
    version: number;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    deadman?: DeadmanWire | null;
  };
  return {
    ciphertext: data.ciphertext.toUint8Array(),
    kdfSalt: data.kdfSalt.toUint8Array(),
    kdfParams: data.kdfParams,
    volume: data.volume,
    version: data.version,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    deadman: data.deadman
      ? {
          wrappedKey: data.deadman.wrappedKey.toUint8Array(),
          beneficiarySalt: data.deadman.beneficiarySalt.toUint8Array(),
          intervalMs: data.deadman.intervalMs,
          graceMs: data.deadman.graceMs,
          lastHeartbeatAt: data.deadman.lastHeartbeatAt ?? null,
          released: data.deadman.released,
          releasedAt: data.deadman.releasedAt ?? null,
        }
      : null,
  };
}

export interface CreateSiteInput {
  siteId: string;
  ciphertext: Uint8Array;
  kdfSalt: Uint8Array;
}

/**
 * Create a brand-new site. Uses setDoc with merge=false so it fails if
 * someone else already claimed the id (prevents silent overwrite).
 */
export async function createSite(input: CreateSiteInput): Promise<void> {
  await setDoc(siteRef(input.siteId), {
    ciphertext: Bytes.fromUint8Array(input.ciphertext),
    kdfSalt: Bytes.fromUint8Array(input.kdfSalt),
    kdfParams: { ...KDF_PARAMS },
    volume: { ...VOLUME_DEFAULTS },
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Optimistic-concurrency update: succeeds only if the server version still
 * matches `expectedVersion`. Prevents last-writer-wins clobbering when the
 * same vault is edited from two tabs.
 *
 * Doubles as the dead-man's-switch heartbeat: every successful save bumps
 * `deadman.lastHeartbeatAt` if a deadman is configured. Saves require the
 * master key (the new ciphertext is re-encrypted with it), so only the
 * vault owner can effectively heartbeat. An attacker who only has read
 * access to the document can never produce a valid new ciphertext.
 */
export async function updateSiteCiphertext(input: {
  siteId: string;
  ciphertext: Uint8Array;
  expectedVersion: number;
}): Promise<{ ok: true; newVersion: number } | { ok: false; currentVersion: number }>
{
  const ref = siteRef(input.siteId);
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("site not found");
    }
    const current = snap.data() as {
      version: number;
      deadman?: DeadmanWire | null;
    };
    if (current.version !== input.expectedVersion) {
      return { ok: false as const, currentVersion: current.version };
    }
    if (current.deadman?.released) {
      throw new Error(
        "vault has been released by the dead-man's switch and is read-only",
      );
    }
    const next = current.version + 1;
    const patch: Record<string, unknown> = {
      ciphertext: Bytes.fromUint8Array(input.ciphertext),
      version: next,
      updatedAt: serverTimestamp(),
    };
    if (current.deadman) {
      patch["deadman.lastHeartbeatAt"] = serverTimestamp();
    }
    tx.update(ref, patch);
    return { ok: true as const, newVersion: next };
  });
}

export interface DeadmanConfigInput {
  siteId: string;
  expectedVersion: number;
  wrappedKey: Uint8Array;
  beneficiarySalt: Uint8Array;
  intervalMs: number;
  graceMs: number;
}

/**
 * Configure or replace the dead-man's-switch on a vault. Caller must hold
 * the current `expectedVersion` to prevent stale clients from clobbering a
 * newer config. Bumps the version counter the same way a content save does.
 *
 * Refuses to write if the vault is already in the released state — at that
 * point the wrapped key is exposed to anyone who knows the URL, and the
 * owner should rotate to a new vault rather than try to rearm.
 */
export async function configureDeadman(
  input: DeadmanConfigInput,
): Promise<
  | { ok: true; newVersion: number }
  | { ok: false; currentVersion: number }
> {
  const ref = siteRef(input.siteId);
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("site not found");
    const current = snap.data() as {
      version: number;
      deadman?: DeadmanWire | null;
    };
    if (current.version !== input.expectedVersion) {
      return { ok: false as const, currentVersion: current.version };
    }
    if (current.deadman?.released) {
      throw new Error("cannot reconfigure a released vault");
    }
    const next = current.version + 1;
    tx.update(ref, {
      version: next,
      updatedAt: serverTimestamp(),
      deadman: {
        wrappedKey: Bytes.fromUint8Array(input.wrappedKey),
        beneficiarySalt: Bytes.fromUint8Array(input.beneficiarySalt),
        intervalMs: input.intervalMs,
        graceMs: input.graceMs,
        lastHeartbeatAt: serverTimestamp(),
        released: false,
      },
    });
    return { ok: true as const, newVersion: next };
  });
}

/**
 * Remove the dead-man's-switch from a vault. Refuses if already released.
 */
export async function disableDeadman(input: {
  siteId: string;
  expectedVersion: number;
}): Promise<
  | { ok: true; newVersion: number }
  | { ok: false; currentVersion: number }
> {
  const ref = siteRef(input.siteId);
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("site not found");
    const current = snap.data() as {
      version: number;
      deadman?: DeadmanWire | null;
    };
    if (current.version !== input.expectedVersion) {
      return { ok: false as const, currentVersion: current.version };
    }
    if (current.deadman?.released) {
      throw new Error("cannot disable a released deadman");
    }
    const next = current.version + 1;
    tx.update(ref, {
      version: next,
      updatedAt: serverTimestamp(),
      deadman: deleteField(),
    });
    return { ok: true as const, newVersion: next };
  });
}
