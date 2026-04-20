/**
 * Derive the Firestore document id for a given human-readable slug.
 *
 * We never store the plaintext slug on the server. The doc id is the SHA-256
 * of an app-scoped prefix concatenated with the slug. An attacker who
 * enumerates Firestore cannot recover slug names without a dictionary attack.
 */
import { utf8Encode, toHex } from "@/lib/utils/bytes";

const APP_PREFIX = "flowvault:v1:";

export async function deriveSiteId(slug: string): Promise<string> {
  const input = utf8Encode(APP_PREFIX + slug.trim().toLowerCase());
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", input as BufferSource),
  );
  return toHex(digest);
}

/**
 * Normalize a slug the same way site ids are derived so client display and
 * routing stay consistent.
 */
export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;

/** Slugs are public-ish URL segments. Keep them ASCII-safe and reasonable. */
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(normalizeSlug(slug));
}
