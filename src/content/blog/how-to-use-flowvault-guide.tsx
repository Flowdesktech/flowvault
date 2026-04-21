import {
  Lead,
  H2,
  H3,
  P,
  Ul,
  Ol,
  Li,
  Code,
  Strong,
  Em,
  A,
  Callout,
  DefList,
  DefItem,
} from "@/components/blog/Prose";

export default function Post() {
  return (
    <>
      <Lead>
        The fastest way to learn Flowvault is to open it and type. This
        guide covers the same ground you would hit by exploring, in the
        order most people actually need things: your first vault, how
        saving and tabs work, when to add a decoy password, and how to
        reach for the trusted handover, time-locked notes, Encrypted
        Send, and encrypted backups when the situation calls for them.
      </Lead>

      <H2 id="first-vault">Step one: your first vault</H2>
      <P>
        Go to{" "}
        <A href="/">
          <Code>flowvault.flowdesk.tech</Code>
        </A>
        . You&apos;ll see a single input box that expects a URL slug
        &mdash; something like <Code>my-notes</Code> or{" "}
        <Code>project-alpha</Code>. Type anything lower-case, hit{" "}
        <Code>Open</Code>, and Flowvault will either:
      </P>
      <Ul>
        <Li>
          Load the existing vault if someone already registered that
          slug (in which case you need their password to decrypt it),
          or
        </Li>
        <Li>
          Offer to create a new vault if the slug is free &mdash; just
          set a password, confirm, and you&apos;re in.
        </Li>
      </Ul>
      <Callout tone="warn" title="There is no password reset">
        Zero-knowledge means exactly that: we don&apos;t have your
        password, your key, or any copy of either. Forgetting the
        password is identical to destroying the notebook. Write it
        somewhere you&apos;ll find again &mdash; a password manager is
        ideal.
      </Callout>
      <P>
        The slug you picked becomes a permanent URL (e.g.{" "}
        <Code>flowvault.flowdesk.tech/s/my-notes</Code>). Bookmark it,
        or just remember it &mdash; the point of the slug-plus-password
        design is that a bookmark isn&apos;t required.
      </P>

      <H2 id="writing-and-saving">Step two: writing and saving</H2>
      <P>
        The editor is a single pane of plain text with Markdown
        awareness. Type anything; saves happen{" "}
        <Strong>
          automatically, in the background, debounced by around a
          second
        </Strong>{" "}
        after you stop typing. The status badge in the top bar shows
        one of three states:
      </P>
      <DefList>
        <DefItem term="Saving…">
          Flowvault is currently re-encrypting the whole notebook with
          your master key and uploading the new ciphertext blob.
        </DefItem>
        <DefItem term="Saved">
          The server has acknowledged the write and bumped the version
          counter. If you have a trusted handover configured, this
          save also counts as a heartbeat.
        </DefItem>
        <DefItem term="Error">
          Either the network dropped, another tab edited the same
          vault (optimistic-concurrency conflict), or the server
          rejected the write (for example because the handover fired
          while you were editing). The banner suggests the fix.
        </DefItem>
      </DefList>
      <P>
        You can also hit the <Code>Save</Code> button to flush
        immediately, or the <Code>Lock</Code> button to clear the key
        from memory and return to the password prompt without closing
        the tab.
      </P>

      <H3 id="tabs">Tabs: many notebooks under one password</H3>
      <P>
        Click <Code>+ New</Code> above the editor to create a tab.
        Double-click (or hover + pencil icon) to rename, drag to
        reorder, and click the <Code>&times;</Code> to delete. Every
        tab is part of the same encrypted slot, so the server sees one
        opaque blob whether you have one tab or twenty. Tab titles
        themselves are zero-knowledge &mdash; nobody who doesn&apos;t
        have your password can tell how many tabs you have or what
        they&apos;re called.
      </P>
      <Callout tone="note">
        The default slot size holds around 8 KiB (~1,500 words) total,
        shared across all tabs for that password. A single vault has
        64 slots for up to 512 KiB. Spreading a single long document
        across multiple slots is on the roadmap.
      </Callout>

      <H2 id="decoy-passwords">
        Step three: adding a decoy password
      </H2>
      <P>
        This is the flagship feature and the one no other browser
        notepad offers. The design principle: one URL holds up to 64
        independent notebooks, each behind a different password, and{" "}
        <Em>nobody</Em> can tell how many exist. The deep mechanics
        are in{" "}
        <A href="/blog/plausible-deniability-hidden-volumes-explained">
          the hidden-volumes deep dive
        </A>
        ; the UI is simple.
      </P>
      <Ol>
        <Li>
          Open the vault under your <Em>real</Em> password so you have
          the master key in memory.
        </Li>
        <Li>
          Click <Code>Add password</Code> in the editor toolbar.
        </Li>
        <Li>
          Enter a new password (the decoy one). Optionally seed the
          new notebook with initial content so it looks ordinary if
          handed over under coercion.
        </Li>
        <Li>Click confirm. Flowvault writes a new slot, encrypted under an
          independent key, and leaves your current notebook untouched.
        </Li>
      </Ol>
      <P>
        From now on, the same URL accepts either password. Each one
        unlocks its own notebook. The server can&apos;t tell there are
        two notebooks. An attacker with a copy of the ciphertext
        can&apos;t tell either &mdash; the unused slots are
        indistinguishable random bytes.
      </P>
      <Callout tone="tip" title="Practical uses">
        A decoy notebook full of grocery lists and work notes. A real
        notebook with travel documents or a recovery phrase. A third
        notebook you don&apos;t tell anyone about even under friendly
        questioning. Same URL, same password prompt, three different
        realities.
      </Callout>

      <H2 id="trusted-handover">
        Step four: trusted handover (for inheritance)
      </H2>
      <P>
        If nobody inherits your notebook when you&apos;re hit by a bus,
        it&apos;s gone. The trusted handover is the answer: pick a
        beneficiary password, give it to someone you trust out of
        band, and configure an inactivity interval. If you stop saving
        for that interval plus a grace period, the vault becomes
        readable to the beneficiary. The full crypto is in{" "}
        <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
          its own post
        </A>
        ; the UI flow:
      </P>
      <Ol>
        <Li>
          In the editor toolbar, click{" "}
          <Code>Handover</Code> (clock icon).
        </Li>
        <Li>
          Pick one of the presets &mdash; weekly / monthly /
          quarterly / yearly check-in cadences &mdash; or set a custom
          interval and grace period.
        </Li>
        <Li>
          Choose a <Em>beneficiary password</Em> at least 12 characters
          long. This is a <Em>different</Em> password from your own;
          it&apos;s the one you&apos;ll give to the person who
          inherits.
        </Li>
        <Li>Click <Code>Enable trusted handover</Code>.</Li>
      </Ol>
      <P>
        Share the beneficiary password with your trusted person over
        something sturdy &mdash; a sealed envelope, a password
        manager&apos;s share link, an in-person conversation &mdash;
        and tell them the URL. From then on, every save counts as a
        check-in. If you go quiet past the interval plus grace, an
        hourly Cloud Function marks the vault released and the
        beneficiary password starts unlocking it.
      </P>
      <Callout tone="warn" title="It only affects the notebook you set it up from">
        The handover wraps the master key of the notebook that was
        open when you configured it. If you have other decoy notebooks
        under different passwords in the same vault, they&apos;re not
        touched &mdash; the beneficiary only inherits the one you
        explicitly set up.
      </Callout>

      <H2 id="encrypted-send">
        Step five: Encrypted Send (one-shot secrets)
      </H2>
      <P>
        Use case: you need to hand someone a password, a recovery
        phrase, or a short piece of sensitive info, and you&apos;d
        rather not leave it in Slack or email. The detailed comparison
        against Bitwarden Send and Privnote is in{" "}
        <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
          this post
        </A>
        ; the how-to:
      </P>
      <Ol>
        <Li>
          Go to{" "}
          <A href="/send/new">
            <Code>/send/new</Code>
          </A>
          .
        </Li>
        <Li>
          Paste the secret (up to 128 KiB of plaintext).
        </Li>
        <Li>
          Choose how long it should live (up to 30 days) and how many
          times it can be opened (default: once).
        </Li>
        <Li>
          Optional: tick &ldquo;Also require a password to open,&rdquo;
          which adds an Argon2id-gated second layer. Share the
          password over a different channel from the link.
        </Li>
        <Li>
          Click <Code>Create link</Code>. You get a URL that looks
          like{" "}
          <Code>flowvault.flowdesk.tech/send/&lt;id&gt;#k=&lt;key&gt;</Code>
          . The <Code>#k=...</Code> fragment is the AES-256 key; your
          browser never sends it to the server.
        </Li>
      </Ol>
      <P>
        When the recipient opens the link, a Cloud Function decrements
        the view counter in a transaction and hard-deletes the document
        when the last view is consumed. Firestore rules deny direct
        reads by clients, so the counter is trustworthy &mdash; not a
        suggestion.
      </P>

      <H2 id="time-locked-notes">
        Step six: time-locked notes (messages to the future)
      </H2>
      <P>
        These are complementary to the trusted handover. A handover
        releases a vault if <Em>you go quiet</Em>. A time-locked note
        releases a message if <Em>a future date arrives</Em>, and not
        before &mdash; not even to the sender. The mechanism uses the
        drand randomness beacon and tlock identity-based encryption,
        detailed in{" "}
        <A href="/blog/time-locked-notes-drand-tlock">
          the time-lock post
        </A>
        . The UI:
      </P>
      <Ol>
        <Li>
          Visit{" "}
          <A href="/timelock/new">
            <Code>/timelock/new</Code>
          </A>
          .
        </Li>
        <Li>
          Compose your message (up to 128 KiB).
        </Li>
        <Li>
          Pick an unlock moment. Anything from a few minutes out to
          decades; the granularity is 30 seconds.
        </Li>
        <Li>
          Optional: tick &ldquo;Also require a password to read&rdquo;
          to layer an Argon2id-keyed inner wrap around the time-lock.
          The reader then needs both the link <Em>and</Em> the
          password, and both gates arrive independently.
        </Li>
        <Li>
          Click <Code>Create time-lock</Code> and share the resulting{" "}
          <Code>flowvault.flowdesk.tech/t/&lt;id&gt;</Code> link.
          Opening it before the unlock moment shows a countdown; after,
          the reader&apos;s browser grabs the drand round signature
          and decrypts locally.
        </Li>
      </Ol>
      <Callout tone="note" title="Real use cases">
        A future-self letter scheduled for a birthday. A recovery
        envelope that only becomes readable a year from now. A
        disclosure commitment (&ldquo;this will open in exactly 90
        days&rdquo;) that you can&apos;t withdraw because even you
        don&apos;t have the key.
      </Callout>

      <H2 id="backup-restore">Step seven: encrypted backup</H2>
      <P>
        Once you&apos;ve got content you care about, take a snapshot.
        Open the vault and use the{" "}
        <Code>Export</Code> menu in the toolbar, which offers two
        options. The format is documented in detail in{" "}
        <A href="/blog/encrypted-backup-fvault-format">
          the .fvault post
        </A>
        ; the short version:
      </P>
      <Ul>
        <Li>
          <Strong>Encrypted backup (.fvault)</Strong> — a single file
          containing the same ciphertext blob the server stores, plus
          the Argon2id salt and KDF parameters. It&apos;s still
          zero-knowledge: reading it requires your password, and every
          decoy slot remains opaque. Preserves every password on the
          vault, tabs and all.
        </Li>
        <Li>
          <Strong>Plaintext Markdown (.zip)</Strong> — behind an
          explicit confirmation, the current slot&apos;s tabs are
          written to <Code>.md</Code> files in a zip, with a{" "}
          <Code>README.md</Code> index. Only the slot you currently
          have unlocked is exported; decoy slots are never included,
          which preserves deniability even under coercion. This is the
          format to pick for migration to Obsidian, a git repo, or
          Standard Notes.
        </Li>
      </Ul>
      <H3 id="restore">Restoring a backup</H3>
      <P>
        To restore, drop the <Code>.fvault</Code> file on{" "}
        <A href="/restore">
          <Code>/restore</Code>
        </A>
        , pick a fresh URL slug, and click <Code>Restore vault</Code>.
        You never type a password during restore &mdash; there&apos;s
        no decryption happening server-side. Once the vault exists at
        the new slug, open it like any other and enter the original
        password(s). Restore refuses to overwrite an existing slug;
        pick a new one if yours is taken.
      </P>

      <H2 id="two-tabs-two-devices">
        Working across two tabs or two devices
      </H2>
      <P>
        The same URL + password opens fine on as many devices as you
        like. If two people (or one person in two tabs) edit the same
        vault at the same time, the optimistic-concurrency check
        catches it: the second writer gets a conflict error instead of
        silently overwriting the first. Reload to see the latest
        version, then retry your edit.
      </P>
      <P>
        This is also why reliable sharing works: give a trusted
        collaborator both the URL and the password, both of you can
        read and write, and neither of you will silently clobber the
        other&apos;s work.
      </P>

      <H2 id="quick-reference">Quick reference</H2>
      <DefList>
        <DefItem term="Create / open a vault">
          <A href="/">Home page</A>, type a slug, set a password.
        </DefItem>
        <DefItem term="Add a decoy password">
          Editor toolbar &rarr; <Code>Add password</Code>.
        </DefItem>
        <DefItem term="Enable trusted handover">
          Editor toolbar &rarr; <Code>Handover</Code>, pick interval
          and beneficiary password.
        </DefItem>
        <DefItem term="Send a one-shot encrypted note">
          <A href="/send/new">/send/new</A>.
        </DefItem>
        <DefItem term="Time-lock a message">
          <A href="/timelock/new">/timelock/new</A>.
        </DefItem>
        <DefItem term="Back up a vault">
          Editor toolbar &rarr;{" "}
          <Code>Export &rarr; Encrypted backup (.fvault)</Code>.
        </DefItem>
        <DefItem term="Migrate to Obsidian / plaintext">
          Editor toolbar &rarr;{" "}
          <Code>Export &rarr; Plaintext Markdown (.zip)</Code>.
        </DefItem>
        <DefItem term="Restore a backup">
          <A href="/restore">/restore</A>, drop the{" "}
          <Code>.fvault</Code> file, pick a new slug.
        </DefItem>
      </DefList>

      <H2 id="next">Where to go next</H2>
      <P>
        If you&apos;re curious about what happens behind the UI, each
        feature has a deep-dive post:
      </P>
      <Ul>
        <Li>
          <A href="/blog/plausible-deniability-hidden-volumes-explained">
            Hidden volumes explained
          </A>
        </Li>
        <Li>
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            Trusted handover
          </A>
        </Li>
        <Li>
          <A href="/blog/time-locked-notes-drand-tlock">
            Time-locked notes
          </A>
        </Li>
        <Li>
          <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
            Encrypted Send vs alternatives
          </A>
        </Li>
        <Li>
          <A href="/blog/encrypted-backup-fvault-format">
            The .fvault backup format
          </A>
        </Li>
      </Ul>
      <P>
        Or take the security tour on{" "}
        <A href="/security">/security</A>, which lists the exact crypto
        primitives, parameters, and threat-model limits.
      </P>
    </>
  );
}
