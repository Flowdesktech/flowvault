import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { SendViewer } from "@/components/send/SendViewer";

export const metadata: Metadata = {
  title: "Encrypted Send — Flowvault",
  description:
    "Open a Flowvault Encrypted Send note. Opening consumes a view; once the sender's view limit is reached, the note is hard-deleted. The decryption key is in the URL fragment and never reaches our servers.",
  robots: { index: false, follow: false },
};

interface Params {
  params: Promise<{ id: string }>;
}

export default async function SendViewPage({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <SendViewer id={id} />
      </main>
    </>
  );
}
