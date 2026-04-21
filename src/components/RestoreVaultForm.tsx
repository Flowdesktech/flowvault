"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileLock2,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/Button";
import { isValidSlug, normalizeSlug } from "@/lib/crypto/siteId";
import { APP_HOST } from "@/lib/config";
import {
  decodeBackup,
  type BackupEnvelope,
} from "@/lib/vault/portable";
import { restoreVaultFromBackup } from "@/lib/vault/service";

type PickedFile =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "ready"; envelope: BackupEnvelope; filename: string };

type SubmitState =
  | { kind: "idle" }
  | { kind: "restoring" }
  | { kind: "taken" }
  | { kind: "error"; message: string };

/**
 * Drag-drop restore UI. Decoding a backup is pure-client (no network),
 * so we can give instant feedback on bad files. Actually creating the
 * site is deferred to submit.
 */
export function RestoreVaultForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFile>({ kind: "none" });
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const ingestFile = useCallback(async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const envelope = decodeBackup(bytes);
      setPicked({ kind: "ready", envelope, filename: file.name });
      if (envelope.slugHint && !slug) {
        setSlug(envelope.slugHint);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read file.";
      setPicked({ kind: "error", message: msg });
    }
  }, [slug]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void ingestFile(file);
    },
    [ingestFile],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void ingestFile(file);
    },
    [ingestFile],
  );

  const ready = picked.kind === "ready";
  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug]);
  const slugOk = isValidSlug(normalizedSlug);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    if (!slugOk) {
      setSlugError(
        "Use 3-64 characters: lowercase letters, numbers, dashes or underscores.",
      );
      return;
    }
    setSlugError(null);
    setSubmit({ kind: "restoring" });
    try {
      const res = await restoreVaultFromBackup({
        slug: normalizedSlug,
        backup: picked.envelope,
      });
      if (res.kind === "restored") {
        router.push(`/s/${encodeURIComponent(normalizedSlug)}`);
        return;
      }
      if (res.kind === "slug-taken") {
        setSubmit({ kind: "taken" });
        return;
      }
      setSubmit({ kind: "error", message: res.reason });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore failed.";
      setSubmit({ kind: "error", message: msg });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ---- 1. Pick backup file ---- */}
      <section>
        <label
          htmlFor="fvault-file"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? "border-accent bg-accent/5"
              : "border-border bg-background-elev hover:border-accent/60 hover:bg-background-elev-2/50"
          }`}
        >
          <input
            ref={inputRef}
            id="fvault-file"
            type="file"
            accept=".fvault,application/json"
            className="sr-only"
            onChange={onFileInput}
          />
          {picked.kind === "ready" ? (
            <>
              <FileLock2 size={28} className="text-accent" />
              <div>
                <div className="font-medium text-foreground">
                  {picked.filename}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {formatBackupSummary(picked.envelope)}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setPicked({ kind: "none" });
                  setSlug("");
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                Choose a different file
              </button>
            </>
          ) : (
            <>
              <Upload
                size={28}
                className={dragOver ? "text-accent" : "text-muted"}
              />
              <div>
                <div className="text-sm font-medium text-foreground">
                  Drop a <span className="font-mono">.fvault</span> backup here
                </div>
                <div className="mt-1 text-xs text-muted">
                  or click to choose from disk &mdash; your password stays
                  needed to actually read it.
                </div>
              </div>
              {picked.kind === "error" ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">
                  <XCircle size={12} /> {picked.message}
                </div>
              ) : null}
            </>
          )}
        </label>
      </section>

      {/* ---- 2. Target slug ---- */}
      <section
        className={ready ? "" : "pointer-events-none opacity-40"}
      >
        <label
          htmlFor="restore-slug"
          className="text-sm font-medium text-foreground"
        >
          Restore to URL
        </label>
        <div className="mt-2 flex items-center rounded-lg border border-border bg-background-elev pl-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <span className="select-none text-sm text-muted">
            {APP_HOST}/s/
          </span>
          <input
            id="restore-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-restored-vault"
            className="h-11 flex-1 bg-transparent pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
            autoComplete="off"
            disabled={!ready}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          The slug must be new &mdash; restoring on top of an existing
          vault is intentionally blocked to avoid silent clobber. Pick a
          fresh URL, or delete the old one first by letting it expire.
        </p>
        {slugError ? (
          <p className="mt-1 text-xs text-danger">{slugError}</p>
        ) : null}
        {submit.kind === "taken" ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
            <CircleAlert size={12} />{" "}
            <span>
              <span className="font-mono">{normalizedSlug}</span> already
              exists. Choose another slug.
            </span>
          </p>
        ) : null}
        {submit.kind === "error" ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger">
            <XCircle size={12} /> {submit.message}
          </p>
        ) : null}
      </section>

      {/* ---- 3. Submit ---- */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          &larr; Back to home
        </Link>
        <Button
          type="submit"
          size="md"
          disabled={!ready || !slugOk || submit.kind === "restoring"}
        >
          {submit.kind === "restoring" ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Restoring…
            </>
          ) : (
            <>
              <CheckCircle2 size={14} /> Restore vault <ArrowRight size={14} />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function formatBackupSummary(envelope: BackupEnvelope): string {
  const parts: string[] = [];
  parts.push(`${Math.round(envelope.ciphertext.length / 1024)} KiB ciphertext`);
  parts.push(
    `${envelope.volume.slotCount}×${Math.round(envelope.volume.slotSize / 1024)} KiB slots`,
  );
  if (envelope.exportedAt) {
    const d = new Date(envelope.exportedAt);
    parts.push(`exported ${d.toISOString().slice(0, 10)}`);
  }
  return parts.join(" · ");
}
