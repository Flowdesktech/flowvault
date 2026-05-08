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
  Example,
  Callout,
  DefList,
  DefItem,
} from "@/components/blog/Prose";

export default function Post() {
  return (
    <>
      <Lead>
        Flowvault 1.5 ships an Encrypted File Send: drop a file (up to
        10&nbsp;MiB), pick how long it lives (max 7 days) and how many
        times it can be downloaded, and share the link. The file is
        AES-256-GCM encrypted in your browser before a single byte
        leaves your device, so our Cloud Storage bucket only ever sees
        opaque ciphertext. You also get a separate{" "}
        <Em>secure delete link</Em> &mdash; a token bound to the upload
        by SHA-256 &mdash; so you can destroy the upload yourself at
        any moment, without waiting for the expiry or the download cap.
      </Lead>

      <Callout tone="tip" title="TL;DR">
        Two links are produced when you create a file send. The
        download link goes to the recipient and contains the AES key
        in the URL fragment. The secure delete link stays with you and
        contains a separate 256-bit token whose SHA-256 is the only
        thing the server stored. Anyone holding the download link can
        download until the cap is consumed; only the holder of the
        delete link can destroy the upload early. Default expiry is
        24&nbsp;hours, default download cap is 1.
      </Callout>

      <H2 id="why">Why a file primitive when Encrypted Send already exists</H2>
      <P>
        Flowvault&apos;s{" "}
        <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
          Encrypted Send
        </A>{" "}
        is for short text: a password, an API key, a recovery phrase.
        It caps the plaintext at 128&nbsp;KiB precisely because it
        isn&apos;t supposed to be a file transfer tool. But every few
        days I hit a case where the secret <Em>is</Em> a file:
      </P>
      <Ul>
        <Li>
          A signed PDF with a banking instruction the recipient is
          supposed to read once and shred.
        </Li>
        <Li>
          A KeePassXC database, a wallet&apos;s recovery JSON, or a
          screenshot of a recovery sheet that doesn&apos;t fit cleanly
          into a copy-pasted code block.
        </Li>
        <Li>
          A small archive (a<Code>.zip</Code> of TLS certs, a
          provisioning bundle, a serialized config) that I&apos;d
          rather not park in chat history for the next decade.
        </Li>
        <Li>
          A short voice memo or a few-second screen recording that
          happens to contain a number nobody should be able to read
          twice.
        </Li>
      </Ul>
      <P>
        For all of those, the right primitive is the same as Encrypted
        Send &mdash; one-shot, view-capped, expiring, end-to-end
        encrypted &mdash; just sized for files and with proper file
        semantics on both ends (a real <Code>name</Code>, a real{" "}
        <Code>contentType</Code>, a Save dialog instead of a textarea).
        That is what File Send is.
      </P>

      <H2 id="the-shape">The shape of a file send</H2>
      <P>
        From the sender&apos;s side, the flow is identical to
        Encrypted Send except step&nbsp;1:
      </P>
      <Ol>
        <Li>
          Drop a file at <A href="/file/new">/file/new</A>. The browser
          reads the bytes locally; nothing is uploaded yet.
        </Li>
        <Li>
          Pick an expiry presets (1&nbsp;hour, 1&nbsp;day,
          3&nbsp;days, 7&nbsp;days &mdash; 7 is the hard ceiling).
        </Li>
        <Li>
          Pick a download cap (1, 2, 5, or 10).
        </Li>
        <Li>
          Optionally tick <Em>Also require a password to download</Em>{" "}
          and type a password. This is the same Argon2id-derived inner
          layer Encrypted Send uses, mixed into HKDF before the
          content key is derived.
        </Li>
        <Li>
          Click <Code>Create file send</Code>. The browser encrypts the
          file, uploads ciphertext to Cloud Storage, then writes a
          metadata document to Firestore.
        </Li>
        <Li>
          You&apos;re shown two links. Copy them now &mdash; we
          don&apos;t store them and we can&apos;t show them again.
        </Li>
      </Ol>
      <Example title="The two links you get back">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`Download link  (share with recipient)
useflowvault.com/file/<id>#k=<base64url-256-bit-key>

Secure delete link  (keep for yourself)
useflowvault.com/file/<id>/delete#t=<base64url-256-bit-token>`}</pre>
      </Example>
      <P>
        Both fragments stay in the browser. Browsers never include the
        part after <Code>#</Code> in HTTP requests, so the AES key and
        the delete token never reach Flowvault, even if the recipient
        clicks the link from inside a chat client that aggressively
        previews URLs.
      </P>

      <H2 id="crypto">The crypto, in twelve lines</H2>
      <P>
        File Send uses the same WebCrypto primitives as the rest of
        Flowvault: AES-256-GCM for confidentiality + integrity,
        Argon2id (64&nbsp;MiB / 3 iterations) for the optional
        password layer, HKDF-SHA-256 for domain separation. Nothing
        exotic, nothing rolled by hand.
      </P>
      <Example title="seal()">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`K           = randomBytes(32)                       // url fragment key
deleteToken = randomBytes(32)                       // delete-link token
salt        = password ? randomBytes(16) : null

baseKey     = password
              ? K || Argon2id(password, salt)
              : K
contentKey  = HKDF(baseKey,  info="flowvault:fileSend:v1:content")
metadataKey = HKDF(baseKey,  info="flowvault:fileSend:v1:metadata")

contentCiphertext  = AES-256-GCM(contentKey,  fileBytes)
metadataCiphertext = AES-256-GCM(metadataKey, JSON({name, contentType, size}))
deleteTokenHash    = SHA-256(deleteToken)`}</pre>
      </Example>
      <P>
        The content ciphertext is uploaded to{" "}
        <Code>fileSends/&lt;id&gt;</Code> in Cloud Storage. The
        metadata ciphertext, the delete-token hash, the expiry, the
        view counters, and (when password mode is on) the Argon2id
        salt go into the Firestore document at the same id. Direct
        client reads are denied on both sides; the only path to the
        bytes is through a Cloud Function that atomically consumes a
        view.
      </P>

      <H2 id="reading-it">Reading the file (without burning the cap)</H2>
      <P>
        The viewer at <Code>/file/&lt;id&gt;</Code> deliberately
        click-gates everything. Because the default cap is 1, fetching
        on mount would let a chat-client preview, a browser prefetch,
        or React Strict Mode&rsquo;s double-effect silently burn the
        only download. Instead the page shows a confirmation card and
        does nothing until the recipient clicks <Em>Open the file</Em>.
      </P>
      <P>
        On click, the flow is:
      </P>
      <Ol>
        <Li>
          The browser calls <Code>readFileSend(id)</Code>, a Cloud
          Function. In a Firestore transaction, the function checks
          expiry and view count, increments the counter, and (on the
          last view) marks the document for deletion.
        </Li>
        <Li>
          The function generates a <Strong>v4 signed URL</Strong> for
          the storage object that lives 5 minutes, then returns it
          alongside the metadata ciphertext, the password salt (if
          any), and a <Code>passwordProtected</Code> flag.
        </Li>
        <Li>
          The viewer first decrypts the metadata blob in the browser
          using <Code>K</Code>. If the file is password-protected and
          no password has been provided yet, this fails fast and the
          UI shows a password prompt &mdash; <Em>before</Em> spending
          bandwidth on a possibly-10&nbsp;MiB body.
        </Li>
        <Li>
          With metadata in hand (filename, MIME type, original size),
          the viewer streams the ciphertext from Cloud Storage with
          a progress bar. The bytes go directly browser ↔ Storage; the
          Cloud Function never proxies the body.
        </Li>
        <Li>
          The browser AEAD-decrypts the ciphertext into a{" "}
          <Code>Blob</Code>, slaps an <Code>object URL</Code> on it,
          and renders a <Code>Save to device</Code> button with the
          original filename. The recipient clicks, the OS save dialog
          opens, the plaintext lands on disk.
        </Li>
        <Li>
          If that download was the final allowed one, the Firestore
          doc is already gone &mdash; the next reload of the link
          will say <Em>Already downloaded</Em>. The Storage object
          itself is collected on the next sweep tick (the signed URL
          stays valid for a 5-minute grace window so the in-flight
          download isn&apos;t cut off).
        </Li>
      </Ol>

      <Callout tone="note" title="Why a signed URL instead of streaming through the function">
        Cloud Functions callable responses are capped at 10&nbsp;MiB
        and are JSON-encoded, which means base64-ing a 10&nbsp;MiB
        ciphertext would overflow. We could stream over an{" "}
        <Code>onRequest</Code> handler, but that puts every byte
        through Functions egress. Signed URLs let the browser pull
        the bytes straight from Cloud Storage, which is faster, free
        of Functions invocation cost, and keeps the function&apos;s
        job tightly scoped to <Em>authorising one download</Em>.
      </Callout>

      <H2 id="secure-delete">The secure delete link, and why it&apos;s a separate token</H2>
      <P>
        The secure delete link is the feature that distinguishes File
        Send from a plain &ldquo;send and forget&rdquo; uploader. It
        gives the sender an immediate, unilateral kill switch &mdash;
        useful when:
      </P>
      <Ul>
        <Li>
          You realise you uploaded the wrong file, or attached the
          wrong recipient&apos;s document.
        </Li>
        <Li>
          The recipient says &ldquo;I&rsquo;ve got it,&rdquo; and you
          want the upload gone now rather than at the 7-day expiry.
        </Li>
        <Li>
          The link gets accidentally CC&apos;d to a wider distribution
          and you need to revoke it before the cap is consumed.
        </Li>
      </Ul>
      <P>
        The token is a fresh 256-bit value generated alongside{" "}
        <Code>K</Code>. The server stores only its SHA-256:
      </P>
      <Example title="Authorising the delete">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`# at create time:
deleteToken      = randomBytes(32)
deleteTokenHash  = SHA-256(deleteToken)
firestore.set({
  ..., deleteTokenHash: <bytes>,
})

# at delete time:
provided = base64UrlDecode(t)               // from URL fragment
SHA-256(provided)  ==  deleteTokenHash      // constant-time compare
  ? delete storage object + firestore doc
  : forbidden`}</pre>
      </Example>
      <P>
        The hash-only-on-the-server design means a Flowvault employee,
        a curious sysadmin, or someone with a leaked database snapshot
        cannot use what they see to destroy your upload. The token is
        only in your URL fragment, which never reached us in the first
        place.
      </P>
      <P>
        It also means we can&apos;t send you a &ldquo;recover your
        delete link&rdquo; email, because we don&apos;t have your
        email and we don&apos;t have the token. Treat the secure
        delete link the same way you treat the download link: copy it
        when we show it to you, save it somewhere you control, and
        understand that we cannot help you re-derive it later.
      </P>

      <H2 id="what-server-sees">What the server actually sees (the honest list)</H2>
      <P>
        Same disclosure standard as the rest of Flowvault. The server
        sees:
      </P>
      <DefList>
        <DefItem term="Storage object">
          The ciphertext bytes (<Code>iv || AES-GCM ciphertext || tag</Code>
          ). Same length as your file plus 28 bytes of AEAD overhead.
          MIME type forced to <Code>application/octet-stream</Code> on
          the way in.
        </DefItem>
        <DefItem term="Ciphertext size">
          Approximately equal to the original file size. So encrypted
          file size leaks &mdash; the same way it does for Bitwarden
          Send, OneTimeSecret, and every other zero-knowledge
          uploader.
        </DefItem>
        <DefItem term="Metadata blob">
          A small AEAD-encrypted JSON object containing{" "}
          <Code>name</Code>, <Code>contentType</Code>, and{" "}
          <Code>size</Code>. The server can&apos;t open it.
        </DefItem>
        <DefItem term="Expiry, view counters">
          Needed for enforcement.
        </DefItem>
        <DefItem term="passwordProtected, passwordSalt">
          A boolean and (when on) a 16-byte Argon2id salt, so the
          recipient&apos;s browser can re-derive the same password
          key. The salt alone is useless without the password and the
          URL fragment.
        </DefItem>
        <DefItem term="deleteTokenHash">
          A 32-byte SHA-256 digest. Useless without the original
          token.
        </DefItem>
        <DefItem term="Upload time, object id">
          Cloud Storage bookkeeping. The id is a random 24-char
          nanoid; we never assigned anything semantic to it.
        </DefItem>
      </DefList>
      <P>
        It does <Em>not</Em> see: the filename, the MIME type, the
        file content, the AES key, the password (if any), the delete
        token, an account, an email, an IP-correlated session, or any
        long-lived identifier.
      </P>

      <H2 id="lifecycle">The lifecycle, including failure modes</H2>
      <P>
        Two scheduled functions run every hour and clean up state. The
        sender doesn&apos;t need to think about either.
      </P>
      <Ul>
        <Li>
          <Strong>fileSendsSweep</Strong> handles three cases:
          <Ul>
            <Li>
              Documents whose <Code>expiresAt</Code> has passed &mdash;
              storage object + Firestore doc both deleted.
            </Li>
            <Li>
              Documents flagged consumed (<Code>consumedAt</Code>{" "}
              older than the signed URL TTL plus a small buffer) &mdash;
              the recipient&apos;s 5-minute download window has
              definitely closed, so the storage object is safe to
              drop. The Firestore doc is already gone from the read
              transaction.
            </Li>
            <Li>
              Orphan storage objects: an upload that finished but
              whose Firestore <Code>create</Code> never landed (network
              hiccup, refused write, etc.). These are detected by
              listing the bucket and cross-referencing Firestore, and
              are deleted once they&apos;re older than the 7-day max
              retention plus an hour of slack.
            </Li>
          </Ul>
        </Li>
        <Li>
          <Strong>readFileSend</Strong> is the only path that
          increments the view counter. It runs in a Firestore
          transaction, so two concurrent reads never both see
          &ldquo;available&rdquo; on the last view.
        </Li>
        <Li>
          <Strong>deleteFileSend</Strong> deletes the storage object
          first, then the Firestore document. If the storage delete
          fails (rare; usually a permissions blip), the doc still
          gets deleted so the link stops working immediately, and the
          orphan-cleanup branch of the sweep eventually catches up.
        </Li>
      </Ul>

      <H2 id="threat-model">The honest threat-model section</H2>
      <P>
        The same caveats that apply to{" "}
        <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
          Encrypted Send
        </A>{" "}
        apply here. A few are worth re-stating because file uploads
        feel weightier than text snippets:
      </P>
      <Ul>
        <Li>
          <Strong>The link is the credential.</Strong> Anyone who has
          the full URL (including the fragment) can download until the
          cap is consumed. Treat it like the file itself.
        </Li>
        <Li>
          <Strong>Chat clients sometimes prefetch links.</Strong> A
          link in Slack, Discord, or some email scanners can be
          fetched by a server-side bot. The browser-only fragment-key
          design means the prefetcher cannot decrypt the file, but
          for non-password sends, a prefetch counts toward the
          download cap if the bot follows redirects far enough. If
          you&apos;re sending into one of these channels, prefer
          either a download cap of 2 (so the bot doesn&apos;t starve
          the human) or a password gate (which the bot won&apos;t
          have).
        </Li>
        <Li>
          <Strong>Network observers see file size.</Strong> A 9.4&nbsp;MiB
          ciphertext is a 9.4&nbsp;MiB file plus 28 bytes. We
          don&apos;t pad. If size leakage is in your threat model,
          archive multiple files into a fixed-size container before
          uploading.
        </Li>
        <Li>
          <Strong>Lose either link, lose the use case.</Strong>{" "}
          Without the download link, no one (including us) can
          decrypt the file. Without the delete link, you&apos;re
          waiting on the cap or expiry. We literally cannot help
          recover either.
        </Li>
        <Li>
          <Strong>10&nbsp;MiB is a hard cap, by design.</Strong>{" "}
          Flowvault is not a Dropbox replacement. If you need to send
          a hundred-MiB build artifact, use OnionShare, Magic Wormhole,
          or Bitwarden Send Files. We may raise the cap in a future
          release, but it will stay scoped to &ldquo;documents and
          screenshots,&rdquo; not &ldquo;datasets and videos.&rdquo;
        </Li>
      </Ul>

      <H2 id="how-it-compares">How it compares</H2>
      <P>
        A condensed version of the comparison table from{" "}
        <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
          Encrypted Send vs Bitwarden Send vs Privnote
        </A>
        , adjusted for file-shaped products.
      </P>
      <Example title="File-send shootout">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`                              Flowvault  Bitwarden  OnionShare  Hat.sh   Firefox
                              File Send  Send Files             (web)    Send (RIP)

Account required              no         yes        no          no       n/a
Open-source frontend          yes        yes        yes         yes      yes
Open-source server            yes        yes        n/a (P2P)   yes      yes
Self-hostable                 yes        yes        yes         yes      defunct
Key in URL fragment           yes        yes        n/a (Tor)   yes      yes
Sender-controlled delete      yes        yes        n/a         no       no
Default lifetime              1 day      30 days    while open  one shot 24 h
Max retention                 7 days     30 days    n/a         one shot ~30 d
Default download cap          1          configurable n/a       one shot one shot
Max payload                   10 MiB     ~500 MB    unbounded   any      ~2.5 GB
Recipient experience          web link   web link   Tor browser web link web link
Tor / VPN friendly            yes        yes        yes (req)   yes      yes`}</pre>
      </Example>
      <P>
        File Send is the smallest, simplest one in that table. That
        is the point. If your file is tiny, ephemeral, and meant for
        one or two recipients, the right shape is the one that gives
        you a link, an expiry, a cap, and a kill switch &mdash; and
        gets out of the way. If your file is large or your audience
        is broad, use a different tool.
      </P>

      <H2 id="practical">Practical recipes</H2>
      <H3 id="recipe-1">Sending a recovery PDF to a colleague</H3>
      <P>
        Use a download cap of 2 and a 1-day expiry. Tick the password
        gate; share the password over a different channel (signal, in
        person, voice). Tell the colleague: &ldquo;This link expires
        in a day; if it says &lsquo;Already downloaded&rsquo;, ping
        me and I&apos;ll regenerate.&rdquo; When they confirm receipt,
        open your secure delete link to remove the upload immediately.
      </P>
      <H3 id="recipe-2">Sharing a CI artifact with a contractor</H3>
      <P>
        Use a 7-day expiry and a download cap of 5 (so they can
        re-download from a different machine without a panic). Skip
        the password unless the artifact contains secrets the
        contractor shouldn&apos;t be able to read in their email
        thread. Hold on to the secure delete link and fire it the
        moment the contract ends.
      </P>
      <H3 id="recipe-3">Sending yourself a config across an air-gap</H3>
      <P>
        Use a 1-hour expiry and a download cap of 1, no password. The
        purpose is &ldquo;move bytes from machine A to machine B in
        the next ten minutes&rdquo; &mdash; the secure delete link is
        your reassurance that if you accidentally close the laptop
        before downloading, you can wipe it without waiting an hour.
      </P>

      <H2 id="see-also">See also</H2>
      <Ul>
        <Li>
          <A href="/file/new">
            <Code>/file/new</Code>
          </A>{" "}
          &mdash; create a File Send link in three clicks.
        </Li>
        <Li>
          <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
            Encrypted Send vs Bitwarden Send vs Privnote
          </A>{" "}
          &mdash; the cousin primitive when the secret is text rather
          than a file.
        </Li>
        <Li>
          <A href="/security">/security</A> &mdash; the exact crypto
          and security rules for File Send: AES-256-GCM with HKDF
          subkeys, optional Argon2id password layer, Cloud Storage
          rules, Cloud Function source.
        </Li>
        <Li>
          <A href="/blog/how-to-use-flowvault-guide">
            The beginner&apos;s guide
          </A>{" "}
          &mdash; the broader walkthrough that now includes File Send.
        </Li>
      </Ul>
    </>
  );
}
