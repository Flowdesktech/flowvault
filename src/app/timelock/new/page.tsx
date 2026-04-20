import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { TimelockComposer } from "@/components/timelock/TimelockComposer";
import Link from "next/link";
import { APP_URL } from "@/lib/config";

const TL_TITLE =
  "Time-locked notes — encrypt a message to a future date with drand & tlock";
const TL_DESCRIPTION =
  "Flowvault's drand-backed time-lock: seal a message now, unlock it automatically at a future moment. Nobody — including Flowvault, including the sender, including a subpoena — can read it before the drand public randomness beacon publishes the target round signature.";

export const metadata: Metadata = {
  title: TL_TITLE,
  description: TL_DESCRIPTION,
  keywords: [
    "time-locked note",
    "drand tlock",
    "future self message",
    "delayed decryption",
    "encrypted message open later",
    "crypto time capsule",
    "scheduled disclosure",
  ],
  alternates: { canonical: "/timelock/new" },
  openGraph: {
    type: "website",
    url: `${APP_URL}/timelock/new`,
    title: TL_TITLE,
    description: TL_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TL_TITLE,
    description: TL_DESCRIPTION,
  },
};

export default function NewTimelockPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-accent">
            Flowvault · Time-lock
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Lock a message until a future moment.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Your message is encrypted in this browser to a future{" "}
            <a
              href="https://drand.love"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              drand
            </a>{" "}
            round. Until that round&apos;s signature is published by the
            distributed beacon network, nobody &mdash; not you, not us,
            not anyone with access to our database &mdash; can decrypt
            it. After the release moment, anyone with the share link
            can. Learn more on the{" "}
            <Link href="/security" className="text-accent hover:underline">
              security page
            </Link>
            .
          </p>
        </header>

        <TimelockComposer />
      </main>
    </>
  );
}
