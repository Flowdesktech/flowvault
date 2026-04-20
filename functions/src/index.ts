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
import { logger } from "firebase-functions/v2";

initializeApp();
const db = getFirestore();

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
const CALLABLE_CORS: (string | RegExp)[] = [
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
      if (!snap.exists) {
        // Log the id so the operator can grep Cloud Functions logs and
        // cross-reference with Firestore. If the write actually
        // committed, the doc should be visible in the console at
        // sends/{id}. If it isn't, the likely causes are: (a) stale
        // security rules that denied the create, (b) the sender wrote
        // to a different Firebase project, or (c) the URL was
        // truncated by the share channel.
        logger.info(`readSend: not-found id=${id}`);
        return { kind: "not-found" };
      }
      const data = snap.data()!;

      const expiresAt = data.expiresAt as Timestamp | undefined;
      if (!expiresAt || expiresAt.toMillis() <= Date.now()) {
        // Don't delete inside the transaction when "expired" is the
        // answer; the scheduled sweep handles it. Keeps this path
        // cheap and avoids write cost on most polls.
        logger.info(`readSend: expired id=${id}`);
        return { kind: "expired" };
      }

      const viewCount = (data.viewCount as number) ?? 0;
      const maxViews = (data.maxViews as number) ?? 1;
      if (viewCount >= maxViews) {
        logger.info(`readSend: exhausted id=${id} views=${viewCount}/${maxViews}`);
        return { kind: "exhausted" };
      }

      const ciphertext = data.ciphertext;
      if (!ciphertext || typeof ciphertext.toBase64 !== "function") {
        logger.warn(`readSend: malformed ciphertext on ${id}`);
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
        ciphertextBase64: ciphertext.toBase64() as string,
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
