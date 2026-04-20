/**
 * Time-lock encryption backed by the drand public randomness beacon.
 *
 * How it works (short version):
 *
 *   1. drand is a distributed network that publishes a fresh BLS threshold
 *      signature every `period` seconds (30s for mainnet). Each round's
 *      signature depends on the private keyshares of a supermajority of
 *      node operators, so nobody can produce it in advance.
 *
 *   2. The `tlock` scheme encrypts a payload to a future round using
 *      identity-based encryption over BLS (IBE). The round number is the
 *      identity; the chain's public key is the IBE master public key.
 *
 *   3. Once drand publishes the round's signature, anyone can recover
 *      that private identity key and decrypt the payload. Before that
 *      moment nobody &mdash; including Flowvault, including the sender,
 *      including a subpoena &mdash; can decrypt it.
 *
 * We use drand mainnet (30s period, RFC-compliant G1 scheme) which is
 * the default supported by tlock-js. 30 seconds of granularity is more
 * than enough for a human-scheduled "open this note on Jan 1, 2030".
 */
import {
  timelockEncrypt as tlockEncrypt,
  timelockDecrypt as tlockDecrypt,
  mainnetClient,
  defaultChainInfo,
  roundAt,
  roundTime,
  type HttpChainClient,
} from "tlock-js";
import { Buffer } from "buffer";
import {
  looksPasswordFramed,
  unwrapWithPassword,
  wrapWithPassword,
} from "@/lib/crypto/passwordFrame";
import { utf8Decode, utf8Encode } from "@/lib/utils/bytes";

/**
 * Minimum unlock horizon enforced in the UI. If someone picks a moment
 * only seconds away, network latency and drand's round period can let
 * the reader decrypt before the sender even finishes uploading. 2
 * minutes gives plenty of slack.
 */
export const MIN_LOCK_SECONDS = 120;

/** Upper bound on the plaintext we&apos;ll accept. Firestore rule caps the
 *  ciphertext at 256 KiB. tlock armoring adds ~40% overhead. */
export const MAX_PLAINTEXT_BYTES = 128 * 1024;

let cachedClient: HttpChainClient | null = null;

function getClient(): HttpChainClient {
  if (!cachedClient) cachedClient = mainnetClient();
  return cachedClient;
}

/** Public identity of the drand chain we target. Stored in every capsule
 *  so future code can still route to the right chain if we add more. */
export function activeChainInfo() {
  return defaultChainInfo;
}

/** Given a future wall-clock unlock time (ms epoch), return the drand
 *  round number whose signature will be the decryption key. */
export function roundForUnlockAt(unlockAtMs: number): number {
  return roundAt(unlockAtMs, defaultChainInfo);
}

/** Convert a drand round number back to its expected wall-clock time
 *  (ms epoch). Accurate to within a beacon period (30 s). */
export function unlockTimeForRound(round: number): number {
  return roundTime(defaultChainInfo, round);
}

/** Current drand round number. */
export function currentRound(): number {
  return roundAt(Date.now(), defaultChainInfo);
}

export interface EncryptOptions {
  /**
   * Optional inner password layer. When provided, the plaintext is first
   * encrypted with AES-256-GCM under an Argon2id-derived key, then the
   * resulting bytes are time-locked. Readers need BOTH the time to pass
   * AND the password to recover the plaintext.
   */
  password?: string;
}

/**
 * Encrypt plaintext to a future drand round. Output is the tlock
 * "armored" UTF-8 payload (an age-ascii envelope).
 *
 * When `opts.password` is set, an inner AES-256-GCM layer is applied
 * first; the armored output is identical in shape to a password-less
 * capsule but only decrypts to a password-framed blob that the viewer
 * then decrypts with the password.
 */
export async function encryptForRound(
  plaintext: string,
  round: number,
  opts: EncryptOptions = {},
): Promise<string> {
  const inner = opts.password
    ? await wrapWithPassword(plaintext, opts.password)
    : utf8Encode(plaintext);
  return tlockEncrypt(round, Buffer.from(inner), getClient());
}

export type DecryptOutcome =
  | { kind: "unlocked"; plaintext: string }
  | { kind: "still-locked"; round: number; unlockAtMs: number }
  | { kind: "needs-password" }
  | { kind: "wrong-password" }
  | { kind: "error"; message: string };

export interface DecryptOptions {
  password?: string;
}

/**
 * Try to decrypt an armored tlock payload.
 *
 *   - `still-locked`  : drand hasn&apos;t published the target round yet.
 *   - `needs-password`: capsule has an inner password layer and the caller
 *                        did not supply a password.
 *   - `wrong-password`: password layer is present, caller supplied a
 *                        password, AES-GCM authentication failed.
 *   - `unlocked`      : plaintext successfully recovered.
 *   - `error`         : malformed input, network failure, or tlock error.
 *
 * The password layer is detected by the 4-byte "FVPW" magic prefix on
 * the bytes recovered from tlock; this detection is authoritative even
 * if the Firestore `passwordProtected` hint is missing or forged.
 */
export async function tryDecrypt(
  ciphertext: string,
  round: number,
  opts: DecryptOptions = {},
): Promise<DecryptOutcome> {
  const now = currentRound();
  if (round > now) {
    return {
      kind: "still-locked",
      round,
      unlockAtMs: unlockTimeForRound(round),
    };
  }
  let inner: Uint8Array;
  try {
    const buf = await tlockDecrypt(ciphertext, getClient());
    inner = new Uint8Array(buf);
  } catch (e) {
    return {
      kind: "error",
      message:
        (e as Error).message ??
        "Decryption failed. The drand beacon may not have caught up yet; try again in a minute.",
    };
  }

  if (!looksPasswordFramed(inner)) {
    return { kind: "unlocked", plaintext: utf8Decode(inner) };
  }

  if (!opts.password) {
    return { kind: "needs-password" };
  }

  const plaintext = await unwrapWithPassword(inner, opts.password);
  if (!plaintext) {
    return { kind: "wrong-password" };
  }
  return { kind: "unlocked", plaintext: utf8Decode(plaintext) };
}
