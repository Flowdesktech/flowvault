import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SendComposer } from "@/components/send/SendComposer";
import { APP_URL } from "@/lib/config";

const TITLE =
  "Encrypted Send — self-destructing, view-capped encrypted notes | Flowvault";
const DESCRIPTION =
  "Flowvault Encrypted Send: paste a password, API key, or any sensitive note; get a one-time link that self-destructs after the recipient opens it (or after you-set an expiry). End-to-end encrypted in your browser with AES-256-GCM; the key lives in the URL fragment and never reaches our servers. Optional password gate on top.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "encrypted send",
    "self-destructing note",
    "one-time secret link",
    "burn-after-reading note",
    "privnote alternative",
    "bitwarden send alternative",
    "secure note sharing",
    "share password safely",
    "ephemeral encrypted link",
    "zero-knowledge send",
    "open source secure send",
  ],
  alternates: { canonical: "/send/new" },
  openGraph: {
    type: "website",
    url: `${APP_URL}/send/new`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function NewSendPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-accent">
            Flowvault &middot; Encrypted Send
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Send a secret that self-destructs.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Encrypt a one-off note in this browser, pick how long it lives
            and how many times it can be opened, and share the link. The
            AES-256 key travels in the URL fragment (the part after{" "}
            <code>#</code>), so our servers never see it. After the final
            view the note is hard-deleted &mdash; not even Flowvault can
            bring it back. Learn more on the{" "}
            <Link href="/security" className="text-accent hover:underline">
              security page
            </Link>
            .
          </p>
        </header>

        <SendComposer />

        <footer className="mt-12 text-xs text-muted">
          Need a long-lived private notebook instead? Try{" "}
          <Link href="/" className="text-accent hover:underline">
            Flowvault
          </Link>
          . Need a message for your future self? Try{" "}
          <Link href="/timelock/new" className="text-accent hover:underline">
            Time-lock
          </Link>
          .
        </footer>
      </main>
    </>
  );
}
