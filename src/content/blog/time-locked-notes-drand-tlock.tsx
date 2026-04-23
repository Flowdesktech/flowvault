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
        Write a note today, hand someone the link, and guarantee that
        nobody &mdash; including you and Flowvault &mdash; can decrypt
        it until a future moment. That&apos;s the shape of a
        time-locked note. The clever part is that the guarantee holds
        even against the person who made the note. This post explains
        how that&apos;s possible at all, using a public randomness
        beacon called drand and a construction called tlock.
      </Lead>

      <H2 id="the-problem">The goal: sealed until a date</H2>
      <P>
        There&apos;s a useful primitive buried in cryptography
        literature under names like &ldquo;timed-release encryption&rdquo;:
        a message you can only read after a fixed future moment, where
        the lock is enforced by mathematics, not by someone promising
        to keep a key safely. Practical examples:
      </P>
      <Ul>
        <Li>
          A birthday letter to yourself that unlocks next year.
        </Li>
        <Li>
          A predictions envelope that opens six months later so nobody
          can argue you rewrote it retroactively.
        </Li>
        <Li>
          A recovery envelope that becomes readable on{" "}
          <Em>exactly</Em> January 1, 2030, not before and not after.
        </Li>
        <Li>
          A disclosure commitment to a journalist that can&apos;t be
          opened early even under subpoena, because the publisher
          doesn&apos;t have the key either.
        </Li>
      </Ul>
      <P>
        The key property is &ldquo;not even the sender can cheat.&rdquo;
        Traditional approaches &mdash; handing the key to an escrow
        service, scheduling a Cloud Function to email yourself &mdash;
        all rely on a trusted operator. Time-lock encryption gives you
        a cryptographic alternative.
      </P>

      <H2 id="drand">Meet drand: the public randomness beacon</H2>
      <P>
        <A href="https://drand.love">drand</A> is a production
        randomness beacon operated by a consortium of independent
        parties (Protocol Labs, Cloudflare, EPFL, Kudelski, and several
        others). Every 30 seconds, the consortium produces a{" "}
        <Em>signature</Em> over the current round number using a
        threshold BLS signing scheme. The signatures are publicly
        reproducible but cannot be computed early &mdash; they require
        real cooperation across the quorum of operators.
      </P>
      <P>
        Crucially for our purposes: the drand consortium commits to a
        <Em>public key</Em> up front. That public key, combined with a
        future round number, forms an identity that an IBE (identity-
        based encryption) scheme can encrypt to. When the round hits,
        the signature <Em>is</Em> the private key that decrypts.
      </P>
      <Callout tone="note">
        &ldquo;I encrypted to round 24,680,000. The signature for that
        round will exist on May 12, 2027 at 14:00:30 UTC. Until then,
        nobody has a key that can decrypt.&rdquo; That&apos;s the
        whole trick.
      </Callout>

      <H2 id="tlock">tlock: turning beacons into encryption</H2>
      <P>
        <A href="https://eprint.iacr.org/2023/189">tlock</A>{" "}
        (Drand-Based Time-Lock Encryption, Timelock.zone, 2023) is the
        scheme that puts the IBE layer on top of drand. The idea:
      </P>
      <Ol>
        <Li>
          Sender picks a target <Em>round number</Em> on the drand
          beacon (equivalent to a target date, at 30-second
          granularity).
        </Li>
        <Li>
          Sender uses the drand network&apos;s public key and the
          target round as an IBE &ldquo;identity.&rdquo;
        </Li>
        <Li>
          Sender encrypts a random AES-GCM key using IBE-to-that-
          identity, then encrypts the message with the AES key
          normally.
        </Li>
        <Li>
          The wrapped key sits in the ciphertext. Nobody can unwrap it
          until the drand network publishes the signature for that
          round.
        </Li>
        <Li>
          On or after the target time, anyone with the ciphertext
          fetches the signature from drand (it&apos;s public),
          decrypts the AES key, then decrypts the message.
        </Li>
      </Ol>
      <P>
        The construction is audit-worthy because the security reduces
        to the hardness of computing a BLS signature over a round
        before the quorum signs it. As long as the drand operators
        don&apos;t collectively collude to sign early, the message is
        sealed.
      </P>

      <H2 id="flowvault-layer">How Flowvault uses it</H2>
      <P>
        Flowvault&apos;s <A href="/timelock/new">/timelock/new</A>{" "}
        page is a thin UI over tlock. When you submit:
      </P>
      <Ol>
        <Li>
          The client converts your chosen unlock time to the matching
          drand round number.
        </Li>
        <Li>
          The client generates a fresh AES-256 key and encrypts your
          message with AES-256-GCM.
        </Li>
        <Li>
          The client runs tlock: encrypts that AES key to (drand
          public key, round) using the IBE scheme. This produces a
          small wrapped key.
        </Li>
        <Li>
          The client uploads <Em>only</Em> the ciphertext + wrapped
          key + round number to Flowvault&apos;s server. No password,
          no email, no account. Optionally, if you ticked
          &ldquo;require a password,&rdquo; it also wraps the AES key
          a second time with an Argon2id-derived password key, so
          both the time lock <Em>and</Em> the password must yield
          before the reader sees plaintext.
        </Li>
      </Ol>
      <P>
        Flowvault stores the ciphertext until 30 days after the unlock
        time (default retention), then garbage-collects it. That&apos;s
        the extent of our involvement.
      </P>

      <H2 id="read-path">The read path</H2>
      <P>
        When someone opens the share link{" "}
        <Code>useflowvault.com/t/&lt;id&gt;</Code>:
      </P>
      <Ul>
        <Li>
          If the unlock time hasn&apos;t arrived, the page shows a
          countdown computed from the target round, and no ciphertext
          decryption is even attempted.
        </Li>
        <Li>
          If the unlock time has arrived, the browser asks a drand
          endpoint (we use{" "}
          <A href="https://drand.cloudflare.com">
            drand.cloudflare.com
          </A>{" "}
          and <A href="https://api.drand.sh">api.drand.sh</A> as
          fallbacks) for the signature on the target round.
        </Li>
        <Li>
          It verifies the signature against the drand public key
          (a constant baked into the client).
        </Li>
        <Li>
          It runs tlock decrypt to recover the AES key.
        </Li>
        <Li>
          If a password layer was enabled, it prompts the reader for
          the password and runs Argon2id + AES-GCM to unwrap the
          inner key.
        </Li>
        <Li>
          AES-GCM decrypts the payload. The plaintext is displayed.
        </Li>
      </Ul>
      <P>
        Nothing about the decryption touches Flowvault&apos;s servers
        in plaintext. We only ever hold the opaque ciphertext and the
        round number.
      </P>

      <H2 id="why-trust-drand">Why trust drand?</H2>
      <P>
        The security of this scheme depends on drand actually being a
        threshold beacon, not a single party. Current drand operators
        include:
      </P>
      <Ul>
        <Li>Cloudflare</Li>
        <Li>Protocol Labs</Li>
        <Li>EPFL (&Eacute;cole polytechnique f&eacute;d&eacute;rale de Lausanne)</Li>
        <Li>Kudelski Security</Li>
        <Li>University of Chile</Li>
        <Li>C4DT</Li>
        <Li>Tbtc / Thesis</Li>
        <Li>emerald (and others)</Li>
      </Ul>
      <P>
        The &ldquo;League of Entropy&rdquo; consortium is publicly
        audited and has been running continuously since 2019. The
        threshold is set so that a strict majority of operators must
        cooperate to produce each signature. For an early unlock, an
        attacker would need to compromise or coerce more than half of
        independent organisations in multiple jurisdictions
        simultaneously.
      </P>
      <Callout tone="warn" title="Not &ldquo;provably impossible&rdquo;">
        The threshold is strong but not infinite. If you need a lock
        for something where a well-resourced adversary would spend
        seven-figure amounts to decrypt early, drand is probably not
        your threat model. For everyday &ldquo;letter to my future
        self&rdquo;, &ldquo;commitment envelope&rdquo;, or
        &ldquo;90-day disclosure&rdquo; use cases, it is
        overwhelmingly stronger than the alternatives.
      </Callout>

      <H2 id="clock-granularity">Clock granularity and drift</H2>
      <P>
        drand produces one signature every 30 seconds, so Flowvault
        rounds unlock times to the nearest 30-second boundary. If you
        pick &ldquo;May 12, 2027 at 14:00:15,&rdquo; the actual unlock
        is &ldquo;May 12, 2027 at 14:00:30.&rdquo; The UI shows the
        effective unlock moment clearly.
      </P>
      <P>
        drand&apos;s round timing uses a public genesis timestamp;
        it&apos;s clock-drift-free for practical purposes. Flowvault
        relies on this by converting target datetimes to round numbers
        at creation time and never re-computing them.
      </P>

      <H2 id="use-cases">Five real use cases</H2>

      <H3 id="future-self">Future-self letters</H3>
      <P>
        Write a letter to yourself on your birthday, unlock it in one
        year. Share the URL with a friend so you can&apos;t lose it
        (they&apos;ll see a countdown until it opens). Or keep it in
        your vault as a tab. The math guarantees the envelope stays
        sealed.
      </P>

      <H3 id="predictions">Prediction commitments</H3>
      <P>
        You think a particular event will happen. Write down the
        prediction, lock it 180 days out. If you&apos;re right,
        you&apos;ve got a cryptographic receipt that you called it
        before the fact. Useful for forecasting, research
        pre-registration, journalism commitments.
      </P>

      <H3 id="dead-drop">Dead-drop disclosures</H3>
      <P>
        You commit to disclosing something in three months unless
        circumstances change. Lock the disclosure now, share the URL
        with your counterparty. They can see the commitment exists
        (the URL resolves) but cannot read it. The deadline is
        externally enforced by drand, not by your willingness to
        release.
      </P>

      <H3 id="recovery">Recovery envelopes</H3>
      <P>
        Combined with the <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
          trusted handover
        </A>
        , this is powerful. Create a recovery envelope today, lock it
        to some far-future date. Store the URL in your vault.
        Configure a handover so that when you go quiet, your
        beneficiary gets the vault, finds the URL, and either waits
        for the envelope to unlock naturally or knows what to tell
        your executor to expect.
      </P>

      <H3 id="multi-party">Multi-party coordination</H3>
      <P>
        Several parties each create time-locked envelopes that unlock
        on the same date. All of them can publish their URLs up front
        (nobody can peek). On the date, everyone&apos;s content
        becomes simultaneously readable. This is the sealed-bid
        auction pattern, useful anywhere you want to prevent
        last-minute information leaks.
      </P>

      <H2 id="limits">What this doesn&apos;t do</H2>
      <Ul>
        <Li>
          <Strong>It doesn&apos;t enforce a maximum lifetime.</Strong>{" "}
          A time-locked note is readable forever once the round hits.
          If you want &ldquo;destroy after the deadline,&rdquo;
          combine it with a lifetime cap on the storage side (we
          garbage-collect ciphertexts 30 days after unlock by
          default).
        </Li>
        <Li>
          <Strong>It doesn&apos;t prevent copying.</Strong> The
          recipient can screenshot the decrypted text, just like any
          other encryption scheme. This is a &ldquo;when it can be
          read&rdquo; primitive, not a DRM primitive.
        </Li>
        <Li>
          <Strong>It isn&apos;t post-quantum.</Strong> BLS signatures
          rely on elliptic-curve pairings; a future quantum attacker
          could theoretically break them. For any lock shorter than
          the &ldquo;practical quantum computer&rdquo; timeline, it&apos;s
          fine; for 50+ year time capsules, pick a different tool.
        </Li>
        <Li>
          <Strong>It depends on drand continuing to exist.</Strong> If
          the League of Entropy disbanded tomorrow, locks using those
          public keys would never unlock. The consortium is stable
          and has been running for years, but it&apos;s a real
          dependency. Flowvault doesn&apos;t promise longer-than-drand
          durability.
        </Li>
      </Ul>

      <Example title="Comparison: other time-release approaches">
        <pre className="whitespace-pre-wrap font-mono text-[12px]">{`                         Flowvault tlock   Email scheduler   Bitcoin timelock
Needs a trusted operator no                yes (Gmail etc)   no
Sender can cheat early   no                yes (reschedule)  no
Cost per envelope        free              free              tx fees
Granularity              30 s              minutes           ~10 min
Post-quantum             no                (depends)         depends`}</pre>
      </Example>

      <H2 id="further-reading">Further reading</H2>
      <Ul>
        <Li>
          <A href="https://drand.love">drand.love</A> &mdash; the
          beacon&apos;s homepage, with the current public key and
          operator list.
        </Li>
        <Li>
          <A href="https://eprint.iacr.org/2023/189">
            tlock paper (IACR ePrint 2023/189)
          </A>{" "}
          &mdash; the formal construction.
        </Li>
        <Li>
          <A href="https://timelock.zone/">timelock.zone</A> &mdash;
          the reference tlock implementations and browser tooling
          Flowvault builds on.
        </Li>
        <Li>
          <A href="/security">The Flowvault security page</A> &mdash;
          the exact drand public key, AES parameters, and Argon2id
          settings for the optional password layer.
        </Li>
        <Li>
          <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
            Trusted handover
          </A>{" "}
          &mdash; the inactivity-triggered cousin of the time lock.
        </Li>
      </Ul>
    </>
  );
}
