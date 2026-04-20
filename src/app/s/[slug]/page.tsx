import { VaultView } from "@/components/VaultView";
import { Navbar } from "@/components/Navbar";
import { notFound } from "next/navigation";
import { isValidSlug, normalizeSlug } from "@/lib/crypto/siteId";

interface Params {
  params: Promise<{ slug: string }>;
}

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
