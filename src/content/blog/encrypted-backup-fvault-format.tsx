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
  Example,
} from "@/components/blog/Prose";

export default function Post() {
  return (
    <>
      <Lead>
        A zero-knowledge service puts a specific responsibility on the
        user: if you lose the password, the data is gone. Backups are
        the insurance policy. Flowvault&apos;s answer is the{" "}
        <Code>.fvault</Code> file: exactly the ciphertext the server
        already holds, plus the KDF parameters needed to unlock it,
        bundled into a single JSON envelope that stays zero-knowledge
        even on your desktop. This post walks through the format, the
        design decisions, and how it compares to the exports from
        Bitwarden, Standard Notes, and CryptPad.
      </Lead>

      <H2 id="goal">What a zero-knowledge backup has to do</H2>
      <P>
        There are four constraints, and they trade off in awkward
        ways:
      </P>
      <Ol>
        <Li>
          <Strong>Must be enough to restore without the operator.</Strong>{" "}
          The whole point of the backup is that the service could
          vanish tomorrow and you&apos;d still be fine. That means
          salt, KDF parameters, volume layout, and ciphertext all have
          to be in the file.
        </Li>
        <Li>
          <Strong>Must stay zero-knowledge once downloaded.</Strong>{" "}
          Your password can&apos;t be in the file. Neither can any
          plaintext. A stolen backup must be indistinguishable from a
          stolen Firestore document.
        </Li>
        <Li>
          <Strong>Must preserve deniability.</Strong> If you have
          decoy notebooks, the backup has to round-trip them too
          &mdash; without ever listing how many active slots there are.
        </Li>
        <Li>
          <Strong>Must be restorable on any instance.</Strong> Not
          just ours. A self-hosted Flowvault (your own Firebase
          project) should be able to read the file and recreate the
          vault.
        </Li>
      </Ol>
      <P>
        The <Code>.fvault</Code> format is engineered backwards from
        those four constraints.
      </P>

      <H2 id="shape">The shape of the file</H2>
      <P>
        A <Code>.fvault</Code> is a single UTF-8 JSON document. Binary
        fields are Base64url-encoded because JSON doesn&apos;t handle
        raw bytes. The envelope looks like this (with a real-world
        example truncated):
      </P>
      <Example title="flowvault-backup (v1)">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`{
  "kind": "flowvault-backup",
  "version": 1,
  "exportedAt": 1745272800000,
  "slugHint": "project-alpha",
  "kdfSalt": "C0X7...base64url...",
  "kdfParams": {
    "algo": "argon2id",
    "memoryKiB": 65536,
    "iterations": 3,
    "parallelism": 1
  },
  "volume": {
    "format": "hidden-volume-v1",
    "slotCount": 64,
    "slotSize": 4096
  },
  "ciphertext": "RVaB...base64url (256 KiB of slots) ..."
}`}</pre>
      </Example>
      <P>
        Every field is there for a specific reason. Let&apos;s walk
        through them.
      </P>

      <H3 id="kind-version">
        <Code>kind</Code> + <Code>version</Code>
      </H3>
      <P>
        Magic string and format version. On open, the client asserts{" "}
        <Code>kind === &quot;flowvault-backup&quot;</Code> and checks
        the version. The current format is v1; anything newer gets
        handled when it ships, older gets a migration path. The magic
        string is there so a mis-uploaded file (a ZIP, a PDF, a wrong
        <Code>.fvault</Code> from a different tool) fails fast with a
        clear error rather than trying to decrypt random bytes.
      </P>

      <H3 id="exported-at">
        <Code>exportedAt</Code>
      </H3>
      <P>
        Unix milliseconds. Just metadata. Not used for decryption, but
        useful if you have multiple backups and want to pick the
        newest.
      </P>

      <H3 id="slug-hint">
        <Code>slugHint</Code>
      </H3>
      <P>
        The URL slug the vault was originally at. This is{" "}
        <Em>not authoritative</Em> &mdash; on restore, you choose a
        fresh slug (the old one might be taken, or you might be
        restoring into a private self-hosted instance with different
        slug rules). It&apos;s there so the restore page can
        pre-populate the field with a sensible default.
      </P>

      <H3 id="kdf-params">
        <Code>kdfSalt</Code> + <Code>kdfParams</Code>
      </H3>
      <P>
        The Argon2id parameters that turn your password into a key.
        The salt is 16 random bytes that were generated when the vault
        was first created; it never changes across saves, so a backup
        and the live vault share the same salt. The parameters are
        frozen per-vault: if we increase defaults in the future, old
        vaults keep their old parameters (or get migrated on your
        explicit opt-in).
      </P>
      <Callout tone="note" title="Why include KDF parameters in the file">
        Suppose Flowvault ships Argon2id v2 tomorrow with higher
        memory. A backup from today still needs to unlock under the
        original parameters. Storing the parameters in the envelope
        means a 10-year-old backup still opens against a 10-year-old
        password, regardless of what the current server defaults are.
      </Callout>

      <H3 id="volume">
        <Code>volume</Code>
      </H3>
      <P>
        The hidden-volume layout: format version, slot count (64),
        slot size (4 KiB by default). Also frozen per-vault. Future
        volume formats will add a new <Code>format</Code> string and
        migrate alongside a version bump.
      </P>

      <H3 id="ciphertext">
        <Code>ciphertext</Code>
      </H3>
      <P>
        The main payload. It&apos;s exactly{" "}
        <Code>slotCount * slotSize = 256 KiB</Code> of bytes, Base64url-
        encoded (which makes it roughly 342 KiB on disk). This is the
        same blob the server has, copied byte-for-byte.
      </P>
      <P>
        Indistinguishable from random. Decoy slots are random. Active
        slots are AES-GCM ciphertexts keyed to your password(s). No
        structure distinguishes the two.
      </P>

      <H2 id="zero-knowledge">
        &ldquo;Zero-knowledge even on your laptop&rdquo;
      </H2>
      <P>
        The crucial property: once downloaded, the file tells an
        attacker the same amount about your notes as the Firestore
        blob tells our server &mdash; which is to say, nothing. The
        KDF parameters are public info (same for all v1 vaults). The
        salt is a random 16 bytes; it doesn&apos;t leak anything
        useful. The ciphertext is AES-GCM under Argon2id-derived keys;
        without a password it&apos;s noise.
      </P>
      <P>
        Consequences:
      </P>
      <Ul>
        <Li>
          Emailing yourself a <Code>.fvault</Code> over Gmail: the
          ciphertext is still only readable with your password. Gmail
          is not in your threat model for the contents.
        </Li>
        <Li>
          Dropping one on a USB stick and losing the stick: ditto.
        </Li>
        <Li>
          Storing in iCloud / OneDrive / Dropbox: provider sees 350
          KB of random-looking bytes per backup. They can&apos;t tell
          what you wrote.
        </Li>
      </Ul>
      <Callout tone="warn" title="But the password still has to be strong">
        A weak password (&ldquo;kitty123&rdquo;) means someone who
        grabs the file can brute-force it offline. At Flowvault&apos;s
        default Argon2id settings this takes about 1 second per
        attempt per CPU core, so a password worth brute-forcing at
        scale still needs enough entropy to be impractical.
      </Callout>

      <H2 id="restore">The restore flow</H2>
      <P>
        To restore, you go to <A href="/restore">/restore</A> and
        drop the file. The client:
      </P>
      <Ol>
        <Li>
          Parses the JSON envelope. Checks <Code>kind</Code> and{" "}
          <Code>version</Code>. Decodes the Base64url fields.
        </Li>
        <Li>
          Lets you pick a fresh slug. (Existing slugs are rejected
          &mdash; Flowvault refuses to overwrite a live vault.)
        </Li>
        <Li>
          Uploads the ciphertext + KDF salt + KDF params + volume
          params as the initial document for the new slug.
        </Li>
      </Ol>
      <P>
        Restore <Em>never</Em> asks for a password. There&apos;s no
        decryption happening. The whole restore operation is
        &ldquo;create a new Firestore document pre-populated with the
        ciphertext.&rdquo; After restore, open the new URL normally
        and enter your original password(s) to read.
      </P>
      <P>
        This matters for self-hosting too: if you run your own
        Flowvault instance (see the{" "}
        <A href="https://github.com/Flowdesktech/flowvault">
          self-host guide in the README
        </A>
        ), you can restore backups made against our hosted service
        into your own infrastructure. The ciphertext is portable.
      </P>

      <H2 id="markdown-export">Plaintext Markdown export</H2>
      <P>
        Sometimes you genuinely want plaintext. Moving to Obsidian,
        committing notes to a private git repo, sharing with a
        collaborator who doesn&apos;t have a Flowvault URL. The{" "}
        <Code>Export</Code> menu in the editor toolbar has a second
        option: <Em>Plaintext Markdown (.zip)</Em>.
      </P>
      <P>
        Rules:
      </P>
      <Ul>
        <Li>
          Behind an explicit confirmation (&ldquo;this creates
          unencrypted files on your disk&rdquo;).
        </Li>
        <Li>
          <Strong>Only the current slot is exported.</Strong> If you
          have decoy notebooks behind other passwords, they&apos;re
          not touched &mdash; preserving deniability even if somebody
          asks &ldquo;can I see the whole export?&rdquo;
        </Li>
        <Li>
          Each tab becomes a <Code>.md</Code> file named after the
          tab; a <Code>README.md</Code> in the root of the zip lists
          them.
        </Li>
        <Li>
          The zip uses the minimal STORE method (no compression),
          which makes the implementation small and
          dependency-free &mdash; Flowvault ships its own 400-line zip
          writer rather than pulling in a full archiver.
        </Li>
      </Ul>

      <H2 id="compared">
        Compared to other encrypted-notes exports
      </H2>

      <H3 id="bitwarden-export">Bitwarden vault export</H3>
      <P>
        Bitwarden exports both <Em>unencrypted</Em> JSON and an
        encrypted variant. The encrypted variant is password-protected
        but uses a user-chosen password that&apos;s independent of the
        vault&apos;s master password, so it&apos;s effectively a
        second account of trust. Importing into a different Bitwarden
        instance works; importing into any other product doesn&apos;t
        (format is bespoke). Decoy notebooks don&apos;t apply &mdash;
        Bitwarden has no deniability concept.
      </P>

      <H3 id="standard-notes-export">Standard Notes backups</H3>
      <P>
        Standard Notes has{" "}
        <A href="https://standardnotes.com/help/66/can-i-backup-my-notes-automatically">
          automated encrypted backups
        </A>
        : scheduled exports to disk or cloud, encrypted with a
        user-provided password. Format is proprietary but documented.
        Same pattern as Flowvault: self-contained, zero-knowledge,
        restorable. The main differences are UI polish (scheduled
        vs manual) and format complexity (Standard Notes&apos;s
        export is more featureful because notes are typed items, not
        raw text).
      </P>

      <H3 id="cryptpad-export">CryptPad exports</H3>
      <P>
        CryptPad exports individual pads as unencrypted Markdown, a
        sharable &ldquo;hidden link&rdquo; (which includes the key in
        the fragment), or the raw CryptPad drive dump. There&apos;s
        no single-file encrypted backup format equivalent to{" "}
        <Code>.fvault</Code>. If you want portable encrypted snapshots
        of a whole CryptPad drive, you&apos;re largely relying on
        the server&apos;s presence.
      </P>

      <H3 id="protectedtext-export">ProtectedText exports</H3>
      <P>
        ProtectedText has no export function. The only way to get a
        copy is manually copy the visible text, which is lossy and
        manual. This was one of the specific gaps that motivated
        adding <Code>.fvault</Code> + Markdown export to Flowvault.
      </P>

      <Example title="Export feature comparison">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`                              Flowvault   Bitwarden   Standard   CryptPad  Protected-
                              (.fvault)   encrypted   Notes      (raw)     Text
                                          JSON        backup

Single-file encrypted export  yes         yes         yes        no        no
Zero-knowledge on disk        yes         yes         yes        partial   n/a
Plaintext export available    yes         yes         yes        yes       manual only
Preserves decoy volumes       yes         n/a         n/a        n/a       n/a
Restorable without account    yes         yes         yes        limited   no
Self-host compatible          yes         yes         yes        yes       no`}</pre>
      </Example>

      <H2 id="practical">Practical advice</H2>
      <Ul>
        <Li>
          <Strong>Back up whenever you make significant edits.</Strong>{" "}
          A <Code>.fvault</Code> is 350 KB; it costs nothing to keep a
          dozen timestamped copies.
        </Li>
        <Li>
          <Strong>Store backups where a future you will find them.</Strong>{" "}
          A cloud drive is fine because the file is still zero-
          knowledge; an encrypted USB is fine; emailing to yourself
          is fine.
        </Li>
        <Li>
          <Strong>Pair with the trusted handover.</Strong> A{" "}
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            handover
          </A>{" "}
          ensures your beneficiary can read the live vault; a{" "}
          <Code>.fvault</Code> ensures they can read it even if
          Flowvault itself has stopped existing.
        </Li>
        <Li>
          <Strong>Test a restore at least once.</Strong> Download a
          backup, restore it to a fresh slug, unlock, verify the tabs
          match. Do this before you ever actually need it.
        </Li>
        <Li>
          <Strong>Use Markdown export only when you mean it.</Strong>{" "}
          Once plaintext <Code>.md</Code> files are on your disk they
          travel with your backups, your Dropbox, and your recycle
          bin. That&apos;s fine for migration; bad for routine
          snapshots.
        </Li>
      </Ul>

      <H2 id="format-evolution">Format evolution</H2>
      <P>
        <Code>.fvault</Code> is versioned for a reason. Likely future
        additions:
      </P>
      <Ul>
        <Li>
          <Code>version: 2</Code> &mdash; larger slot size for
          bigger notebooks, breaking change for the on-disk layout.
        </Li>
        <Li>
          Optional post-quantum KDF parameters, once the ecosystem
          settles on a scheme.
        </Li>
        <Li>
          Multi-file snapshot bundles for very large vaults (chunked
          ciphertext).
        </Li>
      </Ul>
      <P>
        Backwards compatibility is the constraint: restore must always
        accept any old version we&apos;ve ever shipped. That&apos;s
        why the envelope carries its full KDF and volume parameters
        rather than reading them from the current server defaults.
      </P>

      <H2 id="see-also">See also</H2>
      <Ul>
        <Li>
          <A href="/restore">
            <Code>/restore</Code>
          </A>{" "}
          &mdash; the restore page, with a file picker that accepts{" "}
          <Code>.fvault</Code>.
        </Li>
        <Li>
          <A href="/blog/how-to-use-flowvault-guide">
            The beginner&apos;s guide
          </A>{" "}
          &mdash; where backup / restore fits in the broader
          workflow.
        </Li>
        <Li>
          <A href="/blog/plausible-deniability-hidden-volumes-explained">
            Hidden volumes explained
          </A>{" "}
          &mdash; why decoy slots stay indistinguishable even in a
          backup file.
        </Li>
        <Li>
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            Trusted handover
          </A>{" "}
          &mdash; complementary: handover for live vaults,{" "}
          <Code>.fvault</Code> for offline insurance.
        </Li>
        <Li>
          <A href="/security">The security page</A> &mdash; exact
          parameter values and format references.
        </Li>
      </Ul>
    </>
  );
}
