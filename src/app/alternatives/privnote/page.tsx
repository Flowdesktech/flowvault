import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL } from "@/lib/config";
import { IntentPage, type IntentPageData } from "@/components/marketing/IntentPage";

const TITLE =
  "Privnote alternative for self-destructing encrypted notes | Flowvault";
const DESCRIPTION =
  "Flowvault Encrypted Send is a Privnote alternative for passwords, API keys, and short secrets: end-to-end encrypted in your browser, view-capped, expiring, optional password gate, and no account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alternatives/privnote" },
  keywords: [
    "Privnote alternative",
    "one time secret link",
    "self destructing note",
    "burn after reading note",
    "send password securely",
  ],
  openGraph: {
    type: "website",
    url: `${APP_URL}/alternatives/privnote`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const page: IntentPageData = {
  eyebrow: "Privnote alternative",
  title: "Send a secret once, then let it disappear.",
  description:
    "Encrypted Send is Flowvault's account-less one-shot sharing tool. Paste a password, recovery code, or API key, choose a view cap and expiry, and share a link whose decryption key lives in the URL fragment.",
  primaryCta: { href: "/send/new", label: "Create an encrypted send" },
  secondaryCta: { href: "/blog/encrypted-send-vs-bitwarden-send-privnote", label: "Read comparison" },
  bullets: [
    "The AES-256 key stays in the browser URL fragment, not on our server.",
    "Hard-deletes after the final view or expiry window.",
    "Optional password gate if the link may pass through untrusted chat.",
  ],
  sections: [
    {
      title: "What makes it different from a normal paste link",
      body: (
        <p>
          Flowvault encrypts the note in your browser before upload. The server
          stores ciphertext plus expiry and view-limit metadata; it never sees
          the plaintext or URL-fragment key. After the final allowed view, the
          note is deleted from the database rather than archived.
        </p>
      ),
    },
    {
      title: "Best use cases",
      body: (
        <p>
          Use it for short secrets that should not sit in Slack, email, ticket
          comments, or a shared document forever: temporary database
          credentials, API keys, recovery codes, one-time client handoffs, or a
          seed phrase split where the other half travels elsewhere.
        </p>
      ),
    },
    {
      title: "When to use a full vault instead",
      body: (
        <p>
          If the recipient needs a durable private notebook, use a Flowvault
          vault instead of Encrypted Send. A send is intentionally disposable;
          a vault is for notes you want to reopen later, back up, or protect
          with a decoy password.
        </p>
      ),
    },
    {
      title: "Recipient loop",
      body: (
        <p>
          When a recipient opens a note, they now see a small, privacy-respecting
          prompt to{" "}
          <Link href="/send/new" className="text-accent hover:underline">
            send their own encrypted note
          </Link>
          . No tracking, no forced account, just a useful next step.
        </p>
      ),
    },
  ],
  checklistTitle: "Secure send checklist",
  checklist: [
    "Paste only the secret you intend to share.",
    "Keep the default one-view limit for credentials.",
    "Use a short expiry if the recipient is online now.",
    "Add a password if the link may be forwarded or logged.",
    "Share the password through a separate channel.",
  ],
};

export default function PrivnoteAlternativePage() {
  return <IntentPage page={page} />;
}
