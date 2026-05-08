import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { FileSendComposer } from "@/components/fileSend/FileSendComposer";
import { APP_URL } from "@/lib/config";

const TITLE =
  "Encrypted File Send — self-destructing, view-capped encrypted file uploads | Flowvault";
const DESCRIPTION =
  "Flowvault File Send: drop a file (up to 10 MiB), pick how long it lives (max 7 days) and how many times it can be downloaded, and share the link. End-to-end encrypted in your browser with AES-256-GCM; the key lives in the URL fragment and never reaches our servers. You also get a secure delete link to destroy the upload at any time.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "encrypted file send",
    "self-destructing file upload",
    "one-time file link",
    "burn-after-download",
    "secure file sharing",
    "send file with password",
    "ephemeral encrypted file",
    "zero-knowledge file transfer",
    "secure delete link",
    "open source secure file send",
  ],
  alternates: { canonical: "/file/new" },
  openGraph: {
    type: "website",
    url: `${APP_URL}/file/new`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function NewFileSendPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-accent">
            Flowvault &middot; File Send
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Send a file that self-destructs.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Drop a file (up to 10 MiB), pick how long it lives (up to 7
            days) and how many times it can be downloaded, and share the
            link. The AES-256 key travels in the URL fragment (the part
            after <code>#</code>), so our servers never see it. After
            the final download the file is hard-deleted &mdash; not
            even Flowvault can bring it back. You&rsquo;ll also get a{" "}
            <strong>secure delete link</strong> so you can destroy the
            upload yourself at any time. Learn more on the{" "}
            <Link href="/security" className="text-accent hover:underline">
              security page
            </Link>
            .
          </p>
        </header>

        <FileSendComposer />

        <footer className="mt-12 text-xs text-muted">
          Need to send a short secret instead of a file? Try{" "}
          <Link href="/send/new" className="text-accent hover:underline">
            Encrypted Send
          </Link>
          . Need a long-lived private notebook? Try{" "}
          <Link href="/" className="text-accent hover:underline">
            Flowvault
          </Link>
          .
        </footer>
      </main>
    </>
  );
}
