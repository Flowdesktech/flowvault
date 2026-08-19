import Link from "next/link";
import {
  Vault,
  Heart,
  Clock,
  Send,
  BookOpen,
  FileLock2,
} from "lucide-react";
import { DONATE_PATH, GITHUB_URL } from "@/lib/config";

export function Navbar() {
  return (
    <>
      <DonateBanner />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/20 text-accent">
              <Vault size={16} />
            </span>
            Flowvault
          </Link>
          <nav className="flex items-center gap-1 text-sm text-muted sm:gap-4">
            <Link
              href="/send/new"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-foreground"
              title="Send a self-destructing encrypted note"
            >
              <Send size={14} /> <span className="hidden sm:inline">Send</span>
            </Link>
            <Link
              href="/file/new"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-foreground"
              title="Send a self-destructing encrypted file"
            >
              <FileLock2 size={14} />{" "}
              <span className="hidden sm:inline">File</span>
            </Link>
            <Link
              href="/timelock/new"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-foreground"
              title="Encrypt a message to a future date"
            >
              <Clock size={14} /> <span className="hidden sm:inline">Time-lock</span>
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-foreground"
              title="Guides, deep dives, and honest comparisons"
            >
              <BookOpen size={14} /> <span className="hidden sm:inline">Blog</span>
            </Link>
            <Link
              href="/security"
              className="hidden rounded-md px-2 py-1 hover:text-foreground sm:inline-flex"
            >
              Security
            </Link>
            <Link
              href="/faq"
              className="hidden rounded-md px-2 py-1 hover:text-foreground sm:inline-flex"
            >
              FAQ
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-md px-2 py-1 hover:text-foreground sm:inline-flex"
            >
              GitHub
            </a>
            <Link
              href={DONATE_PATH}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1 text-accent hover:bg-accent/20"
              title="Support Flowvault with a direct crypto donation"
            >
              <Heart size={14} /> Donate
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}

/**
 * Thin site-wide banner above the main header. Flowvault has no ads,
 * accounts, or paid tier — hosting for thousands of vaults and
 * time-locks is covered by donations. Shown on every page (not just
 * home) so /send, /timelock, /blog, and vault URLs carry the same ask.
 */
function DonateBanner() {
  return (
    <div className="border-b border-accent/25 bg-accent/10 text-[11px] sm:text-xs">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-1.5 text-muted">
        <Heart size={12} className="text-accent" />
        <span>
          Flowvault is entirely free. Thousands of vaults and time-locks
          are already live &mdash; donations keep the servers running.
        </span>
        <Link
          href={DONATE_PATH}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Donate
        </Link>
      </div>
    </div>
  );
}
