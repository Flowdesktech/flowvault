/**
 * Optional password layer used by both time-locked notes and encrypted
 * sends. Callers wrap their plaintext bytes in this frame to add a
 * second gate on top of whatever outer encryption they already have
 * (tlock for time-locks; URL-fragment AES key for sends). Readers
 * detect the frame by its leading magic and prompt for the password.
 *
 * Frame layout:
 *
 *   [ magic "FVPW" (4)              ]
 *   [ version (1)   ]   // currently 1
 *   [ saltLen (1)   ]   // currently 16
 *   [ salt (saltLen)]   // Argon2id salt
 *   [ AEAD output   ]   // iv (12) || ct || tag (16)
 *
 * Why inner and not outer: for time-locks we want the password layer
 * invisible before the time-lock releases; for sends we want an
 * attacker who captures the ciphertext to still need the password
 * even if they steal the URL fragment. In both cases the inner
 * ordering means the bytes only become password-shaped after the
 * outer layer opens.
 */
import { aeadDecrypt, aeadEncrypt } from "./aead";
import { deriveMasterKey } from "./kdf";
import { randomBytes } from "./random";
import { utf8Encode } from "@/lib/utils/bytes";

const MAGIC = new Uint8Array([0x46, 0x56, 0x50, 0x57]); // "FVPW"
const VERSION = 1;
const SALT_BYTES = 16;
const HEADER_BYTES = 4 /* magic */ + 1 /* version */ + 1; /* saltLen */

/** Wrap UTF-8 plaintext in a password-authenticated frame. */
export async function wrapWithPassword(
  plaintext: string,
  password: string,
): Promise<Uint8Array> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveMasterKey(password, salt);
  const aead = await aeadEncrypt(key, utf8Encode(plaintext));
  const out = new Uint8Array(HEADER_BYTES + salt.length + aead.length);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  out[5] = salt.length;
  out.set(salt, HEADER_BYTES);
  out.set(aead, HEADER_BYTES + salt.length);
  return out;
}

/** True if `bytes` begins with the FVPW magic header. */
export function looksPasswordFramed(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_BYTES) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}

/**
 * Attempt to unwrap a password-framed blob. Returns the plaintext bytes
 * on success, `null` on any failure (wrong password, truncated frame,
 * bad version). Callers should treat null as &ldquo;wrong
 * password&rdquo; in UX copy.
 */
export async function unwrapWithPassword(
  bytes: Uint8Array,
  password: string,
): Promise<Uint8Array | null> {
  if (!looksPasswordFramed(bytes)) return null;
  const version = bytes[4];
  if (version !== VERSION) return null;
  const saltLen = bytes[5];
  if (saltLen < 8 || saltLen > 64) return null;
  const saltStart = HEADER_BYTES;
  const saltEnd = saltStart + saltLen;
  if (saltEnd >= bytes.length) return null;
  const salt = bytes.slice(saltStart, saltEnd);
  const aead = bytes.slice(saltEnd);
  const key = await deriveMasterKey(password, salt);
  return aeadDecrypt(key, aead);
}
