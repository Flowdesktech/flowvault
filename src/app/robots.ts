import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/**
 * Robots policy served at /robots.txt.
 *
 * Allow most of the public marketing surface, but keep vault URLs
 * (`/s/...`), time-lock share links (`/t/...`), and Encrypted Send
 * links (`/send/...`, excluding `/send/new` which is the composer)
 * out of the index. Those URLs are effectively access credentials
 * &mdash; indexing them would let anyone who guesses or obtains one
 * find it via search.
 */
export default function robots(): MetadataRoute.Robots {
  const base = APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/send/new"],
        disallow: ["/s/", "/t/", "/send/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
