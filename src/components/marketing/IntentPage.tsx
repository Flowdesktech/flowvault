import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { GITHUB_URL } from "@/lib/config";

export interface IntentPageData {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  bullets: string[];
  sections: Array<{
    title: string;
    body: ReactNode;
  }>;
  checklistTitle: string;
  checklist: string[];
}

export function IntentPage({ page }: { page: IntentPageData }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {page.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            {page.description}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={page.primaryCta.href}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition hover:bg-accent/90"
            >
              {page.primaryCta.label} <ArrowRight size={16} />
            </Link>
            {page.secondaryCta ? (
              <Link
                href={page.secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background-elev px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent/50"
              >
                {page.secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </header>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {page.bullets.map((bullet) => (
            <div
              key={bullet}
              className="rounded-2xl border border-border bg-background-elev p-4 text-sm text-muted"
            >
              <div className="mb-2 text-accent">
                <Check size={16} />
              </div>
              {bullet}
            </div>
          ))}
        </section>

        <DemoCallout />

        <section className="mt-12 space-y-5">
          {page.sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-border bg-background-elev p-6"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
                {section.body}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-12 rounded-2xl border border-accent/30 bg-accent/5 p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            {page.checklistTitle}
          </h2>
          <ol className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
            {page.checklist.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-background-elev p-6 text-sm text-muted">
          <div className="flex items-center gap-2 text-foreground">
            <ShieldCheck size={16} className="text-accent" />
            <h2 className="font-semibold">Trust signals worth checking</h2>
          </div>
          <p className="mt-3">
            Flowvault is MIT-licensed and open end-to-end: frontend, Cloud
            Functions, Firestore rules, and crypto code are public. The server
            stores opaque ciphertext; your password and plaintext stay in the
            browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/security" className="text-accent hover:underline">
              Read the security page
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              View source <ExternalLink size={12} />
            </a>
            <Link href="/faq" className="text-accent hover:underline">
              See honest limitations
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function DemoCallout() {
  return (
    <section className="mt-12 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        30-second proof
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        Feel plausible deniability before you trust the claim.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Open the same demo vault twice: first with{" "}
        <Code>CorrectPassword</Code>, then lock and unlock with{" "}
        <Code>DecoyPassword</Code>. Same URL, same ciphertext on the server,
        two completely different notebooks.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/s/demo"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition hover:bg-accent/90"
        >
          Open the demo <ArrowRight size={16} />
        </Link>
        <Link
          href="/blog/plausible-deniability-hidden-volumes-explained"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background-elev px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent/50"
        >
          Read the hidden-volume deep dive
        </Link>
      </div>
    </section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-background-elev-2 px-1.5 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}
