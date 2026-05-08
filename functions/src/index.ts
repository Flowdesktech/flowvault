/**
 * Flowvault Cloud Functions.
 *
 * These are intentionally lean. Almost every operation (create, save,
 * decrypt, configure deadman) happens in the browser against Firestore
 * under zero-knowledge security rules. Functions exist only for things
 * the client cannot do alone.
 *
 *   - deadmanSweep (scheduled): every hour, find sites whose dead-man's
 *     switch has expired (now > lastHeartbeatAt + intervalMs + graceMs)
 *     and mark them released. Only the Admin SDK can set this flag, so
 *     clients can never fake a release.
 *   - readSend (callable): atomically consume one view of an Encrypted
 *     Send note. Returns the opaque ciphertext (base64) when a view is
 *     available; hard-deletes the document on the final view. Clients
 *     cannot read `sends/{id}` directly (security rules deny it), so
 *     this function is the only path to the bytes.
 *   - sendsSweep (scheduled): every hour, delete any send whose
 *     expiresAt has passed. Belt-and-suspenders next to Firestore TTL.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { createHash } from "node:crypto";

initializeApp();
const db = getFirestore();
const bucket = () => getStorage().bucket();

/** Hard cap on retention for File Send (7 days). Mirrors the rules. */
const FILE_SEND_MAX_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
/** Lifetime of a download URL surfaced to the recipient. */
const FILE_SEND_DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

/**
 * Mark expired vaults as released. Runs hourly. Cheap: only iterates over
 * sites where a deadman is configured and not yet released. The check
 * (`deadman.lastHeartbeatAt + intervalMs + graceMs <= now`) cannot be
 * expressed in a single Firestore query, so we filter in JS after fetching
 * the candidates.
 *
 * Released vaults get `deadman.released = true` and `deadman.releasedAt`,
 * after which the security rules forbid any further deadman writes by the
 * client. The wrapped key already lived in the document; the beneficiary
 * password is what gates decryption, not access to the document.
 */
export const deadmanSweep = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1" },
  async () => {
    const now = Date.now();
    const qs = await db
      .collection("sites")
      .where("deadman.released", "==", false)
      .get();

    if (qs.empty) {
      logger.info("deadmanSweep: no armed vaults");
      return;
    }

    const batch = db.batch();
    let released = 0;
    qs.forEach((doc) => {
      const dm = doc.data().deadman;
      if (!dm) return;
      const last = dm.lastHeartbeatAt?.toMillis?.() ?? 0;
      const interval = dm.intervalMs ?? 0;
      const grace = dm.graceMs ?? 0;
      if (last && last + interval + grace <= now) {
        batch.update(doc.ref, {
          "deadman.released": true,
          "deadman.releasedAt": FieldValue.serverTimestamp(),
        });
        released++;
      }
    });

    if (released > 0) {
      await batch.commit();
      logger.info(`deadmanSweep: released ${released} vault(s)`);
    } else {
      logger.info(`deadmanSweep: scanned ${qs.size}, none expired`);
    }
  },
);

/**
 * Atomically consume one view of a send document. This is the only
 * path clients have to the ciphertext: rules forbid direct reads.
 *
 * Transaction semantics:
 *   1. GET sends/{id}
 *   2. If missing -> { kind: "not-found" }
 *   3. If expiresAt <= now -> { kind: "expired" } (sweep will clean it)
 *   4. If viewCount >= maxViews -> { kind: "exhausted" } (sweep will clean it)
 *   5. Otherwise:
 *        - Load ciphertext bytes
 *        - If this read would reach maxViews: DELETE the document in
 *          the same transaction so the bytes disappear the moment the
 *          last recipient sees them.
 *        - Else: UPDATE viewCount = viewCount + 1
 *      Return { kind: "ok", ciphertextBase64, viewsRemaining, lastView, passwordProtected }
 *
 * No authentication: recipient holds the URL + fragment key (and
 * possibly a password). That&rsquo;s the whole threat model &mdash;
 * auth here would leak metadata (who read what) without adding
 * security.
 */
/**
 * CORS allowlist for the callable. Firebase Functions v2 don&rsquo;t
 * default-allow custom domains &mdash; only the project&rsquo;s own
 * `.web.app` / `.firebaseapp.com` hosts and localhost &mdash; so browser
 * preflights from our real origin get rejected. We list:
 *
 *   - the production custom domain
 *   - the Firebase Hosting domains (useful if we ever fall back to them)
 *   - localhost / 127.0.0.1 for dev
 *   - a regex for Vercel preview deployments (`*.vercel.app`)
 *
 * CORS is a browser-layer control, not a real security boundary here
 * &mdash; anyone who already has the send id plus the URL-fragment key
 * can just call us from curl. The allowlist is hygiene.
 */
/**
 * Normalize a Firestore `bytes` field to a base64 string. The admin
 * Firestore client returns `Buffer` for bytes fields, but the `Bytes`
 * wrapper class is also a valid representation (and is what the web
 * SDK writes with). Accept both, plus `Uint8Array` defensively, so a
 * future SDK change doesn&rsquo;t silently break us again.
 *
 * Returns null for anything we don&rsquo;t recognize so the caller can
 * log and bail instead of throwing.
 */
function toBase64(value: unknown): string | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (typeof (value as { toBase64?: () => string }).toBase64 === "function") {
    return (value as { toBase64: () => string }).toBase64();
  }
  return null;
}

const CALLABLE_CORS: (string | RegExp)[] = [
  "https://useflowvault.com",
  "https://www.useflowvault.com",
  "https://flowvault.flowdesk.tech",
  "https://flowvault-cf9f2.web.app",
  "https://flowvault-cf9f2.firebaseapp.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
];

export const readSend = onCall(
  {
    region: "us-central1",
    cors: CALLABLE_CORS,
    // Keep this tight; the payload is a single id. Anyone who has the
    // id + fragment key is authorized by construction.
    maxInstances: 20,
  },
  async (req): Promise<ReadSendPayload> => {
    const id = typeof req.data?.id === "string" ? req.data.id.trim() : "";
    if (!id || id.length > 64 || !/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new HttpsError("invalid-argument", "id required");
    }

    const ref = db.collection("sends").doc(id);
    const result = await db.runTransaction<ReadSendPayload>(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { kind: "not-found" };
      const data = snap.data()!;

      const expiresAt = data.expiresAt as Timestamp | undefined;
      if (!expiresAt || expiresAt.toMillis() <= Date.now()) {
        // Don't delete inside the transaction when "expired" is the
        // answer; the scheduled sweep handles it. Keeps this path
        // cheap and avoids write cost on most polls.
        return { kind: "expired" };
      }

      const viewCount = (data.viewCount as number) ?? 0;
      const maxViews = (data.maxViews as number) ?? 1;
      if (viewCount >= maxViews) return { kind: "exhausted" };

      // Firestore bytes fields come back as a Node.js `Buffer` in
      // firebase-admin's Firestore client (not the web SDK's `Bytes`
      // class), so `.toBase64()` doesn't exist. Accept either shape and
      // normalize to base64.
      const ciphertextBase64 = toBase64(data.ciphertext);
      if (!ciphertextBase64) {
        // Genuinely unexpected state — something was persisted in a
        // shape we don't recognize. Log just the id prefix (first 6
        // chars out of 20) so we can find the bad doc without
        // indexing every send id in Cloud Logging. Full ids plus
        // timestamps would be a metadata trail inconsistent with the
        // zero-knowledge posture.
        logger.warn(
          `readSend: malformed ciphertext prefix=${id.slice(0, 6)} type=${typeof data.ciphertext}`,
        );
        return { kind: "not-found" };
      }

      const newCount = viewCount + 1;
      const lastView = newCount >= maxViews;
      if (lastView) {
        // The very last read wipes the bytes. Viewer gets them in this
        // response; the document is gone before they finish reading.
        tx.delete(ref);
      } else {
        tx.update(ref, { viewCount: newCount });
      }

      return {
        kind: "ok",
        ciphertextBase64,
        viewsRemaining: maxViews - newCount,
        lastView,
        passwordProtected: !!data.passwordProtected,
      };
    });

    return result;
  },
);

type ReadSendPayload =
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "exhausted" }
  | {
      kind: "ok";
      ciphertextBase64: string;
      viewsRemaining: number;
      lastView: boolean;
      passwordProtected: boolean;
    };

/**
 * Purge expired sends. Firestore&rsquo;s native TTL policy on
 * `expiresAt` will also do this, but TTL is best-effort with up to
 * 24h of delay. This sweep runs hourly so expired notes disappear
 * from the index promptly, and it keeps the system correct even if
 * TTL is misconfigured.
 */
export const sendsSweep = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1" },
  async () => {
    const now = Timestamp.now();
    const qs = await db
      .collection("sends")
      .where("expiresAt", "<=", now)
      .limit(500)
      .get();

    if (qs.empty) {
      logger.info("sendsSweep: nothing expired");
      return;
    }

    const batch = db.batch();
    qs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    logger.info(`sendsSweep: purged ${qs.size} expired send(s)`);
  },
);

/* -----------------------------------------------------------------------
 * File Send
 *
 * Same threat model as Encrypted Send, but for files up to 10 MiB. The
 * ciphertext lives in Cloud Storage (`fileSends/{id}`), the metadata
 * lives in Firestore (`fileSends/{id}`), and the recipient never gets
 * a direct read on either &mdash; they go through `readFileSend`,
 * which atomically consumes a view and returns a short-lived signed
 * URL for the storage object.
 * -------------------------------------------------------------------- */

interface FileSendDoc {
  storagePath: string;
  ciphertextSize: number;
  metadataCiphertext: unknown;
  expiresAt: Timestamp;
  maxViews: number;
  viewCount: number;
  deleteTokenHash: unknown;
  passwordProtected?: boolean;
  passwordSalt?: unknown;
}

type ReadFileSendPayload =
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "exhausted" }
  | {
      kind: "ok";
      downloadUrl: string;
      metadataCiphertextBase64: string;
      ciphertextSize: number;
      passwordProtected: boolean;
      passwordSaltBase64: string | null;
      viewsRemaining: number;
      lastView: boolean;
      expiresAtMs: number;
    };

function validateId(raw: unknown): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || id.length > 64 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new HttpsError("invalid-argument", "id required");
  }
  return id;
}

/**
 * Atomically consume one view of a File Send. Returns a short-lived
 * v4 signed URL to the ciphertext object so the browser can stream
 * the bytes directly from Cloud Storage rather than round-tripping
 * 10&nbsp;MiB through this function&rsquo;s response.
 *
 * On the final view the Firestore doc is deleted in the same
 * transaction, but the storage object is left in place for a short
 * grace window so the in-flight download can complete; the scheduled
 * `fileSendsSweep` purges it on the next tick.
 */
export const readFileSend = onCall(
  {
    region: "us-central1",
    cors: CALLABLE_CORS,
    maxInstances: 20,
  },
  async (req): Promise<ReadFileSendPayload> => {
    const id = validateId(req.data?.id);
    const ref = db.collection("fileSends").doc(id);

    const result = await db.runTransaction<
      | { kind: "not-found" }
      | { kind: "expired" }
      | { kind: "exhausted" }
      | {
          kind: "consume";
          doc: FileSendDoc;
          newCount: number;
          lastView: boolean;
        }
    >(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { kind: "not-found" };
      const data = snap.data() as FileSendDoc;

      if (!data.expiresAt || data.expiresAt.toMillis() <= Date.now()) {
        return { kind: "expired" };
      }

      const viewCount = data.viewCount ?? 0;
      const maxViews = data.maxViews ?? 1;
      if (viewCount >= maxViews) return { kind: "exhausted" };

      const newCount = viewCount + 1;
      const lastView = newCount >= maxViews;
      if (lastView) {
        // Drop the Firestore record now so any further reveal attempt
        // hits "not-found" / "exhausted". The storage object is GC'd
        // by the scheduled sweep after the in-flight signed URL TTL.
        tx.update(ref, {
          viewCount: newCount,
          consumedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(ref, { viewCount: newCount });
      }

      return { kind: "consume", doc: data, newCount, lastView };
    });

    if (result.kind !== "consume") return result;

    const { doc: data, newCount, lastView } = result;

    const metadataCiphertextBase64 = toBase64(data.metadataCiphertext);
    if (!metadataCiphertextBase64) {
      logger.warn(
        `readFileSend: malformed metadataCiphertext prefix=${id.slice(0, 6)}`,
      );
      return { kind: "not-found" };
    }

    let downloadUrl: string;
    try {
      const [signed] = await bucket()
        .file(data.storagePath)
        .getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + FILE_SEND_DOWNLOAD_URL_TTL_MS,
          // Force a download header so curl / browsers don't try to
          // render it inline. The original filename is encrypted, so
          // we use a generic placeholder.
          //
          // Note: do NOT set `contentType` here. v4 signed URLs treat
          // it as a required signed *request* header, which the
          // browser's plain `fetch()` GET won't send — leading to a
          // "MalformedSecurityHeader" 400. `responseDisposition`
          // travels as a query parameter (response-content-disposition)
          // and doesn't have that constraint.
          responseDisposition:
            'attachment; filename="flowvault-encrypted.bin"',
        });
      downloadUrl = signed;
    } catch (err) {
      // The single most common failure here is the runtime service
      // account lacking `roles/iam.serviceAccountTokenCreator` on
      // itself — getSignedUrl falls through to signBlob, which 403s.
      // Surface the underlying error message so the operator can
      // tell `signBlob denied` from a transient Storage outage in
      // a single log line, without flipping on debug logging.
      const msg = err instanceof Error ? err.message : String(err);
      const isPermission =
        /signBlob|iam\.serviceAccounts/i.test(msg);
      logger.error(
        `readFileSend: signed URL generation failed (${
          isPermission
            ? "missing roles/iam.serviceAccountTokenCreator on the runtime SA"
            : "unknown"
        }): ${msg}`,
      );
      throw new HttpsError(
        "internal",
        isPermission
          ? "download URL signing not configured"
          : "could not issue download URL",
      );
    }

    const passwordSaltBase64 = data.passwordProtected
      ? toBase64(data.passwordSalt)
      : null;

    return {
      kind: "ok",
      downloadUrl,
      metadataCiphertextBase64,
      ciphertextSize: data.ciphertextSize ?? 0,
      passwordProtected: !!data.passwordProtected,
      passwordSaltBase64,
      viewsRemaining: Math.max(0, (data.maxViews ?? 1) - newCount),
      lastView,
      expiresAtMs: data.expiresAt.toMillis(),
    };
  },
);

type DeleteFileSendPayload =
  | { kind: "ok" }
  | { kind: "not-found" }
  | { kind: "forbidden" };

/**
 * Authorize and execute a secure delete. The sender keeps the raw
 * delete token in the URL fragment of the secure delete link; we
 * stored only its SHA-256 at create time. Comparing the digest is a
 * constant-time-ish check against forgery without ever trusting the
 * client to assert ownership.
 */
export const deleteFileSend = onCall(
  {
    region: "us-central1",
    cors: CALLABLE_CORS,
    maxInstances: 20,
  },
  async (req): Promise<DeleteFileSendPayload> => {
    const id = validateId(req.data?.id);
    const tokenRaw =
      typeof req.data?.deleteToken === "string" ? req.data.deleteToken : "";
    if (!tokenRaw || tokenRaw.length > 128) {
      throw new HttpsError("invalid-argument", "deleteToken required");
    }

    const tokenBytes = decodeBase64Url(tokenRaw);
    if (!tokenBytes || tokenBytes.length !== 32) {
      throw new HttpsError("invalid-argument", "invalid deleteToken");
    }
    const providedHash = createHash("sha256").update(tokenBytes).digest();

    const ref = db.collection("fileSends").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { kind: "not-found" };
    const data = snap.data() as FileSendDoc;

    const storedHash = toBuffer(data.deleteTokenHash);
    if (!storedHash || storedHash.length !== providedHash.length) {
      return { kind: "forbidden" };
    }
    if (!timingSafeEqual(storedHash, providedHash)) {
      return { kind: "forbidden" };
    }

    // Delete the storage object first. If that fails we still want the
    // Firestore doc gone so subsequent reads return "not-found"; the
    // sweep will clean any orphan storage object later.
    if (data.storagePath) {
      try {
        await bucket().file(data.storagePath).delete({ ignoreNotFound: true });
      } catch (err) {
        logger.warn(
          `deleteFileSend: storage delete failed prefix=${id.slice(0, 6)}`,
          err,
        );
      }
    }
    await ref.delete();
    return { kind: "ok" };
  },
);

/**
 * Hourly sweep over `fileSends`. Cleans up:
 *
 *   1. Documents whose `expiresAt` has passed (delete doc + object).
 *   2. Documents flagged consumed (`consumedAt` older than the
 *      download URL TTL + a small buffer): the recipient's signed URL
 *      has long since lapsed, so the storage object is safe to drop.
 *   3. Storage objects that have no matching Firestore document and
 *      are older than the maximum allowed retention &mdash; defensive
 *      cleanup for failed creates.
 */
export const fileSendsSweep = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1" },
  async () => {
    const now = Date.now();
    const expiredCutoff = Timestamp.now();
    const consumedCutoff = Timestamp.fromMillis(
      now - FILE_SEND_DOWNLOAD_URL_TTL_MS - 60_000,
    );

    let totalDeleted = 0;

    const expired = await db
      .collection("fileSends")
      .where("expiresAt", "<=", expiredCutoff)
      .limit(200)
      .get();
    for (const docSnap of expired.docs) {
      const data = docSnap.data() as FileSendDoc;
      if (data.storagePath) {
        await bucket()
          .file(data.storagePath)
          .delete({ ignoreNotFound: true })
          .catch((err) =>
            logger.warn("fileSendsSweep: object delete failed", err),
          );
      }
      await docSnap.ref.delete();
      totalDeleted++;
    }

    const consumed = await db
      .collection("fileSends")
      .where("consumedAt", "<=", consumedCutoff)
      .limit(200)
      .get();
    for (const docSnap of consumed.docs) {
      const data = docSnap.data() as FileSendDoc;
      if (data.storagePath) {
        await bucket()
          .file(data.storagePath)
          .delete({ ignoreNotFound: true })
          .catch((err) =>
            logger.warn("fileSendsSweep: object delete failed", err),
          );
      }
      await docSnap.ref.delete();
      totalDeleted++;
    }

    // Orphan-object sweep: any storage object older than the maximum
    // retention with no Firestore companion is safe to delete. We cap
    // the listing each tick to keep the function bounded.
    const orphanCutoffMs = now - FILE_SEND_MAX_EXPIRY_MS - 60 * 60_000;
    let orphans = 0;
    try {
      const [files] = await bucket().getFiles({
        prefix: "fileSends/",
        maxResults: 500,
      });
      for (const f of files) {
        const meta = f.metadata as { timeCreated?: string };
        const createdAt = meta?.timeCreated
          ? Date.parse(meta.timeCreated)
          : NaN;
        if (!Number.isFinite(createdAt)) continue;
        if (createdAt > orphanCutoffMs) continue;
        const id = f.name.split("/")[1];
        if (!id) continue;
        const docSnap = await db.collection("fileSends").doc(id).get();
        if (docSnap.exists) continue;
        await f.delete({ ignoreNotFound: true }).catch(() => undefined);
        orphans++;
      }
    } catch (err) {
      logger.warn("fileSendsSweep: orphan scan failed", err);
    }

    if (totalDeleted > 0 || orphans > 0) {
      logger.info(
        `fileSendsSweep: purged ${totalDeleted} doc(s) and ${orphans} orphan object(s)`,
      );
    } else {
      logger.info("fileSendsSweep: nothing to do");
    }
  },
);

function toBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof (value as { toUint8Array?: () => Uint8Array }).toUint8Array ===
      "function") {
    return Buffer.from(
      (value as { toUint8Array: () => Uint8Array }).toUint8Array(),
    );
  }
  if (typeof (value as { toBase64?: () => string }).toBase64 === "function") {
    return Buffer.from(
      (value as { toBase64: () => string }).toBase64(),
      "base64",
    );
  }
  return null;
}

function decodeBase64Url(s: string): Uint8Array | null {
  try {
    const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));
    return new Uint8Array(Buffer.from(padded, "base64"));
  } catch {
    return null;
  }
}

function timingSafeEqual(a: Buffer, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
