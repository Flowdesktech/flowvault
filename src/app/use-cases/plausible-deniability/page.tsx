import type { Metadata } from "next";
import { APP_URL } from "@/lib/config";
import { IntentPage, type IntentPageData } from "@/components/marketing/IntentPage";

const TITLE =
  "Plausible deniability for encrypted notes | Flowvault";
const DESCRIPTION =
  "Flowvault brings VeraCrypt-style plausible deniability to a browser notepad: multiple passwords, one URL, fixed-size hidden-volume slots, and a live CorrectPassword / DecoyPassword demo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/use-cases/plausible-deniability" },
  keywords: [
    "plausible deniability notes",
    "decoy password notepad",
    "hidden volume encrypted notes",
    "VeraCrypt notes",
    "deniable encrypted notepad",
  ],
  openGraph: {
    type: "website",
    url: `${APP_URL}/use-cases/plausible-deniability`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const page: IntentPageData = {
  eyebrow: "Use case",
  title: "Notes you can unlock without proving what else exists.",
  description:
    "Most encrypted notepads protect you from the server. Flowvault also helps when the attacker is standing next to you and asking for a password. A decoy password opens a real-looking notebook while your real notes stay unprovable.",
  primaryCta: { href: "/s/demo", label: "Try CorrectPassword vs DecoyPassword" },
  secondaryCta: { href: "/blog/plausible-deniability-hidden-volumes-explained", label: "Read the deep dive" },
  bullets: [
    "One URL can hold multiple independent notebooks.",
    "Wrong, empty, and other-password slots fail the same way.",
    "The server sees one opaque ciphertext blob, not your notebook list.",
  ],
  sections: [
    {
      title: "What plausible deniability means here",
      body: (
        <p>
          Flowvault does not just encrypt note contents. It also avoids a
          visible note list, active-slot bitmap, or metadata trail proving how
          many notebooks exist. Different passwords derive different slot
          indexes; each successful password opens its own workspace at the same
          URL.
        </p>
      ),
    },
    {
      title: "What it does not hide",
      body: (
        <p>
          Flowvault hides what is inside the vault and whether another notebook
          exists in the same blob. It does not hide that someone visited your
          chosen URL from a network observer. If vault existence is dangerous in
          your threat model, read the security page before relying on it.
        </p>
      ),
    },
    {
      title: "Good decoys are boring",
      body: (
        <p>
          The best decoy notebook is not theatrical. It looks like something a
          normal person would actually keep: shopping lists, harmless notes, a
          recipe, travel logistics, or low-stakes reminders. The demo&apos;s
          DecoyPassword vault is intentionally boring for that reason.
        </p>
      ),
    },
    {
      title: "Why the demo matters",
      body: (
        <p>
          This feature is easy to over-explain and hard to trust from copy
          alone. The public demo makes the claim tactile: same URL, two
          passwords, two different screens. That is the product&apos;s core
          conversion moment.
        </p>
      ),
    },
  ],
  checklistTitle: "Set up a deniable vault",
  checklist: [
    "Pick a URL slug that does not reveal the real subject.",
    "Create the real password first and save the real notes.",
    "Lock, then create a decoy password with plausible low-stakes content.",
    "Practice unlocking both so you understand the flow before you need it.",
    "Export an encrypted backup and store it separately.",
  ],
};

export default function PlausibleDeniabilityUseCasePage() {
  return <IntentPage page={page} />;
}
