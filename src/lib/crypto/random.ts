/**
 * Cryptographically secure random byte generation.
 * Uses WebCrypto's getRandomValues, which is available in browsers and modern Node.
 *
 * The WebCrypto spec caps a single getRandomValues() call at 65_536 bytes
 * (see https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues).
 * Hidden-volume blobs and similar bulk fills exceed that limit, so we
 * fill in chunks. The chunking is purely a plumbing detail — every byte
 * still comes straight from the CSPRNG.
 */
const MAX_CHUNK = 65_536;

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += MAX_CHUNK) {
    const chunk = out.subarray(offset, Math.min(offset + MAX_CHUNK, length));
    crypto.getRandomValues(chunk);
  }
  return out;
}
