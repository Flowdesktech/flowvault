/**
 * Firestore read/write for the `timelocks` collection.
 *
 * Data model (zero-knowledge):
 *
 *   timelocks/{capsuleId} {
 *     ciphertext:  bytes       // UTF-8 encoded tlock (age-armored) payload
 *     round:       number      // target drand round
 *     chainHash:   string      // drand chain identifier
 *     createdAt:   Timestamp
 *   }
 *
 * Only the target `round` (and therefore the unlock wall-clock time) is
 * visible to the server &mdash; everything else is cryptographically
 * sealed until drand publishes that round.
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
}

/**
 * Create a new timelock capsule. Returns the generated document id which
 * is used for the public share URL (/t/{id}).
 */
export async function createTimelock(args: {
  ciphertext: string;
  round: number;
  chainHash: string;
}): Promise<string> {
  const bytes = new TextEncoder().encode(args.ciphertext);
  const ref = await addDoc(collection(db(), "timelocks"), {
    ciphertext: Bytes.fromUint8Array(bytes),
    round: args.round,
    chainHash: args.chainHash,
    createdAt: serverTimestamp(),
  });
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
  };
}
