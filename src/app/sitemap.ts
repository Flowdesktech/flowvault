import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";
import { POSTS } from "@/lib/blog/posts";

/**
 * Public sitemap served at /sitemap.xml.
 *
 * Only include pages that are worth indexing. Per-user resources
 * &mdash; vaults (`/s/{slug}`), time-lock share links (`/t/{id}`),
 * and Encrypted Send links (`/send/{id}`) &mdash; are intentionally
 * excluded because their URLs are access credentials we don&apos;t
 * want leaking into search results. Those routes also carry
 * `robots: noindex` at the page level; robots.ts adds belt-and-braces
 * `Disallow:` rules.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = APP_URL.replace(/\/$/, "");
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/faq`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/security`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/timelock/new`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/send/new`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/restore`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/donate`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...POSTS.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
