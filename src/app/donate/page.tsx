import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import {
  APP_URL,
  GITHUB_URL,
  NOWPAYMENTS_API_KEY_URL,
  NOWPAYMENTS_DONATION_URL,
  NOWPAYMENTS_EMBED_URL,
} from "@/lib/config";
import { Heart, Shield, EyeOff, ExternalLink } from "lucide-react";
import Link from "next/link";

const DONATE_TITLE =
  "Donate to Flowvault — anonymous crypto donations via NOWPayments";
const DONATE_DESCRIPTION =
  "Support Flowvault with a crypto donation in any of 100+ coins (BTC, ETH, LTC, XMR, USDT, SOL and more). Processed by NOWPayments' donation widget — no sign-up, no email required from donors.";

export const metadata: Metadata = {
  title: DONATE_TITLE,
  description: DONATE_DESCRIPTION,
  keywords: [
    "Flowvault donate",
    "crypto donation",
    "NOWPayments donation",
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

export default function DonatePage() {
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
              Donate in 100+ cryptocurrencies. No sign-up, no email
              required from donors.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-background-elev p-6 text-sm leading-relaxed text-muted">
          <p>
            Flowvault doesn&apos;t run ads, sell data, or ask for your email.
            That means the usual ways an app pays for itself aren&apos;t
            available to us &mdash; which is the whole point. Donations cover
            Firebase hosting, domain &amp; TLS, the drand beacon monitoring
            we use for time-locked notes, and continued development.
          </p>
          <p className="mt-3">
            We use{" "}
            <a
              href="https://nowpayments.io"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              NOWPayments
            </a>{" "}
            as the crypto processor. Their donation widget accepts ~100+
            coins, generates a fresh deposit address per donation (so
            later donors can&apos;t correlate addresses across
            contributions), and <Strong>does not require donors to
            create an account or provide an email</Strong>. If you want
            the most private option, send Monero (XMR) &mdash; it hides
            amounts, senders, and receivers at the protocol level.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Pill icon={<Shield size={14} />} text="No donor account" />
            <Pill icon={<EyeOff size={14} />} text="Fresh address each time" />
            <Pill icon={<Heart size={14} />} text="100+ coins" />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Donate</h2>
          <p className="mt-1 text-xs text-muted">
            Pick a coin and an amount. The widget gives you a one-time
            deposit address &mdash; your browser sends funds directly to
            the blockchain from there.
          </p>

          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="w-full shrink-0 sm:w-[346px]">
              <iframe
                src={NOWPAYMENTS_EMBED_URL}
                width="346"
                height="623"
                frameBorder="0"
                scrolling="no"
                title="Flowvault crypto donation widget (NOWPayments)"
                style={{ overflowY: "hidden" }}
                className="mx-auto block rounded-xl border border-border bg-background-elev"
              />
              <p className="mt-2 text-center text-[11px] text-muted">
                Widget not loading? Some ad-blockers filter
                nowpayments.io.
              </p>
            </div>

            <div className="flex-1 space-y-4 text-sm text-muted">
              <div>
                <p className="text-foreground font-medium">
                  Prefer a full-page flow?
                </p>
                <p className="mt-1">
                  Open the donation page in a new tab &mdash; same
                  widget, more room to read it:
                </p>
                <a
                  href={NOWPAYMENTS_DONATION_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
                >
                  Open donation page <ExternalLink size={14} />
                </a>
                <p className="mt-2 text-[11px] text-muted break-all">
                  Short link:{" "}
                  <a
                    href={NOWPAYMENTS_DONATION_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  >
                    {NOWPAYMENTS_DONATION_URL.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              </div>

              <div>
                <p className="text-foreground font-medium">Backup link</p>
                <p className="mt-1">
                  If the vanity link ever goes down, this one goes
                  directly to our donation endpoint:
                </p>
                <p className="mt-1 text-[11px] break-all">
                  <a
                    href={NOWPAYMENTS_API_KEY_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  >
                    {NOWPAYMENTS_API_KEY_URL.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-background-elev p-5 text-sm text-muted">
          <h3 className="text-foreground font-medium">Privacy notes</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <Strong>Donors don&apos;t need an account.</Strong> The
              NOWPayments donation widget lets anyone contribute
              without signing up. Receipts are optional &mdash; only
              required if the donor wants one for themselves.
            </li>
            <li>
              <Strong>
                Fresh addresses per donation
              </Strong>
              . The widget generates a one-time deposit address for
              each session, so two donors looking at the same page see
              different addresses and can&apos;t cross-reference each
              other on-chain.
            </li>
            <li>
              <Strong>We see no donor metadata.</Strong> On our side we
              receive the forwarded funds and aggregate totals &mdash;
              not an IP, email, or identity. You&apos;re free to donate
              through Tor or a VPN; NOWPayments supports both.
            </li>
            <li>
              <Strong>Choose Monero for maximum privacy.</Strong>{" "}
              Bitcoin, Ethereum, Litecoin, USDT, and Solana are{" "}
              <em>pseudonymous</em>: anyone who later learns a donation
              address can trace its history. Monero hides amounts,
              senders, and receivers cryptographically.
            </li>
          </ul>
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
            project real-world as much as a few dollars does. We mean
            that.
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
        Flowvault &middot; part of the Flowdesk family
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
