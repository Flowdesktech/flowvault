import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/**
 * Robots policy served at /robots.txt.
 *
 * Allow most of the public marketing surface, but keep vault URLs
 * (`/s/...`) and time-lock share links (`/t/...`) out of the index.
 * Those URLs are effectively access credentials &mdash; indexing them
 * would let anyone who guesses or obtains one find it via search.
 */
export default function robots(): MetadataRoute.Robots {
  const base = APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/s/", "/t/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
