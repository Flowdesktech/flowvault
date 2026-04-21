import {
  Lead,
  H2,
  H3,
  P,
  Ul,
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
        Plausible deniability is the one thing Flowvault does that no
        other browser notepad does: one URL, one ciphertext blob,
        multiple passwords, each unlocking a completely different
        notebook, and nobody &mdash; not the server, not an attacker
        who stole the blob, not a government with a subpoena &mdash;
        can prove how many notebooks exist. This post is the
        end-to-end explanation, borrowing the VeraCrypt model and
        translating it to a browser-only notepad.
      </Lead>

      <H2 id="the-problem">
        The problem: &ldquo;the ciphertext alone reveals too much&rdquo;
      </H2>
      <P>
        Encryption that only hides content is not always enough.
        Metadata &mdash; including{" "}
        <Em>whether a secret exists at all</Em> &mdash; is often the
        sensitive part. Consider three realistic scenarios:
      </P>
      <Ul>
        <Li>
          You cross a border where officials inspect phones and
          compel passwords. The fact that a URL unlocks at all implies
          the existence of the content.
        </Li>
        <Li>
          You have one notebook of normal work notes and another with
          financial recovery information. If someone forces you to
          unlock the vault, revealing one reveals both.
        </Li>
        <Li>
          You&apos;re a journalist, an activist, or a whistleblower in
          a jurisdiction that treats &ldquo;existence of encrypted
          data&rdquo; as grounds for indefinite detention (this is a
          real law in several countries in 2026).
        </Li>
      </Ul>
      <P>
        Normal ZKE solves &ldquo;they can&apos;t read my notes.&rdquo;
        Plausible deniability solves &ldquo;they can&apos;t tell
        whether there are more notes they haven&apos;t seen.&rdquo;
        The second problem is harder, and most encrypted notepads
        don&apos;t even try to solve it.
      </P>

      <H2 id="prior-art">Prior art: VeraCrypt and TrueCrypt</H2>
      <P>
        The canonical implementation of deniable encryption is{" "}
        <A href="https://www.veracrypt.fr/">VeraCrypt</A> (and
        TrueCrypt before it). A VeraCrypt container has a single outer
        volume with its own password, <Em>and optionally</Em> a hidden
        volume nested inside its free space with a different password.
        The encrypted container is a fixed size; the free space of the
        outer volume is deliberately filled with random bytes
        indistinguishable from real ciphertext.
      </P>
      <P>
        If you&apos;re compelled to reveal the password, you reveal
        the <Em>outer</Em> volume&apos;s password. An observer sees
        real-looking data, plus some apparent free space. They
        can&apos;t prove the free space is a hidden volume, because
        it&apos;s statistically identical to encrypted noise that
        VeraCrypt would write anyway.
      </P>
      <P>
        This model is well-understood, well-audited, and widely used.
        The question for Flowvault was whether the same primitive could
        live inside a browser-only notepad with no local filesystem
        access. Turns out the answer is yes, with one architectural
        change.
      </P>

      <H2 id="the-design">The Flowvault hidden-volume format</H2>
      <P>
        A Flowvault vault is a single ciphertext blob in Firestore.
        Inside that blob are <Strong>64 fixed-size slots</Strong>, each
        big enough to hold one notebook. Every slot is either:
      </P>
      <Ul>
        <Li>
          Active: encrypted under a real password with AES-256-GCM.
        </Li>
        <Li>
          Unused: filled with cryptographic random bytes at vault-
          creation time (and rotated on every write).
        </Li>
      </Ul>
      <P>
        From the outside &mdash; or from the server&apos;s point of
        view &mdash; the blob is just <Em>N</Em> bytes of random data.
        The only way to tell which slots are active is to possess a
        password and test whether the resulting ciphertext decrypts.
      </P>

      <Example title="conceptual layout">
        <pre className="whitespace-pre-wrap font-mono text-[12px]">{`+------ vault blob (one Firestore doc) ------+
| header:  version | Argon2id salt | volume  |
|          params  | slot count=64 | nonce   |
|--------------------------------------------|
| slot 0   [ 4 KiB ciphertext or random    ] |
| slot 1   [ 4 KiB ciphertext or random    ] |
| slot 2   [ 4 KiB ciphertext or random    ] |
| ...                                        |
| slot 63  [ 4 KiB ciphertext or random    ] |
+--------------------------------------------+`}</pre>
      </Example>

      <H3 id="finding-a-slot">How a password finds its slot</H3>
      <P>
        A password doesn&apos;t know which slot belongs to it. There
        is no index, no map, no &ldquo;this password =&gt; slot
        17&rdquo; lookup table. Instead, Flowvault uses a{" "}
        <Strong>deterministic slot hash</Strong>: for a given vault,
        running Argon2id on (password, vault-salt) produces a master
        key; running HKDF on that key with a fixed info label produces
        a slot index in <Code>[0, 63]</Code>. The same password always
        lands on the same slot in the same vault.
      </P>
      <P>
        When you type a password, the client tries to decrypt that
        one slot. If the AES-GCM tag verifies, you&apos;ve found a
        real notebook. If it doesn&apos;t, the client reports &ldquo;
        wrong password&rdquo; &mdash; <Em>indistinguishably</Em> from
        the case where the slot genuinely contains random bytes.
      </P>
      <Callout tone="note" title="No per-password oracle">
        Crucially, the server doesn&apos;t learn which slot you tried.
        Every decrypt happens in the browser after one document read.
        All the server saw was a single fetch of the whole blob.
      </Callout>

      <H3 id="collisions">What about slot collisions?</H3>
      <P>
        Two passwords could theoretically hash to the same slot. With
        64 slots, the{" "}
        <A href="https://en.wikipedia.org/wiki/Birthday_attack">
          birthday bound
        </A>{" "}
        says the expected collision count for <Em>k</Em> passwords is
        around <Code>k * (k-1) / 128</Code>, i.e. around 4% at 3
        passwords and rising. Flowvault handles this by testing for
        collisions at the moment you add a password: if the new
        password hashes to an already-occupied slot, the UI rejects it
        and asks you to try a different one. (In practice you have
        roughly <Em>log₂(64) = 6 bits</Em> of per-attempt luck.)
      </P>
      <P>
        This does leak one bit to a very determined attacker: if you
        try 64+ random passwords they&apos;re guaranteed to find every
        active slot. But the protection isn&apos;t &ldquo;a trillion
        slots so every password fits.&rdquo; It&apos;s that{" "}
        <Em>you</Em> control which passwords are in the set, and the
        attacker has to brute-force Argon2id for every guess. At 1s
        per guess on a mid-range laptop, even the much smaller search
        space of &ldquo;plausible passwords&rdquo; is impractical at
        scale.
      </P>

      <H2 id="write-path">What happens on save</H2>
      <P>
        When you save, the client has the master key of exactly one
        notebook in memory. It re-encrypts that slot and then{" "}
        <Strong>re-randomises every other slot</Strong> with fresh
        bytes, then uploads the whole blob. The crucial property:
      </P>
      <Ul>
        <Li>
          The server sees the whole blob change on every save, slot
          index included. It can&apos;t infer which slot held the
          edit.
        </Li>
        <Li>
          Empty slots and active-but-unloaded slots are{" "}
          <Em>statistically identical</Em>: both are random-looking
          bytes of the same size.
        </Li>
      </Ul>
      <P>
        If you only changed one word in a 20-slot vault, the
        server&apos;s Firestore document-change log shows the entire
        blob as modified. It has no signal about which notebook was
        edited or even how many notebooks exist.
      </P>

      <H2 id="handover-semantics">
        How this interacts with the trusted handover
      </H2>
      <P>
        A{" "}
        <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
          trusted handover
        </A>{" "}
        wraps the master key of exactly one slot under a beneficiary
        password. That means:
      </P>
      <Ul>
        <Li>
          The beneficiary only ever sees the notebook you explicitly
          opted in.
        </Li>
        <Li>
          Your decoy notebooks are still invisible to them &mdash; they
          don&apos;t even have the deterministic slot index for any
          password except the one they know.
        </Li>
        <Li>
          Enabling handover on a specific slot doesn&apos;t leak
          metadata about the others. From the server&apos;s
          perspective, the blob has a &ldquo;handover record&rdquo;
          field, but the field itself is symmetric-encrypted and
          pinned to that slot&apos;s master key.
        </Li>
      </Ul>

      <H2 id="duress-slot">Duress vs decoy</H2>
      <P>
        Different security models separate &ldquo;decoy&rdquo; (a fake
        notebook you&apos;d be comfortable showing) from &ldquo;duress&rdquo;
        (a password that triggers active defences &mdash; wipe, silent
        alarm, etc). Flowvault deliberately only supports{" "}
        <Em>decoy</Em> semantics, for two reasons:
      </P>
      <Ul>
        <Li>
          Duress-wipe features are dangerous without complete
          guarantees. You&apos;d have to handle server-side deletion,
          which leaks metadata &mdash; &ldquo;this slot existed
          yesterday and doesn&apos;t today&rdquo; is itself
          incriminating. Deniability that survives only on the
          attacker&apos;s word that they didn&apos;t snapshot the
          ciphertext first is not real deniability.
        </Li>
        <Li>
          Silent-alarm patterns exist but they typically rely on a
          trusted intermediary (Have I Been Pwned-style). Flowvault
          has no such intermediary by design.
        </Li>
      </Ul>
      <P>
        So: every password in Flowvault unlocks a real, fully-functional
        notebook. If you&apos;re compelled to reveal a password, you
        reveal one that opens a believable, normal notebook. The others
        remain unproven.
      </P>

      <H2 id="how-does-it-hold-up">
        How does this hold up against attacks?
      </H2>
      <H3 id="attack-1">Stolen ciphertext blob</H3>
      <P>
        An attacker with a full copy of your Firestore blob sees 4 KiB
        &times; 64 = 256 KiB of indistinguishable random bytes. To
        find any content they need to:
      </P>
      <Ul>
        <Li>
          Guess a password you&apos;d plausibly use.
        </Li>
        <Li>
          Run Argon2id (64 MiB memory, 3 iterations &mdash; roughly
          1 s per attempt on commodity hardware) to derive the master
          key.
        </Li>
        <Li>
          Compute the slot index, fetch that slot, try AES-GCM decrypt.
        </Li>
      </Ul>
      <P>
        Finding one notebook gives them no information about the
        others. There is no &ldquo;how many entries are in the vault&rdquo;
        field to mine; there are only slots and guesses.
      </P>

      <H3 id="attack-2">Coerced password reveal</H3>
      <P>
        You reveal one password. The attacker decrypts the matching
        slot; sees a real, believable notebook. They don&apos;t see
        how many other slots are active. They can demand you keep
        revealing passwords; each successful reveal lets them decrypt
        one more slot. The deniability comes from the fact that{" "}
        <Em>you control when to stop.</Em> There is no objective fact
        about the ciphertext that proves there&apos;s more.
      </P>
      <Callout tone="warn" title="Deniability is a social/legal tool, not a magic shield">
        If the adversary has prior knowledge that you&apos;re using
        Flowvault&apos;s hidden-volume feature, they can assume
        multiple passwords exist and keep pressing. The feature is
        most useful when the adversary hasn&apos;t specifically
        profiled you. This matches VeraCrypt&apos;s own guidance.
      </Callout>

      <H3 id="attack-3">Server compromise or subpoena</H3>
      <P>
        Same story as stolen ciphertext. Whatever the server hands
        over is the opaque blob. We don&apos;t log passwords (we
        don&apos;t see them). We don&apos;t log slot indices (clients
        don&apos;t send them). We don&apos;t track how many notebooks
        are live in a vault (we can&apos;t; the information
        isn&apos;t in the blob metadata).
      </P>

      <H3 id="attack-4">
        Long-term traffic analysis on &ldquo;save&rdquo; events
      </H3>
      <P>
        Every save rewrites the whole blob, so the volume of data
        doesn&apos;t leak which notebook was edited. The timing of
        saves can still leak that <Em>someone</Em> is actively using
        the vault &mdash; but not which password they&apos;re using.
        This is the same as every zero-knowledge storage service.
      </P>

      <H2 id="what-this-enables">What this actually enables</H2>
      <P>
        Four concrete use cases that are not really possible with
        other browser notepads:
      </P>
      <Ul>
        <Li>
          <Strong>Cross-border travel.</Strong> Have a visible
          notebook you&apos;d happily show, plus a hidden notebook
          for recovery keys, credentials, or trip-specific notes you
          don&apos;t want inspected.
        </Li>
        <Li>
          <Strong>Shared device or shared URL.</Strong> You and your
          partner share a URL. Either can hand the device to the other
          with their own password, without revealing what the other
          has written. No accounts, no user model.
        </Li>
        <Li>
          <Strong>Whistleblowing drafts.</Strong> A source can keep
          working notes about a sensitive story behind one password,
          while the &ldquo;real&rdquo; password for the URL unlocks a
          harmless grocery list.
        </Li>
        <Li>
          <Strong>Legally compelled disclosure.</Strong> In
          jurisdictions that can compel passwords, the ability to
          reveal one password (a real notebook that looks innocuous)
          reduces the incentive to keep pressing.
        </Li>
      </Ul>

      <H2 id="limits">The limits (spoken plainly)</H2>
      <Ul>
        <Li>
          <Strong>Slot size is fixed.</Strong> Each slot holds around
          8 KiB of content (tab titles + content). A single long
          document can&apos;t span slots yet.
        </Li>
        <Li>
          <Strong>64 slots total.</Strong> Enough for the realistic
          case of &ldquo;one real + a couple of decoys&rdquo;, not a
          sprawling multi-persona setup. Collisions become practically
          certain beyond a handful of passwords per vault.
        </Li>
        <Li>
          <Strong>Rubber-hose is still rubber-hose.</Strong> If an
          attacker knows Flowvault supports hidden volumes, they can
          demand more passwords than you&apos;ve provided. Plausible
          deniability reduces their certainty; it doesn&apos;t give
          you infinite alibis.
        </Li>
        <Li>
          <Strong>Write metadata still exists.</Strong> Timestamps of
          saves are visible to the server and the hosting provider.
          Flowvault minimises server logs, but this is a property of
          the transport, not the format.
        </Li>
      </Ul>

      <H2 id="next">Keep reading</H2>
      <P>
        If you&apos;re curious how the hidden-volume design interacts
        with inheritance, the next post is the{" "}
        <A href="/blog/trusted-handover-encrypted-notes-beneficiary">
          trusted-handover deep dive
        </A>
        . If you&apos;re here for the cryptographic primitives, the{" "}
        <A href="/security">security page</A> lists the exact Argon2id
        and AES-GCM parameters and the format version numbers.
      </P>
    </>
  );
}
