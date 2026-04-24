/**
 * Shared demo-vault constants.
 *
 * The `/s/demo` vault is a public walkthrough with known credentials
 * (CorrectPassword / DecoyPassword) that anyone can open to see the
 * hidden-volume design work end-to-end. It is deliberately read-only
 * on the server so that random visitors cannot vandalise it.
 *
 * Enforcement is defense-in-depth:
 *
 *   1. Firestore security rules reject writes at the demo doc id,
 *      regardless of who is authenticated and what the client does.
 *      That is the only layer that actually matters for safety.
 *   2. The Editor checks `isDemoSlug(slug)` and short-circuits every
 *      save path, so users never see a mysterious 403 from Firestore
 *      and saved-state indicators stay honest.
 *
 * The demo ciphertext was seeded once manually (before the rules were
 * tightened). If the canonical content ever needs to change, temporarily
 * relax the demo guard in `firestore.rules`, re-seed via the normal
 * client flow, then restore the guard.
 *
 * Add more slugs here if we launch a second demo. Keep the list tiny;
 * every entry is a public surface.
 */

/**
 * Slugs that the rest of the app treats as read-only walkthrough
 * vaults. Compared case-insensitively, same normalisation the
 * server-side doc-id derivation does.
 */
export const DEMO_SLUGS = new Set<string>(["demo"]);

/**
 * True when a slug names a demo vault. Accepts a possibly-null slug
 * because BYOS (local-file) vaults have no slug and are never demos.
 */
export function isDemoSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return DEMO_SLUGS.has(slug.trim().toLowerCase());
}

/**
 * Canonical credentials for the public demo. Displayed on the
 * landing page and in the FAQ; duplicated here so any future code
 * that needs to render them (release notes, docs, onboarding copy)
 * imports from a single source of truth instead of hard-coding
 * strings.
 */
export const DEMO_CREDENTIALS = {
  slug: "demo",
  realPassword: "CorrectPassword",
  decoyPassword: "DecoyPassword",
} as const;
