import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { FileSendDeleter } from "@/components/fileSend/FileSendDeleter";

export const metadata: Metadata = {
  title: "Destroy file send — Flowvault",
  description:
    "Use your secure delete link to immediately destroy a Flowvault File Send. The encrypted upload is removed from storage and the metadata document is deleted.",
  robots: { index: false, follow: false },
};

interface Params {
  params: Promise<{ id: string }>;
}

export default async function FileSendDeletePage({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <FileSendDeleter id={id} />
      </main>
    </>
  );
}
