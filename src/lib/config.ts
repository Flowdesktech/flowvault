/**
 * Runtime configuration constants, read from NEXT_PUBLIC_* env vars.
 *
 * These are embedded in the client bundle at build time. None are secrets;
 * they are public URLs, public addresses, or feature flags.
 */

/**
 * Read an env var, treating both `undefined` and an empty string the
 * same way (fall back to the default).
 *
 * `??` only falls back on null/undefined, which bites on Vercel: it's
 * common for a project to have `NEXT_PUBLIC_FOO` defined but set to an
 * empty string. That would otherwise let an empty value sneak into
 * places like `new URL(APP_URL)` and crash the build with
 * `TypeError: Invalid URL` at `_not-found` configuration collection.
 */
function envOr(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : fallback;
}

/** Canonical app origin (used for OG metadata, sitemap, share URLs). */
export const APP_URL = envOr(
  process.env.NEXT_PUBLIC_APP_URL,
  "https://flowvault.flowdesk.tech",
);

/** Hostname shown in the slug picker, e.g. "flowvault.flowdesk.tech/s/...". */
export const APP_HOST = APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const GITHUB_URL = envOr(
  process.env.NEXT_PUBLIC_GITHUB_URL,
  "https://github.com/Flowdesktech/flowvault",
);

/**
 * Public contact address for hire / business-idea / partnership inquiries.
 * Shown in the top banner and on the donate / about pages.
 */
export const CONTACT_EMAIL = envOr(
  process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  "contact@flowdesk.tech",
);

/**
 * NOWPayments donation configuration.
 *
 * We accept donations through NOWPayments' donation widget rather than
 * maintaining raw wallet addresses per-coin: the widget lets donors
 * pick from ~100+ coins, generates a fresh address per donation (so
 * past donors can't correlate addresses), and does not require a donor
 * email. Neither the `api_key` nor the vanity slug are secrets &mdash;
 * both are embedded publicly by design on the donate page.
 *
 * `NEXT_PUBLIC_NOWPAYMENTS_API_KEY` drives the iframe widget; the
 * vanity URL (`NEXT_PUBLIC_NOWPAYMENTS_DONATION_URL`) gives donors a
 * nicer shareable "open in new tab" link.
 */
export const NOWPAYMENTS_API_KEY = envOr(
  process.env.NEXT_PUBLIC_NOWPAYMENTS_API_KEY,
  "d1809dbe-265d-44fc-af65-16cce1b7186b",
);

export const NOWPAYMENTS_DONATION_URL = envOr(
  process.env.NEXT_PUBLIC_NOWPAYMENTS_DONATION_URL,
  "https://nowpayments.io/donation/flowdesktech",
);

/**
 * Fallback URL to NOWPayments' generic (api_key-based) donation page.
 * Used when a vanity slug isn't configured, or as a backup "open in
 * new tab" link alongside the vanity one.
 */
export const NOWPAYMENTS_API_KEY_URL = `https://nowpayments.io/donation?api_key=${NOWPAYMENTS_API_KEY}`;

/** Source URL for the embedded donation-widget iframe. */
export const NOWPAYMENTS_EMBED_URL = `https://nowpayments.io/embeds/donation-widget?api_key=${NOWPAYMENTS_API_KEY}`;

/** Path to the on-site donate page. */
export const DONATE_PATH = "/donate";
