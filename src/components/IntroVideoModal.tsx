"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";

// YouTube ID for the landing-page intro. If we ever re-record, update this
// single constant and the embed, direct-watch link, and storage key all
// follow.
const YOUTUBE_ID = "wkoAIseRicY";

// Bump the suffix if we want returning visitors to see a new intro once
// more (e.g. after re-recording with fresh messaging).
const SEEN_STORAGE_KEY = "flowvault-intro-video-seen.v1";

// Custom event used by IntroVideoButton (and anywhere else) to reopen the
// modal without having to hoist state into the server-rendered page.
const OPEN_EVENT = "flowvault:open-intro-video";

/**
 * Landing-page modal that previews the short plausible-deniability
 * intro video. Auto-opens once per browser (gated by localStorage) so
 * repeat visitors aren't nagged, and listens for a custom window event
 * so a manual "Watch intro" button can reopen it from anywhere on the
 * page.
 *
 * Privacy notes:
 *  - Uses youtube-nocookie.com, so YouTube won't set tracking cookies
 *    unless the visitor actually presses play.
 *  - The iframe is only mounted while the modal is open, so closing it
 *    tears down the connection to Google immediately.
 */
export function IntroVideoModal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, "1");
    } catch {
      // Private-mode / disabled storage: fine, we just re-show next load.
    }
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_STORAGE_KEY) === "1";
    } catch {
      seen = false;
    }

    // Small delay so the modal doesn't visually slam in on top of the
    // hero — feels less aggressive and gives the LCP a beat to settle.
    let timer: number | undefined;
    if (!seen) {
      timer = window.setTimeout(() => setOpen(true), 700);
    }

    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    // Prevent background scroll while the modal is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flowvault 30-second intro"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6"
    >
      <button
        aria-label="Close intro video"
        onClick={close}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-background-elev shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              30-second intro
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">
              See plausible deniability work in 30 seconds.
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-background-elev-2 hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1`}
            title="Flowvault intro: plausible deniability for your notes"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted">
          <p>
            Prefer YouTube?{" "}
            <a
              href={`https://youtu.be/${YOUTUBE_ID}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Watch on youtu.be
            </a>
          </p>
          <button
            onClick={close}
            className="rounded-md border border-border bg-background-elev-2 px-3 py-1.5 text-xs text-foreground hover:bg-background-elev"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Re-opens the intro modal. Dispatches a window event so it doesn't
 * need to share state with the modal component directly.
 *
 * Two visual variants:
 *  - "pill"  — discoverable secondary CTA. Use directly under the
 *              hero form where first-time visitors will notice it even
 *              if the auto-open was blocked (localStorage disabled,
 *              Brave shields, etc.).
 *  - "link"  — low-key text link with underline on hover. Use in rows
 *              alongside other muted navigation links.
 */
export function IntroVideoButton({
  variant = "link",
  className,
  label,
}: {
  variant?: "pill" | "link";
  className?: string;
  label?: string;
}) {
  const handleClick = () => {
    window.dispatchEvent(new Event(OPEN_EVENT));
  };

  const defaultLabel =
    variant === "pill" ? "Watch 30-second intro" : "Watch 30-second intro";
  const resolvedLabel = label ?? defaultLabel;

  const baseClass =
    variant === "pill"
      ? "inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-4 py-2 text-xs font-medium text-accent transition hover:border-accent/60 hover:bg-accent/10"
      : "inline-flex items-center gap-1.5 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className ?? baseClass}
    >
      <PlayCircle
        size={variant === "pill" ? 16 : 14}
        aria-hidden
        className={variant === "pill" ? "text-accent" : undefined}
      />
      {resolvedLabel}
    </button>
  );
}
