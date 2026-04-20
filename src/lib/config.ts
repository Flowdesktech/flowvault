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
 * Wallet addresses for direct crypto donations. We intentionally do NOT use
 * a payment gateway (Plisio, NOWPayments, CoinGate, etc.) because those
 * services collect a donor email or IP for receipts, which contradicts the
 * rest of Flowvault's privacy model. Direct addresses mean zero middleman,
 * zero metadata.
 *
 * Leave an env var empty (or unset) to hide that coin on the donate page.
 */
export const DONATE_ADDRESSES = {
  btc: process.env.NEXT_PUBLIC_BTC_ADDRESS ?? "",
  eth: process.env.NEXT_PUBLIC_ETH_ADDRESS ?? "",
  ltc: process.env.NEXT_PUBLIC_LTC_ADDRESS ?? "",
  xmr: process.env.NEXT_PUBLIC_XMR_ADDRESS ?? "",
  usdt_trc20: process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS ?? "",
  usdt_erc20: process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS ?? "",
  sol: process.env.NEXT_PUBLIC_SOL_ADDRESS ?? "",
} as const;

/** Path to the on-site donate page. */
export const DONATE_PATH = "/donate";
