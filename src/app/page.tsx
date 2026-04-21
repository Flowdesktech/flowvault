import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { OpenVaultForm } from "@/components/OpenVaultForm";
import { APP_URL, CONTACT_EMAIL, DONATE_PATH, GITHUB_URL } from "@/lib/config";
import {
  ShieldCheck,
  Eye,
  Clock,
  KeyRound,
  Lock,
  CircleDollarSign,
  Code2,
  Gauge,
  EyeOff,
  FileLock2,
  Layers,
  Check,
  X,
  Bitcoin,
  Heart,
  Send,
  Notebook,
  Download,
} from "lucide-react";

/**
 * schema.org payloads injected as JSON-LD on the home page.
 *
 * Google uses these to surface a sitelinks search box, an Organization
 * knowledge panel, and rich results for a SoftwareApplication. We keep
 * them in sync with the actual app by sourcing URLs from `config.ts`.
 */
const HOMEPAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "Flowvault",
      url: APP_URL,
      logo: `${APP_URL}/icon.svg`,
      email: CONTACT_EMAIL,
      sameAs: [GITHUB_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "Flowvault",
      description:
        "Zero-knowledge encrypted notepad with plausible deniability, a trusted handover to a beneficiary, drand-backed time-locked notes, self-destructing Encrypted Send, and .fvault encrypted backup & restore.",
      publisher: { "@id": `${APP_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "Flowvault",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      url: APP_URL,
      description:
        "An open-source zero-knowledge encrypted online notepad. Argon2id + AES-256-GCM, plausible-deniability hidden volumes, multi-notebook tabs per password, a client-wrapped trusted handover that releases the vault to a beneficiary if you stop checking in, drand-backed time-locked notes, self-destructing Encrypted Send, and a .fvault encrypted backup format that round-trips every slot without decrypting anything server-side.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Client-side Argon2id key derivation",
        "AES-256-GCM authenticated encryption",
        "Plausible-deniability hidden-volume format",
        "Multi-notebook tabs per password (all inside one encrypted slot)",
        "Client-wrapped trusted handover that releases to a beneficiary if you stop checking in",
        "Drand-backed time-locked notes",
        "Encrypted Send: self-destructing, view-capped one-time notes",
        "Zero-knowledge .fvault backup and restore (migrate or self-host without decrypting server-side)",
        "Plaintext Markdown (.zip) export for the current slot",
        "No account required",
        "Open source (frontend + Cloud Functions + Firestore rules)",
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <section className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background-elev px-3 py-1 text-xs text-muted">
            Zero-knowledge · No account · Open from the frontend down to the
            Firestore rules
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Notes you can deny you have.
          </h1>
          <p className="mt-4 text-base text-muted sm:text-lg">
            An encrypted online notepad where one URL can hide many
            notebooks behind different passwords. Even we can&apos;t tell
            how many you have, or whether you have any. The closest thing
            to a deniable scratchpad you can open in any browser without
            installing anything.
          </p>

          <div className="mt-10">
            <OpenVaultForm />
          </div>

          <p className="mt-3 text-xs text-muted">
            No account. No email. Your password is your only key &mdash; we
            never see it.{" "}
            <Link
              href="/faq"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              How does this compare to ProtectedText, Standard Notes,
              CryptPad, Privnote?
            </Link>
          </p>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<ShieldCheck size={18} />}
            title="Plausible deniability"
            body="Multiple passwords unlock different notebooks on the same URL. Decoys are cryptographically indistinguishable from random data."
          />
          <Feature
            icon={<Eye size={18} />}
            title="We see nothing"
            body="Your password never leaves your browser. The server only stores opaque ciphertext plus your Argon2id salt."
          />
          <Feature
            icon={<Clock size={18} />}
            title="Trusted handover"
            body="Pick a beneficiary and a check-in cadence. If you go quiet past the interval, a hand-wrapped key unlocks the vault for them — and nobody sooner."
          />
          <Feature
            icon={<Clock size={18} />}
            title="Time-locked notes"
            body={
              <>
                Encrypt a message to a future moment. Nobody &mdash; not
                even us &mdash; can read it before the drand beacon
                publishes the unlock round. Optional password gate for
                when the link might travel through untrusted channels.
              </>
            }
            href="/timelock/new"
            ctaLabel="Lock a message"
          />
          <Feature
            icon={<Notebook size={18} />}
            title="Multi-notebook tabs"
            body={
              <>
                One password unlocks a whole workspace, not a single
                page. Add tabs, rename them, reorder them. Every tab
                lives inside the same encrypted slot, so titles and
                content are just as zero-knowledge as the notes
                themselves. Decoy passwords get their own independent
                tab set in their own slot.
              </>
            }
          />
          <Feature
            icon={<Send size={18} />}
            title="Encrypted Send"
            body={
              <>
                One-shot notes that self-destruct after opening. Share a
                password, API key, or recovery phrase through a link that
                vanishes after the recipient reads it &mdash; or after
                an expiry you pick. The AES-256 key lives in the URL
                fragment, so our servers literally cannot decrypt it.
              </>
            }
            href="/send/new"
            ctaLabel="Send a secret"
          />
          <Feature
            icon={<Download size={18} />}
            title="Encrypted backup & restore"
            body={
              <>
                Download a vault as a single <code>.fvault</code>{" "}
                file &mdash; opaque ciphertext plus KDF parameters,
                no passwords inside. Restore on any Flowvault instance
                (including a self-hosted one) at a fresh URL and every
                slot, including decoys, comes back intact. A plaintext
                Markdown export is available too, behind a
                confirmation, for migrating out.
              </>
            }
            href="/restore"
            ctaLabel="Restore from backup"
          />
          <Feature
            icon={<Code2 size={18} />}
            title="Fully open source"
            body="Frontend, Cloud Functions, Firestore rules, and deployment config are all in the public repo. Audit every line that touches your data — or self-host the entire stack."
          />
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Why Flowvault instead of ProtectedText?
            </h2>
            <p className="mt-3 text-muted">
              Flowvault isn&apos;t just a rebuild &mdash; it&apos;s a
              deliberate upgrade on almost every dimension that matters for a
              zero-knowledge notepad.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Reason
              icon={<KeyRound size={16} />}
              title="Memory-hard password hashing"
              body="Argon2id with 64 MiB of memory and 3 iterations per guess — the winner of the Password Hashing Competition and the OWASP-recommended default. ProtectedText today also uses Argon2id (32 MiB), but every save still uploads a parallel legacy blob keyed only by the raw password — bypassing Argon2 entirely if their database is ever stolen."
            />
            <Reason
              icon={<Lock size={16} />}
              title="Authenticated encryption"
              body="AES-256-GCM detects any tampering with your ciphertext. ProtectedText-style AES-CBC is malleable: bitflips in the blob go undetected."
            />
            <Reason
              icon={<EyeOff size={16} />}
              title="Hidden volumes"
              body="The killer feature. Hand over a decoy password under coercion and your real notebook stays invisible. No competing web notepad does this."
            />
            <Reason
              icon={<Notebook size={16} />}
              title="Multi-notebook tabs per password"
              body="A password isn't one page — it's a whole workspace. Add tabs, rename, reorder, delete. Titles and contents are encrypted together inside the slot, so the tab list is as zero-knowledge as the notes. Decoy passwords unlock their own independent tab sets."
            />
            <Reason
              icon={<Layers size={16} />}
              title="Fixed-size ciphertext"
              body="Every Flowvault blob is exactly the same size no matter how much you write, so the server can't tell heavy users from light ones or count notebooks."
            />
            <Reason
              icon={<Gauge size={16} />}
              title="Optimistic concurrency"
              body="Edit in two tabs without losing work. Every write is CAS-protected by a version counter, so stale writes are rejected instead of clobbering fresh ones."
            />
            <Reason
              icon={<FileLock2 size={16} />}
              title="Upgradable KDF"
              body="Argon2 parameters are stored inside the vault, so we can raise the cost as hardware improves without breaking any existing vaults."
            />
            <Reason
              icon={<Code2 size={16} />}
              title="Open source, end to end"
              body="Not just the frontend — the Cloud Functions, the Firestore security rules, and the deployment config are all in the repo. You can audit every line that touches your data, or self-host the entire stack."
            />
            <Reason
              icon={<CircleDollarSign size={16} />}
              title="No ads, no tracking"
              body="Zero analytics, zero third-party scripts, zero ads. Your browser talks to Firestore and to nothing else."
            />
            <Reason
              icon={<ShieldCheck size={16} />}
              title="Published threat model"
              body="We tell you honestly what we can and cannot defend against — including the cases where plausible deniability is weaker. No hand-waving."
            />
            <Reason
              icon={<Send size={16} />}
              title="Self-destructing Encrypted Send"
              body="A Bitwarden-Send / Privnote-style one-shot link, but account-less and open source end-to-end. The AES-256 key lives in the URL fragment (never reaches our servers), views are enforced by a Cloud Function that hard-deletes the bytes on the last read, and an optional password adds a second gate even if the link leaks."
            />
            <Reason
              icon={<Download size={16} />}
              title="Zero-knowledge backup & restore"
              body="Download a full vault as a .fvault file — the same ciphertext the server holds, never decrypted anywhere. Restore to any Flowvault instance (including self-hosted) at a fresh URL and every slot, including decoy passwords, is preserved. ProtectedText has no export or backup function; Flowvault's format makes migration and self-hosting a one-click flow."
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Feature-by-feature
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background-elev-2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Flowvault</th>
                  <th className="px-4 py-3">ProtectedText</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background-elev">
                <Row
                  label="Password-to-key derivation"
                  ours="Argon2id · 64 MiB · 3 iters · HKDF expansion"
                  theirs="Argon2id · 32 MiB · adaptive ~300 ms"
                />
                <Row
                  label="Legacy plaintext-password blob"
                  ours="No"
                  theirs="Yes — every save uploads encryptedContentLegacy keyed only by the raw password"
                  oursGood
                />
                <Row
                  label="Encryption mode"
                  ours="AES-256-GCM (authenticated)"
                  theirs="AES-256-CBC (unauthenticated)"
                  oursGood
                />
                <Row
                  label="Plausible deniability"
                  ours="Yes · hidden volumes"
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Fixed-size ciphertext"
                  ours={<Check className="inline text-success" size={14} />}
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Tamper detection"
                  ours={<Check className="inline text-success" size={14} />}
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Two-tab edit safety"
                  ours="CAS version counter"
                  theirs="Last-writer-wins"
                  oursGood
                />
                <Row
                  label="Multi-notebook tabs per password"
                  ours="Yes (inside the same encrypted slot; titles + order are encrypted too)"
                  theirs="One note per page (tabs, if any, are per-URL)"
                  oursGood
                />
                <Row
                  label="Time-locked notes"
                  ours="Yes (drand + optional password)"
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Self-destructing one-time notes"
                  ours="Yes (AES-256, URL-fragment key, server-enforced view count + TTL, optional password)"
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Trusted handover to a beneficiary"
                  ours="Yes"
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Open source"
                  ours="Frontend + Functions + Firestore rules"
                  theirs="Client JS only (server code closed, per their FAQ)"
                  oursGood
                />
                <Row
                  label="Ads / trackers"
                  ours="None"
                  theirs="None"
                />
                <Row
                  label="Account required"
                  ours="No"
                  theirs="No"
                />
                <Row
                  label="Self-hostable"
                  ours={<Check className="inline text-success" size={14} />}
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
                <Row
                  label="Encrypted backup / restore"
                  ours="Yes — .fvault file preserves all slots, no password inside"
                  theirs="No — notes only leave the browser as a manual copy-paste"
                  oursGood
                />
                <Row
                  label="Plaintext export (Markdown)"
                  ours="Yes — current slot only, with explicit confirmation"
                  theirs={<X className="inline" size={14} />}
                  oursGood
                />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            Comparison reflects ProtectedText&apos;s publicly documented
            behavior at time of writing. Corrections welcome via GitHub.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Encrypted Send vs. Privnote, Bitwarden Send, 1Password Share
            </h2>
            <p className="mt-3 text-sm text-muted">
              Burn-after-reading links aren&apos;t new; Flowvault&apos;s take
              is to make one that&apos;s account-less, open source end-to-end,
              and lives alongside your long-lived vault and time-locks under a
              single URL.
            </p>
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-background-elev-2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3 text-accent">Flowvault Send</th>
                  <th className="px-4 py-3">Privnote</th>
                  <th className="px-4 py-3">Bitwarden Send</th>
                  <th className="px-4 py-3">1Password Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background-elev">
                <SendRow
                  label="Open source end-to-end"
                  ours="Yes — frontend, Cloud Functions, and Firestore rules all in one public repo"
                  privnote="No — server is closed; only inspectable client JS"
                  bitwarden="Partial — Bitwarden clients and server are open, but the hosted service runs their own infrastructure"
                  onepassword={<X className="inline" size={14} />}
                />
                <SendRow
                  label="Account-less for the sender"
                  ours={<Check className="inline text-success" size={14} />}
                  privnote={<Check className="inline text-success" size={14} />}
                  bitwarden={<X className="inline" size={14} />}
                  onepassword={<X className="inline" size={14} />}
                  invertFirstTwo
                />
                <SendRow
                  label="Self-hostable"
                  ours={<Check className="inline text-success" size={14} />}
                  privnote={<X className="inline" size={14} />}
                  bitwarden="Yes (Vaultwarden or official self-host)"
                  onepassword={<X className="inline" size={14} />}
                />
                <SendRow
                  label="Encryption"
                  ours="AES-256-GCM (authenticated)"
                  privnote="AES (CBC in public docs; unauthenticated)"
                  bitwarden="AES-256-CBC with HMAC"
                  onepassword="AES-256-GCM"
                />
                <SendRow
                  label="Decryption key location"
                  ours="URL fragment (#k=…); server never sees it"
                  privnote="URL fragment"
                  bitwarden="URL fragment"
                  onepassword="URL fragment"
                />
                <SendRow
                  label="Optional password on top of link"
                  ours="Yes (Argon2id + AES-GCM, same FVPW frame as time-locks)"
                  privnote="Paid tier only"
                  bitwarden={<Check className="inline text-success" size={14} />}
                  onepassword={<Check className="inline text-success" size={14} />}
                />
                <SendRow
                  label="Server-enforced view cap (atomic hard-delete)"
                  ours="Yes — Cloud Function transaction deletes on last view"
                  privnote="Yes (default 1 view)"
                  bitwarden="Yes"
                  onepassword="Yes"
                />
                <SendRow
                  label="Max lifetime"
                  ours="30 days"
                  privnote="30 days"
                  bitwarden="31 days"
                  onepassword="30 days (14 on lower tiers)"
                />
                <SendRow
                  label="File attachments"
                  ours="Text only (on the roadmap)"
                  privnote="Text only"
                  bitwarden="Paid tier"
                  onepassword={<Check className="inline text-success" size={14} />}
                />
                <SendRow
                  label="Price"
                  ours="Free"
                  privnote="Free + paid tier"
                  bitwarden="Free (text) · paid for files / advanced options"
                  onepassword="Requires paid 1Password subscription"
                />
                <SendRow
                  label="Lives next to a long-lived zero-knowledge vault + time-locked notes"
                  ours={<Check className="inline text-success" size={14} />}
                  privnote={<X className="inline" size={14} />}
                  bitwarden="Password manager, not a notepad"
                  onepassword="Password manager, not a notepad"
                />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            Comparison reflects publicly documented behavior of each
            service at time of writing. Corrections and additions welcome
            via GitHub.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-20 overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/10 via-background-elev to-background-elev p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Heart size={20} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Keep Flowvault private &mdash; and alive.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Flowvault runs on the honor system. We don&apos;t show ads,
                we don&apos;t sell data, and we don&apos;t require an
                account &mdash; not even to accept donations. That&apos;s
                a deliberate choice, and it means the usual ways an app
                pays for itself aren&apos;t available to us. If Flowvault
                has earned a spot in your workflow, a small crypto
                donation keeps the servers paid and the features
                shipping.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Donations go through the{" "}
                <a
                  href="https://nowpayments.io"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  NOWPayments
                </a>{" "}
                donation widget &mdash; 100+ coins, a fresh deposit
                address for each donation, and no donor sign-up or email
                required. Pick Monero if you want the most private
                option.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={DONATE_PATH}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:brightness-110"
                >
                  <Bitcoin size={16} /> Donate with crypto
                </Link>
                <span className="text-xs text-muted">
                  BTC, ETH, LTC, XMR, USDT, SOL &middot; and ~100 more.
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Not in a position to donate? Totally fine &mdash; use
                Flowvault, tell a friend, or{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  star the repo
                </a>
                . That helps just as much.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mt-12 rounded-2xl border border-border bg-background-elev p-6 text-sm text-muted">
          <h2 className="text-foreground font-medium">
            &ldquo;Aren&apos;t these just nice-to-haves?&rdquo;
          </h2>
          <p className="mt-2">
            No. If your threat model is &ldquo;a determined adversary who might
            coerce a password out of me,&rdquo; plausible deniability is the
            difference between losing one notebook and losing all of them. If
            your threat model is offline brute force of a leaked blob,
            Argon2id raises the cost by 3+ orders of magnitude over iterated
            SHA-512. If your threat model is an untrusted server operator,
            authenticated encryption is the difference between &ldquo;they
            corrupt your notes silently&rdquo; and &ldquo;they can&apos;t, and
            you&apos;ll know if they try.&rdquo;
          </p>
          <p className="mt-3">
            Read the{" "}
            <Link href="/security" className="text-accent hover:underline">
              security design
            </Link>{" "}
            or the{" "}
            <Link href="/faq" className="text-accent hover:underline">
              FAQ
            </Link>{" "}
            for more.
          </p>
        </section>
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span>Flowvault · part of the Flowdesk family</span>
          <Link href="/security" className="hover:text-foreground">
            Security
          </Link>
          <Link href="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
          <Link
            href={DONATE_PATH}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            <Heart size={12} /> Donate
          </Link>
        </div>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(HOMEPAGE_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}

function Feature({
  icon,
  title,
  body,
  href,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background-elev p-5">
      <div className="flex items-center gap-2 text-accent">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-accent/15">
          {icon}
        </span>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
      {href ? (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          {ctaLabel ?? "Open"} &rarr;
        </Link>
      ) : null}
    </div>
  );
}

function Reason({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background-elev p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Row({
  label,
  ours,
  theirs,
  oursGood,
}: {
  label: string;
  ours: React.ReactNode;
  theirs: React.ReactNode;
  oursGood?: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-muted">{label}</td>
      <td
        className={
          oursGood
            ? "px-4 py-3 font-medium text-foreground"
            : "px-4 py-3 text-foreground"
        }
      >
        {ours}
      </td>
      <td className="px-4 py-3 text-muted">{theirs}</td>
    </tr>
  );
}

/**
 * Row for the 4-column Encrypted Send comparison. The `invertFirstTwo`
 * flag flips the emphasis styling on the first two cells, used for
 * rows where Flowvault + Privnote both score the good-for-user answer
 * (e.g. &ldquo;no account required&rdquo;) and Bitwarden/1Password
 * don&apos;t.
 */
function SendRow({
  label,
  ours,
  privnote,
  bitwarden,
  onepassword,
  invertFirstTwo,
}: {
  label: string;
  ours: React.ReactNode;
  privnote: React.ReactNode;
  bitwarden: React.ReactNode;
  onepassword: React.ReactNode;
  invertFirstTwo?: boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-3 align-top text-muted">{label}</td>
      <td className="px-4 py-3 align-top font-medium text-foreground">
        {ours}
      </td>
      <td
        className={
          invertFirstTwo
            ? "px-4 py-3 align-top font-medium text-foreground"
            : "px-4 py-3 align-top text-muted"
        }
      >
        {privnote}
      </td>
      <td className="px-4 py-3 align-top text-muted">{bitwarden}</td>
      <td className="px-4 py-3 align-top text-muted">{onepassword}</td>
    </tr>
  );
}
