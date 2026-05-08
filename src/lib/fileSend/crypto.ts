/**
 * Crypto for File Send: short-lived, view-capped, one-way file uploads.
 *
 * Threat model (in order of defense):
 *
 *   1. A random 256-bit key `K` is generated client-side and placed in
 *      the download URL fragment (`#k=...`). Browsers never send
 *      fragments to servers, so Firestore / Cloud Functions / logs
 *      never see `K`.
 *   2. The file bytes are AES-256-GCM encrypted under `contentKey`,
 *      derived from `K` (and the password, if any). The opaque
 *      ciphertext goes to Cloud Storage; without `K` the storage
 *      object is just random bytes to us.
 *   3. The file metadata (name, content-type, size) is AES-256-GCM
 *      encrypted under `metadataKey` derived from the same root and
 *      stored in Firestore alongside the storage path. The server
 *      never learns the original filename.
 *   4. Optional password layer: if the sender opts in, an Argon2id
 *      derivation feeds into the key tree, so an attacker who
 *      captures the URL still needs the out-of-band password.
 *   5. A second random 256-bit token `D` (the delete token) is
 *      generated and stored on the secure delete link; only its
 *      SHA-256 is persisted on the server, so possession of the
 *      original token is required to authorize deletion.
 *   6. The server enforces a view count and absolute expiry
 *      (max 7 days), hard-deletes the document + storage object the
 *      moment views are exhausted, and a scheduled sweep removes
 *      anything past its TTL.
 *
 * The download URL the sender shares looks like:
 *
 *   https://useflowvault.com/file/&lt;id&gt;#k=&lt;base64url-key&gt;
 *
 * The secure delete URL the sender keeps for themselves looks like:
 *
 *   https://useflowvault.com/file/&lt;id&gt;/delete#t=&lt;base64url-token&gt;
 */
import { aeadDecrypt, aeadEncrypt, hkdfDerive } from "@/lib/crypto/aead";
import { deriveMasterKey } from "@/lib/crypto/kdf";
import { randomBytes } from "@/lib/crypto/random";
import {
  concat,
  fromBase64Url,
  toBase64Url,
  utf8Decode,
  utf8Encode,
} from "@/lib/utils/bytes";

/** Hard cap on plaintext file size (10 MiB). */
export const MAX_FILE_SEND_BYTES = 10 * 1024 * 1024;

/** Hard cap on retention (7 days). */
export const MAX_FILE_SEND_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** URL-fragment key length (256-bit AES). */
const FILE_SEND_KEY_BYTES = 32;

/** Length of the secure-delete token. */
const FILE_SEND_DELETE_TOKEN_BYTES = 32;

/** Length of the password-derivation salt. */
const PASSWORD_SALT_BYTES = 16;

const HKDF_INFO_CONTENT = utf8Encode("flowvault:fileSend:v1:content");
const HKDF_INFO_METADATA = utf8Encode("flowvault:fileSend:v1:metadata");

/**
 * Public file metadata bound to a send. Encrypted client-side and
 * stored as a small AEAD blob inside the Firestore document so the
 * recipient can render filename + size before they download the
 * (potentially large) ciphertext.
 *
 * Anything that lands here leaks if the URL fragment ever leaks, by
 * design &mdash; same as the file content. We deliberately do not
 * store anything the server could index against the recipient.
 */
export interface FileMetadata {
  name: string;
  /** MIME type the browser reported on upload. */
  contentType: string;
  /** Original (plaintext) size in bytes. */
  size: number;
}

export interface SealInput {
  file: { bytes: Uint8Array; name: string; contentType: string; size: number };
  password?: string;
}

export interface SealOutput {
  /** AES-GCM ciphertext of the file bytes; goes to Cloud Storage. */
  contentCiphertext: Uint8Array;
  /** AES-GCM ciphertext of the JSON-encoded metadata. */
  metadataCiphertext: Uint8Array;
  /** Base64url 32-byte key. Goes into the download URL fragment. */
  fragmentKey: string;
  /** Base64url 32-byte delete token. Goes into the delete URL fragment. */
  deleteToken: string;
  /** SHA-256 of the delete token (raw bytes). Stored on the server. */
  deleteTokenHash: Uint8Array;
  /** Argon2id salt when password protection is enabled. */
  passwordSalt: Uint8Array | null;
  passwordProtected: boolean;
}

/**
 * Derive the per-purpose subkeys used to encrypt the file content and
 * the file metadata. Keying material is `K || passwordKey`; HKDF
 * domain-separates the two outputs so a leak of one cannot be reused
 * against the other.
 */
async function deriveSubkeys(
  K: Uint8Array,
  password: string | undefined,
  passwordSalt: Uint8Array | null,
): Promise<{ contentKey: Uint8Array; metadataKey: Uint8Array }> {
  let baseKey = K;
  if (password && passwordSalt) {
    const pwKey = await deriveMasterKey(password, passwordSalt);
    baseKey = concat(K, pwKey);
  }
  const [contentKey, metadataKey] = await Promise.all([
    hkdfDerive(baseKey, HKDF_INFO_CONTENT),
    hkdfDerive(baseKey, HKDF_INFO_METADATA),
  ]);
  return { contentKey, metadataKey };
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const out = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return new Uint8Array(out);
}

/**
 * Seal a file into ciphertext blobs + URL-fragment material. Call this
 * on the sender&rsquo;s device; the contentCiphertext is uploaded to
 * Cloud Storage and the metadataCiphertext + token hash are stored in
 * Firestore.
 */
export async function seal(input: SealInput): Promise<SealOutput> {
  if (input.file.bytes.length === 0) {
    throw new Error("empty file");
  }
  if (input.file.bytes.length > MAX_FILE_SEND_BYTES) {
    throw new Error(`file exceeds ${MAX_FILE_SEND_BYTES} bytes`);
  }

  const K = randomBytes(FILE_SEND_KEY_BYTES);
  const deleteToken = randomBytes(FILE_SEND_DELETE_TOKEN_BYTES);
  const passwordProtected = !!input.password;
  const passwordSalt = passwordProtected
    ? randomBytes(PASSWORD_SALT_BYTES)
    : null;

  const { contentKey, metadataKey } = await deriveSubkeys(
    K,
    input.password,
    passwordSalt,
  );

  const meta: FileMetadata = {
    name: input.file.name,
    contentType: input.file.contentType || "application/octet-stream",
    size: input.file.size,
  };
  const metaBytes = utf8Encode(JSON.stringify(meta));

  const [contentCiphertext, metadataCiphertext, deleteTokenHash] =
    await Promise.all([
      aeadEncrypt(contentKey, input.file.bytes),
      aeadEncrypt(metadataKey, metaBytes),
      sha256(deleteToken),
    ]);

  return {
    contentCiphertext,
    metadataCiphertext,
    fragmentKey: toBase64Url(K),
    deleteToken: toBase64Url(deleteToken),
    deleteTokenHash,
    passwordSalt,
    passwordProtected,
  };
}

export interface OpenMetadataInput {
  metadataCiphertext: Uint8Array;
  fragmentKey: string;
  passwordSalt: Uint8Array | null;
  password?: string;
}

export interface OpenContentInput {
  contentCiphertext: Uint8Array;
  fragmentKey: string;
  passwordSalt: Uint8Array | null;
  password?: string;
}

export type OpenMetadataOutcome =
  | { kind: "ok"; metadata: FileMetadata }
  | { kind: "needs-password" }
  | { kind: "wrong-password" }
  | { kind: "error"; message: string };

export type OpenContentOutcome =
  | { kind: "ok"; bytes: Uint8Array }
  | { kind: "wrong-password" }
  | { kind: "error"; message: string };

function decodeFragmentKey(s: string): Uint8Array | null {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(s);
  } catch {
    return null;
  }
  if (bytes.length !== FILE_SEND_KEY_BYTES) return null;
  return bytes;
}

/**
 * Try to decrypt the metadata blob. Used by the viewer to surface
 * filename / size before consuming the (much larger) storage object,
 * and to verify that the supplied password actually decrypts.
 */
export async function openMetadata(
  input: OpenMetadataInput,
): Promise<OpenMetadataOutcome> {
  const K = decodeFragmentKey(input.fragmentKey);
  if (!K) return { kind: "error", message: "invalid-key" };

  if (input.passwordSalt && !input.password) {
    return { kind: "needs-password" };
  }

  const { metadataKey } = await deriveSubkeys(
    K,
    input.password,
    input.passwordSalt,
  );
  const decoded = await aeadDecrypt(metadataKey, input.metadataCiphertext);
  if (!decoded) {
    return input.password
      ? { kind: "wrong-password" }
      : { kind: "error", message: "decrypt-failed" };
  }
  try {
    const parsed = JSON.parse(utf8Decode(decoded)) as FileMetadata;
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.contentType !== "string" ||
      typeof parsed.size !== "number"
    ) {
      return { kind: "error", message: "bad-metadata" };
    }
    return { kind: "ok", metadata: parsed };
  } catch {
    return { kind: "error", message: "bad-metadata" };
  }
}

/**
 * Decrypt the content ciphertext (full file bytes). Caller is expected
 * to have already verified the password via {@link openMetadata}.
 */
export async function openContent(
  input: OpenContentInput,
): Promise<OpenContentOutcome> {
  const K = decodeFragmentKey(input.fragmentKey);
  if (!K) return { kind: "error", message: "invalid-key" };
  const { contentKey } = await deriveSubkeys(
    K,
    input.password,
    input.passwordSalt,
  );
  const decoded = await aeadDecrypt(contentKey, input.contentCiphertext);
  if (!decoded) {
    return input.password
      ? { kind: "wrong-password" }
      : { kind: "error", message: "decrypt-failed" };
  }
  return { kind: "ok", bytes: decoded };
}
