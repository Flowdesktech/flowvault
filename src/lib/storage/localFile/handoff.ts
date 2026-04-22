/**
 * In-memory handoff between the home-page "Open / Create local vault"
 * action and the `/local/[localSiteId]` route that hosts the editor.
 *
 * The File System Access API hands us back a `FileSystemFileHandle`
 * that is structured-cloneable into IndexedDB, but is NOT something
 * we want to put in the URL or pull through a server component. A
 * Next.js client-side `router.push("/local/<id>")` call preserves the
 * JS heap, so a simple module-scoped Map is the right vehicle: the
 * picker handler stashes the handle (and, for the create flow, the
 * already-decrypted `OpenResult`) keyed by the newly-minted siteId,
 * and the target route calls `takeLocalVaultHandoff(siteId)` on mount.
 *
 * Lifetime: the Map is wiped on a full page reload, which is the
 * right behavior. A user who reloads `/local/<id>` should re-recall
 * the handle from IndexedDB and re-enter the password, rather than
 * silently reusing a stale in-memory handoff.
 *
 * We deliberately do NOT keep stashed entries alive across
 * navigations: `take` is a pop. If the route never renders (user hit
 * back before the push completed), the entry will be garbage-collected
 * with the Map once the tab closes, which is fine.
 */
import type { OpenResult } from "@/lib/vault/service";

export interface LocalVaultHandoff {
  handle: FileSystemFileHandle;
  /**
   * Set only by the create flow, where the home page has already
   * decrypted the fresh vault and just needs the route to install it.
   * The open-existing flow leaves this unset so the route prompts for
   * a password.
   */
  opened?: OpenResult;
}

const pending = new Map<string, LocalVaultHandoff>();

/** Stash a handoff under `siteId`. Replaces any prior entry for the same id. */
export function stashLocalVaultHandoff(
  siteId: string,
  payload: LocalVaultHandoff,
): void {
  pending.set(siteId, payload);
}

/** Pop the stashed handoff for `siteId`. Returns `null` if none was set. */
export function takeLocalVaultHandoff(
  siteId: string,
): LocalVaultHandoff | null {
  const v = pending.get(siteId);
  if (!v) return null;
  pending.delete(siteId);
  return v;
}
