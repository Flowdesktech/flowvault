import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { SupportDialog } from "@/components/SupportDialog";
import { FileSendViewer } from "@/components/fileSend/FileSendViewer";

export const metadata: Metadata = {
  title: "Encrypted File Send — Flowvault",
  description:
    "Open a Flowvault File Send. Opening consumes a download; once the sender's download limit is reached, the file is hard-deleted. The decryption key is in the URL fragment and never reaches our servers.",
  robots: { index: false, follow: false },
};

interface Params {
  params: Promise<{ id: string }>;
}

export default async function FileSendViewPage({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <Navbar />
      <SupportDialog />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <FileSendViewer id={id} />
      </main>
    </>
  );
}
