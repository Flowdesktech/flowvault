/**
 * Cryptographically secure random byte generation.
 * Uses WebCrypto's getRandomValues, which is available in browsers and modern Node.
 */

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}
