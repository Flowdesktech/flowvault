import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { DONATE_PATH } from "@/lib/config";

export const metadata = {
  title:
    "FAQ — Flowvault: encrypted online notepad, dead-man's switch, ProtectedText / Standard Notes / CryptPad / Privnote alternative",
  description:
    "Honest answers about Flowvault: how plausible-deniability hidden volumes work, how the dead-man's switch releases a vault to a beneficiary if you stop checking in, how Flowvault compares to ProtectedText, Standard Notes, CryptPad, Privnote, Notesnook, Joplin, Obsidian, Bitwarden Send, and Skiff Notes, and what happens if you forget your password.",
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const ABOUT: QA[] = [
  {
    q: "What is Flowvault?",
    a: (
      <>
        Flowvault is an encrypted notepad. You pick a URL like{" "}
        <Code>flowvault.flowdesk.tech/s/my-notes</Code>, set a password, and
        write. Your
        notes are encrypted in your browser before they reach our server, so
        we only ever see an opaque ciphertext blob.
      </>
    ),
  },
  {
    q: "Do I need to create an account?",
    a: "No. There is no sign-up, no email, no phone number. A URL slug plus a password is the entire identity system.",
  },
  {
    q: "How much does it cost?",
    a: "Free for normal personal use. We may add a paid tier later for custom domains and larger vaults, but the core notepad will stay free.",
  },
];

const VS_PROTECTED_TEXT: QA[] = [
  {
    q: "I already use ProtectedText. Why switch?",
    a: (
      <>
        Four concrete differences, in honest order:
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            <Strong>No legacy plaintext-password blob.</Strong> Inspect{" "}
            <Code>protectedtext.com/js/main.js</Code> &mdash; every save
            still uploads a parallel <Code>encryptedContentLegacy</Code>{" "}
            blob keyed only by the raw password (for backwards compatibility
            with older clients). If their database is ever stolen, attackers
            can crack that legacy blob without doing any Argon2 work at all.
            Flowvault has no such fallback &mdash; every blob requires the
            full Argon2 chain.
          </li>
          <li>
            <Strong>Authenticated encryption.</Strong> Flowvault uses
            AES-256-GCM, which detects any tampering with the ciphertext.
            ProtectedText uses AES-256-CBC via the legacy CryptoJS library,
            which is malleable: bitflips in the blob go undetected.
          </li>
          <li>
            <Strong>Plausible deniability via hidden volumes.</Strong> One
            Flowvault URL can hold multiple independent notebooks, each
            behind a different password, all packed into one fixed-size
            blob. ProtectedText is one password, one blob &mdash; no decoy
            possible without a breaking format change.
          </li>
          <li>
            <Strong>Open backend.</Strong> ProtectedText publishes its
            client JS for inspection but their FAQ explicitly says the
            server code is closed. Flowvault publishes the frontend, the
            Cloud Functions, and the Firestore security rules &mdash; the
            entire stack is reviewable, licensed, and self-hostable.
          </li>
        </ol>
        <p className="mt-3">
          <Strong>What we&apos;re NOT claiming:</Strong> ProtectedText today
          actually does use Argon2id (32 MiB, adaptive ~300 ms) for the
          primary blob &mdash; it&apos;s a real KDF, in the same family as
          ours (64 MiB, 3 iters, HKDF expansion). The KDF gap is small. The
          legacy-blob issue, the malleable cipher, and the lack of
          deniability are the real differences.
        </p>
      </>
    ),
  },
  {
    q: "What is \"plausible deniability\" in practice?",
    a: (
      <>
        One URL can hold multiple notebooks, each behind a different
        password. The server stores one fixed-size blob; it cannot tell how
        many notebooks live inside. If someone coerces a password out of you
        at a border crossing or in a legal process, you hand over a decoy
        password that opens a decoy notebook full of mundane content. Your
        real notebook stays as cryptographically random-looking bytes in the
        same blob. Nobody &mdash; not us, not an attacker with a copy of the
        blob &mdash; can prove another notebook exists.
      </>
    ),
  },
  {
    q: "Is ProtectedText insecure?",
    a: (
      <>
        No. ProtectedText is a solid, long-running, popular service and we
        respect what they built &mdash; we wouldn&apos;t exist without it as
        prior art. Flowvault is aimed at people who want a stronger threat
        model (coercion, offline brute force of stolen DBs, tampering, open
        server code) and don&apos;t mind switching. For a quick private
        scratchpad, ProtectedText is perfectly fine.
      </>
    ),
  },
  {
    q: "How does Flowvault compare to Standard Notes?",
    a: (
      <>
        <Strong>Standard Notes</Strong> is an excellent end-to-end-encrypted
        note-taking app focused on long-form personal knowledge management.
        It has clients on every platform, sync across devices, and a real
        company behind it. It also requires an{" "}
        <Strong>account (email + password)</Strong>, and most useful
        features (Markdown rendering, code editor, daily writing prompts,
        cloud backups, tags) live behind a paid subscription.
        <p className="mt-3">
          Flowvault has a different shape: no account, no email, no app
          install, no subscription. You type a URL, set a password, and
          start writing in a browser tab. It&apos;s closer to ProtectedText
          than to Standard Notes in spirit. We add hidden volumes and a
          fully open backend on top. Pick Standard Notes if you want a
          long-term encrypted journal across devices; pick Flowvault if you
          want a no-account scratchpad with deniability.
        </p>
      </>
    ),
  },
  {
    q: "How does Flowvault compare to CryptPad?",
    a: (
      <>
        <Strong>CryptPad</Strong> is a fantastic, fully open-source
        encrypted office suite (docs, sheets, slides, kanban, code) built by
        XWiki SAS in France. It&apos;s the right answer if you need
        real-time collaborative editing with cryptography. The trade-off:
        long-term storage requires an account, the UI is a full app rather
        than a notepad, and it doesn&apos;t offer hidden-volume
        deniability &mdash; one user, one set of pads.
        <p className="mt-3">
          Flowvault is much smaller in scope (plain text, single pane, one
          URL = one vault). If you want a Google Docs replacement, use
          CryptPad. If you want a hidden, deniable scratchpad you can open
          from any browser without signing in, use Flowvault.
        </p>
      </>
    ),
  },
  {
    q: "How does Flowvault compare to Privnote and other burn-after-reading services?",
    a: (
      <>
        <Strong>Privnote</Strong> (and similar &mdash; PrivateBin, Yopass,
        OneTimeSecret) are great for sending a single secret that
        self-destructs after one read. They are <em>not</em> persistent
        notepads. You write once, the recipient reads once, the link dies.
        <p className="mt-3">
          Flowvault is the opposite: a persistent notepad you come back to
          for years. If you need to share a one-shot password with a
          colleague, use Privnote or PrivateBin. If you need a private place
          to keep notes, drafts, or to-dos forever, use Flowvault.
        </p>
      </>
    ),
  },
  {
    q: "How does Flowvault compare to Joplin and Obsidian?",
    a: (
      <>
        <Strong>Joplin</Strong> and <Strong>Obsidian</Strong> are
        local-first desktop note apps. Joplin offers optional E2EE sync
        through your own provider; Obsidian sells Obsidian Sync as a paid
        E2EE add-on, otherwise notes live on your disk. Both are excellent
        for power users who want a knowledge graph, tags, plugins, and
        offline-first storage on a real device.
        <p className="mt-3">
          They&apos;re a different category from Flowvault. Flowvault is
          designed for the case where you can&apos;t install software (a
          friend&apos;s laptop, a school computer, a hotel kiosk, a phone
          you don&apos;t own), or where you want plausible deniability
          rather than local-disk encryption. The ideal setup is probably
          both: Obsidian or Joplin at home, Flowvault for everywhere else.
        </p>
      </>
    ),
  },
  {
    q: "How does Flowvault compare to Notesnook?",
    a: (
      <>
        <Strong>Notesnook</Strong> is a polished, fully open-source
        end-to-end-encrypted notes app with native clients on every
        platform, a free tier, and a paid Pro tier for advanced features.
        It&apos;s a strong choice if you want an Evernote-style app with
        real cryptography. Like Standard Notes, it requires an account and
        is centered on a multi-device app experience.
        <p className="mt-3">
          Flowvault is account-less and browser-only. We don&apos;t compete
          on app polish or device sync &mdash; we compete on{" "}
          <Strong>zero metadata</Strong> (we don&apos;t even know who you
          are) and <Strong>hidden-volume deniability</Strong>. If you want
          an encrypted note <em>app</em>, Notesnook is great. If you want an
          encrypted note <em>URL</em> with deniability, that&apos;s us.
        </p>
      </>
    ),
  },
  {
    q: "I used Skiff Notes. Where should I go now?",
    a: (
      <>
        Skiff was acquired by Notion in early 2024 and shut down. If you
        liked Skiff for the encrypted-Notion vibe, look at{" "}
        <Strong>Proton Docs</Strong> or <Strong>CryptPad</Strong> for
        document-style use, or <Strong>Standard Notes</Strong> /{" "}
        <Strong>Notesnook</Strong> for note-app use. For quick anonymous
        scratch notes, Flowvault and ProtectedText are the spiritual
        successors to the &ldquo;just give me a URL&rdquo; model.
      </>
    ),
  },
  {
    q: "How does Flowvault compare to Bitwarden Send / Bitwarden Notes / 1Password Secure Notes?",
    a: (
      <>
        Password managers&apos; secure-notes features are excellent for
        short, structured secrets attached to a credential (license keys,
        recovery codes, one-line answers). They live inside an account
        protected by a master password and your device&apos;s vault.
        <Strong>Bitwarden Send</Strong> is for ephemeral one-off shares,
        similar to Privnote.
        <p className="mt-3">
          Flowvault is for free-form text you want to keep coming back to,
          without an account, without installing anything, and with the
          option to hide some of it behind a decoy. Use both: passwords go
          in a password manager, free-form notes go in Flowvault.
        </p>
      </>
    ),
  },
  {
    q: "How does Flowvault compare to Cryptee, Turtl, HedgeDoc, dontpad, Etherpad?",
    a: (
      <>
        Quick survey:
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <Strong>Cryptee</Strong>: Estonia-based, encrypted notes and
            photos, account required. Beautiful but a different shape than a
            no-login notepad.
          </li>
          <li>
            <Strong>Turtl</Strong>: open-source encrypted notes app with
            account-based sync. Closer to Standard Notes than to
            ProtectedText.
          </li>
          <li>
            <Strong>HedgeDoc</Strong> (formerly CodiMD, fork of HackMD):
            collaborative Markdown editor. Excellent for shared drafts but
            generally not encrypted at rest unless you self-host with care.
          </li>
          <li>
            <Strong>dontpad</Strong>, <Strong>Etherpad</Strong>,{" "}
            <Strong>pad.riseup.net</Strong>: collaborative pads,{" "}
            <em>not</em> encrypted &mdash; the operator can read your
            content. Useful for non-sensitive coordination, not for
            secrets.
          </li>
        </ul>
        <p className="mt-3">
          If your top requirement is &ldquo;an encrypted notepad I can open
          in a browser without signing in,&rdquo; the realistic field is
          essentially Flowvault and ProtectedText. Everything else is a
          different category.
        </p>
      </>
    ),
  },
];

const SECURITY: QA[] = [
  {
    q: "What does the server actually see?",
    a: (
      <>
        A SHA-256-derived site id (not your slug), an opaque ciphertext blob,
        your Argon2id salt, the KDF and volume parameters, and timestamps.
        That&apos;s it. No passwords, no keys, no plaintext, no clue how many
        notebooks a vault contains.
      </>
    ),
  },
  {
    q: "Is my password ever transmitted?",
    a: "No. Your password is used purely in-browser to derive the encryption key. The only thing your browser sends to the server is ciphertext. Verify this yourself by opening the Network tab while saving.",
  },
  {
    q: "Why Argon2id instead of PBKDF2 or SHA-512?",
    a: (
      <>
        Because modern password cracking is done on GPUs and ASICs that are
        terrible at the &ldquo;memory-hard&rdquo; access patterns Argon2id
        forces. Iterated SHA-512 or PBKDF2 cost attackers cents per billion
        guesses on commodity GPUs. Argon2id with 64 MiB of memory forces each
        guess to allocate real RAM, slashing throughput by orders of
        magnitude. It&apos;s also the winner of the Password Hashing
        Competition and the OWASP-recommended default.
      </>
    ),
  },
  {
    q: "What if you get hacked?",
    a: "An attacker who steals the entire Firestore would get a pile of ciphertext blobs plus salts. No passwords, no keys. They would still have to run Argon2id-protected offline brute force, one password at a time, per vault. That's the zero-knowledge design working as intended.",
  },
  {
    q: "Can you be compelled to hand over my notes?",
    a: "We can only hand over what we have: ciphertext. We don't have your password, your derived keys, or any way to recover them. If a court ordered us to give a notebook to a third party, we would give them the same ciphertext you could download yourself from Firestore — unreadable without your password.",
  },
  {
    q: "Is the frontend code verifiable?",
    a: (
      <>
        The source is open. Today you trust that the JavaScript your browser
        downloads matches the source on GitHub &mdash; the same trust
        assumption as every browser-based crypto app. We plan to publish
        signed bundle hashes for each release so you can verify the bundle
        your browser ran. See the{" "}
        <Link href="/security" className="text-accent hover:underline">
          security page
        </Link>{" "}
        for the current state.
      </>
    ),
  },
];

const USAGE: QA[] = [
  {
    q: "I forgot my password. Can I recover my notes?",
    a: "No. That's the whole point. There is no &ldquo;reset&rdquo; link because there is no copy of your key anywhere. Write your password somewhere safe.",
  },
  {
    q: "Can two people share a vault?",
    a: "Yes. Share the URL and the password over a trusted channel. Both people can read and edit. If they edit at the same time, the second writer gets a conflict error instead of overwriting the first — so you won't silently lose data.",
  },
  {
    q: "How big can a notebook be?",
    a: "Each notebook (slot) holds around 8 KiB of text (roughly 1,500 words) in the default configuration. A single vault holds 64 slots for a total of 512 KiB. Multi-slot notebooks (spreading one notebook across several slots for longer content) are on the roadmap.",
  },
  {
    q: "Can I use Flowvault offline?",
    a: "Not yet. A PWA / offline mode with local-first sync is on the roadmap.",
  },
  {
    q: "Can I add a decoy password to an existing vault?",
    a: (
      <>
        Yes. Open your vault, click <Strong>Add password</Strong> in the
        editor toolbar, and pick a new password. Optionally seed the new
        notebook with some initial content (useful if it&apos;s meant to look
        ordinary when handed over under coercion). Each password unlocks its
        own notebook; nobody &mdash; not us, not an adversary with a copy of
        your blob &mdash; can tell how many you have.
      </>
    ),
  },
  {
    q: "What happens if two passwords collide on the same slot?",
    a: (
      <>
        Each password hashes into one of <Strong>64</Strong> slot positions.
        The chance of two independent passwords landing on the same slot is
        about <Code>1/64</Code> (~1.6%). For three passwords it&apos;s ~4.7%;
        for five, ~14%. On collision one notebook overwrites the other
        &mdash; we cannot detect collisions across passwords without storing
        metadata that would break deniability. The one case we <em>do</em>
        catch: Flowvault refuses to register a new password whose slot would
        overwrite the notebook you currently have open. If collisions matter
        for your threat model, just pick a different password and try again.
      </>
    ),
  },
];

const FEATURES: QA[] = [
  {
    q: "What is the dead-man's switch?",
    a: (
      <>
        An opt-in way to say: &ldquo;if I stop checking in for X days, let
        this trusted person decrypt my vault.&rdquo; You pick a{" "}
        <Strong>beneficiary password</Strong> (different from your own) and
        share it with them out of band. The browser derives a beneficiary
        key with Argon2id, wraps your master key with AES-GCM under it, and
        uploads a ~60-byte wrapped blob. Every save counts as a heartbeat;
        if you go quiet past the interval + grace you configured, an hourly
        Cloud Function marks the vault{" "}
        <Code>released</Code>, and the beneficiary can then visit the URL,
        enter their password, unwrap the master key, and read the notebook.
      </>
    ),
  },
  {
    q: "Is the dead-man's switch zero-knowledge too?",
    a: (
      <>
        The cryptography is, yes &mdash; the server never sees the
        beneficiary password, the master key, or the plaintext. We do
        <em> acknowledge</em> two visible side-effects we can&apos;t avoid
        without losing the ability to schedule the release: the{" "}
        <Strong>existence</Strong> of a switch on the vault, and the{" "}
        interval / grace / last-heartbeat metadata. The wrapped key and
        beneficiary salt themselves are opaque ciphertext.
      </>
    ),
  },
  {
    q: "Can someone else fake a heartbeat to keep my vault alive forever?",
    a: (
      <>
        Only if they already have your master key. Heartbeats piggyback on
        saves, and every save re-encrypts the whole ciphertext blob with
        the master key &mdash; so an attacker with only read access to the
        document cannot produce a valid new ciphertext to extend the timer.
        They can overwrite it with garbage (that&apos;s a general issue
        with any password-only zero-knowledge notepad, and the defense we
        plan to add is a Cloud Function that requires a proof of master-key
        knowledge for writes). But they can&apos;t secretly keep the
        deadman alive.
      </>
    ),
  },
  {
    q: "Can I cancel a dead-man's switch?",
    a: (
      <>
        While it&apos;s still active (not released yet): yes, any time,
        from the editor toolbar &mdash; that removes the wrapped key blob
        from the document entirely. Once it has released, no: the Firestore
        rules lock the document against further writes, because the
        wrapped key has already been sitting in a potentially-public
        document and anyone who knew the URL could have grabbed a copy.
        After a release you should treat the URL as burned and start a new
        vault.
      </>
    ),
  },
  {
    q: "What happens to my other hidden notebooks when the switch fires?",
    a: (
      <>
        Only the notebook that belongs to the master key you wrapped is
        exposed to the beneficiary &mdash; by design. The other slots in
        the vault (decoys, or notebooks under other passwords) stay as
        random-looking bytes that the beneficiary has no key for. If you
        care about this, configure the switch from a <em>decoy</em>{" "}
        notebook&apos;s session rather than from your primary one.
      </>
    ),
  },
  {
    q: "Do Standard Notes / ProtectedText / Privnote have a dead-man's switch?",
    a: (
      <>
        Not out of the box. Standard Notes has paid cloud sharing but not a
        time-triggered release mechanism. ProtectedText, Privnote,
        CryptPad, and most &ldquo;zero-knowledge notepad&rdquo; services
        have no concept of inheritance &mdash; forget or lose the password
        and the data is gone. Flowvault ships the switch as a first-class,
        client-side feature.
      </>
    ),
  },
  {
    q: "Time-locked notes — are those the same as the dead-man's switch?",
    a: (
      <>
        No, they&apos;re complementary. The dead-man&apos;s switch uses a
        password-wrapped key that the <em>server</em> unveils after a
        timeout. Time-locked notes (on the roadmap) use the{" "}
        <Strong>drand</Strong> public randomness beacon&apos;s threshold
        BLS signatures as the unlock material &mdash; nobody, not us, not
        you, can decrypt before drand publishes the round signature.
        Different threat models, different mechanisms.
      </>
    ),
  },
];

const COMPANY: QA[] = [
  {
    q: "Who builds Flowvault?",
    a: "Flowvault is part of the Flowdesk family of tools. It's built in the open; contributions and security reviews are welcome.",
  },
  {
    q: "Is Flowvault open source? How does that compare to ProtectedText?",
    a: (
      <>
        Yes &mdash; and importantly, the whole stack, not just the frontend
        bundle. Three things are published together in the same
        repository:
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Strong>Frontend</Strong> (Next.js, all UI + client-side crypto)
          </li>
          <li>
            <Strong>Cloud Functions</Strong> (dead-man&apos;s-switch
            heartbeat + sweep, abuse intake). You can read exactly what
            server-side code runs on your behalf &mdash; there is no hidden
            server process.
          </li>
          <li>
            <Strong>Firestore security rules</Strong> (the actual boundary
            that keeps us from reading your data). These are short,
            auditable, and enforced by Google&apos;s infrastructure.
          </li>
        </ul>
        <p className="mt-3">
          You can self-host the entire stack: bring your own Firebase
          project, deploy the rules and Functions, point the frontend at it.
          A permissive license (MIT planned) lets you fork it freely.
        </p>
        <p className="mt-3">
          For comparison: <Strong>ProtectedText</Strong> publishes its
          client-side JavaScript so you can read it in the browser
          (commendable, and they encourage it), but their FAQ explicitly
          states &ldquo;we haven&apos;t opened the server code for now.&rdquo;
          They argue the server is irrelevant because all crypto happens in
          the client &mdash; which is a fair argument, but you still
          can&apos;t self-host their service or audit what their server does
          with your encrypted blobs (rate-limiting, logging, retention).
          Flowvault&apos;s answer is to put the server code, the database
          rules, and the deployment config in the same repo, so there
          is nothing to take on faith.
        </p>
      </>
    ),
  },
  {
    q: "How is Flowvault funded?",
    a: (
      <>
        Donations and personal time. We don&apos;t run ads, don&apos;t sell
        data, and don&apos;t have a paid tier (yet). The project intentionally
        doesn&apos;t have the usual revenue levers because those levers tend
        to be the opposite of privacy. Hosting, domain, and drand beacon
        monitoring costs come out of pocket and out of donations.
      </>
    ),
  },
  {
    q: "I want to support Flowvault. What helps?",
    a: (
      <>
        <Strong>Direct crypto donations</Strong> are the most privacy-safe
        way. The{" "}
        <Link href={DONATE_PATH} className="text-accent hover:underline">
          /donate
        </Link>{" "}
        page lists wallet addresses for Bitcoin, Ethereum, Litecoin, Monero,
        USDT (TRC-20 and ERC-20), and Solana &mdash; no sign-up, no email,
        no middleman. Your browser talks directly to the blockchain; we
        learn nothing about you. Even the equivalent of a coffee genuinely
        helps.
        <br />
        <br />
        Not in a position to donate? Use Flowvault, tell someone who needs
        it, star the GitHub repo, file a bug, or submit a PR. All of those
        matter just as much.
      </>
    ),
  },
  {
    q: "Why crypto instead of a regular card or PayPal?",
    a: (
      <>
        Because every traditional payment rail asks for identifying
        information &mdash; card number, email, billing address, country
        &mdash; which defeats the point of a zero-knowledge product.
        Accepting crypto lets us receive your support without also
        receiving a dossier on you. If crypto is a non-starter for you,
        we&apos;re not offended; please just don&apos;t feel pressured.
      </>
    ),
  },
  {
    q: "Why not use Plisio, NOWPayments, or a similar crypto gateway?",
    a: (
      <>
        Because those gateways &mdash; even though they handle crypto &mdash;
        still collect a donor <Strong>email</Strong> for receipts, which
        contradicts Flowvault&apos;s whole pitch. Raw wallet addresses are
        the only way to accept money without learning anything about the
        sender. We display them as plain text and QR codes; your browser
        never makes a network request to a payment processor, because there
        isn&apos;t one.
      </>
    ),
  },
  {
    q: "Which coin should I send?",
    a: (
      <>
        If privacy is paramount, send <Strong>Monero (XMR)</Strong>. Every
        other major chain &mdash; Bitcoin, Ethereum, Litecoin, USDT, Solana
        &mdash; is pseudonymous: the full history of transactions to an
        address is public, so anyone who ever learns a donation address
        later can see the full ledger. Monero hides amounts, senders, and
        receivers by design. For low fees on stablecoins, USDT on TRC-20
        (Tron) is a good choice.
      </>
    ),
  },
  {
    q: "How do I report a security issue?",
    a: "Please use GitHub security advisories or email the maintainer privately before public disclosure. We'll credit responsible disclosures.",
  },
];

export default function FAQPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-[15px] leading-relaxed text-foreground">
        <h1 className="text-3xl font-semibold tracking-tight">FAQ</h1>
        <p className="mt-3 text-muted">
          Questions we get (or expect to get). If yours isn&apos;t here, open
          an issue on GitHub.
        </p>

        <Section title="About Flowvault" items={ABOUT} />
        <Section
          title="Comparisons: Flowvault vs ProtectedText, Standard Notes, CryptPad, Privnote, and other encrypted notepads"
          items={VS_PROTECTED_TEXT}
        />
        <Section title="Security" items={SECURITY} />
        <Section
          title="Dead-man's switch & time-locked notes"
          items={FEATURES}
        />
        <Section title="Using Flowvault" items={USAGE} />
        <Section title="Project" items={COMPANY} />
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        Flowvault · part of the Flowdesk family
      </footer>
    </>
  );
}

function Section({ title, items }: { title: string; items: QA[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-background-elev">
        {items.map((item) => (
          <details
            key={item.q}
            className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
              <span className="font-medium text-foreground">{item.q}</span>
              <span className="shrink-0 text-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-muted">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-background-elev-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-foreground">{children}</strong>;
}
