import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { TimelockViewer } from "@/components/timelock/TimelockViewer";

export const metadata: Metadata = {
  title: "Time-locked note — Flowvault",
  description:
    "Open a drand-backed time-locked note. The message unlocks automatically once the target beacon round is published.",
  robots: { index: false, follow: false },
};

interface Params {
  params: Promise<{ id: string }>;
}

export default async function TimelockViewPage({ params }: Params) {
  const { id } = await params;
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <TimelockViewer id={id} />
      </main>
    </>
  );
}
