"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  Lock,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MAX_FILE_SEND_BYTES, seal } from "@/lib/fileSend/crypto";
import {
  FILE_SEND_DEFAULT_EXPIRY_MS,
  FILE_SEND_DEFAULT_VIEWS,
  FILE_SEND_MAX_EXPIRY_MS,
  FILE_SEND_MAX_VIEWS,
  createFileSend,
} from "@/lib/firebase/fileSends";
import { APP_URL } from "@/lib/config";

const EXPIRY_PRESETS: { label: string; ms: number }[] = [
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "1 day", ms: 24 * 60 * 60_000 },
  { label: "3 days", ms: 3 * 24 * 60 * 60_000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60_000 },
];

const VIEW_PRESETS: number[] = [1, 2, 5, FILE_SEND_MAX_VIEWS];

type Stage =
  | { kind: "idle" }
  | { kind: "encrypting" }
  | { kind: "uploading"; fraction: number }
  | { kind: "registering" };

interface CreatedState {
  downloadUrl: string;
  deleteUrl: string;
  expiresAt: number;
  maxViews: number;
  passwordProtected: boolean;
  fileName: string;
  fileSize: number;
}

export function FileSendComposer() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expiryMs, setExpiryMs] = useState<number>(FILE_SEND_DEFAULT_EXPIRY_MS);
  const [maxViews, setMaxViews] = useState<number>(FILE_SEND_DEFAULT_VIEWS);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedState | null>(null);

  const tooLarge = !!file && file.size > MAX_FILE_SEND_BYTES;
  const busy = stage.kind !== "idle";

  const sizeLabel = useMemo(
    () => (file ? formatBytes(file.size) : null),
    [file],
  );

  const reset = () => {
    setFile(null);
    setPassword("");
    setConfirm("");
    setUsePassword(false);
    setExpiryMs(FILE_SEND_DEFAULT_EXPIRY_MS);
    setMaxViews(FILE_SEND_DEFAULT_VIEWS);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    setErr(null);
    if (!file) {
      setErr("Pick a file first.");
      return;
    }
    if (file.size === 0) {
      setErr("That file is empty.");
      return;
    }
    if (file.size > MAX_FILE_SEND_BYTES) {
      setErr(`File is ${formatBytes(file.size)}; the cap is 10 MiB.`);
      return;
    }
    if (expiryMs > FILE_SEND_MAX_EXPIRY_MS) {
      setErr("Expiry can't be more than 7 days.");
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

    try {
      setStage({ kind: "encrypting" });
      const fileBuffer = new Uint8Array(await file.arrayBuffer());
      const sealed = await seal({
        file: {
          bytes: fileBuffer,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
        password: usePassword ? password : undefined,
      });

      setStage({ kind: "uploading", fraction: 0 });
      const expiresAtMs = Date.now() + expiryMs;
      const { id } = await createFileSend({
        contentCiphertext: sealed.contentCiphertext,
        metadataCiphertext: sealed.metadataCiphertext,
        expiresAtMs,
        maxViews,
        passwordProtected: sealed.passwordProtected,
        passwordSalt: sealed.passwordSalt,
        deleteTokenHash: sealed.deleteTokenHash,
        onUploadProgress: (fraction) =>
          setStage({ kind: "uploading", fraction }),
      });

      setStage({ kind: "registering" });
      const downloadUrl = `${APP_URL}/file/${id}#k=${sealed.fragmentKey}`;
      const deleteUrl = `${APP_URL}/file/${id}/delete#t=${sealed.deleteToken}`;
      setCreated({
        downloadUrl,
        deleteUrl,
        expiresAt: expiresAtMs,
        maxViews,
        passwordProtected: sealed.passwordProtected,
        fileName: file.name,
        fileSize: file.size,
      });
      reset();
    } catch (e) {
      setErr((e as Error).message ?? "Failed to create the file send.");
    } finally {
      setStage({ kind: "idle" });
    }
  };

  if (created) {
    return (
      <CreatedCard
        state={created}
        onAnother={() => {
          setCreated(null);
          setErr(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background-elev p-5">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">File</span>
          <span
            className={`text-xs ${
              tooLarge ? "text-danger" : "text-muted"
            }`}
          >
            {sizeLabel ? `${sizeLabel} / ` : ""}10 MiB max
          </span>
        </label>

        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="filesend-input"
          />
          <label
            htmlFor="filesend-input"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition ${
              tooLarge
                ? "border-danger/40 bg-danger/5 text-danger"
                : file
                  ? "border-accent/40 bg-accent/5 text-foreground"
                  : "border-border bg-background text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            <FileUp size={22} />
            {file ? (
              <>
                <span className="text-sm font-medium text-foreground">
                  {file.name}
                </span>
                <span className="text-xs text-muted">
                  {sizeLabel} &middot;{" "}
                  {file.type || "application/octet-stream"}
                </span>
                <span className="text-xs text-accent underline-offset-4 hover:underline">
                  Change file
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">
                  Drop a file here, or click to choose
                </span>
                <span className="text-xs">
                  Up to 10 MiB. Encrypted in this browser before it
                  leaves your device.
                </span>
              </>
            )}
          </label>
        </div>
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
              {v === 1 ? "1 download" : `${v} downloads`}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          The encrypted file is hard-deleted from our storage the moment
          the last download is consumed &mdash; whichever comes first,
          downloads or expiry. Maximum retention is 7 days.
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
              Also require a password to download
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
              don&rsquo;t store a hint. If you forget it, the file is
              unrecoverable.
            </p>
          </div>
        ) : null}
      </section>

      {err ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      ) : null}

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs text-muted">
          Encrypted client-side with AES-256-GCM. The key lives in the
          download URL&rsquo;s <code>#fragment</code> &mdash; browsers
          never send fragments to servers, so even our database
          can&rsquo;t decrypt the file.
        </p>
        <Button
          onClick={submit}
          disabled={busy || tooLarge}
          size="lg"
          className="shrink-0 whitespace-nowrap"
        >
          <Upload size={16} /> {stageLabel(stage)}
        </Button>
      </div>

      {stage.kind === "uploading" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-background-elev-2">
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.round(stage.fraction * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function stageLabel(stage: Stage): string {
  switch (stage.kind) {
    case "idle":
      return "Create file send";
    case "encrypting":
      return "Encrypting…";
    case "uploading":
      return `Uploading ${Math.round(stage.fraction * 100)}%`;
    case "registering":
      return "Finalizing…";
  }
}

function CreatedCard({
  state,
  onAnother,
}: {
  state: CreatedState;
  onAnother: () => void;
}) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/10 p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-accent">
        <Check size={16} /> File send created.
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        <strong>{state.fileName}</strong> ({formatBytes(state.fileSize)}) is
        encrypted and uploaded. The download link below opens it{" "}
        <strong>
          {state.maxViews === 1 ? "once" : `up to ${state.maxViews} times`}
        </strong>{" "}
        and expires on{" "}
        <strong>{new Date(state.expiresAt).toLocaleString()}</strong>.{" "}
        {state.passwordProtected ? (
          <>
            The recipient also needs the password you set. Send the link
            and the password through different channels.
          </>
        ) : (
          <>
            Anyone with the full link (including the part after{" "}
            <code>#</code>) can download it &mdash; treat the link like
            the file itself.
          </>
        )}
      </p>

      <LinkCard
        label="Download link"
        url={state.downloadUrl}
        icon={<Lock size={14} className="text-accent" />}
        helper="Share this with the recipient."
      />
      <LinkCard
        label="Secure delete link"
        url={state.deleteUrl}
        icon={<Trash2 size={14} className="text-danger" />}
        helper="Keep this for yourself. Opening it lets you destroy the upload before it expires or is fully consumed."
        tone="warning"
      />

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <p>
          We don&apos;t store these links. Copy them now &mdash; we
          can&apos;t show them again, and Flowvault can&apos;t decrypt
          the file on anyone&apos;s behalf.
        </p>
      </div>

      {state.passwordProtected ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <p>
            This file is password-protected. We never stored the
            password and can&apos;t recover it &mdash; if you lose it,
            the file is unrecoverable.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onAnother}
          className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Send another file
        </button>
      </div>
    </div>
  );
}

function LinkCard({
  label,
  url,
  icon,
  helper,
  tone = "default",
}: {
  label: string;
  url: string;
  icon: React.ReactNode;
  helper: string;
  tone?: "default" | "warning";
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
    <div className="mt-4">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 flex flex-wrap items-center gap-2 rounded-lg border ${
          tone === "warning" ? "border-warning/30" : "border-border"
        } bg-background px-3 py-2 font-mono text-xs text-foreground`}
      >
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
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}
