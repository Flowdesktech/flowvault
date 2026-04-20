import Link from "next/link";
import { Vault, Heart, Briefcase, Clock, Send } from "lucide-react";
import { CONTACT_EMAIL, DONATE_PATH, GITHUB_URL } from "@/lib/config";

export function Navbar() {
  return (
    <>
      <HireBanner />
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
              href="/timelock/new"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-foreground"
              title="Encrypt a message to a future date"
            >
              <Clock size={14} /> <span className="hidden sm:inline">Time-lock</span>
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

function HireBanner() {
  return (
    <div className="border-b border-border/60 bg-background-elev/80 text-[11px] sm:text-xs">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-1.5 px-4 py-1.5 text-muted">
        <Briefcase size={12} className="text-accent" />
        <span>
          Available for hire &mdash; privacy-first apps, engineering, and
          business-idea work.
        </span>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Flowdesk%20hire%20inquiry`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
