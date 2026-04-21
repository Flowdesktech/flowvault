import type { ReactNode } from "react";
import Link from "next/link";
import { Info, AlertTriangle, Lightbulb } from "lucide-react";

/**
 * Shared typography primitives for the blog.
 *
 * We hand-roll these instead of pulling `@tailwindcss/typography` so the
 * blog matches the FAQ / Security page aesthetic exactly and so we don't
 * ship another dependency. Each helper renders a plain semantic element
 * with Flowvault-tuned spacing, colour, and line-height.
 */

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="text-[15px] leading-relaxed text-foreground [&_a]:text-accent [&_a:hover]:underline">
      {children}
    </div>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[17px] leading-relaxed text-muted">{children}</p>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-12 scroll-mt-20 text-2xl font-semibold tracking-tight text-foreground"
    >
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="mt-8 scroll-mt-20 text-lg font-semibold text-foreground"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 leading-relaxed text-muted">{children}</p>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-muted marker:text-muted/70">
      {children}
    </ul>
  );
}

export function Ol({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted marker:text-muted/70">
      {children}
    </ol>
  );
}

export function Li({ children }: { children: ReactNode }) {
  return <li className="leading-relaxed">{children}</li>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-background-elev-2 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

export function Em({ children }: { children: ReactNode }) {
  return <em className="italic">{children}</em>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  // Internal links use next/link so Next can prefetch; external stay
  // plain `<a>` with safe defaults.
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="text-accent hover:underline">
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent hover:underline"
    >
      {children}
    </a>
  );
}

export function Blockquote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-6 rounded-r-md border-l-2 border-accent/40 bg-accent/5 px-4 py-3 text-sm italic text-muted">
      {children}
    </blockquote>
  );
}

export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warn" | "tip";
  title?: string;
  children: ReactNode;
}) {
  const palette = {
    note: {
      border: "border-accent/30",
      bg: "bg-accent/5",
      icon: <Info size={14} className="mt-0.5 shrink-0 text-accent" />,
    },
    warn: {
      border: "border-warning/30",
      bg: "bg-warning/10",
      icon: (
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
      ),
    },
    tip: {
      border: "border-success/30",
      bg: "bg-success/10",
      icon: <Lightbulb size={14} className="mt-0.5 shrink-0 text-success" />,
    },
  }[tone];
  return (
    <aside
      className={`mt-6 flex gap-3 rounded-lg border ${palette.border} ${palette.bg} px-4 py-3 text-sm leading-relaxed text-foreground`}
    >
      {palette.icon}
      <div>
        {title ? (
          <p className="font-medium text-foreground">{title}</p>
        ) : null}
        <div className={title ? "mt-1 text-muted" : "text-muted"}>
          {children}
        </div>
      </div>
    </aside>
  );
}

/**
 * Horizontal key/value grid (used for "at a glance" comparison summaries).
 * Renders as a clean two-column table visually, but stays as a semantic
 * `<dl>` for screen readers.
 */
export function DefList({ children }: { children: ReactNode }) {
  return (
    <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-lg border border-border bg-background-elev p-4 text-sm">
      {children}
    </dl>
  );
}

export function DefItem({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">
        {term}
      </dt>
      <dd className="text-muted">{children}</dd>
    </>
  );
}

/**
 * Renders a figure/example block — a muted frame around sample output,
 * a diagram, a short conceptual walkthrough, etc.
 */
export function Example({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <figure className="mt-6 overflow-hidden rounded-lg border border-border bg-background-elev">
      {title ? (
        <figcaption className="border-b border-border/60 bg-background-elev-2 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted">
          {title}
        </figcaption>
      ) : null}
      <div className="px-4 py-3 text-sm text-muted">{children}</div>
    </figure>
  );
}
