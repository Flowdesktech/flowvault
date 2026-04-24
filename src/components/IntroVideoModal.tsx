"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, PlayCircle, X } from "lucide-react";

// Self-hosted MP4 under public/video/intro.mp4. Served directly from
// our origin so there's no Google tracker and no YouTube "sign in to
// confirm you're not a bot" gate on the landing page.
const VIDEO_SRC = "/video/intro.mp4";
const VIDEO_POSTER = "/video/intro-poster.jpg";

// YouTube mirror, kept as a fallback link for people who prefer to
// watch on YouTube (or who have video autoplay blocked).
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
 * Self-hosted rationale: the MP4 lives in /public so there are no
 * third-party cookies, no Google requests, and no bot-check sign-in
 * gate. A ~1-minute 720p clip at ~12 MB is cheap to serve directly.
 */
export function IntroVideoModal() {
  const [open, setOpen] = useState(false);
  // `started` gates the native <video> controls and the overlay play
  // button. We keep the controls hidden until the user explicitly
  // clicks play — this way the poster frame reads as a clean hero
  // image instead of a chrome-heavy media widget on first paint.
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setStarted(false);
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, "1");
    } catch {
      // Private-mode / disabled storage: fine, we just re-show next load.
    }
  }, []);

  const handlePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    // Click counts as a user gesture, so we can play with audio on.
    video.muted = false;
    try {
      await video.play();
    } catch {
      // Some browsers still block unmuted autoplay immediately after
      // mount; fall back to muted playback so the user at least sees
      // the video, and let the controls expose an unmute button.
      try {
        video.muted = true;
        await video.play();
      } catch {
        // Give up silently — the fallback YouTube link in the footer
        // is the user's escape hatch.
      }
    }
    setStarted(true);
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

    // Pause + rewind when the modal closes so reopening starts cleanly.
    const video = videoRef.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (video) {
        try {
          video.pause();
          video.currentTime = 0;
        } catch {
          // Some browsers throw if the element was already detached;
          // safe to ignore, teardown is best-effort.
        }
      }
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flowvault 1-minute intro"
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
              1-minute intro
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">
              See plausible deniability work in under a minute.
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
          {/* Native controls only appear after the user hits the overlay
              play button — before that, the poster frame + centered play
              button reads as a proper hero still. */}
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={VIDEO_POSTER}
            controls={started}
            playsInline
            preload="metadata"
            onEnded={() => setStarted(true)}
            className="absolute inset-0 h-full w-full"
          >
            Your browser can&apos;t play this video.{" "}
            <a
              href={`https://youtu.be/${YOUTUBE_ID}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Watch on YouTube instead.
            </a>
          </video>
          {!started ? (
            <button
              type="button"
              onClick={handlePlay}
              aria-label="Play intro video"
              className="group absolute inset-0 flex items-center justify-center focus:outline-none"
            >
              {/* Subtle vignette so the play button has enough contrast
                  over whatever poster frame ffmpeg happens to grab. */}
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/50 transition group-hover:from-black/20 group-hover:via-black/40 group-hover:to-black/60"
              />
              <span className="relative grid h-20 w-20 place-items-center rounded-full bg-accent text-background shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] ring-4 ring-white/10 transition group-hover:scale-[1.06] group-focus-visible:ring-white/30 sm:h-24 sm:w-24">
                <Play
                  size={32}
                  strokeWidth={2.5}
                  aria-hidden
                  // Nudge the triangle a hair right so it reads as
                  // centered — the Play glyph is visually weighted left.
                  className="translate-x-[2px]"
                />
              </span>
            </button>
          ) : null}
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

  const defaultLabel = "Watch 1-minute intro";
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
