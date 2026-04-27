"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { open, type OpenOutcome } from "@/lib/send/crypto";
import { readSend } from "@/lib/firebase/sends";

/**
 * The viewer click-gates the `readSend` call because the default is
 * one view &mdash; if we fetched on mount, a preview bot, a rogue
 * browser prefetch, or React Strict Mode&rsquo;s double-effect could
 * silently burn it. The user has to actively choose to reveal.
 */
type Phase =
  | { kind: "gate"; passwordProtectedHint: boolean }
  | { kind: "missing-key" }
  | { kind: "fetching" }
  | { kind: "needs-password"; ciphertext: Uint8Array; error: string | null; lastView: boolean }
  | { kind: "decrypting"; ciphertext: Uint8Array; password?: string; lastView: boolean }
  | { kind: "plaintext"; plaintext: string; lastView: boolean }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "exhausted" }
  | { kind: "error"; message: string };

export function SendViewer({ id }: { id: string }) {
  const [fragmentKey, setFragmentKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({
    kind: "gate",
    passwordProtectedHint: false,
  });
  const consumed = useRef(false);

  // Read the URL fragment exactly once, on mount. Browsers never ship
  // fragments to servers, so this is the only place the key exists
  // outside the crypto pipeline.
  //
  // We defer the setState into a microtask so React&rsquo;s
  // set-state-in-effect lint is happy &mdash; the rule flags
  // synchronous setState inside an effect body. The semantics are the
  // same: the next render sees the resolved state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const raw = window.location.hash;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!raw || !raw.startsWith("#")) {
        setPhase({ kind: "missing-key" });
        return;
      }
      const params = new URLSearchParams(raw.slice(1));
      const k = params.get("k");
      if (!k) {
        setPhase({ kind: "missing-key" });
        return;
      }
      setFragmentKey(k);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reveal = async () => {
    if (!fragmentKey) {
      setPhase({ kind: "missing-key" });
      return;
    }
    if (consumed.current) return;
    consumed.current = true;
    setPhase({ kind: "fetching" });
    try {
      const result = await readSend(id);
      if (result.kind === "not-found") return setPhase({ kind: "not-found" });
      if (result.kind === "expired") return setPhase({ kind: "expired" });
      if (result.kind === "exhausted") return setPhase({ kind: "exhausted" });

      // Outer decrypt with the fragment key.
      const outcome: OpenOutcome = await open({
        ciphertext: result.ciphertext,
        fragmentKey,
      });
      if (outcome.kind === "plaintext") {
        return setPhase({
          kind: "plaintext",
          plaintext: outcome.plaintext,
          lastView: result.lastView,
        });
      }
      if (outcome.kind === "needs-password") {
        return setPhase({
          kind: "needs-password",
          ciphertext: result.ciphertext,
          error: null,
          lastView: result.lastView,
        });
      }
      // Decrypt failure with no password prompt means the key is wrong
      // &mdash; usually a truncated/corrupt fragment.
      setPhase({
        kind: "error",
        message:
          "Couldn't decrypt this note. The link may be truncated or the note was created with a different key.",
      });
    } catch (e) {
      consumed.current = false; // allow retry if it was a transient network error
      setPhase({
        kind: "error",
        message: (e as Error).message ?? "Failed to fetch the note.",
      });
    }
  };

  if (phase.kind === "gate") {
    return <GateView onReveal={reveal} />;
  }

  if (phase.kind === "missing-key") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Incomplete link</Header>
        <p className="mt-2 text-sm text-muted">
          This link is missing its decryption key. The key travels in the
          URL fragment (the part after <code>#</code>), which some chat
          clients strip. Ask the sender to share the full link &mdash;
          or to create a new one.
        </p>
      </Card>
    );
  }

  if (phase.kind === "fetching") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          Fetching and decrypting…
        </div>
      </Card>
    );
  }

  if (phase.kind === "not-found") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Note not found</Header>
        <p className="mt-2 text-sm text-muted">
          Either the link is wrong, the note was already opened its final
          time, or it expired and was purged. Flowvault doesn&rsquo;t
          keep deleted notes anywhere.
        </p>
      </Card>
    );
  }

  if (phase.kind === "expired") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Note expired</Header>
        <p className="mt-2 text-sm text-muted">
          The sender gave this note a deadline and it has passed. Ask
          for a new link.
        </p>
      </Card>
    );
  }

  if (phase.kind === "exhausted") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Already opened</Header>
        <p className="mt-2 text-sm text-muted">
          This note reached its view limit. It&rsquo;s been hard-deleted
          from our database &mdash; even we can&rsquo;t retrieve it.
        </p>
      </Card>
    );
  }

  if (phase.kind === "error") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Something went wrong</Header>
        <p className="mt-2 text-sm text-muted">{phase.message}</p>
      </Card>
    );
  }

  if (phase.kind === "needs-password") {
    return (
      <PasswordView
        error={phase.error}
        lastView={phase.lastView}
        onSubmit={async (pw) => {
          setPhase({
            kind: "decrypting",
            ciphertext: phase.ciphertext,
            password: pw,
            lastView: phase.lastView,
          });
          const outcome = await open({
            ciphertext: phase.ciphertext,
            fragmentKey: fragmentKey!,
            password: pw,
          });
          if (outcome.kind === "plaintext") {
            setPhase({
              kind: "plaintext",
              plaintext: outcome.plaintext,
              lastView: phase.lastView,
            });
          } else if (outcome.kind === "wrong-password") {
            setPhase({
              kind: "needs-password",
              ciphertext: phase.ciphertext,
              error: "Wrong password. Try again.",
              lastView: phase.lastView,
            });
          } else {
            setPhase({
              kind: "error",
              message: "Decryption failed.",
            });
          }
        }}
      />
    );
  }

  if (phase.kind === "decrypting") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          Deriving the key from your password (Argon2id) and decrypting…
        </div>
      </Card>
    );
  }

  return <PlaintextView plaintext={phase.plaintext} lastView={phase.lastView} />;
}

function GateView({ onReveal }: { onReveal: () => void }) {
  return (
    <Card tone="accent">
      <Header icon={<Lock size={18} />}>You&rsquo;ve been sent a note</Header>
      <p className="mt-2 text-sm text-muted">
        Opening this note consumes a view. Once the sender&rsquo;s view
        limit is reached, the note is deleted from our database
        forever. Only click <em>Open</em> when you&rsquo;re ready to
        read it.
      </p>
      <ul className="mt-4 space-y-1 text-xs text-muted">
        <li>
          &bull; The note is end-to-end encrypted &mdash; the key is in
          the URL you clicked, never on our servers.
        </li>
        <li>
          &bull; We may also need a password from the sender. If so,
          we&rsquo;ll ask after fetching.
        </li>
      </ul>
      <div className="mt-6 flex items-center justify-end">
        <Button onClick={onReveal} size="lg">
          <Unlock size={16} /> Open the note
        </Button>
      </div>
    </Card>
  );
}

function PasswordView({
  error,
  lastView,
  onSubmit,
}: {
  error: string | null;
  lastView: boolean;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  return (
    <Card tone="accent">
      <Header icon={<KeyRound size={18} />}>Password required</Header>
      <p className="mt-2 text-sm text-muted">
        The sender added a password on top of the link. Enter it below
        &mdash; it&rsquo;s verified locally in your browser; we never
        see it.
      </p>
      {lastView ? (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          This is the last view &mdash; after you open the note, it will
          be deleted from our database.
        </div>
      ) : null}
      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (password.length === 0) return;
          onSubmit(password);
        }}
      >
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={password.length === 0}>
            <Unlock size={14} /> Decrypt
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PlaintextView({
  plaintext,
  lastView,
}: {
  plaintext: string;
  lastView: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };
  return (
    <Card tone="success">
      <div className="flex items-center justify-between">
        <Header icon={<Unlock size={18} />}>Note opened</Header>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background-elev px-2 py-1 text-xs text-muted hover:text-foreground"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 font-mono text-sm text-foreground">
        {plaintext}
      </pre>
      {lastView ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            That was the last view. The note has been deleted from our
            database. Copy anything you need now &mdash; reloading this
            page won&rsquo;t bring it back.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">
          Decrypted locally in your browser. We never saw the plaintext.
        </p>
      )}
      <div className="mt-5 rounded-xl border border-border bg-background-elev px-4 py-3 text-xs text-muted">
        This was sent with Flowvault Encrypted Send. Need to send your own
        password, API key, or recovery phrase without leaving it in chat
        history?{" "}
        <Link href="/send/new" className="text-accent hover:underline">
          Create a self-destructing note
        </Link>
        .
      </div>
    </Card>
  );
}

function Card({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success";
}) {
  const border =
    tone === "accent"
      ? "border-accent/30"
      : tone === "success"
        ? "border-success/30"
        : "border-border";
  const bg =
    tone === "accent"
      ? "bg-accent/5"
      : tone === "success"
        ? "bg-success/5"
        : "bg-background-elev";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-6`}>{children}</div>
  );
}

function Header({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
      <span className="text-accent">{icon}</span>
      {children}
    </div>
  );
}
