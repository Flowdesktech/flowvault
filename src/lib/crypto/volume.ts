/**
 * Hidden-volume blob format used by Flowvault for plausible deniability.
 *
 * ------------------------------------------------------------------
 *  Design
 * ------------------------------------------------------------------
 *
 * A site's stored ciphertext is a fixed-size blob split into N equally-sized
 * slots. Each slot is independently AES-GCM-encrypted with a subkey derived
 * from (password, slotIndex). Slots that are not in use are filled with
 * cryptographically random bytes; real and random slots are indistinguishable
 * without the corresponding key.
 *
 *   blob = slot[0] || slot[1] || ... || slot[N-1]
 *
 *   slot layout (each = slotSize bytes):
 *     [ IV (12) | ciphertext+tag (slotSize - 12) ]
 *
 *   After decryption, the slot "frame" is:
 *     [ magic "FVLT" (4)                         ]
 *     [ version (1) | flags (1)                  ]
 *     [ contentLength (u32 LE, 4)                ]
 *     [ content (contentLength bytes)            ]
 *     [ random padding filling to slot interior  ]
 *
 * A single password picks a deterministic slot index via
 *   slotIndex = HMAC-SHA256(masterKey, "slot-index")[0..4] mod N
 * so a user always lands in the same slot when they re-enter their password.
 *
 * Collision note: with M independent passwords on the same site, the
 * probability of two passwords hashing to the same slot is ~ M^2 / (2N).
 * At N=64 that's ~1.6% for 2 passwords, ~4.7% for 3, and ~14% for 5, which
 * the UI can surface without being alarming for typical use. Collisions
 * cannot be detected across passwords (that would break deniability), so on
 * collision one notebook silently overwrites the other; the UI warns and
 * asks the user to choose a different password when possible.
 *
 * Integrity: AES-GCM's auth tag means random-filled slots essentially never
 * decrypt successfully under a guessed key. The 4-byte magic is a belt-and-
 * suspenders check plus a fast format sanity test.
 */
import { aeadDecrypt, aeadEncrypt, hkdfDerive, AEAD } from "./aead";
import { randomBytes } from "./random";
import { utf8Encode } from "@/lib/utils/bytes";

export const VOLUME_DEFAULTS = {
  slotCount: 64,
  slotSize: 8 * 1024, // 8 KiB per slot -> 512 KiB total blob
  frameVersion: 1,
};

const MAGIC = new Uint8Array([0x46, 0x56, 0x4c, 0x54]); // "FVLT"
const FRAME_HEADER_BYTES = 4 /* magic */ + 1 /* version */ + 1 /* flags */ + 4; /* contentLength */

export interface VolumeParams {
  slotCount: number;
  slotSize: number;
}

export interface OpenSlot {
  /** 0-based index of the slot this password decrypted. */
  index: number;
  /** Decrypted plaintext content. */
  content: Uint8Array;
}

/** Produce a blob of the correct size filled entirely with random bytes. */
export function freshBlob(params: VolumeParams): Uint8Array {
  return randomBytes(params.slotCount * params.slotSize);
}

/**
 * Compute the preferred slot index for a given master key. The same password
 * (and therefore the same master key) always lands in the same slot on a
 * given site, which is how re-opening a vault works without any server-side
 * "which-slot-am-I" metadata.
 */
export async function slotIndexFor(
  masterKey: Uint8Array,
  params: VolumeParams,
): Promise<number> {
  const tag = await hkdfDerive(masterKey, utf8Encode("flowvault:slot-index"), 4);
  const n =
    (tag[0] << 24) | (tag[1] << 16) | (tag[2] << 8) | tag[3];
  // Unsigned conversion then mod
  const u = n >>> 0;
  return u % params.slotCount;
}

async function slotKeyFor(
  masterKey: Uint8Array,
  slotIndex: number,
): Promise<Uint8Array> {
  const info = utf8Encode(`flowvault:slot:${slotIndex}`);
  return hkdfDerive(masterKey, info, 32);
}

function encodeFrame(
  content: Uint8Array,
  interiorSize: number,
  flags = 0,
): Uint8Array {
  const maxContent = interiorSize - FRAME_HEADER_BYTES;
  if (content.length > maxContent) {
    throw new Error(
      `content too large for slot: ${content.length} > ${maxContent}`,
    );
  }
  const frame = new Uint8Array(interiorSize);
  // Fill trailing bytes with random padding first; header + content overwrite.
  const pad = randomBytes(interiorSize);
  frame.set(pad, 0);
  frame.set(MAGIC, 0);
  frame[4] = VOLUME_DEFAULTS.frameVersion;
  frame[5] = flags;
  const lenOffset = 6;
  frame[lenOffset + 0] = content.length & 0xff;
  frame[lenOffset + 1] = (content.length >>> 8) & 0xff;
  frame[lenOffset + 2] = (content.length >>> 16) & 0xff;
  frame[lenOffset + 3] = (content.length >>> 24) & 0xff;
  frame.set(content, FRAME_HEADER_BYTES);
  return frame;
}

function decodeFrame(frame: Uint8Array): Uint8Array | null {
  if (frame.length < FRAME_HEADER_BYTES) return null;
  for (let i = 0; i < MAGIC.length; i++) {
    if (frame[i] !== MAGIC[i]) return null;
  }
  const version = frame[4];
  if (version !== VOLUME_DEFAULTS.frameVersion) return null;
  const len =
    frame[6] |
    (frame[7] << 8) |
    (frame[8] << 16) |
    (frame[9] << 24);
  const end = FRAME_HEADER_BYTES + len;
  if (len < 0 || end > frame.length) return null;
  return frame.slice(FRAME_HEADER_BYTES, end);
}

function slotBounds(params: VolumeParams, index: number) {
  const start = index * params.slotSize;
  const end = start + params.slotSize;
  return { start, end };
}

/**
 * Attempt to open any slot in the blob with the provided master key. Returns
 * the first slot that decrypts (there should be at most one; multiple would
 * be a severe HKDF collision).
 */
export async function openWithKey(
  blob: Uint8Array,
  masterKey: Uint8Array,
  params: VolumeParams,
): Promise<OpenSlot | null> {
  const preferred = await slotIndexFor(masterKey, params);
  const order = [preferred];
  for (let i = 0; i < params.slotCount; i++) {
    if (i !== preferred) order.push(i);
  }
  for (const idx of order) {
    const { start, end } = slotBounds(params, idx);
    const slot = blob.slice(start, end);
    const subKey = await slotKeyFor(masterKey, idx);
    const frame = await aeadDecrypt(subKey, slot);
    if (!frame) continue;
    const content = decodeFrame(frame);
    if (content) return { index: idx, content };
  }
  return null;
}

/**
 * Produce a new blob by replacing a single slot with freshly-encrypted
 * content. Other slots are copied verbatim from the input blob, preserving
 * any other notebooks encrypted under different passwords.
 *
 * This is the critical operation for deniability: the caller never needs to
 * know what is inside any other slot in order to preserve it.
 */
export async function writeSlot(
  existingBlob: Uint8Array,
  masterKey: Uint8Array,
  slotIndex: number,
  content: Uint8Array,
  params: VolumeParams,
): Promise<Uint8Array> {
  if (existingBlob.length !== params.slotCount * params.slotSize) {
    throw new Error("blob size does not match volume params");
  }
  const interior = params.slotSize - AEAD.overhead;
  const frame = encodeFrame(content, interior);
  const subKey = await slotKeyFor(masterKey, slotIndex);
  const encrypted = await aeadEncrypt(subKey, frame);
  if (encrypted.length !== params.slotSize) {
    throw new Error(
      `unexpected slot ciphertext length: ${encrypted.length} != ${params.slotSize}`,
    );
  }
  const out = new Uint8Array(existingBlob);
  const { start } = slotBounds(params, slotIndex);
  out.set(encrypted, start);
  return out;
}

/** Maximum bytes of content that fit in a single slot with the given params. */
export function slotCapacity(params: VolumeParams): number {
  return params.slotSize - AEAD.overhead - FRAME_HEADER_BYTES;
}
