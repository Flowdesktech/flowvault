"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  KeyRound,
  Loader2,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  type FileMetadata,
  openContent,
  openMetadata,
} from "@/lib/fileSend/crypto";
import {
  downloadCiphertext,
  readFileSend,
  type ReadFileSendResult,
} from "@/lib/firebase/fileSends";

/**
 * The viewer click-gates the `readFileSend` call because the default
 * is one download &mdash; if we fetched on mount, a preview bot,
 * a rogue browser prefetch, or React Strict Mode&rsquo;s
 * double-effect could silently burn it. The user has to actively
 * choose to download.
 */
type Phase =
  | { kind: "gate" }
  | { kind: "missing-key" }
  | { kind: "fetching" }
  | { kind: "needs-password"; result: SuccessfulFetch; error: string | null }
  | { kind: "downloading"; result: SuccessfulFetch; password?: string; fraction: number }
  | { kind: "decrypting"; result: SuccessfulFetch }
  | {
      kind: "ready";
      metadata: FileMetadata;
      bytes: Uint8Array;
      lastView: boolean;
      objectUrl: string;
    }
  | { kind: "not-found" }
  | { kind: "expired" }
  | { kind: "exhausted" }
  | { kind: "error"; message: string };

type SuccessfulFetch = Extract<ReadFileSendResult, { kind: "ok" }>;

export function FileSendViewer({ id }: { id: string }) {
  const [fragmentKey, setFragmentKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "gate" });
  const consumed = useRef(false);
  const objectUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
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
      const result = await readFileSend(id);
      if (result.kind !== "ok") return setPhase({ kind: result.kind });

      // Try to decrypt metadata first; if a password is required, we'll
      // know without burning bandwidth on a 10 MiB body.
      const metaOutcome = await openMetadata({
        metadataCiphertext: result.metadataCiphertext,
        fragmentKey,
        passwordSalt: result.passwordSalt,
      });
      if (metaOutcome.kind === "needs-password") {
        return setPhase({
          kind: "needs-password",
          result,
          error: null,
        });
      }
      if (metaOutcome.kind === "ok") {
        return downloadAndDecrypt(result, undefined, metaOutcome.metadata);
      }
      // Outer-key failure — likely a truncated fragment.
      setPhase({
        kind: "error",
        message:
          "Couldn't decrypt this file. The link may be truncated or the file was created with a different key.",
      });
    } catch (e) {
      consumed.current = false;
      setPhase({
        kind: "error",
        message: (e as Error).message ?? "Failed to fetch the file.",
      });
    }
  };

  const downloadAndDecrypt = async (
    result: SuccessfulFetch,
    password: string | undefined,
    knownMetadata?: FileMetadata,
  ) => {
    if (!fragmentKey) return;
    setPhase({ kind: "downloading", result, password, fraction: 0 });

    const ciphertext = await downloadCiphertext(
      result.downloadUrl,
      (fraction) =>
        setPhase((prev) =>
          prev.kind === "downloading" ? { ...prev, fraction } : prev,
        ),
    );

    setPhase({ kind: "decrypting", result });

    let metadata = knownMetadata;
    if (!metadata) {
      const metaOutcome = await openMetadata({
        metadataCiphertext: result.metadataCiphertext,
        fragmentKey,
        passwordSalt: result.passwordSalt,
        password,
      });
      if (metaOutcome.kind !== "ok") {
        setPhase({
          kind: "needs-password",
          result,
          error:
            metaOutcome.kind === "wrong-password"
              ? "Wrong password. Try again."
              : "Decryption failed.",
        });
        return;
      }
      metadata = metaOutcome.metadata;
    }

    const contentOutcome = await openContent({
      contentCiphertext: ciphertext,
      fragmentKey,
      passwordSalt: result.passwordSalt,
      password,
    });
    if (contentOutcome.kind !== "ok") {
      setPhase({
        kind: "needs-password",
        result,
        error:
          contentOutcome.kind === "wrong-password"
            ? "Wrong password. Try again."
            : "Decryption failed.",
      });
      return;
    }

    const blob = new Blob([contentOutcome.bytes as BlobPart], {
      type: metadata.contentType || "application/octet-stream",
    });
    const objectUrl = URL.createObjectURL(blob);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = objectUrl;

    setPhase({
      kind: "ready",
      metadata,
      bytes: contentOutcome.bytes,
      lastView: result.lastView,
      objectUrl,
    });
  };

  if (phase.kind === "gate") return <GateView onReveal={reveal} />;

  if (phase.kind === "missing-key") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Incomplete link</Header>
        <p className="mt-2 text-sm text-muted">
          This link is missing its decryption key. The key travels in
          the URL fragment (the part after <code>#</code>), which some
          chat clients strip. Ask the sender to share the full link
          &mdash; or to create a new one.
        </p>
      </Card>
    );
  }

  if (phase.kind === "fetching") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          Reserving a download &amp; checking metadata…
        </div>
      </Card>
    );
  }

  if (phase.kind === "not-found") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>File not found</Header>
        <p className="mt-2 text-sm text-muted">
          Either the link is wrong, the file already hit its download
          limit, or it expired and was purged. Flowvault doesn&rsquo;t
          keep deleted uploads anywhere.
        </p>
      </Card>
    );
  }

  if (phase.kind === "expired") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>File expired</Header>
        <p className="mt-2 text-sm text-muted">
          The sender gave this file a deadline and it has passed. Ask
          for a new link.
        </p>
      </Card>
    );
  }

  if (phase.kind === "exhausted") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Already downloaded</Header>
        <p className="mt-2 text-sm text-muted">
          This file reached its download limit. It&rsquo;s been
          hard-deleted from our storage &mdash; even we can&rsquo;t
          retrieve it.
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
        lastView={phase.result.lastView}
        onSubmit={(pw) => downloadAndDecrypt(phase.result, pw)}
      />
    );
  }

  if (phase.kind === "downloading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          Downloading encrypted bytes ({Math.round(phase.fraction * 100)}%)…
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background-elev-2">
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.round(phase.fraction * 100)}%` }}
          />
        </div>
      </Card>
    );
  }

  if (phase.kind === "decrypting") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" />
          Decrypting locally…
        </div>
      </Card>
    );
  }

  return <ReadyView phase={phase} />;
}

function GateView({ onReveal }: { onReveal: () => void }) {
  return (
    <Card tone="accent">
      <Header icon={<Lock size={18} />}>You&rsquo;ve been sent a file</Header>
      <p className="mt-2 text-sm text-muted">
        Opening this link consumes a download. Once the sender&rsquo;s
        download limit is reached, the file is deleted from our storage
        forever. Only click <em>Download</em> when you&rsquo;re ready to
        save it.
      </p>
      <ul className="mt-4 space-y-1 text-xs text-muted">
        <li>
          &bull; The file is end-to-end encrypted &mdash; the key is in
          the URL you clicked, never on our servers.
        </li>
        <li>
          &bull; We may also need a password from the sender. If so,
          we&rsquo;ll ask after fetching.
        </li>
        <li>
          &bull; Up to 10 MiB; retention is at most 7 days from when
          the sender created it.
        </li>
      </ul>
      <div className="mt-6 flex items-center justify-end">
        <Button onClick={onReveal} size="lg">
          <Unlock size={16} /> Open the file
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
          This is the last download &mdash; once you decrypt the file,
          the upload will be deleted from our storage.
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

function ReadyView({
  phase,
}: {
  phase: Extract<Phase, { kind: "ready" }>;
}) {
  const { metadata, objectUrl, lastView } = phase;
  return (
    <Card tone="success">
      <Header icon={<FileLock2 size={18} />}>File decrypted</Header>
      <div className="mt-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground">
        <div className="font-medium">{metadata.name}</div>
        <div className="mt-1 text-xs text-muted">
          {formatBytes(metadata.size)} &middot;{" "}
          {metadata.contentType || "application/octet-stream"}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={objectUrl}
          download={metadata.name}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:brightness-110"
        >
          <Download size={14} /> Save to device
        </a>
      </div>
      {lastView ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            That was the last download. The encrypted upload has been
            deleted from our storage. Save the file now &mdash;
            reloading this page won&rsquo;t bring it back.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">
          Decrypted locally in your browser. We never saw the
          plaintext.
        </p>
      )}
      <div className="mt-5 rounded-xl border border-border bg-background-elev px-4 py-3 text-xs text-muted">
        This file was sent with Flowvault File Send. Need to send your
        own document, image, or recovery key without leaving it in
        chat history?{" "}
        <Link href="/file/new" className="text-accent hover:underline">
          Create a self-destructing file send
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}
