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
        ProtectedText has been the default answer to &ldquo;is there a
        URL I can open, type a password, and start writing?&rdquo; for
        over a decade. Flowvault is a newer project aimed at the same
        primitive, with a few specific technical choices that look
        different. This post is the honest head-to-head: what&apos;s
        the same, what Flowvault changes and why, where ProtectedText
        is genuinely better, and how to decide between them.
      </Lead>

      <H2 id="common-ground">What&apos;s the same</H2>
      <P>
        Both products answer the same question: a zero-knowledge
        notepad you can open from any browser, with no account, no
        email, no software install. Both derive a key from your
        password with Argon2id. Both encrypt in the browser and send
        only ciphertext to the server. Both let you pick a URL and
        reuse it forever. That shared shape is why people compare them
        in the first place.
      </P>
      <P>
        I have a lot of respect for ProtectedText. It&apos;s been
        running since around 2011, survived everything that&apos;s
        killed a dozen &ldquo;encrypted pastebin&rdquo; projects, and
        the fundamental UX &mdash; type a URL, type a password, write
        &mdash; is <Em>right</Em>. Flowvault wouldn&apos;t exist if
        ProtectedText hadn&apos;t shown that the shape works.
      </P>

      <H2 id="four-specific-differences">
        Four specific technical differences
      </H2>
      <P>
        There are four places where Flowvault and ProtectedText make
        different choices. Only the first two are concerns about
        ProtectedText itself; the other two are features Flowvault
        adds that ProtectedText doesn&apos;t have.
      </P>

      <H3 id="diff-1">1. The legacy plaintext-password blob</H3>
      <P>
        This is the most specific, verifiable difference. Open a
        ProtectedText URL, watch the network tab on save, and
        you&apos;ll see it upload <Em>two</Em> ciphertexts: a modern
        blob keyed by an Argon2id-derived key, and an{" "}
        <Code>encryptedContentLegacy</Code> blob keyed directly by the
        raw password (for backwards compatibility with much older
        clients that didn&apos;t use Argon2).
      </P>
      <P>
        The modern blob is fine. The legacy blob is the problem: if a
        database dump ever leaks, that second blob is crackable{" "}
        <Em>without doing any Argon2 work at all</Em>. A strong Argon2
        parameter set multiplies the cost of a guess by several
        orders of magnitude. A legacy blob next to it reverts that
        protection.
      </P>
      <P>
        Flowvault has no legacy compatibility layer because there
        aren&apos;t any older clients to be compatible with. Every
        ciphertext has to go through the full Argon2id chain to even
        attempt a decrypt.
      </P>
      <Callout tone="note" title="To be fair">
        If a ProtectedText URL is used strictly with a high-entropy
        password, the legacy blob is still hard to crack. The concern
        is users with weaker passwords, where the Argon2 work factor
        is the thing that saves them, and the legacy blob silently
        removes it.
      </Callout>

      <H3 id="diff-2">2. Authenticated vs malleable cipher</H3>
      <P>
        ProtectedText&apos;s primary blob uses AES-256-CBC via the
        CryptoJS library. AES-CBC is not authenticated: if someone
        flips bits in the stored ciphertext, the client decrypts into
        <Em>something</Em> &mdash; possibly garbage, possibly just a
        mutated plaintext &mdash; without any signal that the
        ciphertext was tampered with.
      </P>
      <P>
        AES-256-<Em>GCM</Em>, which Flowvault uses, is authenticated:
        any modification to the stored bytes produces a verification
        failure and the decrypt hard-aborts. For a threat model that
        includes an untrusted or compromised server, that matters. A
        malicious hosting provider could flip bytes in a CBC blob and
        you&apos;d never notice until the content stopped making
        sense. GCM surfaces it immediately.
      </P>
      <P>
        AES-GCM has been the default recommendation for authenticated
        encryption for about a decade now. There isn&apos;t a strong
        argument against using it in a 2026 notepad.
      </P>

      <H3 id="diff-3">3. Plausible deniability (hidden volumes)</H3>
      <P>
        ProtectedText has one password per URL. You reveal the password,
        you reveal everything. If a border agent or adversary compels
        the password, there&apos;s no cryptographic alibi.
      </P>
      <P>
        Flowvault implements VeraCrypt-style hidden volumes inside
        the browser notepad: one URL holds up to 64 independent
        notebooks, each behind a different password, and nobody can
        prove how many notebooks exist. Empty slots are filled with
        random bytes indistinguishable from real ciphertext. Under
        coercion you can reveal one password, show an ordinary-
        looking notebook, and not leave evidence of the others.
      </P>
      <P>
        The full mechanism is in the{" "}
        <A href="/blog/plausible-deniability-hidden-volumes-explained">
          hidden-volume deep-dive
        </A>
        . No other browser-based encrypted notepad in 2026 offers this.
        It&apos;s the single biggest feature gap between Flowvault and
        ProtectedText.
      </P>

      <H3 id="diff-4">4. Open-source scope</H3>
      <P>
        ProtectedText&apos;s client-side JavaScript is visible in the
        browser &mdash; you can read it on any page. That&apos;s
        better than most &ldquo;encrypted&rdquo; products. But the{" "}
        <Em>server</Em> side is{" "}
        <A href="https://www.protectedtext.com/faq">
          explicitly closed source
        </A>{" "}
        per their own FAQ. You can&apos;t verify what logging,
        retention, or rate-limiting happens server-side, and you
        can&apos;t self-host.
      </P>
      <P>
        Flowvault is open end-to-end. The{" "}
        <A href="https://github.com/Flowdesktech/flowvault">
          repository
        </A>{" "}
        contains:
      </P>
      <Ul>
        <Li>The frontend (Next.js, all of the crypto).</Li>
        <Li>
          The Cloud Functions (the trusted-handover sweep, the
          Encrypted Send atomic counter, time-lock retention).
        </Li>
        <Li>
          The Firestore security rules &mdash; the actual enforcement
          boundary between the operator and your data.
        </Li>
      </Ul>
      <P>
        All three are deployed unmodified. You can read them, audit
        them, fork them, and self-host the whole thing on your own
        Firebase project. The zero-knowledge claim is falsifiable in a
        way ProtectedText&apos;s simply isn&apos;t.
      </P>

      <H2 id="feature-gap">
        Features Flowvault has that ProtectedText doesn&apos;t
      </H2>
      <P>
        Beyond the core notepad, Flowvault bundles four other
        zero-knowledge primitives that together replace a handful of
        separate products:
      </P>
      <Ul>
        <Li>
          <Strong>Multi-notebook tabs per password.</Strong> Each
          password unlocks a workspace, not a single page. Rename,
          reorder, delete tabs &mdash; still one opaque blob on the
          server.
        </Li>
        <Li>
          <Strong>
            <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
              Trusted handover
            </A>
            .
          </Strong>{" "}
          Nominate a beneficiary with a separate password; if you stop
          checking in for an interval you configure, the vault
          auto-hands over. No account required for either party.
        </Li>
        <Li>
          <Strong>
            <A href="/blog/time-locked-notes-drand-tlock">
              Time-locked notes
            </A>
            .
          </Strong>{" "}
          Encrypt a message that literally cannot be opened before a
          target date &mdash; not even by you &mdash; using drand and
          tlock IBE.
        </Li>
        <Li>
          <Strong>
            <A href="/blog/encrypted-send-vs-bitwarden-send-privnote">
              Encrypted Send
            </A>
            .
          </Strong>{" "}
          One-shot self-destructing links for sharing a password, an
          API key, or a recovery phrase. Key in the URL fragment,
          view cap enforced server-side by a Cloud Function.
        </Li>
        <Li>
          <Strong>
            <A href="/blog/encrypted-backup-fvault-format">
              <Code>.fvault</Code> encrypted backup + Markdown export
            </A>
            .
          </Strong>{" "}
          Download the full vault as a single zero-knowledge file,
          restore to any instance, or export the currently unlocked
          slot as plaintext Markdown for migration.
        </Li>
      </Ul>
      <P>
        ProtectedText does none of these. If you need any of them,
        you&apos;re layering separate tools (Bitwarden Send for
        one-shots, a will for inheritance, etc.) on top.
      </P>

      <H2 id="where-protectedtext-wins">Where ProtectedText wins</H2>
      <P>
        Honest scoring has to go both ways. There are real reasons to
        keep using ProtectedText.
      </P>
      <Ul>
        <Li>
          <Strong>Track record.</Strong> ProtectedText has run for
          over a decade. Flowvault launched in 2026. If &ldquo;still
          online in five years&rdquo; is important to you, a 15-year-
          old service is a safer bet on base rates alone. (Mitigation
          in Flowvault: download a{" "}
          <Code>.fvault</Code> backup so you can restore on a
          self-hosted instance even if we disappear.)
        </Li>
        <Li>
          <Strong>Brand recognition.</Strong> &ldquo;Go to
          protectedtext.com&rdquo; is a URL non-technical people
          remember. Flowvault is new and has to earn that familiarity.
        </Li>
        <Li>
          <Strong>Zero moving parts.</Strong> ProtectedText is a
          static page and a blob store. Flowvault has Cloud Functions
          for the handover sweep, Encrypted Send atomicity, and
          time-lock retention. Fewer moving parts means fewer
          opportunities for bugs; this argument genuinely favours
          ProtectedText.
        </Li>
        <Li>
          <Strong>
            Simpler mental model if all you want is one notebook.
          </Strong>{" "}
          If plausible deniability, inheritance, time-locks, and
          one-shot sharing are features you don&apos;t need and
          won&apos;t use, a product without them is simpler.
        </Li>
        <Li>
          <Strong>Stability-as-a-feature.</Strong> ProtectedText
          hasn&apos;t changed much in years. For some use cases
          (&ldquo;I just want the URL I saved in 2019 to keep working
          exactly the same&rdquo;) that&apos;s a virtue.
        </Li>
      </Ul>

      <H2 id="side-by-side">Side-by-side</H2>
      <Example title="Flowvault vs ProtectedText">
        <pre className="whitespace-pre-wrap font-mono text-[11px]">{`                                    Flowvault            ProtectedText

Account required                    no                   no
Password-to-key derivation          Argon2id             Argon2id
                                    (64 MiB, 3 iter)     (32 MiB, ~300 ms)
Cipher                              AES-256-GCM          AES-256-CBC
                                    (authenticated)      (unauthenticated)
Legacy plaintext-password blob      no                   yes
Plausible deniability               yes (hidden          no
                                    volumes, 64 slots)
Fixed-size ciphertext blob          yes                  no
Tamper detection on read            yes (GCM tag)        no
Multi-notebook tabs per password    yes                  no
Trusted handover to beneficiary     yes                  no
Time-locked notes (drand)           yes                  no
One-shot self-destructing sharing   yes (Send)           no
Encrypted backup / restore file     yes (.fvault)        no
Plaintext export                    yes (Markdown .zip)  manual copy
Open-source frontend                yes                  yes (client JS only)
Open-source server                  yes                  no
Open-source security rules          yes                  n/a (closed server)
Self-hostable                       yes                  no
Track record                        < 1 year             15+ years
Licensed                            MIT                  (unstated)`}</pre>
      </Example>

      <H2 id="migrating">Migrating from ProtectedText</H2>
      <P>
        ProtectedText has no export function. The only way to move is
        manual: open the vault, copy each tab&apos;s plaintext, paste
        into Flowvault. A few practical notes if you&apos;re doing
        this:
      </P>
      <Ol>
        <Li>
          Pick a Flowvault URL slug. It doesn&apos;t have to match
          your ProtectedText URL.
        </Li>
        <Li>
          Set a strong password (different from your ProtectedText
          password; rotating during migration is a small free
          security upgrade).
        </Li>
        <Li>
          Create a tab in Flowvault for each logical section of your
          ProtectedText notebook. Tabs are cheap; split by topic.
        </Li>
        <Li>
          Open ProtectedText in one browser tab, Flowvault in another.
          Copy-paste section by section.
        </Li>
        <Li>
          Once you&apos;re satisfied everything transferred, download
          a <Code>.fvault</Code> backup (Export menu) so you have a
          portable copy independent of Flowvault&apos;s servers.
        </Li>
        <Li>
          If you used ProtectedText for shared-URL inheritance
          (&ldquo;my spouse knows the URL and password&rdquo;), now
          is a good moment to set up a{" "}
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            trusted handover
          </A>{" "}
          with a dedicated beneficiary password instead.
        </Li>
      </Ol>
      <P>
        It takes about ten minutes for a typical notebook. You can
        keep the ProtectedText URL alive for a while as a fallback.
      </P>

      <H2 id="who-should-pick-which">Who should pick which</H2>

      <H3 id="pick-protectedtext">Pick ProtectedText if</H3>
      <Ul>
        <Li>
          You&apos;re already using it and the URL is muscle memory.
        </Li>
        <Li>
          You value a 15-year track record over a specific feature gap.
        </Li>
        <Li>
          You have a single notebook, a strong password, and a threat
          model that doesn&apos;t include coercion or server
          compromise.
        </Li>
        <Li>
          You don&apos;t need tabs, inheritance, time-locks, or
          backups.
        </Li>
      </Ul>

      <H3 id="pick-flowvault">Pick Flowvault if</H3>
      <Ul>
        <Li>
          You want plausible deniability &mdash; one URL, multiple
          notebooks, different passwords.
        </Li>
        <Li>
          You want modern authenticated encryption (AES-GCM) and no
          legacy password-keyed blob sitting next to your data.
        </Li>
        <Li>
          You want a beneficiary to be able to open the notebook if
          you stop checking in.
        </Li>
        <Li>
          You want the one-shot send, the time-lock, or the encrypted
          backup as part of the same tool instead of three separate
          ones.
        </Li>
        <Li>
          You want the option to self-host, read the server code, or
          fork the project.
        </Li>
      </Ul>

      <H2 id="tldr">TL;DR</H2>
      <P>
        Flowvault is an honest upgrade on the ProtectedText primitive:
        same URL-and-password shape, better crypto defaults (no legacy
        plaintext-password blob, AES-GCM instead of CBC), a
        deniability feature that doesn&apos;t exist in ProtectedText,
        and a server side that&apos;s actually open and self-hostable.
        ProtectedText&apos;s main remaining advantage is its longevity.
      </P>
      <P>
        If you&apos;re weighing them, the best test is to open both
        and use them for a week. Flowvault URLs are free. Try it at{" "}
        <A href="/">useflowvault.com</A>, write some notes,
        add a decoy password, download a backup, and decide from
        experience rather than a spec sheet.
      </P>

      <H2 id="see-also">See also</H2>
      <Ul>
        <Li>
          <A href="/blog/why-i-built-flowvault">
            Why I built Flowvault
          </A>{" "}
          &mdash; the fuller landscape critique that motivated the
          project.
        </Li>
        <Li>
          <A href="/blog/plausible-deniability-hidden-volumes-explained">
            Plausible deniability with hidden volumes
          </A>{" "}
          &mdash; the exact mechanism that ProtectedText doesn&apos;t
          have.
        </Li>
        <Li>
          <A href="/blog/encrypted-backup-fvault-format">
            The <Code>.fvault</Code> format
          </A>{" "}
          &mdash; why &ldquo;ProtectedText has no export&rdquo; was
          one of the motivating gaps.
        </Li>
        <Li>
          <A href="/security">/security</A> &mdash; exact Argon2id and
          AES-GCM parameters, Firestore rule excerpts, and what the
          server actually sees.
        </Li>
        <Li>
          <A href="/">useflowvault.com</A> &mdash; try it.
        </Li>
      </Ul>
    </>
  );
}
