/**
 * Firestore read/write for the `timelocks` collection.
 *
 * Data model (zero-knowledge):
 *
 *   timelocks/{capsuleId} {
 *     ciphertext:         bytes       // UTF-8 encoded tlock (age-armored) payload
 *     round:              number      // target drand round
 *     chainHash:          string      // drand chain identifier
 *     createdAt:          Timestamp
 *     passwordProtected?: bool        // present+true iff an inner password
 *                                     // layer wraps the time-locked payload
 *   }
 *
 * Only the target `round` (and therefore the unlock wall-clock time) and
 * whether a password layer exists are visible to the server &mdash;
 * everything else is cryptographically sealed until drand publishes that
 * round. The `passwordProtected` flag is a UX hint only; the viewer also
 * detects the inner layer cryptographically after tlock-decrypt, so
 * forging or omitting the hint cannot bypass the password.
 */
import {
  Bytes,
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./client";

export interface TimelockRecord {
  id: string;
  /** UTF-8 decoded tlock-age ciphertext. */
  ciphertext: string;
  round: number;
  chainHash: string;
  createdAt: Timestamp | null;
  passwordProtected: boolean;
}

/**
 * Create a new timelock capsule. Returns the generated document id which
 * is used for the public share URL (/t/{id}).
 */
export async function createTimelock(args: {
  ciphertext: string;
  round: number;
  chainHash: string;
  passwordProtected?: boolean;
}): Promise<string> {
  const bytes = new TextEncoder().encode(args.ciphertext);
  const payload: Record<string, unknown> = {
    ciphertext: Bytes.fromUint8Array(bytes),
    round: args.round,
    chainHash: args.chainHash,
    createdAt: serverTimestamp(),
  };
  if (args.passwordProtected) payload.passwordProtected = true;
  const ref = await addDoc(collection(db(), "timelocks"), payload);
  return ref.id;
}

/**
 * Fetch a capsule by id. Returns null if it doesn&apos;t exist so the UI
 * can render a friendly &ldquo;not found&rdquo; state.
 */
export async function fetchTimelock(id: string): Promise<TimelockRecord | null> {
  const snap = await getDoc(doc(db(), "timelocks", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  const ct = data.ciphertext as Bytes | undefined;
  if (!ct) return null;
  return {
    id: snap.id,
    ciphertext: new TextDecoder().decode(ct.toUint8Array()),
    round: Number(data.round),
    chainHash: String(data.chainHash ?? ""),
    createdAt: (data.createdAt as Timestamp) ?? null,
    passwordProtected: data.passwordProtected === true,
  };
}
