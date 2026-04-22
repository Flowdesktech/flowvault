import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { LocalVaultView } from "@/components/LocalVaultView";

interface Params {
  params: Promise<{ localSiteId: string }>;
}

/**
 * Local-vault URLs contain an opaque UUID that identifies the file the
 * user picked, not the file contents. Still, the URL functions as a
 * capability to re-prompt for file access in this browser profile, so
 * we mirror `/s/[slug]`'s privacy posture and keep the route out of
 * search engine indexes.
 */
export const metadata: Metadata = {
  title: "Open local vault — Flowvault",
  description:
    "Open a Flowvault local vault from a file on your device. The vault's ciphertext lives on your disk; nothing about this unlock touches our servers.",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * UUIDs we mint have the form `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
 * (36 chars, hex + dashes). The hex-only fallback path produces a
 * 32-char string. Accept either; refuse anything else so the route
 * can't be used for probing unrelated URL spaces.
 */
function isValidLocalSiteId(id: string): boolean {
  if (id.length === 36) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    );
  }
  if (id.length === 32) {
    return /^[0-9a-f]{32}$/i.test(id);
  }
  return false;
}

export default async function LocalVaultPage({ params }: Params) {
  const { localSiteId: raw } = await params;
  const localSiteId = decodeURIComponent(raw).toLowerCase();
  if (!isValidLocalSiteId(localSiteId)) notFound();

  return (
    <>
      <Navbar />
      <LocalVaultView localSiteId={localSiteId} />
    </>
  );
}
