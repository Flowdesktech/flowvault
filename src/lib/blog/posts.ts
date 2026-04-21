import type { ComponentType } from "react";
import WhyIBuiltFlowvault from "@/content/blog/why-i-built-flowvault";
import HowToUseFlowvault from "@/content/blog/how-to-use-flowvault-guide";
import HiddenVolumes from "@/content/blog/plausible-deniability-hidden-volumes-explained";
import TrustedHandover from "@/content/blog/trusted-handover-encrypted-notes-beneficiary";
import TimeLockedNotes from "@/content/blog/time-locked-notes-drand-tlock";
import EncryptedSendVs from "@/content/blog/encrypted-send-vs-bitwarden-send-privnote";
import FvaultFormat from "@/content/blog/encrypted-backup-fvault-format";

/**
 * Public blog index. Every post is a TSX component (lives under
 * `src/content/blog/`) plus the metadata below, which powers:
 *   - the `/blog` index card list
 *   - per-post `<title>`, `<meta>`, OpenGraph, Twitter, JSON-LD
 *   - `generateStaticParams` for `/blog/[slug]`
 *   - the sitemap entries
 *
 * Keeping posts as real React components (instead of MDX or raw
 * markdown) matches the existing FAQ / Security page pattern and
 * avoids another parser dependency in the bundle.
 */
export interface BlogPost {
  slug: string;
  /** SEO-facing page title (also used as the visible <h1>). */
  title: string;
  /** Short social-friendly tagline; sits under the H1 on the post page. */
  subtitle: string;
  /** 140–160 char meta description. Also used in OG / Twitter. */
  description: string;
  /** 1–2 sentence excerpt shown on the `/blog` index card. */
  excerpt: string;
  /** ISO YYYY-MM-DD. Used for datePublished + "X days ago" labels. */
  publishedAt: string;
  /** ISO YYYY-MM-DD, set when the post is substantively rewritten. */
  updatedAt?: string;
  /** Tags shown as visible chips on the index card. Keep to 2–3 each. */
  tags: string[];
  /** Long-tail keyword list for the per-post `<meta keywords>`. */
  keywords: string[];
  /** Rough reading time in minutes, computed by eye when authoring. */
  readMinutes: number;
  /** React component that renders the article body inside a `<Prose>`. */
  Body: ComponentType;
}

const POSTS_UNSORTED: BlogPost[] = [
  {
    slug: "why-i-built-flowvault",
    title:
      "Why I built Flowvault: an honest, zero-knowledge encrypted notepad for 2026",
    subtitle:
      "The gaps in ProtectedText, Standard Notes, Bitwarden Send, and Privnote — and why I wrote a new one instead of patching an old one.",
    description:
      "The origin story and design philosophy behind Flowvault: what's wrong with today's encrypted notepads, why we need plausible deniability, and how zero-knowledge should actually look in 2026.",
    excerpt:
      "Every existing encrypted notepad I tried in 2026 made one or more painful compromises — legacy cipher modes, closed server code, no deniability, or a mandatory account. Here's why I wrote Flowvault instead of living with them.",
    publishedAt: "2026-04-21",
    tags: ["manifesto", "story"],
    keywords: [
      "why flowvault",
      "zero knowledge notepad story",
      "encrypted notepad manifesto",
      "privacy-first notes",
      "protectedtext alternative 2026",
      "open source encrypted notepad",
      "plausible deniability notes",
    ],
    readMinutes: 9,
    Body: WhyIBuiltFlowvault,
  },
  {
    slug: "how-to-use-flowvault-guide",
    title:
      "How to use Flowvault: a complete beginner's guide to zero-knowledge notes",
    subtitle:
      "From your first URL to decoy passwords, trusted handovers, time-locked notes, Encrypted Send, and encrypted backups — step by step.",
    description:
      "A practical, screenshot-free walkthrough of every Flowvault feature: picking a URL, multi-tab notebooks, hidden volumes, trusted handover, time-locked notes, Encrypted Send, and .fvault backup / restore.",
    excerpt:
      "A practical, feature-by-feature walkthrough: your first vault, multi-tab notebooks, decoy passwords, trusted handover, time-locked notes, Encrypted Send, and zero-knowledge backup / restore. No screenshots — just the exact clicks.",
    publishedAt: "2026-04-21",
    tags: ["guide", "tutorial"],
    keywords: [
      "how to use flowvault",
      "flowvault tutorial",
      "flowvault beginner guide",
      "encrypted notepad tutorial",
      "zero knowledge notes tutorial",
      "how to use encrypted notepad",
      "flowvault walkthrough",
    ],
    readMinutes: 11,
    Body: HowToUseFlowvault,
  },
  {
    slug: "plausible-deniability-hidden-volumes-explained",
    title:
      "Plausible deniability for notes: how Flowvault's hidden volumes actually work",
    subtitle:
      "One URL, many notebooks, no way to tell how many exist. The VeraCrypt idea, translated into a browser notepad.",
    description:
      "A from-first-principles explanation of Flowvault's hidden-volume format: 64 fixed-size slots, deterministic slot hashing, why decoys are indistinguishable from random data, and the trade-offs vs VeraCrypt.",
    excerpt:
      "Flowvault is the only browser-based encrypted notepad with VeraCrypt-style plausible deniability: multiple passwords unlock different notebooks on the same URL, and nobody can prove how many notebooks exist. Here's exactly how the format works.",
    publishedAt: "2026-04-21",
    tags: ["feature", "crypto"],
    keywords: [
      "plausible deniability notes",
      "hidden volume encryption",
      "decoy password notes",
      "veracrypt for notes",
      "coercion-resistant notes",
      "duress password notepad",
      "encrypted notepad deniability",
    ],
    readMinutes: 10,
    Body: HiddenVolumes,
  },
  {
    slug: "trusted-handover-encrypted-notes-beneficiary",
    title:
      "Trusted handover: giving a beneficiary access to your encrypted notes, the right way",
    subtitle:
      "Inactivity-triggered release, client-side key wrap, and why it's both stronger and easier than Bitwarden Emergency Access.",
    description:
      "How Flowvault's trusted handover works end-to-end: Argon2id-derived beneficiary keys, AES-GCM master-key wrap, heartbeat-on-save semantics, and a head-to-head comparison with Bitwarden Emergency Access and 1Password recovery.",
    excerpt:
      "Set up a trusted beneficiary who can decrypt your vault if you stop checking in — without telling them the password in advance, without a mandatory account, and without ever letting the server see a plaintext key.",
    publishedAt: "2026-04-21",
    tags: ["feature", "crypto"],
    keywords: [
      "digital inheritance notes",
      "encrypted notes beneficiary",
      "inactivity-triggered release",
      "bitwarden emergency access alternative",
      "1password recovery alternative",
      "trusted handover notepad",
      "encrypted notepad succession",
      "dead man's switch notes",
    ],
    readMinutes: 10,
    Body: TrustedHandover,
  },
  {
    slug: "time-locked-notes-drand-tlock",
    title:
      "Time-locked notes: writing messages you literally cannot read until a future date",
    subtitle:
      "Identity-based encryption, the drand randomness beacon, and how to send a letter to your future self that even the sender can't open early.",
    description:
      "How Flowvault time-locked notes work: drand's threshold BLS signatures as identities, tlock IBE encryption, why neither Flowvault nor a subpoena can unlock early, and practical use cases (anniversaries, disclosure commitments, recovery envelopes).",
    excerpt:
      "A future-self letter, a scheduled disclosure, a recovery envelope — time-locked notes let you encrypt something that literally cannot be read before a target date, not even by the sender. The drand randomness beacon does the heavy lifting.",
    publishedAt: "2026-04-21",
    tags: ["feature", "crypto"],
    keywords: [
      "time locked notes",
      "drand beacon notes",
      "tlock encryption",
      "future message",
      "delayed disclosure",
      "IBE notes",
      "identity based encryption notes",
      "timelock crypto notes",
    ],
    readMinutes: 9,
    Body: TimeLockedNotes,
  },
  {
    slug: "encrypted-send-vs-bitwarden-send-privnote",
    title:
      "Encrypted Send vs Bitwarden Send vs Privnote: account-less one-shot secrets compared",
    subtitle:
      "Who sees what, who enforces the view cap, and why the key should never touch the server — a no-PR head-to-head.",
    description:
      "A detailed head-to-head: Flowvault Encrypted Send, Bitwarden Send, Privnote, OneTimeSecret, PrivateBin, and 1Password Share. URL-fragment keys, server-enforced view caps, optional password gates, open-source trust anchors.",
    excerpt:
      "If you just want to share a password, an API key, or a recovery phrase once, which one-shot link service should you use in 2026? A detailed, honest comparison of Flowvault Encrypted Send, Bitwarden Send, Privnote, OneTimeSecret, PrivateBin, and 1Password Share.",
    publishedAt: "2026-04-21",
    tags: ["feature", "comparison"],
    keywords: [
      "bitwarden send alternative",
      "privnote alternative",
      "one time secret link",
      "burn after reading alternative",
      "1password share alternative",
      "privatebin alternative",
      "onetimesecret alternative",
      "self destructing note link",
    ],
    readMinutes: 10,
    Body: EncryptedSendVs,
  },
  {
    slug: "encrypted-backup-fvault-format",
    title:
      "The .fvault format: zero-knowledge backups for an encrypted notepad",
    subtitle:
      "How to snapshot every slot, every decoy password, and every tab — without ever handing the server a plaintext byte. Plus a plaintext Markdown export for migrating out.",
    description:
      "A deep dive on Flowvault's .fvault backup format: exact JSON envelope, why it's still zero-knowledge once downloaded, restore semantics, self-hosting migration, plaintext Markdown export, and how it stacks up against Bitwarden / Standard Notes / CryptPad exports.",
    excerpt:
      "A Flowvault backup is exactly the ciphertext the server already holds — no passwords inside, no plaintext, no accounts, and still decryptable on a self-hosted instance. Here's the exact format and why the trade-offs look the way they do.",
    publishedAt: "2026-04-21",
    tags: ["feature", "format"],
    keywords: [
      "encrypted notepad backup",
      "fvault file format",
      "zero knowledge backup",
      "self-host encrypted notepad",
      "migrate encrypted notes",
      "encrypted note markdown export",
      "portable encrypted note format",
      "protectedtext export alternative",
    ],
    readMinutes: 9,
    Body: FvaultFormat,
  },
];

/** Sort by publishedAt descending, then by slug for deterministic ties. */
export const POSTS: BlogPost[] = [...POSTS_UNSORTED].sort((a, b) => {
  if (a.publishedAt !== b.publishedAt) {
    return a.publishedAt < b.publishedAt ? 1 : -1;
  }
  return a.slug.localeCompare(b.slug);
});

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/**
 * Pick up to `n` "related" posts, excluding the one at `slug`. The
 * heuristic is shared-tag count first, then recency. Good enough for a
 * seven-post launch; we can upgrade to real embeddings later.
 */
export function getRelatedPosts(slug: string, n = 3): BlogPost[] {
  const current = getPost(slug);
  if (!current) return [];
  const currentTags = new Set(current.tags);
  return POSTS.filter((p) => p.slug !== slug)
    .map((p) => {
      const overlap = p.tags.filter((t) => currentTags.has(t)).length;
      return { post: p, overlap };
    })
    .sort((a, b) => {
      if (a.overlap !== b.overlap) return b.overlap - a.overlap;
      return a.post.publishedAt < b.post.publishedAt ? 1 : -1;
    })
    .slice(0, n)
    .map(({ post }) => post);
}
