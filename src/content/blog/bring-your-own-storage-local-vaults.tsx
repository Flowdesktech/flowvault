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
        Flowvault started as &ldquo;an encrypted notepad at a URL.&rdquo;
        Version 1.2 adds the other end of the spectrum:{" "}
        <Strong>an encrypted notepad that lives as a single file on
        your own disk</Strong>, with our servers never seeing the
        ciphertext. Same hidden-volume format, same Argon2id +
        AES-GCM, same multi-notebook tabs &mdash; just written straight
        to <Code>D:\notes\journal.flowvault</Code> (or wherever you
        point it) through your browser&apos;s File System Access API.
        This post is the deep dive: what BYOS changes about the threat
        model, what the on-disk file looks like, which features work
        and which don&apos;t, and what&apos;s coming next (S3, WebDAV,
        and more).
      </Lead>

      <H2 id="why">Why a local-file mode at all?</H2>
      <P>
        Flowvault&apos;s hosted mode is already zero-knowledge. The
        server sees a SHA-256-derived site id, an opaque ciphertext
        blob, your Argon2id salt, and some timestamps &mdash; not your
        password, not your keys, not your plaintext, not even how many
        notebooks live inside the blob. On paper there&apos;s no
        technical reason to take the ciphertext off the server: it
        already tells an attacker (and us) nothing useful.
      </P>
      <P>
        In practice, three things kept coming up in user feedback:
      </P>
      <Ul>
        <Li>
          <Strong>&ldquo;I don&apos;t want to trust the server even
          with opaque bytes.&rdquo;</Strong> Zero-knowledge is a
          cryptographic claim about what&apos;s <Em>on</Em> the server.
          It doesn&apos;t say anything about availability, retention,
          jurisdiction, subpoenas for the blob itself, or what an
          attacker with a stolen database could do with 10 years of
          compute progress. For some threat models the right answer is
          simply: don&apos;t give the server the blob in the first
          place.
        </Li>
        <Li>
          <Strong>&ldquo;I want my notes to work on a laptop I carry
          around, even offline.&rdquo;</Strong> A URL-backed vault
          needs a live server. A file on disk doesn&apos;t.
        </Li>
        <Li>
          <Strong>&ldquo;I already pay for encrypted storage; why not
          use it?&rdquo;</Strong> People have external encrypted
          drives, Nextcloud, S3 buckets with versioning, Proton Drive,
          you name it. For them, Flowvault&apos;s Firestore is an
          extra piece of infrastructure they don&apos;t need.
        </Li>
      </Ul>
      <P>
        BYOS is the answer to all three. The editor stays exactly
        what it was; the storage moves.
      </P>

      <H2 id="create-or-open">Creating or opening a local vault</H2>
      <P>
        From the Flowvault home page, below the usual &ldquo;enter a
        URL&rdquo; form, there are two new buttons:{" "}
        <Strong>Create local vault</Strong> and{" "}
        <Strong>Open local vault</Strong>.
      </P>
      <Ol>
        <Li>
          Click one. Your browser shows a file picker. Choose a path
          like <Code>journal.flowvault</Code> (on create) or select an
          existing <Code>.flowvault</Code> file (on open).
        </Li>
        <Li>
          Enter a password, same way you would for a hosted vault.
          Argon2id derivation runs locally (64 MiB, 3 iterations).
        </Li>
        <Li>
          You land on a URL that looks like{" "}
          <Code>useflowvault.com/local/&lt;uuid&gt;</Code>. The
          UUID is generated in your browser; it&apos;s an opaque
          identifier the editor uses to look up your file handle.{" "}
          <Em>The UUID never leaves your browser</Em> &mdash; the
          route is entirely client-side, and neither the URL nor the
          file name is posted to our servers.
        </Li>
      </Ol>
      <P>
        After that, the editor looks and behaves exactly the way a
        hosted vault does. Save with <Code>Ctrl/Cmd+S</Code>. Add
        tabs. Add a decoy password. Export a <Code>.fvault</Code>{" "}
        backup. Export plaintext Markdown. The only visual difference
        is the header chip, which reads{" "}
        <Code>local: journal.flowvault</Code> instead of{" "}
        <Code>/s/&lt;slug&gt;</Code>.
      </P>

      <H2 id="file-format">What&apos;s inside a .flowvault file</H2>
      <P>
        A <Code>.flowvault</Code> is a hybrid binary + JSON format.
        It needs to carry a fixed-size ciphertext blob (hundreds of
        KiB), so wrapping the whole thing in Base64 (as the{" "}
        <Code>.fvault</Code> backup format does) would balloon the
        on-disk size for no gain. Instead, the file has a short
        binary preamble, a JSON header, and then the raw ciphertext.
      </P>
      <Example title="file layout">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`offset 0      : "FVLV"  (4-byte magic)
offset 4      : headerLen (u32, little-endian)
offset 8      : JSON header (UTF-8, exactly headerLen bytes)
offset 8 + N  : raw ciphertext (fixed size, e.g. 512 KiB)`}</pre>
      </Example>
      <P>
        The magic bytes <Code>FVLV</Code> are there so a mis-opened
        file fails fast &mdash; we check the magic before we try to
        parse anything, and the open flow refuses a file that
        doesn&apos;t start with it. The JSON header carries
        everything the editor needs to know about the vault:
      </P>
      <Example title="flowvault-local (v1) header">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`{
  "formatVersion": 1,
  "localSiteId": "b335d33c-355d-4323-a5b2-771c3009ac5d",
  "vaultVersion": 42,
  "createdAt": 1745272800000,
  "updatedAt": 1745276400000,
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
    "slotSize": 8192
  },
  "ciphertextLen": 524288
}`}</pre>
      </Example>
      <P>
        Everything after <Code>ciphertextLen</Code> bytes into the
        ciphertext region is noise. Every field has a specific
        reason to exist:
      </P>
      <Ul>
        <Li>
          <Code>formatVersion</Code> &mdash; so future files can
          introduce larger slot sizes or new volume formats without
          breaking old readers.
        </Li>
        <Li>
          <Code>localSiteId</Code> &mdash; a per-file UUID. The editor
          asserts that the file it opens reports the same{" "}
          <Code>localSiteId</Code> it was registered under, so an
          accidental overwrite with a different vault file gets
          caught.
        </Li>
        <Li>
          <Code>vaultVersion</Code> &mdash; a monotonic counter used
          for optimistic concurrency. More on this below.
        </Li>
        <Li>
          <Code>kdfSalt</Code>, <Code>kdfParams</Code>,{" "}
          <Code>volume</Code> &mdash; the same three fields that are
          stored on the Firestore document for a hosted vault. They
          pin the cryptographic parameters to the <Em>vault</Em>,
          not to whatever defaults are current at read time.
        </Li>
        <Li>
          <Code>ciphertextLen</Code> &mdash; a sanity check against
          truncation. If the file on disk is shorter than{" "}
          <Code>8 + headerLen + ciphertextLen</Code>, we refuse to
          open it rather than silently reading garbage.
        </Li>
      </Ul>
      <P>
        No passwords, no derived keys, no plaintext, no per-slot
        metadata. Opening the file in a text editor shows you the
        four ASCII magic bytes, the JSON you see above, and then raw
        binary that looks like noise. Decoy slots stay
        indistinguishable from active ones, same as in the hosted
        vault.
      </P>
      <Callout tone="note" title="Why not just reuse .fvault?">
        The <Code>.fvault</Code> backup format is a <Em>snapshot</Em>:
        a self-contained JSON envelope with Base64-encoded
        ciphertext, meant to sit in cold storage. A{" "}
        <Code>.flowvault</Code> is the <Em>live vault</Em>: it gets
        rewritten on every save, so we care about write size and
        alignment. Raw bytes after a short header keeps the editor
        fast and the file roughly the same size as it would be on
        Firestore. The two formats share the ciphertext semantically;
        you can export a <Code>.fvault</Code> from a{" "}
        <Code>.flowvault</Code> at any time.
      </Callout>

      <H2 id="server-view">What the server sees for a local vault</H2>
      <P>
        For the vault itself: nothing. Concretely, when you save a
        local vault, the browser writes bytes to your disk and no
        HTTP request touches our backend. You can verify this from
        your browser&apos;s DevTools network tab: type something,
        save, and watch the tab stay empty.
      </P>
      <P>
        There are two caveats, both deliberate:
      </P>
      <Ul>
        <Li>
          <Strong>Static page loads.</Strong> Vercel serves the
          Flowvault frontend. Opening{" "}
          <Code>/local/&lt;uuid&gt;</Code> fetches the same JS bundle
          as opening any other page; Vercel sees that request, the
          same way it sees any other page view. It doesn&apos;t see
          which file you open or what&apos;s in it.
        </Li>
        <Li>
          <Strong>Server-dependent features.</Strong> If you use
          Encrypted Send or time-locked notes from within a local
          vault, those specific flows still post documents to
          Firestore &mdash; because those features need a server
          (to enforce view caps, to wait for drand). The server
          sees the same opaque ciphertext for those features as it
          would from any hosted vault. It still does not see your
          local vault&apos;s blob.
        </Li>
      </Ul>
      <P>
        One feature <Em>is</Em> disabled entirely for local vaults:
        the <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
          trusted handover
        </A>. That one needs a Cloud Function checking a timer, which
        only makes sense for a document the server owns. The editor
        hides the Handover button for local vaults rather than
        offering something it can&apos;t keep.
      </P>

      <H2 id="concurrency">Concurrency: the in-file CAS counter</H2>
      <P>
        Hosted vaults use Firestore&apos;s conditional writes to
        prevent two tabs from clobbering each other: every save
        includes the <Code>version</Code> you read, and the server
        rejects the write if that version no longer matches. Local
        files have no server to arbitrate, so we do the next best
        thing: the header carries a <Code>vaultVersion</Code>{" "}
        counter, and writes happen in a read-check-write cycle.
      </P>
      <Example title="adapter.ts (simplified)">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`async function writeCiphertext(input) {
  const current = await readFileHeader();
  if (current.vaultVersion !== input.expectedVersion) {
    return { ok: false, currentVersion: current.vaultVersion };
  }
  const nextVersion = current.vaultVersion + 1;
  const payload = encodeLocalVaultFile({
    ...current,
    vaultVersion: nextVersion,
    updatedAt: Date.now(),
    ciphertext: input.ciphertext,
  });
  await writeFileBytes(payload);
  return { ok: true, newVersion: nextVersion };
}`}</pre>
      </Example>
      <P>
        This gets you the same guarantee the hosted backend does{" "}
        <Em>within one device</Em>: if you open the vault in two
        browser tabs and save from both, the second writer sees a
        conflict and is prompted to refresh instead of silently
        overwriting the first.
      </P>
      <Callout tone="warn" title="BYOS is not a sync engine">
        CAS can detect conflicts; it can&apos;t resolve them. If you
        copy the <Code>.flowvault</Code> file to a second device and
        edit both without coordinating, whichever save happens later
        wins at the file-system level and you have a divergence. The
        safe patterns are <Em>(a)</Em> edit in one place at a time
        (treat the file like a document you&apos;re holding open),
        or <Em>(b)</Em> keep a separate vault per device and merge
        manually. Real multi-device sync would need a backend that
        coordinates writes &mdash; which is exactly what the S3 and
        WebDAV adapters on the roadmap are intended to provide.
      </Callout>

      <H2 id="handle-persistence">
        Getting back into a vault: handle persistence
      </H2>
      <P>
        The File System Access API hands your browser a{" "}
        <Code>FileSystemFileHandle</Code> when you pick a file.
        That handle is what the editor uses to read and write. Two
        awkward facts about handles:
      </P>
      <Ul>
        <Li>
          They&apos;re{" "}
          <Strong>origin-scoped and not portable</Strong>: a handle
          created on <Code>useflowvault.com</Code> is opaque
          to any other origin, and can&apos;t be serialised into a
          cookie or <Code>localStorage</Code>.
        </Li>
        <Li>
          They&apos;re <Strong>not permission-persistent</Strong>:
          even if you kept the handle around, the browser prompts
          for &ldquo;allow Flowvault to write to this file?&rdquo;
          again when you come back after a while. That&apos;s a web
          platform rule, not us.
        </Li>
      </Ul>
      <P>
        The part we <Em>can</Em> fix is remembering that the handle
        exists at all. Handles <Em>can</Em> be stored in IndexedDB
        (structured clone supports them), so Flowvault keeps a
        per-origin <Code>handleRegistry</Code> that maps your{" "}
        <Code>localSiteId</Code> UUID to the handle you first
        granted, plus a little metadata (the file name we last saw,
        the timestamp). When you revisit{" "}
        <Code>/local/&lt;uuid&gt;</Code> on the same browser profile,
        the editor recalls the handle, calls{" "}
        <Code>queryPermission()</Code>, and &mdash; if needed &mdash;
        asks the browser to prompt you one more time. You still type
        your password, because the password has never been stored;
        but you don&apos;t have to re-pick the file from a disk
        browser unless you want to.
      </P>
      <P>
        On a new browser profile, a new machine, or after clearing
        site data, the registry is empty and the normal{" "}
        <Em>Open local vault</Em> flow picks up the file from disk
        again. The file itself is all that matters for recovery;
        the registry is just a convenience cache.
      </P>

      <H2 id="lock-semantics">Lock semantics</H2>
      <P>
        Clicking <Code>Lock</Code> on a local vault does three
        things, in this order:
      </P>
      <Ol>
        <Li>
          Drops the in-memory master key and zeroes the decrypted
          tab contents.
        </Li>
        <Li>
          Unregisters the per-site storage adapter. The next visit
          to <Code>/local/&lt;uuid&gt;</Code> must go through the
          recall path again, including a fresh browser permission
          grant for file access.
        </Li>
        <Li>
          Clears the open-vault state in the editor&apos;s Zustand
          store so the password gate shows.
        </Li>
      </Ol>
      <P>
        Contrast with a hosted vault&apos;s lock, which only needs
        step (1) and (3) &mdash; Firestore doesn&apos;t hand us
        capability-style access, so there&apos;s no adapter to tear
        down. For local vaults the adapter teardown matters: it&apos;s
        the thing that forces the next session to go through an
        explicit File System Access permission prompt rather than
        silently reusing a live handle.
      </P>

      <H2 id="threat-model">Threat-model notes</H2>
      <P>
        BYOS is a real reduction in what our backend can see about
        you. It is <Em>not</Em> a universal upgrade over the hosted
        vault, because it moves the trust boundary onto your device.
      </P>
      <P>
        Things that get strictly better:
      </P>
      <Ul>
        <Li>
          The server doesn&apos;t see your ciphertext or any
          per-vault metadata, so &ldquo;what if Flowvault gets
          breached&rdquo; stops applying to this vault at all.
        </Li>
        <Li>
          Subpoenas, law-enforcement requests, and hosting-provider
          data requests against Flowvault yield nothing for local
          vaults, because there&apos;s nothing to yield.
        </Li>
        <Li>
          Jurisdiction simply doesn&apos;t apply to a file on your
          own disk.
        </Li>
      </Ul>
      <P>
        Things that don&apos;t change:
      </P>
      <Ul>
        <Li>
          The ciphertext still requires your password to unlock.
          Argon2id parameters are the same. A stolen file is
          equivalent, cryptographically, to a stolen Firestore
          document.
        </Li>
      </Ul>
      <P>
        Things you have to think about that weren&apos;t your problem
        before:
      </P>
      <Ul>
        <Li>
          <Strong>Local forensic risks.</Strong> A file on disk is
          subject to shadow copies, cloud-sync providers,
          file-system journaling, un-deleted snapshots in swap or
          hibernation images, and anything else on your machine that
          might have briefly seen plaintext in memory. If any of
          that is in your threat model, store the{" "}
          <Code>.flowvault</Code> on an encrypted volume (VeraCrypt,
          LUKS, BitLocker, FileVault) the same way you would any
          other sensitive file.
        </Li>
        <Li>
          <Strong>Losing the file means losing the data.</Strong>{" "}
          There is no copy on our servers. Back it up. An easy
          rhythm is a periodic <Code>.fvault</Code> export into a
          separate folder or cloud drive &mdash; the export is still
          zero-knowledge, still needs your password, so it&apos;s
          fine to store in places you wouldn&apos;t trust with
          plaintext.
        </Li>
        <Li>
          <Strong>Untrusted browser extensions.</Strong> This
          caveat applies to hosted vaults too, but it bites harder
          here: an extension running in the same origin can read the
          DOM while your vault is open. For high-stakes local
          vaults, use a dedicated browser profile with no
          extensions.
        </Li>
      </Ul>

      <H2 id="architecture">
        Architecture: the <Code>VaultStorageAdapter</Code> interface
      </H2>
      <P>
        Under the hood, BYOS wasn&apos;t a one-off bolt-on. Every
        vault-blob read and write in Flowvault now goes through a
        shared adapter interface:
      </P>
      <Example title="src/lib/storage/adapter.ts">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`export interface VaultStorageAdapter {
  create(input: CreateVaultInput): Promise<void>;
  restore(input: RestoreVaultInput): Promise<void>;
  read(siteId: string): Promise<VaultRecord | null>;
  refresh(siteId: string): Promise<VaultRefreshResult | null>;
  writeCiphertext(input: WriteCiphertextInput): Promise<WriteResult>;
}`}</pre>
      </Example>
      <P>
        The Firestore backend is one implementation (a thin wrapper
        over the existing <Code>src/lib/firebase/sites.ts</Code>
        functions, preserved verbatim so hosted vaults behave
        identically). The local-file backend is another. A
        dispatcher &mdash; <Code>getVaultStorage(siteId)</Code>{" "}
        &mdash; picks the right one based on the route you&apos;re
        on: URL-routed vaults at <Code>/s/&lt;slug&gt;</Code> get
        Firestore, and sites registered under the per-site override
        map (the local-file case) get their override.
      </P>
      <P>
        Which means adding a new backend is, roughly, five files:
      </P>
      <Ol>
        <Li>
          An adapter implementation conforming to{" "}
          <Code>VaultStorageAdapter</Code>.
        </Li>
        <Li>
          A small UI entry point to configure credentials / picker.
        </Li>
        <Li>
          A route (or reuse of an existing one) where the dispatcher
          hands control to the new adapter.
        </Li>
        <Li>
          Persistence for any handles / credentials that need to
          survive a reload.
        </Li>
        <Li>
          Docs and a threat-model section.
        </Li>
      </Ol>
      <P>
        That&apos;s the lever for everything on the roadmap below.
      </P>

      <H2 id="roadmap">What&apos;s next</H2>
      <P>
        Priority is driven by demand. If any of these would unblock
        you,{" "}
        <A href="https://github.com/Flowdesktech/flowvault/issues/new">
          open a GitHub issue
        </A>{" "}
        so we can see the signal.
      </P>
      <H3 id="s3">S3-compatible backends</H3>
      <P>
        AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO,
        Storj-S3, and every other &ldquo;speaks the S3 API&rdquo;
        provider. The blob stays opaque the same way it does on
        Firestore; the adapter just shuttles bytes. Versioning on
        the bucket side gives you essentially-free snapshot history,
        which is an upgrade over both Firestore and local files.
        Credentials would live in <Code>localStorage</Code>,
        encrypted under a device-local key, so each browser profile
        configures its own. Conflict detection uses the object&apos;s
        ETag as the CAS token. This is probably the first
        server-backed BYOS adapter to ship.
      </P>
      <H3 id="webdav">WebDAV backends</H3>
      <P>
        Nextcloud, ownCloud, Storj-compatible WebDAV gateways,
        Synology, and anyone else exposing a plain WebDAV endpoint.
        Same shape as S3, different wire format; CAS via the{" "}
        <Code>If-Match</Code> header and <Code>ETag</Code>s. Great
        for people who already self-host and want Flowvault to be
        purely a client.
      </P>
      <H3 id="decentralized">
        IPFS / Storj / Arweave (experimental)
      </H3>
      <P>
        Fully decentralised backends are attractive but come with
        real downsides (availability, mutability, address
        persistence). We&apos;ll ship these behind a clear
        &ldquo;experimental&rdquo; banner once the design handles
        the &ldquo;where does the pointer to the latest version
        live&rdquo; question cleanly.
      </P>
      <H3 id="android-ios">Mobile</H3>
      <P>
        File System Access API support on mobile browsers is uneven.
        A native-PWA or thin native wrapper with scoped storage
        access is a tracked line of work but depends on the browser
        platforms moving first.
      </P>

      <H2 id="faq">Frequently asked questions</H2>
      <H3 id="faq-which-browsers">Which browsers are supported today?</H3>
      <P>
        Chromium-based desktop browsers: Chrome, Edge, Brave, Opera,
        Vivaldi, Arc. Firefox and Safari don&apos;t implement the
        File System Access API yet, so the Create/Open local vault
        buttons are disabled there. Hosted vaults at{" "}
        <Code>/s/&lt;slug&gt;</Code> still work everywhere.
      </P>
      <H3 id="faq-move">
        Can I move a .flowvault between devices?
      </H3>
      <P>
        Yes. Copy the file &mdash; USB stick, cloud sync, encrypted
        email, whatever fits your threat model. On the second device,
        click <Strong>Open local vault</Strong>, point at the copied
        file, and enter your password. The file is self-contained;
        nothing else needs to travel with it.
      </P>
      <H3 id="faq-tlock">
        Can I compose time-locked notes from a local vault?
      </H3>
      <P>
        Yes. Time-locked notes and Encrypted Send live in their own
        Firestore collections and are unaffected by where your
        <Em> vault</Em> is stored. Those features only talk to the
        server for their own capsule / send documents, never for the
        local vault.
      </P>
      <H3 id="faq-fvault-vs-flowvault">
        <Code>.fvault</Code> vs <Code>.flowvault</Code> &mdash; which
        do I want?
      </H3>
      <P>
        Both. A <Code>.flowvault</Code> is the live vault you work
        out of; a <Code>.fvault</Code> is a point-in-time backup you
        stash somewhere safe. The two formats share the underlying
        ciphertext, so you can export a <Code>.fvault</Code> from a
        local vault and restore it to a hosted slug, or vice versa,
        at any time.
      </P>
      <H3 id="faq-delete">How do I delete a local vault?</H3>
      <P>
        Delete the file from your disk. That&apos;s the whole state.
        If you also want to clear the per-browser handle registry,
        use your browser&apos;s site-data settings for{" "}
        <Code>useflowvault.com</Code>.
      </P>

      <H2 id="see-also">See also</H2>
      <Ul>
        <Li>
          <A href="/">Flowvault home</A> &mdash; the{" "}
          <Em>Bring your own storage</Em> section sits below the
          usual open-vault form.
        </Li>
        <Li>
          <A href="/faq">The FAQ</A> &mdash; has a dedicated{" "}
          <Em>Bring Your Own Storage</Em> section with the shorter,
          question-answer version of this post.
        </Li>
        <Li>
          <A href="/blog/plausible-deniability-hidden-volumes-explained">
            Hidden volumes explained
          </A>{" "}
          &mdash; the slot format inside a <Code>.flowvault</Code>{" "}
          is the same one described there.
        </Li>
        <Li>
          <A href="/blog/encrypted-backup-fvault-format">
            The <Code>.fvault</Code> backup format
          </A>{" "}
          &mdash; its sibling format; snapshots for cold storage.
        </Li>
        <Li>
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            Trusted handover
          </A>{" "}
          &mdash; the one feature that <Em>doesn&apos;t</Em> work
          for local vaults, and why.
        </Li>
        <Li>
          <A href="/security">The security page</A> &mdash; the
          canonical list of exact parameter values.
        </Li>
      </Ul>
    </>
  );
}
