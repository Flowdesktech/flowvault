/**
 * Firestore + Cloud Storage service for the File Send feature.
 *
 * Wire format:
 *
 *   - Cloud Storage: `fileSends/{id}` holds the raw AEAD ciphertext of
 *     the file bytes. Reads from clients are denied by storage rules;
 *     a Cloud Function issues a short-lived signed URL after
 *     atomically consuming a view in Firestore.
 *   - Firestore: `fileSends/{id}` holds the small encrypted metadata
 *     blob, expiry, view counters, password salt (if any), and the
 *     SHA-256 of the secure-delete token. Direct reads are denied by
 *     security rules; the readFileSend callable is the only path.
 *
 * The id is generated client-side (nanoid) so the upload to storage
 * and the subsequent create on Firestore can target the same key.
 * Stale uploads (storage object exists but no Firestore doc, e.g.
 * because the create failed) are cleaned up by the fileSendsSweep
 * scheduled function.
 */
import { Bytes, Timestamp, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import { customAlphabet } from "nanoid";
import { db, fn, storage } from "./client";
import { fromBase64, toBase64 } from "@/lib/utils/bytes";

/** Caps mirrored in firestore.rules and storage.rules. */
export const FILE_SEND_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const FILE_SEND_MAX_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const FILE_SEND_MIN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const FILE_SEND_MAX_VIEWS = 10;
export const FILE_SEND_DEFAULT_VIEWS = 1;
export const FILE_SEND_DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day
export const FILE_SEND_METADATA_MAX_BYTES = 4 * 1024;

const ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
const generateId = customAlphabet(ID_ALPHABET, 24);

export interface CreateFileSendInput {
  contentCiphertext: Uint8Array;
  metadataCiphertext: Uint8Array;
  expiresAtMs: number;
  maxViews: number;
  passwordProtected: boolean;
  passwordSalt: Uint8Array | null;
  /** SHA-256 of the secure-delete token (32 raw bytes). */
  deleteTokenHash: Uint8Array;
  /** Optional progress callback for the Storage upload (0..1). */
  onUploadProgress?: (fraction: number) => void;
}

export interface CreateFileSendResult {
  id: string;
}

/**
 * Upload the ciphertext to Cloud Storage, then create the Firestore
 * companion document. The two writes are not transactional &mdash;
 * the sweep function eventually drops orphaned storage objects whose
 * Firestore counterpart never landed.
 */
export async function createFileSend(
  input: CreateFileSendInput,
): Promise<CreateFileSendResult> {
  if (input.contentCiphertext.length === 0) {
    throw new Error("empty ciphertext");
  }
  if (input.contentCiphertext.length > FILE_SEND_MAX_FILE_BYTES + 4096) {
    throw new Error("ciphertext exceeds 10 MiB cap");
  }
  if (input.metadataCiphertext.length === 0) {
    throw new Error("empty metadata");
  }
  if (input.metadataCiphertext.length > FILE_SEND_METADATA_MAX_BYTES) {
    throw new Error("metadata blob too large");
  }
  if (input.maxViews < 1 || input.maxViews > FILE_SEND_MAX_VIEWS) {
    throw new Error("invalid maxViews");
  }
  const now = Date.now();
  if (
    input.expiresAtMs <= now + FILE_SEND_MIN_EXPIRY_MS - 60_000 ||
    input.expiresAtMs > now + FILE_SEND_MAX_EXPIRY_MS + 60_000
  ) {
    throw new Error("invalid expiresAt");
  }
  if (input.deleteTokenHash.length !== 32) {
    throw new Error("invalid deleteTokenHash");
  }
  if (input.passwordProtected && !input.passwordSalt) {
    throw new Error("missing passwordSalt");
  }

  const id = generateId();
  const path = `fileSends/${id}`;

  const storageRef = ref(storage(), path);
  const blob = new Blob([input.contentCiphertext as BlobPart], {
    type: "application/octet-stream",
  });
  await uploadBytes(storageRef, blob, {
    contentType: "application/octet-stream",
    cacheControl: "private, no-store",
  });
  // Best-effort progress: uploadBytes is one-shot, so mark complete once it returns.
  input.onUploadProgress?.(1);

  const payload: Record<string, unknown> = {
    storagePath: path,
    ciphertextSize: input.contentCiphertext.length,
    metadataCiphertext: Bytes.fromUint8Array(input.metadataCiphertext),
    expiresAt: Timestamp.fromMillis(input.expiresAtMs),
    maxViews: input.maxViews,
    viewCount: 0,
    deleteTokenHash: Bytes.fromUint8Array(input.deleteTokenHash),
    createdAt: serverTimestamp(),
  };
  if (input.passwordProtected) {
    payload.passwordProtected = true;
    payload.passwordSalt = Bytes.fromUint8Array(input.passwordSalt!);
  }

  await setDoc(doc(db(), "fileSends", id), payload);
  return { id };
}

/**
 * Discriminated outcome for a readFileSend call.
 */
export type ReadFileSendResult =
  | {
      kind: "ok";
      downloadUrl: string;
      metadataCiphertext: Uint8Array;
      ciphertextSize: number;
      passwordProtected: boolean;
      passwordSalt: Uint8Array | null;
      viewsRemaining: number;
      lastView: boolean;
      expiresAtMs: number;
    }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "exhausted" };

interface ReadCallablePayload {
  kind: "ok" | "not-found" | "expired" | "exhausted";
  downloadUrl?: string;
  metadataCiphertextBase64?: string;
  ciphertextSize?: number;
  passwordProtected?: boolean;
  passwordSaltBase64?: string | null;
  viewsRemaining?: number;
  lastView?: boolean;
  expiresAtMs?: number;
}

/**
 * Atomically consume a view and obtain a short-lived signed URL for
 * the encrypted file. The actual ciphertext download happens directly
 * against Cloud Storage so the function payload stays small even for
 * 10 MiB files.
 */
export async function readFileSend(id: string): Promise<ReadFileSendResult> {
  const call = httpsCallable<{ id: string }, ReadCallablePayload>(
    fn(),
    "readFileSend",
  );
  const { data } = await call({ id });
  if (data.kind !== "ok") return { kind: data.kind };
  if (
    !data.downloadUrl ||
    !data.metadataCiphertextBase64 ||
    typeof data.ciphertextSize !== "number" ||
    typeof data.expiresAtMs !== "number"
  ) {
    return { kind: "not-found" };
  }
  return {
    kind: "ok",
    downloadUrl: data.downloadUrl,
    metadataCiphertext: fromBase64(data.metadataCiphertextBase64),
    ciphertextSize: data.ciphertextSize,
    passwordProtected: !!data.passwordProtected,
    passwordSalt: data.passwordSaltBase64
      ? fromBase64(data.passwordSaltBase64)
      : null,
    viewsRemaining: data.viewsRemaining ?? 0,
    lastView: !!data.lastView,
    expiresAtMs: data.expiresAtMs,
  };
}

/**
 * Fetch the ciphertext bytes from Cloud Storage using the short-lived
 * signed URL returned by {@link readFileSend}. Surfaces a progress
 * fraction (0..1) when the response stream exposes a byte length.
 */
export async function downloadCiphertext(
  url: string,
  onProgress?: (fraction: number, loaded: number, total: number | null) => void,
): Promise<Uint8Array> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`download failed (${res.status})`);
  }
  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : null;
  if (!res.body || !onProgress) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress?.(1, buf.length, buf.length);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(total ? Math.min(1, received / total) : 0, received, total);
    }
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  onProgress(1, received, total ?? received);
  return out;
}

export type DeleteFileSendResult =
  | { kind: "ok" }
  | { kind: "not-found" }
  | { kind: "forbidden" };

interface DeleteCallablePayload {
  kind: "ok" | "not-found" | "forbidden";
}

/**
 * Authorize and execute a secure delete using the token from the
 * delete URL fragment. The server compares SHA-256 of the supplied
 * token to the hash stored at create time; we send the raw token
 * (base64-encoded) over TLS so the function can recompute the digest.
 */
export async function deleteFileSend(
  id: string,
  deleteTokenBase64Url: string,
): Promise<DeleteFileSendResult> {
  const call = httpsCallable<
    { id: string; deleteToken: string },
    DeleteCallablePayload
  >(fn(), "deleteFileSend");
  const { data } = await call({ id, deleteToken: deleteTokenBase64Url });
  return { kind: data.kind };
}

/** Re-export for tests / debugging. */
export const _internal = { generateId, toBase64 };
