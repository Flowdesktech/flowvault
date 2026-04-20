/**
 * Dead-man's switch: client-side cryptography + service calls.
 *
 * Goal: if the vault owner stops checking in for a configured interval, a
 * pre-designated beneficiary can decrypt the vault by entering a
 * "beneficiary password" that the owner shared with them out-of-band.
 *
 * How it works (zero-knowledge end to end):
 *
 *   1. Owner picks a beneficiary password BP, an interval I, and a grace G.
 *   2. We derive a beneficiary key BK = Argon2id(BP, freshSalt).
 *   3. We wrap the current master key with BK using AES-256-GCM:
 *        wrappedKey = AEAD_BK(masterKey)
 *   4. We upload { wrappedKey, beneficiarySalt, I, G } to Firestore. The
 *      server learns nothing about either password or the master key.
 *   5. Every save bumps `deadman.lastHeartbeatAt = serverTimestamp()`.
 *      Saves require the master key (it's used to re-encrypt the blob), so
 *      only the owner can effectively heartbeat.
 *   6. A scheduled Cloud Function `deadmanSweep` runs hourly. For any
 *      configured deadman where now > lastHeartbeatAt + I + G, it sets
 *      `released = true`. (Only the Admin SDK can do this; clients can't.)
 *   7. Once released, the beneficiary visits the URL, enters BP, derives
 *      BK, unwraps the master key, and decrypts the vault as normal.
 *
 * Deniability impact, documented honestly:
 *   - The *existence* of a deadman config is visible to the server. We
 *     can't avoid this without losing the ability to schedule the sweep.
 *   - The interval, grace, and last-heartbeat time are visible.
 *   - The wrapped key blob and beneficiary salt are opaque ciphertext.
 *   - Hidden volumes still work normally for the *owner*. The beneficiary
 *     unlocks the slot the master key opens — by design, that is the
 *     "primary" notebook the owner registered with the deadman.
 */
import { aeadDecrypt, aeadEncrypt } from "@/lib/crypto/aead";
import { deriveMasterKey } from "@/lib/crypto/kdf";
import { randomBytes } from "@/lib/crypto/random";
import { utf8Decode } from "@/lib/utils/bytes";
import {
  configureDeadman as fbConfigureDeadman,
  disableDeadman as fbDisableDeadman,
  fetchSite,
  type DeadmanRecord,
  type SiteRecord,
} from "@/lib/firebase/sites";
import {
  openWithKey,
  type VolumeParams,
} from "@/lib/crypto/volume";
import {
  deserializeBundle,
  type NotebookBundle,
} from "@/lib/vault/notebooks";

export const BENEFICIARY_SALT_BYTES = 16;
export const MASTER_KEY_BYTES = 32;

/** Tag bound to the wrapped blob via AES-GCM AAD, version-stamped. */
const WRAP_AAD = new TextEncoder().encode("flowvault.deadman.v1");

/**
 * Wrap a master key under a beneficiary-password-derived key and write the
 * result to Firestore. Returns the new vault version on success.
 */
export async function configureDeadman(input: {
  siteId: string;
  expectedVersion: number;
  masterKey: Uint8Array;
  beneficiaryPassword: string;
  intervalMs: number;
  graceMs: number;
}): Promise<
  | { kind: "configured"; newVersion: number }
  | { kind: "conflict"; currentVersion: number }
> {
  if (input.beneficiaryPassword.length < 8) {
    throw new Error("Beneficiary password must be at least 8 characters.");
  }
  const salt = randomBytes(BENEFICIARY_SALT_BYTES);
  const beneficiaryKey = await deriveMasterKey(
    input.beneficiaryPassword,
    salt,
  );
  const wrappedKey = await aeadEncrypt(
    beneficiaryKey,
    input.masterKey,
    WRAP_AAD,
  );
  const res = await fbConfigureDeadman({
    siteId: input.siteId,
    expectedVersion: input.expectedVersion,
    wrappedKey,
    beneficiarySalt: salt,
    intervalMs: input.intervalMs,
    graceMs: input.graceMs,
  });
  if (!res.ok) return { kind: "conflict", currentVersion: res.currentVersion };
  return { kind: "configured", newVersion: res.newVersion };
}

export async function disableDeadman(input: {
  siteId: string;
  expectedVersion: number;
}): Promise<
  | { kind: "disabled"; newVersion: number }
  | { kind: "conflict"; currentVersion: number }
> {
  const res = await fbDisableDeadman(input);
  if (!res.ok) return { kind: "conflict", currentVersion: res.currentVersion };
  return { kind: "disabled", newVersion: res.newVersion };
}

export interface BeneficiaryUnlockResult {
  kind: "unlocked";
  masterKey: Uint8Array;
  slotIndex: number;
  bundle: NotebookBundle;
  blob: Uint8Array;
  version: number;
  kdfSalt: Uint8Array;
  volume: VolumeParams;
  siteId: string;
  /** The deadman record at unlock time (for UI: "released N days ago"). */
  deadman: DeadmanRecord;
}

export type BeneficiaryUnlockError =
  | { kind: "not-released" }
  | { kind: "no-deadman" }
  | { kind: "wrong-password" }
  | { kind: "site-missing" };

/**
 * Beneficiary flow: given the URL slug and the beneficiary password,
 * derive the beneficiary key, unwrap the master key, and decrypt the
 * vault. Refuses to operate if the vault is not in the released state, so
 * that the beneficiary password cannot be silently brute-forced before the
 * owner has actually missed their check-ins.
 */
export async function unlockReleased(input: {
  siteId: string;
  beneficiaryPassword: string;
}): Promise<BeneficiaryUnlockResult | BeneficiaryUnlockError> {
  const site = await fetchSite(input.siteId);
  if (!site) return { kind: "site-missing" };
  if (!site.deadman) return { kind: "no-deadman" };
  if (!site.deadman.released) return { kind: "not-released" };

  const beneficiaryKey = await deriveMasterKey(
    input.beneficiaryPassword,
    site.deadman.beneficiarySalt,
  );
  const masterKey = await aeadDecrypt(
    beneficiaryKey,
    site.deadman.wrappedKey,
    WRAP_AAD,
  );
  if (!masterKey || masterKey.length !== MASTER_KEY_BYTES) {
    return { kind: "wrong-password" };
  }

  const volume: VolumeParams = {
    slotCount: site.volume.slotCount,
    slotSize: site.volume.slotSize,
  };
  const found = await openWithKey(site.ciphertext, masterKey, volume);
  // The wrapped key opens the same slot it opened at configure time.
  // If it doesn't open any slot, the vault was rotated past this deadman
  // (shouldn't happen unless the owner manually rebuilt it).
  if (!found) return { kind: "wrong-password" };

  return {
    kind: "unlocked",
    masterKey,
    slotIndex: found.index,
    bundle: deserializeBundle(utf8Decode(found.content)),
    blob: site.ciphertext,
    version: site.version,
    kdfSalt: site.kdfSalt,
    volume,
    siteId: input.siteId,
    deadman: site.deadman,
  };
}

/**
 * Pure helper: given a deadman config, compute when the next sweep
 * would treat it as expired. Used by the UI to render countdowns.
 */
export function deadmanExpiresAt(
  deadman: { lastHeartbeatAt: { toMillis(): number } | null; intervalMs: number; graceMs: number },
): number | null {
  if (!deadman.lastHeartbeatAt) return null;
  return deadman.lastHeartbeatAt.toMillis() + deadman.intervalMs + deadman.graceMs;
}

/** Does this deadman record need a fresh heartbeat soon (>50% interval)? */
export function deadmanShouldRefresh(deadman: {
  lastHeartbeatAt: { toMillis(): number } | null;
  intervalMs: number;
}): boolean {
  if (!deadman.lastHeartbeatAt) return false;
  const elapsed = Date.now() - deadman.lastHeartbeatAt.toMillis();
  return elapsed > deadman.intervalMs / 2;
}

export type SiteRecordWithDeadman = SiteRecord & { deadman: DeadmanRecord };
