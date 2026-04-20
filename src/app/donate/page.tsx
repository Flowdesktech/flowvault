import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { APP_URL, DONATE_ADDRESSES, GITHUB_URL } from "@/lib/config";
import { AddressCard } from "@/components/donate/AddressCard";
import { Heart, Shield, EyeOff } from "lucide-react";
import Link from "next/link";

const DONATE_TITLE =
  "Donate to Flowvault — direct crypto, no email, no middleman";
const DONATE_DESCRIPTION =
  "Support Flowvault with a direct Bitcoin, Monero, Ethereum, Litecoin, USDT, or Solana donation. No middleman, no email, no receipts — consistent with how everything else here works.";

export const metadata: Metadata = {
  title: DONATE_TITLE,
  description: DONATE_DESCRIPTION,
  keywords: [
    "Flowvault donate",
    "crypto donation",
    "Monero donation",
    "Bitcoin donation",
    "privacy-respecting donation",
  ],
  alternates: { canonical: "/donate" },
  openGraph: {
    type: "website",
    url: `${APP_URL}/donate`,
    title: DONATE_TITLE,
    description: DONATE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DONATE_TITLE,
    description: DONATE_DESCRIPTION,
  },
};

interface CoinMeta {
  key: keyof typeof DONATE_ADDRESSES;
  name: string;
  symbol: string;
  /** Network / chain note for coins that exist on multiple chains. */
  chain?: string;
  /** Optional highlight (we tag Monero as the max-privacy option). */
  accent?: string;
}

const COINS: CoinMeta[] = [
  {
    key: "xmr",
    name: "Monero",
    symbol: "XMR",
    chain: "Monero mainnet",
    accent: "Most private option",
  },
  { key: "btc", name: "Bitcoin", symbol: "BTC", chain: "Bitcoin mainnet" },
  { key: "eth", name: "Ethereum", symbol: "ETH", chain: "Ethereum mainnet" },
  { key: "ltc", name: "Litecoin", symbol: "LTC", chain: "Litecoin mainnet" },
  {
    key: "usdt_trc20",
    name: "Tether",
    symbol: "USDT",
    chain: "TRC-20 (Tron) — low fees",
  },
  {
    key: "usdt_erc20",
    name: "Tether",
    symbol: "USDT",
    chain: "ERC-20 (Ethereum)",
  },
  { key: "sol", name: "Solana", symbol: "SOL", chain: "Solana mainnet" },
];

export default function DonatePage() {
  const available = COINS.filter((c) => DONATE_ADDRESSES[c.key]);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <Heart size={22} />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Support Flowvault
            </h1>
            <p className="mt-2 text-muted">
              Directly to a wallet. No middleman, no email, no receipts.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-background-elev p-6 text-sm leading-relaxed text-muted">
          <p>
            Flowvault doesn&apos;t run ads, sell data, or ask for your email.
            That means the usual ways an app pays for itself aren&apos;t
            available to us &mdash; which is the whole point. Donations cover
            Firebase hosting, domain &amp; TLS, the drand beacon monitoring we
            use for time-locked notes, and continued development.
          </p>
          <p className="mt-3">
            We deliberately <Strong>do not use payment gateways</Strong> like
            Plisio or NOWPayments, because even their &ldquo;crypto&rdquo;
            flows usually ask donors for an email for a receipt. That would
            contradict the rest of Flowvault. Instead, the addresses below
            are raw wallets we control, displayed statically. Your browser
            talks directly to the blockchain &mdash; nobody at Flowvault
            learns anything about you.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Pill icon={<Shield size={14} />} text="No email" />
            <Pill icon={<EyeOff size={14} />} text="No middleman" />
            <Pill icon={<Heart size={14} />} text="No receipts" />
          </div>
        </section>

        {available.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="mt-10 space-y-4">
            <h2 className="text-lg font-semibold">Wallet addresses</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {available.map((coin) => (
                <AddressCard
                  key={`${coin.key}`}
                  name={coin.name}
                  symbol={coin.symbol}
                  chain={coin.chain}
                  accent={coin.accent}
                  address={DONATE_ADDRESSES[coin.key]}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-border bg-background-elev p-5 text-sm text-muted">
          <h3 className="text-foreground font-medium">
            A note on Monero vs everything else
          </h3>
          <p className="mt-2">
            Bitcoin, Ethereum, Litecoin, USDT, and Solana are all
            pseudonymous: anyone who later learns the donation address can
            see the full history of donations to it. Monero is different
            &mdash; by design, the amount, sender, and receiver of an XMR
            transaction are cryptographically hidden. If you want the most
            private way to donate, choose Monero.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-background-elev p-5 text-sm text-muted">
          <h3 className="text-foreground font-medium">
            Can&apos;t or don&apos;t want to donate?
          </h3>
          <p className="mt-2">
            Honestly, no pressure. Using Flowvault, telling a friend who
            needs it,{" "}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              starring the repo
            </a>
            , filing a thoughtful issue, or sending a PR all help the
            project real-world as much as a few dollars does. We mean that.
          </p>
          <p className="mt-3">
            And thank you, either way.{" "}
            <Link href="/" className="text-accent hover:underline">
              Back to the app
            </Link>
            .
          </p>
        </section>
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        Flowvault · part of the Flowdesk family
      </footer>
    </>
  );
}

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background-elev-2 px-3 py-2 text-xs font-medium text-foreground">
      <span className="text-accent">{icon}</span>
      {text}
    </span>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-foreground">{children}</strong>;
}

function EmptyState() {
  return (
    <section className="mt-10 rounded-2xl border border-dashed border-border bg-background-elev p-6 text-sm text-muted">
      <p className="text-foreground font-medium">
        Donation addresses not yet configured
      </p>
      <p className="mt-2">
        The site operator hasn&apos;t set any wallet addresses in{" "}
        <code className="rounded bg-background-elev-2 px-1.5 py-0.5 text-xs">
          .env.local
        </code>{" "}
        yet. If this is your own deployment, set one or more of:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-background-elev-2 p-3 text-[11px] text-foreground">
{`NEXT_PUBLIC_BTC_ADDRESS=...
NEXT_PUBLIC_ETH_ADDRESS=...
NEXT_PUBLIC_LTC_ADDRESS=...
NEXT_PUBLIC_XMR_ADDRESS=...
NEXT_PUBLIC_USDT_TRC20_ADDRESS=...
NEXT_PUBLIC_USDT_ERC20_ADDRESS=...
NEXT_PUBLIC_SOL_ADDRESS=...`}
      </pre>
    </section>
  );
}
