"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  MIN_LOCK_SECONDS,
  MAX_PLAINTEXT_BYTES,
  activeChainInfo,
  encryptForRound,
  roundForUnlockAt,
  unlockTimeForRound,
} from "@/lib/timelock/tlock";
import { createTimelock } from "@/lib/firebase/timelocks";
import {
  Clock,
  Check,
  Copy,
  ExternalLink,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { APP_URL } from "@/lib/config";

/**
 * Suggested unlock horizons. These drive one-tap presets; users can
 * also type any datetime they like via the custom input.
 */
const PRESETS: { label: string; addMs: number }[] = [
  { label: "In 5 minutes", addMs: 5 * 60_000 },
  { label: "In 1 hour", addMs: 60 * 60_000 },
  { label: "Tomorrow, this time", addMs: 24 * 60 * 60_000 },
  { label: "In 1 week", addMs: 7 * 24 * 60 * 60_000 },
  { label: "In 1 month", addMs: 30 * 24 * 60 * 60_000 },
  { label: "In 1 year", addMs: 365 * 24 * 60 * 60_000 },
];

/** Convert a Date to a string suitable for <input type="datetime-local"> */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function TimelockComposer() {
  const [text, setText] = useState("");
  const [customISO, setCustomISO] = useState<string>(() =>
    toLocalInputValue(new Date(Date.now() + 24 * 60 * 60_000)),
  );
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    url: string;
    unlockAt: number;
    passwordProtected: boolean;
  } | null>(null);

  const unlockAtMs = useMemo(() => {
    const ms = new Date(customISO).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }, [customISO]);

  const bytes = useMemo(() => new TextEncoder().encode(text).length, [text]);

  const lock = async () => {
    setErr(null);
    if (text.trim().length === 0) {
      setErr("Write something to lock first.");
      return;
    }
    if (bytes > MAX_PLAINTEXT_BYTES) {
      setErr(
        `Message is ${bytes.toLocaleString()} bytes, limit is ${MAX_PLAINTEXT_BYTES.toLocaleString()}.`,
      );
      return;
    }
    if (!Number.isFinite(unlockAtMs) || unlockAtMs <= 0) {
      setErr("Pick a valid unlock date.");
      return;
    }
    const deltaSec = (unlockAtMs - Date.now()) / 1000;
    if (deltaSec < MIN_LOCK_SECONDS) {
      setErr(
        `Pick a time at least ${MIN_LOCK_SECONDS / 60} minutes in the future.`,
      );
      return;
    }

    const trimmedPw = password;
    if (usePassword) {
      if (trimmedPw.length < 4) {
        setErr("Password must be at least 4 characters.");
        return;
      }
      if (trimmedPw !== confirm) {
        setErr("Password and confirmation don't match.");
        return;
      }
    }

    setBusy(true);
    try {
      const round = roundForUnlockAt(unlockAtMs);
      const ciphertext = await encryptForRound(
        text,
        round,
        usePassword ? { password: trimmedPw } : undefined,
      );
      const id = await createTimelock({
        ciphertext,
        round,
        chainHash: activeChainInfo().hash,
        passwordProtected: usePassword,
      });
      const url = `${APP_URL}/t/${id}`;
      setCreated({
        url,
        unlockAt: unlockTimeForRound(round),
        passwordProtected: usePassword,
      });
      setText("");
      setPassword("");
      setConfirm("");
    } catch (e) {
      setErr((e as Error).message ?? "Failed to lock the message.");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <CreatedCard
        url={created.url}
        unlockAt={created.unlockAt}
        passwordProtected={created.passwordProtected}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background-elev p-5">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Message
          </span>
          <span
            className={`text-xs ${
              bytes > MAX_PLAINTEXT_BYTES ? "text-danger" : "text-muted"
            }`}
          >
            {bytes.toLocaleString()} / {MAX_PLAINTEXT_BYTES.toLocaleString()}{" "}
            bytes
          </span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write anything. It will be encrypted in this browser before it leaves."
          rows={10}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </section>

      <section className="rounded-2xl border border-border bg-background-elev p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock size={16} className="text-accent" />
          Unlock when
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() =>
                setCustomISO(toLocalInputValue(new Date(Date.now() + p.addMs)))
              }
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-xs text-muted">
          Or pick an exact moment
        </label>
        <input
          type="datetime-local"
          value={customISO}
          onChange={(e) => setCustomISO(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {unlockAtMs > 0 ? (
          <p className="mt-3 text-xs text-muted">
            Resolves to drand round{" "}
            <span className="font-mono text-foreground">
              #{roundForUnlockAt(unlockAtMs).toLocaleString()}
            </span>{" "}
            &mdash; approximately{" "}
            <span className="text-foreground">
              {new Date(
                unlockTimeForRound(roundForUnlockAt(unlockAtMs)),
              ).toLocaleString()}
            </span>
            .
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-background-elev p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={usePassword}
            onChange={(e) => setUsePassword(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border bg-background text-accent focus:ring-2 focus:ring-accent/30"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <KeyRound size={16} className="text-accent" />
              Also require a password to read
            </span>
            <span className="mt-1 block text-xs text-muted">
              Adds a second gate: even after the time-lock releases, the
              reader needs this password. Useful if the link might travel
              through channels you don&apos;t fully trust. Share the
              password out-of-band.
            </span>
          </span>
        </label>
        {usePassword ? (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="new-password"
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
            <input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p className="text-xs text-muted">
              We never store your password, can&apos;t recover it, and
              don&apos;t store a hint. If you forget it, the message is
              gone even after the time-lock releases.
            </p>
          </div>
        ) : null}
      </section>

      {err ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {err}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Sealed client-side with{" "}
          <a
            href="https://github.com/drand/tlock-js"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            tlock
          </a>
          . The capsule is stored as opaque ciphertext + target round.
        </p>
        <Button onClick={lock} disabled={busy} size="lg">
          <Lock size={16} /> {busy ? "Sealing…" : "Lock message"}
        </Button>
      </div>
    </div>
  );
}

function CreatedCard({
  url,
  unlockAt,
  passwordProtected,
}: {
  url: string;
  unlockAt: number;
  passwordProtected: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop — browser without clipboard access
    }
  };
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/10 p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-accent">
        <Check size={16} /> Locked.
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        Your message will unlock around{" "}
        <strong>{new Date(unlockAt).toLocaleString()}</strong>.{" "}
        {passwordProtected ? (
          <>
            Anyone with the link below will see a countdown, and after
            that moment they still need the password you set to read the
            message. Send the link and the password through different
            channels.
          </>
        ) : (
          <>
            Anyone with the link below can open it at that moment
            &mdash; treat the link like the secret itself.
          </>
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
        <span className="flex-1 truncate">{url}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background-elev px-2 py-1 text-muted hover:text-foreground"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <Link
          href={url.replace(/^https?:\/\/[^/]+/, "")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background-elev px-2 py-1 text-muted hover:text-foreground"
        >
          <ExternalLink size={12} /> Open
        </Link>
      </div>
      {passwordProtected ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <p>
            This capsule is password-protected. We never stored the
            password and can&apos;t recover it &mdash; if you lose it,
            the message is unreadable forever.
          </p>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted">
        We never stored your message in plaintext. Flowvault can&apos;t
        unlock it for anyone &mdash; only the drand network&apos;s
        published round signature can{passwordProtected ? ", and only then with your password" : ""}.
      </p>
    </div>
  );
}
