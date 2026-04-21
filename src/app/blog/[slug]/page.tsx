import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { APP_URL } from "@/lib/config";
import { getPost, getRelatedPosts, POSTS } from "@/lib/blog/posts";
import { Prose } from "@/components/blog/Prose";
import { ArrowLeft, ArrowRight, Calendar, Clock } from "lucide-react";

/**
 * `/blog/[slug]` dynamic route.
 *
 * Posts are registered in `src/lib/blog/posts.ts`. This page:
 *   1. Emits a static param for every slug at build time.
 *   2. Builds per-post SEO (title, description, canonical, OG, Twitter,
 *      Article + BreadcrumbList JSON-LD).
 *   3. Renders the post body inside `<Prose>` with a byline header and
 *      a related-posts footer.
 */

export async function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${APP_URL.replace(/\/$/, "")}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      siteName: "Flowvault",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: ["Flowvault"],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
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
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const base = APP_URL.replace(/\/$/, "");
  const url = `${base}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        url,
        mainEntityOfPage: url,
        headline: post.title,
        description: post.description,
        keywords: post.keywords.join(", "),
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        inLanguage: "en",
        author: {
          "@type": "Organization",
          name: "Flowvault",
          url: base,
        },
        publisher: {
          "@type": "Organization",
          name: "Flowvault",
          url: base,
          logo: {
            "@type": "ImageObject",
            url: `${base}/icon.svg`,
          },
        },
        image: `${base}/opengraph-image`,
        articleSection: post.tags.join(", "),
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
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: url,
          },
        ],
      },
    ],
  };

  const related = getRelatedPosts(post.slug, 3);
  const Body = post.Body;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <nav className="mb-8 text-xs text-muted">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft size={12} /> All posts
          </Link>
        </nav>

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />{" "}
              <time dateTime={post.publishedAt}>
                {formatDate(post.publishedAt)}
              </time>
            </span>
            <span className="text-muted/60">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {post.readMinutes} min read
            </span>
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-background-elev-2 px-2 py-0.5 text-[10px] tracking-wide text-muted"
              >
                {t}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            {post.subtitle}
          </p>
        </header>

        <article>
          <Prose>
            <Body />
          </Prose>
        </article>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-border/60 pt-10">
            <h2 className="text-lg font-semibold text-foreground">
              Related posts
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group rounded-xl border border-border bg-background-elev p-4 transition-colors hover:border-accent/50 hover:bg-background-elev-2"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    {r.readMinutes} min read
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground group-hover:text-accent">
                    {r.title}
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs text-muted">
                    {r.excerpt}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-accent">
                    Read <ArrowRight size={11} />
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14 rounded-2xl border border-border bg-background-elev p-6 text-sm text-muted">
          <p className="text-foreground font-medium">
            Ready to try what you just read about?
          </p>
          <p className="mt-2">
            Open a URL on{" "}
            <Link href="/" className="text-accent hover:underline">
              the home page
            </Link>{" "}
            (no sign-up), send a{" "}
            <Link href="/send/new" className="text-accent hover:underline">
              self-destructing encrypted note
            </Link>
            , or seal a message for a future date at{" "}
            <Link
              href="/timelock/new"
              className="text-accent hover:underline"
            >
              /timelock/new
            </Link>
            .
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
