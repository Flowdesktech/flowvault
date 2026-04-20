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
import { Clock, Check, Copy, ExternalLink, Lock } from "lucide-react";
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    url: string;
    unlockAt: number;
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

    setBusy(true);
    try {
      const round = roundForUnlockAt(unlockAtMs);
      const ciphertext = await encryptForRound(text, round);
      const id = await createTimelock({
        ciphertext,
        round,
        chainHash: activeChainInfo().hash,
      });
      const url = `${APP_URL}/t/${id}`;
      setCreated({ url, unlockAt: unlockTimeForRound(round) });
      setText("");
    } catch (e) {
      setErr((e as Error).message ?? "Failed to lock the message.");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return <CreatedCard url={created.url} unlockAt={created.unlockAt} />;
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

function CreatedCard({ url, unlockAt }: { url: string; unlockAt: number }) {
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
        <strong>{new Date(unlockAt).toLocaleString()}</strong>. Anyone
        with the link below can open it at that moment &mdash; treat the
        link like the secret itself.
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
      <p className="mt-4 text-xs text-muted">
        We never stored your message in plaintext. Flowvault can&apos;t
        unlock it for anyone &mdash; only the drand network&apos;s
        published round signature can.
      </p>
    </div>
  );
}
