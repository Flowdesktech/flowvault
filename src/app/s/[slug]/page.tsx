import type { Metadata } from "next";
import { VaultView } from "@/components/VaultView";
import { Navbar } from "@/components/Navbar";
import { notFound } from "next/navigation";
import { isValidSlug, normalizeSlug } from "@/lib/crypto/siteId";

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * Vault URLs are effectively access credentials &mdash; anyone who
 * guesses or discovers the slug can attempt to unlock. Indexing them
 * in search engines would be a serious leak, even though the content
 * itself is encrypted. We also set a generic title so slugs never
 * show up in the window title or OG preview.
 */
export const metadata: Metadata = {
  title: "Open vault — Flowvault",
  description:
    "Enter your password to unlock this Flowvault notepad. Your password and notes never leave your browser in plaintext.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SitePage({ params }: Params) {
  const { slug: raw } = await params;
  const slug = normalizeSlug(decodeURIComponent(raw));
  if (!isValidSlug(slug)) notFound();

  return (
    <>
      <Navbar />
      <VaultView slug={slug} />
    </>
  );
}
