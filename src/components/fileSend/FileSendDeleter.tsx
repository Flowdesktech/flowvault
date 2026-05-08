"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteFileSend } from "@/lib/firebase/fileSends";

type Phase =
  | { kind: "loading" }
  | { kind: "missing-token" }
  | { kind: "ready" }
  | { kind: "deleting" }
  | { kind: "deleted" }
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

export function FileSendDeleter({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const raw = window.location.hash;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!raw || !raw.startsWith("#")) {
        setPhase({ kind: "missing-token" });
        return;
      }
      const params = new URLSearchParams(raw.slice(1));
      const t = params.get("t");
      if (!t) {
        setPhase({ kind: "missing-token" });
        return;
      }
      setToken(t);
      setPhase({ kind: "ready" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (!token) return;
    setPhase({ kind: "deleting" });
    try {
      const result = await deleteFileSend(id, token);
      if (result.kind === "ok") return setPhase({ kind: "deleted" });
      if (result.kind === "not-found") return setPhase({ kind: "not-found" });
      return setPhase({ kind: "forbidden" });
    } catch (e) {
      setPhase({
        kind: "error",
        message: (e as Error).message ?? "Delete failed.",
      });
    }
  };

  if (phase.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      </Card>
    );
  }

  if (phase.kind === "missing-token") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>
          Incomplete delete link
        </Header>
        <p className="mt-2 text-sm text-muted">
          This link is missing its delete token. The token travels in
          the URL fragment (the part after <code>#</code>), which some
          chat clients strip. Use the secure delete link you copied
          when you created the file send.
        </p>
      </Card>
    );
  }

  if (phase.kind === "deleting") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" /> Deleting upload…
        </div>
      </Card>
    );
  }

  if (phase.kind === "deleted") {
    return (
      <Card tone="success">
        <Header icon={<Check size={18} />}>File send destroyed</Header>
        <p className="mt-2 text-sm text-muted">
          The encrypted upload has been deleted from our storage and
          the metadata document is gone. Anyone holding the download
          link will see a <em>not found</em> page.
        </p>
        <p className="mt-4 text-xs text-muted">
          Want to send another file?{" "}
          <Link href="/file/new" className="text-accent hover:underline">
            Create a new file send
          </Link>
          .
        </p>
      </Card>
    );
  }

  if (phase.kind === "not-found") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Nothing to delete</Header>
        <p className="mt-2 text-sm text-muted">
          This file send is already gone &mdash; either the recipients
          downloaded it the maximum number of times, the expiry passed,
          or you deleted it earlier.
        </p>
      </Card>
    );
  }

  if (phase.kind === "forbidden") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>
          Delete token doesn&apos;t match
        </Header>
        <p className="mt-2 text-sm text-muted">
          We couldn&apos;t verify the secure-delete token. Make sure
          you&apos;re using the exact link Flowvault gave you when you
          created the file send.
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

  return (
    <Card tone="warning">
      <Header icon={<Trash2 size={18} />}>Destroy this file send</Header>
      <p className="mt-2 text-sm text-muted">
        Click <strong>Destroy</strong> to immediately delete the
        encrypted upload from our storage and remove the metadata
        document. The download link will stop working as soon as this
        completes.
      </p>
      <p className="mt-3 text-xs text-muted">
        This action is permanent. Flowvault cannot recover deleted file
        sends.
      </p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <Link
          href="/"
          className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Cancel
        </Link>
        <Button variant="danger" onClick={submit}>
          <Trash2 size={14} /> Destroy
        </Button>
      </div>
    </Card>
  );
}

function Card({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  const border =
    tone === "warning"
      ? "border-warning/30"
      : tone === "success"
        ? "border-success/30"
        : "border-border";
  const bg =
    tone === "warning"
      ? "bg-warning/5"
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
