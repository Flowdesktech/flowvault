import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { APP_URL } from "@/lib/config";

const SEC_TITLE =
  "Security & threat model — Argon2id, AES-GCM, hidden volumes, drand tlock";
const SEC_DESCRIPTION =
  "Flowvault's threat model and crypto primitives: Argon2id key derivation, AES-256-GCM authenticated encryption, hidden-volume plausible deniability, a client-wrapped dead-man's switch, and drand-backed time-locked notes. Written honestly, with the limits spelled out.";

export const metadata: Metadata = {
  title: SEC_TITLE,
  description: SEC_DESCRIPTION,
  keywords: [
    "Flowvault security",
    "encrypted notepad threat model",
    "Argon2id notes",
    "AES-GCM notepad",
    "plausible deniability hidden volumes",
    "drand tlock time lock",
    "zero knowledge architecture",
  ],
  alternates: { canonical: "/security" },
  openGraph: {
    type: "article",
    url: `${APP_URL}/security`,
    title: SEC_TITLE,
    description: SEC_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SEC_TITLE,
    description: SEC_DESCRIPTION,
  },
};

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-[15px] leading-relaxed text-foreground">
        <h1 className="text-3xl font-semibold tracking-tight">
          Security & threat model
        </h1>
        <p className="mt-3 text-muted">
          Flowvault is an honest description of what we protect, what we
          don&apos;t, and why.
        </p>

        <H2>What you give up when you use Flowvault</H2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Your password. If you forget it, your notes are unrecoverable.</li>
          <li>
            Trust that the JavaScript your browser loads is the same
            open-source JavaScript published on GitHub. This is the same trust
            assumption as every browser-based crypto app.
          </li>
        </ul>

        <H2>What Flowvault&apos;s server sees</H2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            A SHA-256-derived site id (not your slug, but an attacker with a
            slug dictionary can compute it).
          </li>
          <li>An opaque ciphertext blob of fixed size (512 KiB by default).</li>
          <li>Your per-site Argon2id salt and KDF parameters.</li>
          <li>A monotonic version counter and timestamps.</li>
        </ul>
        <p className="mt-2 text-muted">
          The server never sees your password, the keys derived from it, the
          content of any notebook, or how many notebooks you actually have on
          a given site.
        </p>

        <H2>Key derivation</H2>
        <p className="mt-2 text-muted">
          A 256-bit master key is derived with Argon2id from your password and
          a random 16-byte salt stored in the site document. Default
          parameters: <Code>64 MiB memory, 3 iterations, parallelism 1</Code>.
          These are visible in the site document and versioned so we can
          upgrade them without breaking existing vaults.
        </p>

        <H2>Hidden-volume format</H2>
        <p className="mt-2 text-muted">
          Each site stores a fixed-size blob split into N equally-sized slots
          (default <Code>64 × 8 KiB = 512 KiB</Code>). Each slot is encrypted
          with a per-slot subkey derived via HKDF-SHA256 from the master key.
          Slots not in use are filled with cryptographically random bytes,
          indistinguishable from encrypted slots without the corresponding
          key.
        </p>
        <p className="mt-2 text-muted">
          A given password lands in a deterministic slot derived from the
          master key (slot index = HMAC-based fingerprint mod N). Because
          different passwords hash to different slots, multiple notebooks can
          coexist on the same URL with no server-side metadata indicating how
          many exist. If a slot fails to decrypt, that&apos;s
          cryptographically indistinguishable from &ldquo;there is nothing
          there.&rdquo;
        </p>
        <p className="mt-2 text-muted">
          Collision risk between two independent passwords on the same site is
          ~<Code>1/64</Code> (≈1.6%). For M passwords the birthday-style
          probability of any collision is ~<Code>M²/(2·64)</Code>: 4.7% for 3
          passwords, 14% for 5, 54% for 10. Flowvault refuses to register a
          password whose slot would overwrite the currently-open notebook,
          but cannot detect collisions with other hidden notebooks (doing so
          would break deniability).
        </p>

        <H2>Plausible deniability (and its limits)</H2>
        <p className="mt-2 text-muted">
          A password you hand over under coercion opens that password&apos;s
          notebook. Other notebooks encrypted under other passwords remain as
          random-looking bytes in the blob. There is no database field the
          server could hand over that proves they exist.
        </p>
        <p className="mt-2 text-muted">
          Limitations: the total blob size is public, so an adversary who
          knows Flowvault&apos;s default layout knows there <em>could</em> be
          up to N notebooks on a site. A motivated adversary with repeated
          snapshots of your blob will see which slot changes after you
          type — so deniability is strongest in the single-snapshot case
          (border search, compelled disclosure) and weaker against a
          persistent network observer who can correlate writes to slots.
        </p>

        <H2>Transport & frontend integrity</H2>
        <p className="mt-2 text-muted">
          All traffic is TLS. The frontend is a statically-built Next.js
          bundle; releases are tagged in Git, and we intend to publish
          signed release hashes so you can verify the bundle your browser
          runs matches a reviewable commit. This is the hardest problem for
          any browser-crypto app; we take it seriously but do not claim to
          have solved it.
        </p>

        <H2>Open-source backend</H2>
        <p className="mt-2 text-muted">
          The frontend is not the only thing you can audit. The Cloud
          Functions code (the dead-man&apos;s-switch sweep), the Firestore
          security rules, and the deployment config &mdash; i.e. the
          actual boundary that stops Flowvault operators from reading or
          mutating your data &mdash; are published in the same repository
          and deployed unmodified. Most zero-knowledge services hide their
          server; ours is reviewable, forkable, and self-hostable
          end-to-end.
        </p>

        <H2>Dead-man&apos;s switch</H2>
        <p className="mt-2 text-muted">
          You can configure a beneficiary who can decrypt the vault if you
          stop checking in. The scheme is fully client-side:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>
            You pick a <em>beneficiary password</em> (different from your
            own). The browser derives a beneficiary key with Argon2id and a
            fresh salt, wraps your master key with AES-256-GCM under it,
            and uploads the 60-byte wrapped blob. We never see either
            password or the master key.
          </li>
          <li>
            Every save bumps <Code>deadman.lastHeartbeatAt</Code>. Saves
            require the master key (they re-encrypt the blob with it), so
            only you can effectively heartbeat. An attacker who only reads
            the document cannot forge a valid ciphertext.
          </li>
          <li>
            A scheduled Cloud Function (hourly) marks configured vaults as
            <Code>released</Code> when{" "}
            <Code>now &gt; lastHeartbeatAt + intervalMs + graceMs</Code>.
            Only the Admin SDK can set that flag; the Firestore rules
            forbid clients from doing so.
          </li>
          <li>
            After release, the security rules lock the document against
            further writes. The beneficiary visits the URL, enters the
            beneficiary password, unwraps the master key client-side, and
            decrypts the vault.
          </li>
        </ol>
        <p className="mt-2 text-muted">
          Honest trade-offs: the <em>existence</em> of a dead-man&apos;s
          switch is visible to the server (we need it to schedule the
          sweep); the interval, grace and last-heartbeat timestamps are
          visible too. The wrapped key blob and beneficiary salt are opaque
          ciphertext. Give your beneficiary a password long enough to resist
          offline brute force if they ever receive the URL &mdash; after
          release, anyone who learns the URL could attempt guesses against
          the same Argon2id parameters that protect your own password.
        </p>

        <H2>Time-locked notes</H2>
        <p className="mt-2 text-muted">
          Flowvault can encrypt a capsule to a future{" "}
          <a
            href="https://drand.love"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            drand
          </a>{" "}
          beacon round using the{" "}
          <a
            href="https://github.com/drand/tlock-js"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            tlock
          </a>{" "}
          scheme (identity-based encryption over BLS). The ciphertext is
          stored in Firestore and becomes decryptable only after the drand
          network publishes the corresponding round signature. Nobody
          &mdash; including Flowvault, including the sender, including a
          subpoena &mdash; can decrypt earlier than that moment.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
          <li>
            In your browser we compute the target round for your chosen
            unlock time (30-second granularity against the RFC drand
            mainnet chain) and encrypt the plaintext to that round.
          </li>
          <li>
            We store <Code>ciphertext</Code>, <Code>round</Code>,{" "}
            <Code>chainHash</Code>, and a server timestamp in{" "}
            <Code>timelocks/&#123;id&#125;</Code>. Firestore rules forbid
            updates or deletes &mdash; capsules are write-once.
          </li>
          <li>
            When anyone opens <Code>/t/&#123;id&#125;</Code> after the
            unlock moment, the browser fetches the drand round signature
            and decrypts locally. The server never sees the plaintext
            and never holds the unlock key.
          </li>
        </ol>
        <p className="mt-2 text-muted">
          Honest trade-offs: the target <em>round</em> (and therefore
          the unlock wall-clock time, to ~30 s) is visible to the server
          by necessity &mdash; readers need to know when to retry. The
          share URL is the access credential; treat it like the secret
          itself (or add an optional password gate, below). Security
          rests on drand&apos;s threshold assumption (a supermajority
          of node operators must stay honest) and on BLS over BLS12-381;
          we track the chain parameters and will rotate if drand ever
          deprecates the current scheme.
        </p>

        <H2>Optional password on time-locked notes</H2>
        <p className="mt-2 text-muted">
          You can harden a capsule with a second gate so that even a
          leaked URL isn&apos;t sufficient to read the message after the
          time-lock releases. When enabled, the plaintext is
          double-wrapped:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
          <li>
            <strong className="text-foreground">Inner layer (password):</strong>{" "}
            a 16-byte random salt is generated, an Argon2id key is
            derived from your password (same parameters as vaults: 64
            MiB memory, 3 iterations), and the plaintext is encrypted
            with AES-256-GCM under that key. The inner framing is{" "}
            <Code>&quot;FVPW&quot; || version || saltLen || salt || iv || ct || tag</Code>
            .
          </li>
          <li>
            <strong className="text-foreground">Outer layer (time):</strong>{" "}
            those bytes are passed to tlock and sealed to the unlock
            round exactly like a password-less capsule.
          </li>
        </ol>
        <p className="mt-2 text-muted">
          Why the inner layer comes first: before the unlock round
          releases, the capsule is cryptographically opaque &mdash; even
          a reader who knows the password cannot peek at the AES layer
          early. After the round, the bytes are still a
          password-authenticated blob that only the key unlocks. The
          Firestore document carries a <Code>passwordProtected</Code>{" "}
          boolean hint so the viewer can prompt during the countdown
          instead of after; the viewer also detects the inner layer
          cryptographically from the decrypted bytes, so a forged or
          missing hint cannot bypass the password. We never store the
          password, its hash, or a hint; if you lose it the message is
          unrecoverable.
        </p>

        <H2>Responsible disclosure</H2>
        <p className="mt-2 text-muted">
          Security issues: please report via GitHub security advisories or
          email the maintainer before public disclosure.
        </p>
      </main>
    </>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold">{children}</h2>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-background-elev px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}
