/**
 * Firestore service for the Encrypted Send feature. Creates
 * short-lived, view-capped blobs and fetches them via a Cloud Function
 * that atomically consumes a view and deletes the document on the
 * last view.
 *
 * Clients can never read the `sends/{id}` documents directly: the
 * security rules deny it, and reads go through the `readSend`
 * callable. This lets the server enforce view counts and absolute
 * expiry without trusting the client.
 */
import { Bytes, Timestamp, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, fn } from "./client";
import { fromBase64 } from "@/lib/utils/bytes";

/** Expiry / view-count bounds. Mirrored in Firestore rules. */
export const SEND_MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SEND_MIN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const SEND_MAX_VIEWS = 100;
export const SEND_DEFAULT_VIEWS = 1;
export const SEND_DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

export interface CreateSendInput {
  ciphertext: Uint8Array;
  /** Absolute wall-clock millis. Must be &le; 30 days from now. */
  expiresAtMs: number;
  /** 1..SEND_MAX_VIEWS */
  maxViews: number;
  passwordProtected: boolean;
}

/** Returns the new send id. */
export async function createSend(input: CreateSendInput): Promise<string> {
  if (input.ciphertext.length === 0) {
    throw new Error("empty ciphertext");
  }
  if (input.ciphertext.length > 262_144) {
    throw new Error("send too large");
  }
  if (input.maxViews < 1 || input.maxViews > SEND_MAX_VIEWS) {
    throw new Error("invalid maxViews");
  }
  const now = Date.now();
  if (
    input.expiresAtMs <= now + SEND_MIN_EXPIRY_MS - 60_000 ||
    input.expiresAtMs > now + SEND_MAX_EXPIRY_MS + 60_000
  ) {
    throw new Error("invalid expiresAt");
  }

  const payload: Record<string, unknown> = {
    ciphertext: Bytes.fromUint8Array(input.ciphertext),
    expiresAt: Timestamp.fromMillis(input.expiresAtMs),
    maxViews: input.maxViews,
    viewCount: 0,
    createdAt: serverTimestamp(),
  };
  if (input.passwordProtected) payload.passwordProtected = true;

  const ref = await addDoc(collection(db(), "sends"), payload);
  return ref.id;
}

/**
 * Discriminated outcome for a readSend call. The server never returns
 * partial results &mdash; either the viewer got ciphertext and
 * consumed a view, or a definite reason why not.
 */
export type ReadSendResult =
  | {
      kind: "ok";
      ciphertext: Uint8Array;
      /** Views still available AFTER this read (0 means just consumed the last). */
      viewsRemaining: number;
      /** True if this read triggered the server to hard-delete the doc. */
      lastView: boolean;
      passwordProtected: boolean;
    }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "exhausted" };

/**
 * Raw callable payload. The server returns ciphertext as base64 because
 * Firestore Bytes don&rsquo;t round-trip cleanly through the callable JSON
 * channel.
 */
interface CallablePayload {
  kind: "ok" | "not-found" | "expired" | "exhausted";
  ciphertextBase64?: string;
  viewsRemaining?: number;
  lastView?: boolean;
  passwordProtected?: boolean;
}

export async function readSend(id: string): Promise<ReadSendResult> {
  const call = httpsCallable<{ id: string }, CallablePayload>(fn(), "readSend");
  const { data } = await call({ id });
  if (data.kind !== "ok") return { kind: data.kind };
  if (!data.ciphertextBase64) {
    return { kind: "not-found" };
  }
  return {
    kind: "ok",
    ciphertext: fromBase64(data.ciphertextBase64),
    viewsRemaining: data.viewsRemaining ?? 0,
    lastView: !!data.lastView,
    passwordProtected: !!data.passwordProtected,
  };
}
