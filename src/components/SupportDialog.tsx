"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Heart, Star } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  CONTACT_EMAIL,
  DONATE_PATH,
  GITHUB_URL,
} from "@/lib/config";

const LAST_SEEN_KEY = "flowvault-support-dialog-last-seen-v1";
const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1_000; // 3 days

/**
 * A deliberately infrequent, non-blocking support request for people
 * opening Flowvault resources. Dismissing it suppresses the prompt for
 * three days across vault, time-lock, note-send, and file-send pages.
 */
export function SupportDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let lastSeen = 0;
    try {
      lastSeen = Number(window.localStorage.getItem(LAST_SEEN_KEY)) || 0;
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }

    if (Date.now() - lastSeen < REMINDER_INTERVAL_MS) return;

    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {
      // The dialog can still be dismissed when storage is unavailable.
    }
    setOpen(false);
  }, []);

  const hireUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    "Work inquiry (via Flowvault)",
  )}`;

  return (
    <Modal
      open={open}
      onClose={close}
      title="A small note from Flowvault’s creator"
      description="Not a paywall—just an honest request for support."
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <p>
          Flowvault is entirely free: no ads, no paid plan, and no selling
          your data. Thousands of vaults and time-locks have now been
          created, and keeping the service online has real hosting and
          development costs.
        </p>
        <p>
          If Flowvault has helped you, starring the open-source repository
          is a free way to help more people find it. If you have any work or
          project I might be able to help with, I’d also be grateful if you
          considered hiring me. Donations help keep the servers running,
          too.
        </p>
        <p className="text-xs">
          There is no obligation. You can close this message and continue
          using Flowvault for free.
        </p>

        <div className="grid gap-2 pt-1 sm:grid-cols-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground transition hover:brightness-110"
          >
            <Star size={15} /> Star on GitHub
          </a>
          <a
            href={hireUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-background-elev-2 px-3 text-sm font-medium text-foreground transition hover:bg-border"
          >
            <Briefcase size={15} /> Hire me
          </a>
          <a
            href={DONATE_PATH}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            <Heart size={15} /> Donate
          </a>
        </div>
      </div>
    </Modal>
  );
}
