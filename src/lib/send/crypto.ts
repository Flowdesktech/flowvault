/**
 * Crypto for Encrypted Send: short-lived, view-capped, one-way notes.
 *
 * Threat model (in order of defense):
 *
 *   1. A random 256-bit key `K` is generated client-side and placed in
 *      the URL fragment (`#k=...`). Browsers never send fragments to
 *      servers, so Firestore/Cloud Functions/logs never see `K`.
 *   2. The plaintext is AES-256-GCM encrypted under `K`. The opaque
 *      ciphertext is what goes to Firestore. Without `K` the server
 *      cannot decrypt the note &mdash; zero-knowledge like the rest of
 *      Flowvault.
 *   3. Optional inner password layer: before the outer AES wrap, the
 *      plaintext may be wrapped in the shared FVPW password frame
 *      (Argon2id + AES-256-GCM). This means an attacker who captures
 *      the URL (key included) *still* needs the out-of-band password.
 *   4. The server enforces a view count and absolute expiry, hard-deletes
 *      the document once views are exhausted, and a scheduled sweep
 *      removes anything past its expiry. Clients can never read the
 *      document directly &mdash; only a Cloud Function can, and only
 *      as part of atomically consuming a view.
 *
 * The URL the sender copies looks like:
 *
 *   https://useflowvault.com/send/&lt;id&gt;#k=&lt;base64url-key&gt;
 */
import { aeadDecrypt, aeadEncrypt } from "@/lib/crypto/aead";
import {
  looksPasswordFramed,
  unwrapWithPassword,
  wrapWithPassword,
} from "@/lib/crypto/passwordFrame";
import { randomBytes } from "@/lib/crypto/random";
import {
  fromBase64Url,
  toBase64Url,
  utf8Decode,
  utf8Encode,
} from "@/lib/utils/bytes";

/** Matches the time-lock cap so composer copy/size limits are consistent. */
export const MAX_SEND_PLAINTEXT_BYTES = 128 * 1024;

/** URL-fragment key length in bytes. 32 bytes = 256 bits = AES-256. */
const SEND_KEY_BYTES = 32;

export interface SealInput {
  plaintext: string;
  password?: string;
}

export interface SealOutput {
  /** Opaque bytes to persist in Firestore. */
  ciphertext: Uint8Array;
  /** Base64url of the 32-byte key. Goes into the URL fragment only. */
  fragmentKey: string;
  passwordProtected: boolean;
}

/**
 * Seal a plaintext into a send blob + URL-fragment key. Call this on
 * the sender&rsquo;s device; `ciphertext` gets POSTed to Firestore and
 * `fragmentKey` gets appended to the shareable link as `#k=&lt;key&gt;`.
 */
export async function seal(input: SealInput): Promise<SealOutput> {
  const inner = input.password
    ? await wrapWithPassword(input.plaintext, input.password)
    : utf8Encode(input.plaintext);
  const key = randomBytes(SEND_KEY_BYTES);
  const ciphertext = await aeadEncrypt(key, inner);
  return {
    ciphertext,
    fragmentKey: toBase64Url(key),
    passwordProtected: !!input.password,
  };
}

export interface OpenInput {
  ciphertext: Uint8Array;
  fragmentKey: string;
  password?: string;
}

export type OpenOutcome =
  | { kind: "plaintext"; plaintext: string }
  | { kind: "needs-password" }
  | { kind: "wrong-password" }
  | { kind: "error"; message: string };

/**
 * Reverse of `seal`. `fragmentKey` is the base64url string from the
 * viewer&rsquo;s URL fragment. Returns a discriminated outcome so the
 * UI can render specific messaging per failure mode.
 */
export async function open(input: OpenInput): Promise<OpenOutcome> {
  let key: Uint8Array;
  try {
    key = fromBase64Url(input.fragmentKey);
  } catch {
    return { kind: "error", message: "invalid-key" };
  }
  if (key.length !== SEND_KEY_BYTES) {
    return { kind: "error", message: "invalid-key" };
  }

  const inner = await aeadDecrypt(key, input.ciphertext);
  if (!inner) {
    return { kind: "error", message: "decrypt-failed" };
  }

  if (!looksPasswordFramed(inner)) {
    return { kind: "plaintext", plaintext: utf8Decode(inner) };
  }

  if (!input.password) {
    return { kind: "needs-password" };
  }

  const plaintext = await unwrapWithPassword(inner, input.password);
  if (!plaintext) return { kind: "wrong-password" };
  return { kind: "plaintext", plaintext: utf8Decode(plaintext) };
}

/**
 * Detect whether the opaque bytes carry an inner FVPW frame without
 * attempting decryption. Used nowhere on the hot path &mdash; the server
 * stores a hint flag instead &mdash; but handy for tests.
 */
export function isPasswordFramed(innerBytes: Uint8Array): boolean {
  return looksPasswordFramed(innerBytes);
}
