"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Send,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MAX_SEND_PLAINTEXT_BYTES, seal } from "@/lib/send/crypto";
import {
  SEND_DEFAULT_EXPIRY_MS,
  SEND_DEFAULT_VIEWS,
  createSend,
} from "@/lib/firebase/sends";
import { APP_URL } from "@/lib/config";

/**
 * Expiry presets. The server caps absolute expiry at 30 days; we
 * don&rsquo;t offer anything longer. Defaults to 1 week &mdash; long
 * enough that recipients on the other side of a timezone gap can
 * still open it, short enough that forgotten links don&rsquo;t
 * linger forever.
 */
const EXPIRY_PRESETS: { label: string; ms: number }[] = [
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "1 day", ms: 24 * 60 * 60_000 },
  { label: "1 week", ms: 7 * 24 * 60 * 60_000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60_000 },
];

const VIEW_PRESETS: number[] = [1, 3, 5, 10];

export function SendComposer() {
  const [text, setText] = useState("");
  const [expiryMs, setExpiryMs] = useState<number>(SEND_DEFAULT_EXPIRY_MS);
  const [maxViews, setMaxViews] = useState<number>(SEND_DEFAULT_VIEWS);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    url: string;
    expiresAt: number;
    maxViews: number;
    passwordProtected: boolean;
  } | null>(null);

  const bytes = useMemo(() => new TextEncoder().encode(text).length, [text]);

  const submit = async () => {
    setErr(null);
    if (text.trim().length === 0) {
      setErr("Write something to send first.");
      return;
    }
    if (bytes > MAX_SEND_PLAINTEXT_BYTES) {
      setErr(
        `Note is ${bytes.toLocaleString()} bytes, limit is ${MAX_SEND_PLAINTEXT_BYTES.toLocaleString()}.`,
      );
      return;
    }
    if (usePassword) {
      if (password.length < 4) {
        setErr("Password must be at least 4 characters.");
        return;
      }
      if (password !== confirm) {
        setErr("Password and confirmation don't match.");
        return;
      }
    }

    setBusy(true);
    try {
      const sealed = await seal({
        plaintext: text,
        password: usePassword ? password : undefined,
      });
      const expiresAtMs = Date.now() + expiryMs;
      const id = await createSend({
        ciphertext: sealed.ciphertext,
        expiresAtMs,
        maxViews,
        passwordProtected: sealed.passwordProtected,
      });
      // Note the `#k=...` fragment: the key never reaches the server.
      const url = `${APP_URL}/send/${id}#k=${sealed.fragmentKey}`;
      setCreated({
        url,
        expiresAt: expiresAtMs,
        maxViews,
        passwordProtected: sealed.passwordProtected,
      });
      setText("");
      setPassword("");
      setConfirm("");
    } catch (e) {
      setErr((e as Error).message ?? "Failed to create the send.");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <CreatedCard
        url={created.url}
        expiresAt={created.expiresAt}
        maxViews={created.maxViews}
        passwordProtected={created.passwordProtected}
        onAnother={() => setCreated(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background-elev p-5">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Note</span>
          <span
            className={`text-xs ${
              bytes > MAX_SEND_PLAINTEXT_BYTES ? "text-danger" : "text-muted"
            }`}
          >
            {bytes.toLocaleString()} /{" "}
            {MAX_SEND_PLAINTEXT_BYTES.toLocaleString()} bytes
          </span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a password, a seed phrase, API keys, or anything you&rsquo;d rather not sit in chat history. Encrypted in this browser before it leaves."
          rows={10}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </section>

      <section className="rounded-2xl border border-border bg-background-elev p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock size={16} className="text-accent" /> Expires after
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXPIRY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setExpiryMs(p.ms)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                expiryMs === p.ms
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm font-medium text-foreground">
          <Eye size={16} className="text-accent" /> Destroy after
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {VIEW_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setMaxViews(v)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                maxViews === v
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {v === 1 ? "1 view" : `${v} views`}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          The note is hard-deleted from our database the moment the last
          view is used &mdash; whichever comes first, views or expiry.
        </p>
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
              Also require a password to open
            </span>
            <span className="mt-1 block text-xs text-muted">
              Adds a second gate on top of the link&rsquo;s secret key.
              Useful if the link might leak through email, chat, or a
              forwarded reply. Share the password through a different
              channel.
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
              We never store your password, can&rsquo;t recover it, and
              don&rsquo;t store a hint. If you forget it, the note is
              unreadable.
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
          Encrypted client-side with AES-256-GCM. The key lives in the
          URL&rsquo;s <code>#fragment</code> &mdash; browsers never send
          fragments to servers, so we literally cannot decrypt this note
          even if we wanted to.
        </p>
        <Button onClick={submit} disabled={busy} size="lg">
          <Send size={16} /> {busy ? "Sealing…" : "Create send"}
        </Button>
      </div>
    </div>
  );
}

function CreatedCard({
  url,
  expiresAt,
  maxViews,
  passwordProtected,
  onAnother,
}: {
  url: string;
  expiresAt: number;
  maxViews: number;
  passwordProtected: boolean;
  onAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/10 p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-accent">
        <Check size={16} /> Send created.
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        This link opens the note{" "}
        <strong>{maxViews === 1 ? "once" : `up to ${maxViews} times`}</strong>{" "}
        and expires on{" "}
        <strong>{new Date(expiresAt).toLocaleString()}</strong>.{" "}
        {passwordProtected ? (
          <>
            The recipient also needs the password you set. Send the link
            and the password through different channels.
          </>
        ) : (
          <>
            Anyone with the full link (including the part after{" "}
            <code>#</code>) can open it &mdash; treat the link like the
            secret itself.
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

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
        <Lock size={14} className="mt-0.5 shrink-0" />
        <p>
          We don&apos;t store this link. Copy it now &mdash; we
          can&apos;t show it again, and Flowvault can&apos;t decrypt the
          note on anyone&apos;s behalf.
        </p>
      </div>

      {passwordProtected ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <p>
            This note is password-protected. We never stored the password
            and can&apos;t recover it &mdash; if you lose it, the note
            is unreadable.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onAnother}
          className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Create another
        </button>
      </div>
    </div>
  );
}
