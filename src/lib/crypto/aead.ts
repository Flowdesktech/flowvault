/**
 * AES-256-GCM authenticated encryption, plus an HKDF helper used to derive
 * per-slot subkeys from the master key.
 */
import { randomBytes } from "./random";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const AEAD = {
  ivLength: IV_LENGTH,
  tagLength: TAG_LENGTH,
  overhead: IV_LENGTH + TAG_LENGTH,
};

/**
 * WebCrypto's type signatures (since TS 5.7) require BufferSource backed by a
 * concrete ArrayBuffer rather than the more general ArrayBufferLike that a
 * sliced Uint8Array produces. We cast at the boundary to keep the rest of
 * the code using plain Uint8Array.
 */
type BS = BufferSource;

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BS, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt `plaintext` with AES-GCM and return `iv || ciphertext || tag`.
 * WebCrypto concatenates ciphertext and tag in its output; we prepend the IV
 * so callers can treat the result as a self-contained slot.
 */
export async function aeadEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  additionalData?: Uint8Array,
): Promise<Uint8Array> {
  const iv = randomBytes(IV_LENGTH);
  const ck = await importAesKey(key);
  const params: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as BS,
    tagLength: TAG_LENGTH * 8,
  };
  if (additionalData) {
    (params as AesGcmParams & { additionalData: BS }).additionalData =
      additionalData as BS;
  }
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(params, ck, plaintext as BS),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

/**
 * Decrypt a `iv || ciphertext || tag` buffer. Returns null on failure so
 * callers can probe multiple candidate slots without try/catch noise.
 */
export async function aeadDecrypt(
  key: Uint8Array,
  input: Uint8Array,
  additionalData?: Uint8Array,
): Promise<Uint8Array | null> {
  if (input.length < IV_LENGTH + TAG_LENGTH) return null;
  const iv = input.slice(0, IV_LENGTH);
  const body = input.slice(IV_LENGTH);
  try {
    const ck = await importAesKey(key);
    const params: AesGcmParams = {
      name: "AES-GCM",
      iv: iv as BS,
      tagLength: TAG_LENGTH * 8,
    };
    if (additionalData) {
      (params as AesGcmParams & { additionalData: BS }).additionalData =
        additionalData as BS;
    }
    const pt = new Uint8Array(
      await crypto.subtle.decrypt(params, ck, body as BS),
    );
    return pt;
  } catch {
    return null;
  }
}

/**
 * HKDF-SHA256 expansion: derive a domain-separated subkey from a master key.
 * Used to produce per-slot encryption keys so that each hidden volume slot
 * has an independent key even though they share a master-key source.
 */
export async function hkdfDerive(
  masterKey: Uint8Array,
  info: Uint8Array,
  length = 32,
): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey(
    "raw",
    masterKey as BS,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0) as BS,
      info: info as BS,
    },
    base,
    length * 8,
  );
  return new Uint8Array(bits);
}
