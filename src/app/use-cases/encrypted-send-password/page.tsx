import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL } from "@/lib/config";
import { IntentPage, type IntentPageData } from "@/components/marketing/IntentPage";

const TITLE =
  "Send a password securely with a self-destructing encrypted link | Flowvault";
const DESCRIPTION =
  "Use Flowvault Encrypted Send to share a password, API key, recovery code, or short secret through a view-capped, expiring, end-to-end encrypted link with the key in the URL fragment.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/use-cases/encrypted-send-password" },
  keywords: [
    "send password securely",
    "securely share API key",
    "self destructing password link",
    "encrypted password sharing",
    "one time password link",
  ],
  openGraph: {
    type: "website",
    url: `${APP_URL}/use-cases/encrypted-send-password`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const page: IntentPageData = {
  eyebrow: "Use case",
  title: "Send a password without leaving it in chat history.",
  description:
    "Slack, email, and ticket comments are bad places for credentials. Flowvault Encrypted Send gives you a one-time encrypted link with a view cap, expiry window, and optional password gate.",
  primaryCta: { href: "/send/new", label: "Create a secure send" },
  secondaryCta: { href: "/alternatives/privnote", label: "Compare to Privnote" },
  bullets: [
    "The server stores ciphertext, not plaintext.",
    "The decryption key travels in the URL fragment.",
    "After the final view, the note is hard-deleted.",
  ],
  sections: [
    {
      title: "A safer handoff for credentials",
      body: (
        <p>
          Paste the credential, choose one view and a short expiry, copy the
          link, then send it through the channel you already use. If the link
          itself might be logged or forwarded, add a password and share that
          password through a separate channel.
        </p>
      ),
    },
    {
      title: "What the recipient sees",
      body: (
        <p>
          The recipient gets a click-gated page that explains opening consumes
          a view. That prevents preview bots and accidental page loads from
          silently burning the note before a human is ready.
        </p>
      ),
    },
    {
      title: "Use a vault when the secret needs to live",
      body: (
        <p>
          Encrypted Send is disposable by design. For secrets you need to keep,
          rotate, back up, or protect behind a decoy, create a regular
          Flowvault notebook instead and export a <Link href="/restore" className="text-accent hover:underline">.fvault backup</Link>.
        </p>
      ),
    },
    {
      title: "Good defaults",
      body: (
        <p>
          For most passwords and API keys, use one view and a one-hour or
          one-day expiry. Use longer windows only when the recipient is in a
          different timezone or unlikely to open the link soon.
        </p>
      ),
    },
  ],
  checklistTitle: "Password handoff checklist",
  checklist: [
    "Paste only the credential, not extra context.",
    "Use one view for passwords and production API keys.",
    "Pick a short expiry whenever possible.",
    "Add a password if the link travels through email or a ticket system.",
    "Ask the recipient to confirm receipt, then rotate if policy requires it.",
  ],
};

export default function EncryptedSendPasswordUseCasePage() {
  return <IntentPage page={page} />;
}
