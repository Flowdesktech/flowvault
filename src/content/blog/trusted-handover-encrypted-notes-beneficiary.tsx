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
  Example,
} from "@/components/blog/Prose";

export default function Post() {
  return (
    <>
      <Lead>
        What happens to your encrypted notebook if you stop being able
        to use it? The trusted handover is Flowvault&apos;s answer:
        nominate a beneficiary, pick a check-in cadence, and if you go
        quiet for the interval plus a grace period, the vault
        auto-hands-over to that person &mdash; without ever telling
        Flowvault your password, and without an account anywhere.
        Here&apos;s how it works, end to end, and how it compares to
        Bitwarden Emergency Access and 1Password recovery.
      </Lead>

      <H2 id="the-problem">The problem</H2>
      <P>
        Zero-knowledge encryption has a structural weakness: if you
        forget your password or die, your notes are gone. The
        single-tenant property that protects you from us also
        protects your notes from anyone you&apos;d <Em>want</Em> to
        inherit them.
      </P>
      <P>
        The naive fixes are all bad:
      </P>
      <Ul>
        <Li>
          <Strong>Share the master password with your spouse now.</Strong>{" "}
          Fine until one of you changes it and forgets to tell the
          other, or until you have content you wouldn&apos;t want
          them reading while you&apos;re still alive.
        </Li>
        <Li>
          <Strong>Put it in a will.</Strong> Works, but slow, legally
          messy, and requires your executor to understand
          passwords.
        </Li>
        <Li>
          <Strong>Give the service operator an escrow key.</Strong>{" "}
          Breaks zero-knowledge. That&apos;s not a recovery flow, it
          just makes the vault no longer zero-knowledge.
        </Li>
      </Ul>
      <P>
        What you actually want is: a beneficiary who gets the keys{" "}
        <Em>automatically, at the right moment, without the operator
        ever holding a plaintext key.</Em>
      </P>

      <H2 id="shape">The shape of the solution</H2>
      <P>
        Two ideas, combined:
      </P>
      <Ul>
        <Li>
          <Strong>Client-side wrap.</Strong> The beneficiary password
          is never sent to us. It runs Argon2id in{" "}
          <Em>your</Em> browser, producing a beneficiary key, which
          then AES-GCM-wraps your master key. The resulting wrapped
          key is what we store.
        </Li>
        <Li>
          <Strong>Server-side timer.</Strong> Every time you save, the
          server bumps a &ldquo;last seen&rdquo; timestamp. An hourly
          Cloud Function scans for vaults whose last-seen is older
          than (interval + grace). Those get marked released. Once
          released, the wrapped key becomes readable to a client that
          presents the beneficiary password.
        </Li>
      </Ul>
      <P>
        Both parts are necessary. Without the server-side timer,
        there&apos;s no &ldquo;you went quiet&rdquo; signal. Without
        the client-side wrap, the server would have to decrypt
        things for the beneficiary and we&apos;d know the key.
      </P>

      <H2 id="walkthrough">Walkthrough: enabling a handover</H2>
      <P>
        You open your vault, click <Code>Handover</Code> in the
        toolbar, and configure three things:
      </P>
      <DefList>
        <DefItem term="Interval">
          How long you can go without saving before the grace period
          starts. Presets: weekly, monthly, quarterly, yearly. Custom
          intervals between 1 day and 5 years.
        </DefItem>
        <DefItem term="Grace period">
          A buffer after the interval during which Flowvault emails
          nobody (we don&apos;t have your email) and does nothing
          except wait. Typical: 7 days. This is your &ldquo;I was on
          a hiking trip&rdquo; window.
        </DefItem>
        <DefItem term="Beneficiary password">
          A strong password (min 12 chars) you hand to a trusted
          person out of band. Not your master password. Flowvault
          never sees it, in plaintext or otherwise.
        </DefItem>
      </DefList>
      <P>
        When you click <Code>Enable trusted handover</Code>, the
        client:
      </P>
      <Ol>
        <Li>
          Takes your current master key (the one that just decrypted
          this slot).
        </Li>
        <Li>
          Runs Argon2id on (beneficiary password, a fresh 16-byte
          salt) to get a beneficiary key.
        </Li>
        <Li>
          Encrypts the master key with that beneficiary key using
          AES-256-GCM and a fresh 12-byte nonce. This produces a{" "}
          <Em>wrapped master key</Em>.
        </Li>
        <Li>
          Uploads a Firestore document containing: the wrapped master
          key, the Argon2id salt, the GCM nonce, the interval, the
          grace period, a <Code>released: false</Code> flag, and the
          current timestamp as last-seen.
        </Li>
      </Ol>
      <P>
        That&apos;s the whole setup. The beneficiary password never
        leaves your browser. Flowvault has a ciphertext that wraps
        another ciphertext and a clock.
      </P>

      <H2 id="steady-state">Steady state: checking in</H2>
      <P>
        Every time you save your vault, the same transaction that
        writes the new ciphertext also bumps the handover&apos;s
        <Code>lastSeenAt</Code> timestamp. That is the check-in.
        There&apos;s no separate &ldquo;I&apos;m still here&rdquo;
        button &mdash; if you&apos;re editing, you&apos;re checking in.
      </P>
      <Callout tone="tip" title="Why heartbeat-on-save">
        This keeps the threat model clean. A dedicated heartbeat
        endpoint would have to accept proof-of-liveness from clients
        without a password, which means the server would need to
        decide which clients count as &ldquo;still alive&rdquo; using
        something weaker than the vault key itself. Tying the
        heartbeat to an authenticated, signed save means only the
        real owner can keep the timer alive.
      </Callout>
      <P>
        If you never want to log in again but want the handover to
        fire sooner, just stop saving. If you want the handover to
        fire <Em>never</Em>, disable it from the same modal.
      </P>

      <H2 id="release">The release</H2>
      <P>
        A Cloud Function runs once an hour. It queries Firestore for
        handovers where <Code>lastSeenAt</Code> plus{" "}
        <Code>interval</Code> plus <Code>grace</Code> is in the past
        and <Code>released</Code> is still false. For each match, it
        writes <Code>released: true</Code> and flips the vault&apos;s
        main document into read-only mode (no more writes accepted,
        including from someone who still has the master password).
      </P>
      <P>
        The Firestore security rules enforce the read-only flip: once{" "}
        <Code>deadman.released</Code> is true, no client can write the
        main blob or change handover fields. This is what stops a
        &ldquo;a malicious party presses the button early&rdquo;
        scenario: the server can&apos;t fake a release because the
        scheduled Cloud Function is the only write path, and the rule
        engine enforces it.
      </P>

      <H2 id="beneficiary-unlock">The beneficiary side</H2>
      <P>
        Your beneficiary receives two things from you out of band: the
        vault URL and the beneficiary password. If the handover has
        fired (or when it eventually does), they:
      </P>
      <Ol>
        <Li>
          Open the URL. The page loads, notices{" "}
          <Code>released: true</Code> on the handover document, and
          shows a beneficiary unlock prompt.
        </Li>
        <Li>
          They type the beneficiary password. Argon2id runs in
          their browser with the same salt you originally used,
          derives the beneficiary key, and unwraps the master key
          via AES-GCM.
        </Li>
        <Li>
          The master key now decrypts the slot it was created for,
          and the beneficiary sees the notebook &mdash; in read-only
          mode. Flowvault blocks further writes from the
          beneficiary. It&apos;s explicitly an inheritance view, not a
          transfer of ownership.
        </Li>
      </Ol>
      <P>
        If you stored a backup of the beneficiary password yourself,
        you can also unlock post-release to grab the contents and move
        them elsewhere. Either way, once released, the vault at that
        URL is frozen &mdash; if you&apos;re back from the
        woodlands, you should create a new vault at a new URL rather
        than trying to &ldquo;un-release&rdquo; the old one (which is
        impossible by design).
      </P>

      <H2 id="decoys">
        Handover + hidden volumes: deniability is preserved
      </H2>
      <P>
        The handover wraps one slot&apos;s master key. It knows
        nothing about other slots, so:
      </P>
      <Ul>
        <Li>
          A beneficiary with the beneficiary password sees exactly the
          notebook you configured the handover from.
        </Li>
        <Li>
          They don&apos;t see, and can&apos;t prove the existence of,
          decoy notebooks behind other passwords. The handover
          document in Firestore is a small blob keyed to one slot; the
          other slots remain unreferenced random bytes.
        </Li>
        <Li>
          You can have multiple handovers too &mdash; enable one for
          a &ldquo;family&rdquo; notebook with your spouse, another
          for a &ldquo;work&rdquo; notebook with your business
          partner. Each beneficiary sees only their notebook.
        </Li>
      </Ul>

      <H2 id="comparison">
        How this compares to Bitwarden Emergency Access and 1Password
      </H2>

      <H3 id="bitwarden">Bitwarden Emergency Access</H3>
      <P>
        Bitwarden&apos;s{" "}
        <A href="https://bitwarden.com/help/emergency-access/">
          Emergency Access
        </A>{" "}
        is the closest equivalent in a mainstream password manager. It
        works on a similar &ldquo;timer + beneficiary&rdquo; pattern
        but with some important differences:
      </P>
      <Ul>
        <Li>
          Both parties need Bitwarden <Em>accounts</Em>. Your
          beneficiary must sign up, enable two-factor, and accept an
          invitation.
        </Li>
        <Li>
          It&apos;s a <Em>Premium</Em> feature (paid tier on both
          sides).
        </Li>
        <Li>
          The key escrow happens through Bitwarden&apos;s shared-key
          mechanism rather than a direct password-derived wrap. This
          is well-designed but requires more trust in Bitwarden&apos;s
          infra.
        </Li>
        <Li>
          Bitwarden is a password manager with accounts, backups, and
          recovery phrase support. If you&apos;re already in that
          ecosystem, Emergency Access is excellent.
        </Li>
      </Ul>
      <P>
        Flowvault&apos;s handover is the account-less version. No
        sign-up for either party. No subscription. Open-source server
        code (Bitwarden&apos;s server is open-source too). The
        trade-off is that Flowvault is a notepad, not a password
        manager &mdash; if you want vault features like password
        generation and autofill, use Bitwarden. If you want a
        zero-knowledge scratchpad with inheritance, use this.
      </P>

      <H3 id="1password">1Password Recovery</H3>
      <P>
        <A href="https://1password.com/families">1Password Families</A>{" "}
        has &ldquo;family organizer&rdquo; recovery: family members
        can reset each other&apos;s passwords if they have recovery
        roles. This is a different shape &mdash; it&apos;s a social
        recovery model, not an inactivity-triggered release. Both
        parties must have 1Password accounts in the same family, and
        recovery is initiated on demand rather than automatically.
      </P>

      <H3 id="keepass">KeePass</H3>
      <P>
        KeePass-family tools leave inheritance as an exercise for the
        user: you can give someone a copy of the kdbx file and the
        password now, but there&apos;s no scheduled release and no
        check-in. If you want scheduled release of a KeePass database,
        you need a dead-man mail service on top, which reintroduces an
        account.
      </P>

      <H3 id="summary">Summary table</H3>
      <Example title="quick comparison">
        <pre className="whitespace-pre-wrap font-mono text-[12px]">{`                        Flowvault  Bitwarden EA  1Password  KeePass
Account required         no         yes           yes        no
Cost                     free       paid tier     paid tier  free
Inactivity-triggered     yes        yes           no         no
Open-source end-to-end   yes        partial       no         yes
Plausible deniability    yes        no            no         no
Zero-knowledge release   yes        yes           yes        n/a`}</pre>
      </Example>

      <H2 id="threat-model">What it protects against &mdash; and what it doesn&apos;t</H2>

      <H3 id="protects">Protects against</H3>
      <Ul>
        <Li>
          <Strong>Death or incapacity.</Strong> The beneficiary gets
          the key on schedule.
        </Li>
        <Li>
          <Strong>Long-term amnesia.</Strong> If you forget your own
          password, the beneficiary password is a back-channel (one
          you set up knowingly).
        </Li>
        <Li>
          <Strong>Flowvault operator compromise.</Strong> Attackers at
          our end can&apos;t release your vault early: the scheduled
          function is the only write path, and Firestore rules
          enforce it.
        </Li>
        <Li>
          <Strong>Evil beneficiary before you&apos;re gone.</Strong>{" "}
          The beneficiary cannot read the vault while you&apos;re
          still checking in. The wrapped key is unreadable to them
          until <Code>released: true</Code>.
        </Li>
      </Ul>

      <H3 id="doesnt-protect">Doesn&apos;t protect against</H3>
      <Ul>
        <Li>
          <Strong>Collusion between you and the beneficiary now.</Strong>{" "}
          If you&apos;ve already shared the master password with them,
          the handover doesn&apos;t make it go away. It&apos;s an
          addition, not a replacement.
        </Li>
        <Li>
          <Strong>Weak beneficiary passwords.</Strong> If the
          beneficiary password is guessable, anyone with the URL can
          wait for release and then brute-force. Use a long random one.
        </Li>
        <Li>
          <Strong>You reviving.</Strong> Once the timer fires, it
          fires. There is no &ldquo;I&apos;m back, never mind&rdquo;
          button, by design: that would let an attacker who
          temporarily got your password silently extend the timer
          forever. Starting a fresh vault is the recovery path.
        </Li>
      </Ul>

      <H2 id="practical">Practical advice</H2>
      <Ul>
        <Li>
          <Strong>Pick your interval honestly.</Strong> If you open
          your vault weekly, a weekly interval is fine. If you use it
          only in emergencies, set it yearly and accept that your
          beneficiary waits up to a year plus grace.
        </Li>
        <Li>
          <Strong>Communicate the setup.</Strong> A handover that your
          beneficiary doesn&apos;t know about is a handover that
          doesn&apos;t fire. Tell them: &ldquo;when this URL starts
          working with the password I gave you, that&apos;s how you
          know to open it.&rdquo;
        </Li>
        <Li>
          <Strong>Test it.</Strong> Temporarily set the interval to a
          few minutes on a test vault, watch it release, and unlock
          from a different browser with the beneficiary password.
          Then reset to real values.
        </Li>
        <Li>
          <Strong>Pair it with an encrypted backup.</Strong>{" "}
          <A href="/blog/encrypted-backup-fvault-format">
            Download a <Code>.fvault</Code>
          </A>{" "}
          occasionally and store it somewhere your beneficiary can
          find it. Even if Flowvault disappeared tomorrow, the
          ciphertext + the password still decrypts on any self-hosted
          instance.
        </Li>
      </Ul>

      <H2 id="next">Related reading</H2>
      <Ul>
        <Li>
          <A href="/blog/plausible-deniability-hidden-volumes-explained">
            Plausible deniability with hidden volumes
          </A>{" "}
          &mdash; how the handover plays nicely with decoy notebooks.
        </Li>
        <Li>
          <A href="/blog/encrypted-backup-fvault-format">
            The <Code>.fvault</Code> backup format
          </A>{" "}
          &mdash; long-term insurance for the whole vault.
        </Li>
        <Li>
          <A href="/security">The security page</A> &mdash; exact
          Argon2id parameters, Firestore rule excerpts, Cloud Function
          source.
        </Li>
      </Ul>
    </>
  );
}
