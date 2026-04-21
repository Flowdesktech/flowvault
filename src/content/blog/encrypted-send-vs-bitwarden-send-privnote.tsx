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
        If you just want to hand someone a password, an API key, or a
        recovery phrase once, which one-shot link service should you
        reach for? This post compares the six obvious candidates in
        2026 &mdash; Flowvault Encrypted Send, Bitwarden Send, Privnote,
        OneTimeSecret, PrivateBin, and 1Password Share &mdash; with
        specifics about key location, view-cap enforcement, open-source
        posture, and the trade-offs behind each choice.
      </Lead>

      <H2 id="what-counts">What a &ldquo;one-shot secret link&rdquo; actually needs to do</H2>
      <P>
        Before the head-to-head, the criteria. A service in this
        category is really answering four questions:
      </P>
      <Ol>
        <Li>
          <Strong>Where does the decryption key live?</Strong> Ideally
          in the URL fragment (<Code>#</Code>), which the browser never
          sends to the server.
        </Li>
        <Li>
          <Strong>Who enforces the view cap?</Strong> The server has
          to, otherwise a malicious recipient can just curl the link
          twice. That means the server mediates reads and strictly
          counts.
        </Li>
        <Li>
          <Strong>Is the code verifiable?</Strong> Open-source
          client + open-source server means you can audit the claim.
          Open-source client alone is partial.
        </Li>
        <Li>
          <Strong>Can a second factor (a password) protect the link?</Strong>{" "}
          If your channel gets scraped, the link alone shouldn&apos;t
          be enough.
        </Li>
      </Ol>
      <P>
        Let&apos;s evaluate the six candidates against those four
        axes.
      </P>

      <H2 id="flowvault-send">Flowvault Encrypted Send</H2>
      <P>
        The <A href="/send/new">/send/new</A> page in Flowvault. Full
        behaviour:
      </P>
      <Ul>
        <Li>
          A random 256-bit AES-GCM key is generated client-side. The
          plaintext is encrypted in the browser; only the ciphertext
          is uploaded.
        </Li>
        <Li>
          The URL is{" "}
          <Code>
            flowvault.flowdesk.tech/send/&lt;id&gt;#k=&lt;base64url-key&gt;
          </Code>
          . The key lives after the <Code>#</Code>, so it never
          reaches Flowvault&apos;s server in any HTTP request.
        </Li>
        <Li>
          Optional password layer. If enabled, the plaintext is
          double-wrapped: Argon2id-derived password key inside, AES-GCM
          outside. The password travels in a different channel from
          the URL.
        </Li>
        <Li>
          View cap is enforced by a Cloud Function in a Firestore
          transaction: decrement counter, return ciphertext only if
          the decrement succeeded, hard-delete the doc when the
          counter hits zero. The security rules deny direct client
          reads of the send document &mdash; the only read path is
          through the atomic function.
        </Li>
        <Li>
          Default lifetime 24 h, max 30 days. Hourly Cloud Function
          sweeps expired docs.
        </Li>
        <Li>
          Max payload 128 KiB plaintext. Plenty for secrets, not
          intended for file transfer.
        </Li>
        <Li>
          <A href="https://github.com/Flowdesktech/flowvault">
            All three layers
          </A>{" "}
          &mdash; frontend, Cloud Function, Firestore rules &mdash;
          are in one repo. Self-hostable.
        </Li>
      </Ul>
      <P>
        No account, ever. No email. No rate-limit that requires one.
      </P>

      <H2 id="bitwarden-send">Bitwarden Send</H2>
      <P>
        <A href="https://bitwarden.com/products/send/">
          Bitwarden Send
        </A>{" "}
        is Bitwarden&apos;s first-party take. Mature, widely used,
        solid engineering.
      </P>
      <Ul>
        <Li>
          <Strong>Account required to create.</Strong> You need a
          Bitwarden account to create a Send link (free tier works for
          text, paid for files). This is the biggest difference: if
          you already have Bitwarden, it&apos;s convenient; if you
          don&apos;t, it&apos;s a signup barrier.
        </Li>
        <Li>
          Key in URL fragment, same as Flowvault.
        </Li>
        <Li>
          View cap and expiry enforced server-side. Password layer
          available.
        </Li>
        <Li>
          <A href="https://github.com/bitwarden">Open-source</A>{" "}
          clients and server. Self-hostable via Vaultwarden or the
          official server.
        </Li>
        <Li>
          Payload limits tied to your plan (free: 100 MB for files,
          practically unlimited for text).
        </Li>
      </Ul>
      <P>
        If you&apos;re already a Bitwarden user, Send is the natural
        choice for one-offs. The account requirement is the trade-off.
      </P>

      <H2 id="privnote">Privnote</H2>
      <P>
        <A href="https://privnote.com/">Privnote</A> is the historical
        original of this category (2008). Simple shape: paste text,
        get a URL, link self-destructs on first read.
      </P>
      <Ul>
        <Li>
          Key in URL fragment. Plaintext is never sent to the server.
        </Li>
        <Li>
          View cap is 1 (fixed); expiry is up to 30 days or
          &ldquo;read immediately.&rdquo;
        </Li>
        <Li>
          Optional password layer, optional email notification of
          read.
        </Li>
        <Li>
          <Em>Closed-source server.</Em> The client-side JS is
          available to inspect but the backend is proprietary.
          You can&apos;t self-host.
        </Li>
        <Li>
          Free tier is ad-supported.
        </Li>
        <Li>
          Used more-or-less as a household name, which is its own
          usability advantage (&ldquo;go to privnote.com&rdquo; needs
          no explanation).
        </Li>
      </Ul>
      <P>
        Great default for casual, very-short-lived secrets. If your
        threat model includes the operator, the closed-server posture
        matters.
      </P>

      <H2 id="onetimesecret">OneTimeSecret</H2>
      <P>
        <A href="https://onetimesecret.com/">OneTimeSecret</A> is the
        archetype of the &ldquo;account-less privnote clone&rdquo;
        genre.
      </P>
      <Ul>
        <Li>
          No account needed. Paste, get a link, done.
        </Li>
        <Li>
          Key is typically in the URL path (not fragment) on the
          hosted version; self-hosted builds can vary. This means the
          hosted operator <Em>could</Em> see the key, as a matter of
          design.
        </Li>
        <Li>
          Optional passphrase layer is server-side Argon2 &mdash; the
          passphrase hash reaches the server and is used to gate the
          read.
        </Li>
        <Li>
          <A href="https://github.com/onetimesecret/onetimesecret">
            Open-source
          </A>{" "}
          server and client. Self-hostable, which is the main reason
          to use it.
        </Li>
        <Li>
          Widely self-hosted by companies that want a private
          alternative.
        </Li>
      </Ul>
      <P>
        If you self-host OneTimeSecret behind your VPN, it&apos;s an
        excellent fit for an internal tool. On the public instance,
        the key-in-URL design means you&apos;re trusting the operator
        with more than Flowvault does.
      </P>

      <H2 id="privatebin">PrivateBin</H2>
      <P>
        <A href="https://privatebin.info/">PrivateBin</A> is a
        pastebin with client-side AES-256 and zero-knowledge semantics,
        forked from ZeroBin many years ago. Many instances exist in
        the wild (cryptgeon, snopyta, etc.).
      </P>
      <Ul>
        <Li>
          Client-side encryption with key in URL fragment.
        </Li>
        <Li>
          Configurable view cap (<Em>burn after reading</Em>) and
          expiry.
        </Li>
        <Li>
          Optional password on top.
        </Li>
        <Li>
          <A href="https://github.com/PrivateBin/PrivateBin">
            Open-source
          </A>{" "}
          end-to-end. Many public instances, though their trust
          posture varies.
        </Li>
        <Li>
          Supports Markdown and code, plus rudimentary Tor/Onion
          deployments.
        </Li>
      </Ul>
      <P>
        The closest non-Flowvault equivalent by philosophy. If you
        want a pastebin more than a note sharer, PrivateBin is a good
        pick.
      </P>

      <H2 id="1password">1Password Share</H2>
      <P>
        <A href="https://1password.com/features/secure-password-sharing/">
          1Password Share
        </A>{" "}
        generates a link from an item in your 1Password vault.
      </P>
      <Ul>
        <Li>
          <Strong>Requires a 1Password account</Strong> to create.
        </Li>
        <Li>
          Key management is internal to 1Password&apos;s mediated
          sharing; the recipient doesn&apos;t need an account to open.
        </Li>
        <Li>
          Expiry + one-time-view enforced by 1Password&apos;s
          infrastructure.
        </Li>
        <Li>
          <Em>Closed-source</Em> server. Open-source client would be
          stretching the term.
        </Li>
        <Li>
          The best UX for existing 1Password users because it reaches
          directly into your vault.
        </Li>
      </Ul>
      <P>
        If you&apos;re already paying for 1Password, this is the
        frictionless option. If not, you&apos;re paying a subscription
        for a feature that&apos;s free elsewhere, with a
        closed-source server in the mix.
      </P>

      <H2 id="side-by-side">Side-by-side</H2>
      <Example title="Feature comparison">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`                            Flowvault   Bitwarden   Privnote   OneTime-   Private-   1Password
                            Send        Send                   Secret     Bin        Share

Account required            no          yes         no         no         no         yes
Free / paid                 free        free tier   free       free       free       paid
Key in URL fragment         yes         yes         yes        no*        yes        n/a
Server enforces view cap    yes         yes         yes        yes        yes        yes
Open-source frontend        yes         yes         partial    yes        yes        no
Open-source server          yes         yes         no         yes        yes        no
Self-hostable               yes         yes         no         yes        yes        no
Password gate (2nd layer)   yes         yes         yes        yes        yes        no
Default view cap            1           configurable 1          1          configurable 1
Max lifetime                30 d        30 d        30 d       7 d        configurable 30 d
Max plaintext payload       128 KiB     ~5 MB       very small large      large      ~vault item

(* OneTimeSecret hosted version: key is part of the URL path,
   not the fragment. Self-hosted builds may be configured differently.)`}</pre>
      </Example>

      <H2 id="how-to-choose">How to actually choose</H2>
      <P>
        The right service depends on three questions. If I were
        writing a cheat sheet for a friend, it would look like this.
      </P>

      <H3 id="casual">For the casual send-a-password case</H3>
      <P>
        Anybody here is fine. Privnote is the most recognisable name;
        Flowvault Encrypted Send, Bitwarden Send, PrivateBin,
        OneTimeSecret all do the job.
      </P>

      <H3 id="existing-vendor">
        If you&apos;re already in one of these ecosystems
      </H3>
      <P>
        Use Bitwarden Send (if Bitwarden user) or 1Password Share (if
        1Password user). The in-vault integration is a real UX win for
        frequent senders.
      </P>

      <H3 id="paranoid">For the paranoid case</H3>
      <P>
        You want the key to <Em>definitely</Em> never touch a server,
        you want to audit the mediator code, you want a password layer
        in front, and you want the option to self-host. That narrows
        to Flowvault Encrypted Send, Bitwarden Send self-hosted, and
        PrivateBin self-hosted. All three are reasonable; Flowvault
        adds the benefit of being in the same ecosystem as a
        persistent notepad with{" "}
        <A href="/blog/plausible-deniability-hidden-volumes-explained">
          hidden volumes
        </A>{" "}
        and{" "}
        <A href="/blog/time-locked-notes-drand-tlock">time-locks</A>,
        so one URL covers most secret-handling needs.
      </P>

      <H3 id="large-file">For large file transfer</H3>
      <P>
        Use Bitwarden Send (up to 100 MB free, 500 MB paid) or
        Firefox Send alternatives (Hat.sh, OnionShare). Flowvault,
        Privnote, and PrivateBin are text-sized.
      </P>

      <H2 id="specific-gotchas">
        Four things people get wrong about this category
      </H2>
      <Ol>
        <Li>
          <Strong>
            &ldquo;The link already expired/opened&rdquo; is a feature,
            not a bug.
          </Strong>{" "}
          If your recipient says &ldquo;the link says it&apos;s been
          opened,&rdquo; assume someone else opened it and the secret
          is burned. Rotate immediately, don&apos;t try to reopen.
        </Li>
        <Li>
          <Strong>Share the link and the password separately.</Strong>{" "}
          If both travel over the same channel, the password adds no
          real protection.
        </Li>
        <Li>
          <Strong>Chat apps preview links.</Strong> Some (Slack,
          Discord, certain email scanners) open URLs to generate
          previews. If your service uses view cap 1, the preview
          counts as the view. Favour passwords or longer caps when
          sending into these channels, or use a service that detects
          bots (Flowvault, Bitwarden Send, Privnote all treat GET
          requests carefully but none is immune to aggressive
          previewers).
        </Li>
        <Li>
          <Strong>Fragments aren&apos;t magic.</Strong> They protect
          against <Em>the server</Em> seeing the key. They don&apos;t
          protect against a shoulder surfer, a compromised browser, or
          a malicious extension. The URL itself is always sensitive.
        </Li>
      </Ol>

      <H2 id="see-also">See also</H2>
      <Ul>
        <Li>
          <A href="/send/new">
            <Code>/send/new</Code>
          </A>{" "}
          &mdash; create a Flowvault Encrypted Send link in three
          clicks.
        </Li>
        <Li>
          <A href="/blog/how-to-use-flowvault-guide">
            The beginner&apos;s guide
          </A>{" "}
          &mdash; the broader walkthrough including Encrypted Send.
        </Li>
        <Li>
          <A href="/security">/security</A> &mdash; the exact crypto
          for Encrypted Send: AES-256-GCM + optional Argon2id password
          wrap, Firestore rules, Cloud Function source.
        </Li>
        <Li>
          <A href="/blog/time-locked-notes-drand-tlock">
            Time-locked notes
          </A>{" "}
          &mdash; the cousin primitive when you want
          &ldquo;readable after a date&rdquo; rather than
          &ldquo;readable once.&rdquo;
        </Li>
      </Ul>
    </>
  );
}
