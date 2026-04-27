import type { Metadata } from "next";
import { APP_URL } from "@/lib/config";
import { Code, IntentPage, type IntentPageData } from "@/components/marketing/IntentPage";

const TITLE =
  "Standard Notes alternative for short deniable secret notes | Flowvault";
const DESCRIPTION =
  "Flowvault is not a full Standard Notes replacement. It is a no-account encrypted scratchpad for short secrets, decoy passwords, one-shot encrypted sends, and local .flowvault files.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alternatives/standard-notes" },
  keywords: [
    "Standard Notes alternative",
    "encrypted notes without account",
    "private scratchpad",
    "plausible deniability notes",
    "local encrypted notepad file",
  ],
  openGraph: {
    type: "website",
    url: `${APP_URL}/alternatives/standard-notes`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const page: IntentPageData = {
  eyebrow: "Standard Notes alternative",
  title: "Not a full notes suite — a sharper private scratchpad.",
  description:
    "Standard Notes is better for synced long-form notes. Flowvault is better when you want a browser-only secret notebook with no account, a decoy password, encrypted one-shot sends, or a local file that never reaches our server.",
  primaryCta: { href: "/", label: "Create a short secret notebook" },
  secondaryCta: { href: "/s/demo", label: "Try the decoy demo" },
  bullets: [
    "No account, email, subscription, or sync identity.",
    "Decoy passwords unlock believable alternate notebooks.",
    "Local .flowvault files keep ciphertext on your own disk.",
  ],
  sections: [
    {
      title: "When Standard Notes is the better tool",
      body: (
        <p>
          If you want native apps, multi-device sync, long journals, tags,
          plugins, or hundreds of notes, use Standard Notes, Notesnook,
          Obsidian, or Joplin. Flowvault is deliberately smaller. Each notebook
          slot holds about 8 KiB, roughly 1,500 words.
        </p>
      ),
    },
    {
      title: "When Flowvault is the better layer",
      body: (
        <p>
          Use Flowvault for high-value short notes: recovery phrases, API keys,
          travel notes, contact details, backup codes, or credentials you do
          not want tied to a normal notes account. The value is the URL-plus-
          password model, hidden volumes, and the ability to hand over a decoy.
        </p>
      ),
    },
    {
      title: "Keep hosted storage optional",
      body: (
        <p>
          If you do not want Flowvault&apos;s servers to store even encrypted
          ciphertext, create a <Code>.flowvault</Code> local file. It uses the
          same hidden-volume format but reads and writes through your browser
          directly to a file on your disk.
        </p>
      ),
    },
    {
      title: "A good pairing, not a forced switch",
      body: (
        <p>
          Many users should keep their main notes app and add Flowvault beside
          it. Put broad knowledge work in Standard Notes; put the small set of
          notes you might need to deny, send once, or hand over later in
          Flowvault.
        </p>
      ),
    },
  ],
  checklistTitle: "Use Flowvault alongside Standard Notes",
  checklist: [
    "Leave long-form journals and knowledge-base notes where they are.",
    "Move only short secrets and recovery material into Flowvault.",
    "Create a decoy password with innocent notes.",
    "Use Encrypted Send for client handoffs instead of pasting in chat.",
    "Export an encrypted .fvault backup after changes.",
  ],
};

export default function StandardNotesAlternativePage() {
  return <IntentPage page={page} />;
}
