import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { APP_URL } from "@/lib/config";
import { POSTS } from "@/lib/blog/posts";
import { ArrowRight, BookOpen, Calendar, Clock } from "lucide-react";

const TITLE =
  "Flowvault Blog — encrypted notes, plausible deniability, trusted handover, time-locked notes, and honest comparisons";
const DESCRIPTION =
  "Deep dives and beginner guides from the Flowvault team: how zero-knowledge encrypted notepads actually work, how plausible-deniability hidden volumes compare to VeraCrypt, and honest head-to-heads against ProtectedText, Standard Notes, Bitwarden Send, and Privnote.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "flowvault blog",
    "encrypted notepad blog",
    "zero knowledge notes",
    "plausible deniability notes",
    "trusted handover notepad",
    "time locked notes",
    "encrypted send alternative",
    "protectedtext alternative",
    "privnote alternative",
    "bitwarden send alternative",
  ],
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: `${APP_URL}/blog`,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Flowvault",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function BlogIndexPage() {
  const base = APP_URL.replace(/\/$/, "");
  // schema.org Blog with a BlogPosting list — helps Google render
  // sitelinks / article cards from the index.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${base}/blog#blog`,
        url: `${base}/blog`,
        name: "Flowvault Blog",
        description: DESCRIPTION,
        inLanguage: "en",
        publisher: {
          "@type": "Organization",
          name: "Flowvault",
          url: base,
        },
        blogPost: POSTS.map((p) => ({
          "@type": "BlogPosting",
          "@id": `${base}/blog/${p.slug}`,
          url: `${base}/blog/${p.slug}`,
          headline: p.title,
          description: p.description,
          datePublished: p.publishedAt,
          dateModified: p.updatedAt ?? p.publishedAt,
          keywords: p.keywords.join(", "),
          author: { "@type": "Organization", name: "Flowvault" },
          mainEntityOfPage: `${base}/blog/${p.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${base}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${base}/blog`,
          },
        ],
      },
    ],
  };
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <header className="mb-10">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-accent">
            <BookOpen size={12} /> Flowvault &middot; Blog
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Deep dives, guides, and honest comparisons.
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Long-form writing from the team: how the cryptography inside
            Flowvault actually works, practical walkthroughs of every
            feature, and no-punches-pulled comparisons against
            ProtectedText, Standard Notes, Bitwarden Send, Privnote, and
            the rest of the landscape. No marketing fluff, no SEO
            doorway pages — just the posts you&apos;d want to read if
            you were about to trust a browser tab with a secret.
          </p>
        </header>

        <section className="space-y-4">
          {POSTS.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-background-elev p-6 transition-colors hover:border-accent/50 hover:bg-background-elev-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} />{" "}
                  <time dateTime={p.publishedAt}>
                    {formatDate(p.publishedAt)}
                  </time>
                </span>
                <span className="text-muted/60">&middot;</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} /> {p.readMinutes} min read
                </span>
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-background-elev-2 px-2 py-0.5 text-[10px] tracking-wide text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground group-hover:text-accent">
                {p.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                {p.excerpt}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-accent">
                Read the post <ArrowRight size={14} />
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-14 rounded-2xl border border-border bg-background-elev p-6 text-sm text-muted">
          <h2 className="text-foreground font-medium">
            Want a topic covered?
          </h2>
          <p className="mt-2">
            Open a discussion on{" "}
            <a
              href="https://github.com/Flowdesktech/flowvault/discussions"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              GitHub
            </a>{" "}
            or browse the{" "}
            <Link href="/faq" className="text-accent hover:underline">
              FAQ
            </Link>{" "}
            and the{" "}
            <Link href="/security" className="text-accent hover:underline">
              security page
            </Link>{" "}
            for shorter-form answers.
          </p>
        </section>
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted">
        Flowvault &middot; part of the Flowdesk family
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}

function formatDate(iso: string): string {
  // YYYY-MM-DD -> "Apr 21, 2026" for human display. Keep the ISO on
  // <time dateTime> so crawlers and screen readers see the machine form.
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}
