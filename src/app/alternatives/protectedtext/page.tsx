import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL } from "@/lib/config";
import { Code, IntentPage, type IntentPageData } from "@/components/marketing/IntentPage";

const TITLE =
  "ProtectedText alternative with hidden volumes and stronger crypto | Flowvault";
const DESCRIPTION =
  "Flowvault is a modern ProtectedText alternative: no account, browser-only encrypted notes, Argon2id 64 MiB, AES-256-GCM, hidden-volume decoy passwords, .fvault backup, and local .flowvault files.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alternatives/protectedtext" },
  keywords: [
    "ProtectedText alternative",
    "alternative to ProtectedText",
    "encrypted notepad like ProtectedText",
    "zero knowledge notepad",
    "plausible deniability notes",
  ],
  openGraph: {
    type: "website",
    url: `${APP_URL}/alternatives/protectedtext`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const page: IntentPageData = {
  eyebrow: "ProtectedText alternative",
  title: "A modern ProtectedText replacement with decoy passwords.",
  description:
    "If you like ProtectedText's no-account URL-plus-password model but want open source code, stronger authenticated encryption, portable backups, and hidden-volume plausible deniability, Flowvault is built for that exact migration.",
  primaryCta: { href: "/", label: "Create a vault" },
  secondaryCta: { href: "/s/demo", label: "Try the demo" },
  bullets: [
    "Same simple mental model: pick a URL, set a password, write.",
    "Multiple passwords can unlock different notebooks at the same URL.",
    "Open source frontend, Cloud Functions, and Firestore rules.",
  ],
  sections: [
    {
      title: "What changes when you move from ProtectedText",
      body: (
        <>
          <p>
            ProtectedText is useful because it is frictionless. Flowvault keeps
            that part: no account, no email, no phone number, and no workspace
            setup. The difference is the format underneath. Flowvault uses
            client-side Argon2id key derivation (64 MiB, 3 iterations),
            AES-256-GCM authenticated encryption, fixed-size hidden-volume
            slots, and an encrypted <Code>.fvault</Code> backup format.
          </p>
          <p>
            The practical upgrade is deniability. One URL can hold multiple
            notebooks behind different passwords. A decoy password opens a
            believable cover notebook; your real notebook remains
            indistinguishable from random bytes.
          </p>
        </>
      ),
    },
    {
      title: "What Flowvault does not try to replace",
      body: (
        <p>
          Flowvault is not a year-long journal or a full PKM system. Each
          notebook slot is about 8 KiB, roughly 1,500 words. That limit is
          intentional: it keeps the hidden-volume blob bounded and predictable.
          For dense private notes, credentials, recovery phrases, and short
          operational runbooks, it is a good fit.
        </p>
      ),
    },
    {
      title: "Migration path",
      body: (
        <p>
          Copy only the secrets that belong in a short encrypted scratchpad:
          recovery codes, API keys, wallet seed fragments, travel notes, or
          contact details you would want behind a decoy. Put long-form material
          in a dedicated notes app, then use Flowvault as the small, deniable
          layer beside it.
        </p>
      ),
    },
    {
      title: "Deeper comparison",
      body: (
        <p>
          The full technical comparison is in{" "}
          <Link
            href="/blog/flowvault-vs-protectedtext"
            className="text-accent hover:underline"
          >
            Flowvault vs ProtectedText
          </Link>
          , including crypto details and places where ProtectedText is still
          simpler.
        </p>
      ),
    },
  ],
  checklistTitle: "ProtectedText migration checklist",
  checklist: [
    "Pick a new Flowvault URL slug that does not reveal the subject.",
    "Create your real password and paste only short, high-value notes.",
    "Create a decoy password with boring, believable content.",
    "Export an encrypted .fvault backup after the first save.",
    "Optional: create a local .flowvault file if you want no hosted ciphertext at all.",
  ],
};

export default function ProtectedTextAlternativePage() {
  return <IntentPage page={page} />;
}
