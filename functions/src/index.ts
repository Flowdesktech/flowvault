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
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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
