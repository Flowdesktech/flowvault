import {
  Lead,
  H2,
  P,
  Ul,
  Li,
  Code,
  Strong,
  Em,
  A,
  Callout,
} from "@/components/blog/Prose";

export default function Post() {
  return (
    <>
      <Lead>
        Before writing Flowvault, I spent an afternoon testing every
        &ldquo;encrypted notepad&rdquo; I could find and came away with
        the same feeling each time: the product was almost there, and
        then one specific compromise ruined it. This post is the
        catalogue of those compromises and the design decisions they
        pushed me toward.
      </Lead>

      <H2 id="the-goal">The goal: a URL, a password, and a notebook</H2>
      <P>
        There is a very specific primitive I keep wanting and keep not
        finding: a URL I can open on <Em>any</Em> browser, type a
        password, and start writing. No account. No email. No app
        install. No sync client. No magic-link flow. No &ldquo;just open
        the desktop app first.&rdquo;{" "}
        <Strong>
          A slug and a password is the entire identity system.
        </Strong>
      </P>
      <P>
        The reason is that I live across three laptops, a phone, a work
        machine I don&apos;t fully control, and the occasional hotel or
        library kiosk. The notepad I want exists in that
        lowest-common-denominator world. Anything with an account is
        already a worse fit than a URL I remember and a password
        I remember.
      </P>
      <P>
        The service that historically gets closest to this primitive is{" "}
        <A href="https://www.protectedtext.com/">ProtectedText</A>.
        It&apos;s lasted for over a decade precisely because the shape
        is right. But the moment you read the source it serves, you
        find three things you wish weren&apos;t there. I&apos;ll get to
        those.
      </P>

      <H2 id="whats-wrong-with-the-landscape">
        What&apos;s wrong with the 2026 landscape
      </H2>
      <P>
        Here&apos;s the honest tour. I respect every one of these
        projects &mdash; Flowvault wouldn&apos;t exist without their
        prior art &mdash; but each has at least one compromise I
        couldn&apos;t live with.
      </P>

      <H2 id="protectedtext">ProtectedText: three small things that compound</H2>
      <P>
        ProtectedText is the closest spiritual predecessor to Flowvault.
        Account-less, URL-shaped, been around since the early 2010s.
        Open their <Code>main.js</Code> in the browser and you can
        watch the client code run. That&apos;s already better than most
        of the industry.
      </P>
      <P>
        The three things that added up to &ldquo;I&apos;d like to write
        something new&rdquo;:
      </P>
      <Ul>
        <Li>
          <Strong>A legacy plaintext-password blob.</Strong> Every save
          uploads two ciphertexts: a modern one and an{" "}
          <Code>encryptedContentLegacy</Code> blob keyed directly by
          the raw password (for backwards compatibility with older
          clients). If the database is ever stolen, that legacy blob is
          crackable without any Argon2 work at all. A brand new design
          has no such back-compat cost, so I wanted to ship one.
        </Li>
        <Li>
          <Strong>Malleable cipher mode.</Strong> The primary blob is
          AES-256-CBC via the legacy CryptoJS library. CBC is
          un-authenticated: bitflips in stored ciphertext go undetected
          and the plaintext silently mutates. AES-256-<Em>GCM</Em> has
          been the default for authenticated encryption for about a
          decade; there&apos;s no reason a 2026 notepad should use
          anything else.
        </Li>
        <Li>
          <Strong>Closed server code.</Strong> ProtectedText&apos;s FAQ
          is explicit that the server side is closed source. The crypto
          runs client-side so that argument is partly valid, but you
          still can&apos;t verify what logging / rate-limiting /
          retention actually happens, and you can&apos;t self-host.
        </Li>
      </Ul>
      <Callout tone="note" title="What I'm not claiming">
        ProtectedText today uses Argon2id on the primary blob &mdash;
        that part is genuinely good, and the KDF gap between it and
        Flowvault is small. The legacy blob, the malleable cipher, and
        the closed backend are the real differences. If you&apos;re
        already using ProtectedText for low-stakes personal notes,
        you&apos;re not in imminent danger; this is a design-philosophy
        argument.
      </Callout>

      <H2 id="standard-notes-notesnook">
        Standard Notes and Notesnook: beautiful, but accounts
      </H2>
      <P>
        Both <A href="https://standardnotes.com/">Standard Notes</A>{" "}
        and <A href="https://notesnook.com/">Notesnook</A> are
        excellent end-to-end-encrypted note apps. Clients on every
        platform, real companies behind them, public audits, generous
        free tiers. If you want a long-term encrypted journal with
        full sync, they&apos;re both great answers.
      </P>
      <P>
        They both require an account with an email. The moment you
        need an email, you need a lost-password flow; the moment you
        need a lost-password flow, someone&apos;s email provider is in
        your threat model. This is a fine trade if what you want is a
        persistent journal, but it rules out the anonymous-from-any-
        browser use case entirely.
      </P>
      <P>
        Separate issue: most of the interesting features (Markdown,
        code editor, daily prompts, cloud backups, tags) sit behind a
        paid subscription. There&apos;s nothing wrong with charging for
        software, but it does push the basic &ldquo;encrypted
        scratchpad I keep forever&rdquo; primitive out of reach for a
        lot of people.
      </P>

      <H2 id="privnote-cryptpad">
        Privnote, CryptPad, Bitwarden Send: the wrong category
      </H2>
      <P>
        <A href="https://privnote.com/">Privnote</A>,{" "}
        <A href="https://cryptpad.fr/">CryptPad</A>,{" "}
        <A href="https://bitwarden.com/products/send/">Bitwarden Send</A>,
        and{" "}
        <A href="https://1password.com/features/secure-password-sharing/">
          1Password Share
        </A>{" "}
        are all great at what they do. They&apos;re just not the same
        primitive. Privnote and Bitwarden Send are{" "}
        <Em>one-shot</Em> tools: you create a link, the recipient opens
        it once, and the note self-destructs. CryptPad is a
        collaborative office suite with encryption. None of them are
        &ldquo;the notepad I return to for years.&rdquo;
      </P>
      <P>
        What I wanted was both. A persistent notepad for the
        long-lived stuff, <Em>and</Em> a one-shot burn-after-reading
        primitive for the ephemeral stuff, both at the same URL, both
        with consistent crypto, both open-source end-to-end. That
        became{" "}
        <A href="/send/new">
          <Code>/send/new</Code>
        </A>{" "}
        next to the main vault.
      </P>

      <H2 id="obsidian-joplin">
        Obsidian and Joplin: brilliant, but not the use case
      </H2>
      <P>
        These are local-first desktop apps. If you have a real machine
        you control and want a knowledge graph with plugins, they&apos;re
        the answer. They don&apos;t help when you can&apos;t install
        software or when you want{" "}
        <A href="/blog/plausible-deniability-hidden-volumes-explained">
          plausible deniability
        </A>{" "}
        rather than local-disk encryption. The ideal setup is probably
        both &mdash; Obsidian at home, Flowvault everywhere else.
      </P>

      <H2 id="plausible-deniability">
        The feature nobody else had: plausible deniability
      </H2>
      <P>
        The specific gap that tipped me from &ldquo;I should use X
        instead&rdquo; to &ldquo;I should write something new&rdquo;
        was plausible deniability. VeraCrypt and TrueCrypt have had
        hidden volumes for disk encryption since forever. The idea
        translates perfectly to a notepad: one URL, one fixed-size
        ciphertext blob, multiple passwords, each unlocking a
        different notebook, and no way for the server (or anyone who
        stole the blob) to tell how many notebooks exist.
      </P>
      <P>
        None of the incumbent notepads do this. ProtectedText is
        one-password-one-blob. Standard Notes gates sharing behind
        accounts. Privnote is single-shot. The obvious hole was
        &ldquo;<Em>VeraCrypt for a browser notepad</Em>&rdquo; and I
        spent a while convinced somebody must have shipped that
        already. They hadn&apos;t. So Flowvault became that, first.
      </P>
      <P>
        The mechanism turned out to be straightforward once I stopped
        overthinking it &mdash; I wrote up the details in{" "}
        <A href="/blog/plausible-deniability-hidden-volumes-explained">
          a dedicated deep-dive on hidden volumes
        </A>
        . The short version: 64 fixed-size slots inside one blob, each
        password deterministically hashed to one slot, empty slots
        pre-filled with random bytes indistinguishable from real
        ciphertext.
      </P>

      <H2 id="design-principles">The four design principles</H2>
      <P>
        Once I decided to write something new, the rules of the road
        crystallised quickly. Four principles, no negotiable ones.
      </P>

      <H2 id="principle-1">
        1. Zero-knowledge is non-negotiable &mdash; and server code counts
      </H2>
      <P>
        The server stores opaque bytes. We don&apos;t learn your
        password, we don&apos;t learn your plaintext, we don&apos;t
        learn how many notebooks a vault contains. Fine &mdash; every
        modern notepad claims this. The interesting part is making
        that claim verifiable.
      </P>
      <P>
        That means the{" "}
        <A href="https://github.com/Flowdesktech/flowvault">
          entire stack
        </A>{" "}
        ships in one repo: frontend, Cloud Functions (the trusted-
        handover sweep, the Encrypted Send read path, the time-lock
        writer), and the Firestore security rules &mdash; which are
        the <Em>actual</Em> boundary Google&apos;s infrastructure
        enforces between us and your data. If those three pieces
        aren&apos;t all in your hands, the zero-knowledge claim is on
        trust.
      </P>

      <H2 id="principle-2">2. Modern crypto, honestly specified</H2>
      <P>
        Argon2id for key derivation, with 64 MiB of memory and 3
        iterations (tuned to ~1 s on a mid-range laptop). AES-256-GCM
        for authenticated encryption. HKDF for key separation. No
        custom crypto, no rolled-my-own anything.
      </P>
      <P>
        The <A href="/security">security page</A> lists the exact
        parameters and the exact limits. No hand-waving: if something
        has a trade-off (and nearly everything does), it&apos;s
        written down next to the thing.
      </P>

      <H2 id="principle-3">
        3. No account, ever, for anything the user does day-to-day
      </H2>
      <P>
        Opening a vault, adding a decoy password, sending a
        self-destructing secret, sealing a time-locked note,
        downloading a backup, restoring a backup on a self-hosted
        instance &mdash; none of these ever ask for an email or create
        a user record. The URL slug plus the password plus (for
        handovers) a trusted beneficiary&apos;s password is the whole
        identity system.
      </P>

      <H2 id="principle-4">
        4. Features must compose, not fragment
      </H2>
      <P>
        The easy mistake is to ship the notepad, then launch a
        separate product for one-shot sharing, then another for
        time-locked messages, and another for encrypted sharing with a
        link. Three sign-ins, three brands, three threat models to
        keep straight. Flowvault puts all of it behind the same URL,
        the same crypto primitives, and the same open repo:
      </P>
      <Ul>
        <Li>
          The <Em>persistent</Em> notepad with hidden-volume
          deniability.
        </Li>
        <Li>
          A{" "}
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            trusted handover
          </A>{" "}
          that releases the vault to a beneficiary if you stop
          checking in.
        </Li>
        <Li>
          <A href="/blog/time-locked-notes-drand-tlock">
            Time-locked notes
          </A>{" "}
          keyed to the drand beacon so nobody &mdash; including us
          &mdash; can decrypt before the target date.
        </Li>
        <Li>
          <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
            Encrypted Send
          </A>
          , the one-shot self-destructing cousin of Bitwarden Send and
          Privnote.
        </Li>
        <Li>
          <A href="/blog/encrypted-backup-fvault-format">
            Zero-knowledge <Code>.fvault</Code> backups
          </A>{" "}
          and plaintext Markdown export for migrations.
        </Li>
      </Ul>

      <H2 id="what-flowvault-is-not">What Flowvault is not trying to be</H2>
      <P>
        It&apos;s worth being direct about the edges of the project,
        because they matter for deciding if Flowvault fits your
        workflow.
      </P>
      <Ul>
        <Li>
          <Strong>Not a knowledge graph.</Strong> No backlinks, no
          tags, no search index. Each slot holds around 8 KiB per tab
          in the default configuration. Spreading a notebook across
          slots is on the roadmap, but Flowvault is aimed at
          scratchpad + secret-store duty, not replacing Obsidian.
        </Li>
        <Li>
          <Strong>Not a multi-device sync app.</Strong> The notebook
          lives in one Firestore document. Two tabs on two devices
          with the same password work fine (with optimistic-
          concurrency conflict detection) but this is not a
          pass-through to a CRDT.
        </Li>
        <Li>
          <Strong>Not an office suite.</Strong> Plain text, one pane,
          Markdown-aware. If you want spreadsheets or slides with
          cryptography, use CryptPad.
        </Li>
        <Li>
          <Strong>Not a funding story.</Strong> We take direct crypto
          donations through{" "}
          <A href="/donate">NOWPayments</A> (no donor email, no
          account, fresh address per donation). That&apos;s the whole
          business model. No ads, no analytics, no paid tier planned
          in the short term.
        </Li>
      </Ul>

      <H2 id="where-to-start">Where to start if you&apos;re curious</H2>
      <P>
        The rest of this blog is the feature-by-feature walkthrough:
      </P>
      <Ul>
        <Li>
          <A href="/blog/how-to-use-flowvault-guide">
            The beginner&apos;s guide
          </A>{" "}
          walks through every click, end-to-end.
        </Li>
        <Li>
          <A href="/blog/plausible-deniability-hidden-volumes-explained">
            Hidden volumes explained
          </A>{" "}
          is the deep-dive on the deniability feature and why
          it&apos;s unique in this category.
        </Li>
        <Li>
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            Trusted handover
          </A>{" "}
          covers the inactivity-triggered release and the Bitwarden
          Emergency Access comparison.
        </Li>
        <Li>
          <A href="/blog/time-locked-notes-drand-tlock">
            Time-locked notes
          </A>{" "}
          walks through drand + tlock.
        </Li>
        <Li>
          <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
            Encrypted Send compared
          </A>{" "}
          is the no-punches-pulled head-to-head.
        </Li>
        <Li>
          <A href="/blog/encrypted-backup-fvault-format">
            The <Code>.fvault</Code> backup format
          </A>{" "}
          documents the portability story.
        </Li>
      </Ul>
      <P>
        Or just open{" "}
        <A href="/">the home page</A>, pick a URL, set a password, and
        start writing. You can read every line of code that ran on
        your behalf afterwards.
      </P>
    </>
  );
}
