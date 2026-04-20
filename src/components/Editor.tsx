"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { useVault } from "@/lib/store/vault";
import { saveVault } from "@/lib/vault/service";
import { slotCapacity } from "@/lib/crypto/volume";
import {
  Check,
  CircleAlert,
  Clock,
  KeyRound,
  Loader2,
  LogOut,
  Save,
} from "lucide-react";
import { AddPasswordModal } from "./AddPasswordModal";
import { DeadmanModal } from "./DeadmanModal";
import { deadmanExpiresAt } from "@/lib/vault/deadman";
import { useNow } from "@/lib/utils/useNow";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const AUTO_SAVE_MS = 1500;

export function Editor() {
  const { open, updateContent, updateAfterSave, close } = useVault();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [addPasswordOpen, setAddPasswordOpen] = useState(false);
  const [deadmanOpen, setDeadmanOpen] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const capacity = useMemo(
    () => (open ? slotCapacity(open.volume) : 0),
    [open],
  );

  const save = useCallback(async () => {
    if (!open) return;
    setStatus({ kind: "saving" });
    const res = await saveVault({
      siteId: open.siteId,
      masterKey: open.masterKey,
      slotIndex: open.slotIndex,
      volume: open.volume,
      previousBlob: open.blob,
      expectedVersion: open.version,
      content: open.content,
    });
    if (res.kind === "saved") {
      updateAfterSave({
        blob: res.blob,
        version: res.version,
        content: open.content,
      });
      dirtyRef.current = false;
      setStatus({ kind: "saved", at: Date.now() });
      return;
    }
    if (res.kind === "too-large") {
      setStatus({
        kind: "error",
        message: `Note too large. Max ${res.maxBytes.toLocaleString()} bytes.`,
      });
      return;
    }
    if (res.kind === "conflict") {
      setStatus({
        kind: "error",
        message:
          "This vault was edited elsewhere. Reload to see the latest version.",
      });
    }
  }, [open, updateAfterSave]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, AUTO_SAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [open?.content, save]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (!open) return null;

  const bytes = new Blob([open.content]).size;
  const pct = Math.min(100, Math.round((bytes / capacity) * 100));
  const readOnly = open.beneficiary || open.deadman?.released === true;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      {readOnly ? (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          {open.beneficiary
            ? "Beneficiary view: this vault was released by the dead-man's switch. You can read but not modify it."
            : "This vault has been released by the dead-man's switch and is locked against further writes. To start fresh, create a new vault under a new URL."}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-border bg-background-elev px-2 py-1 font-mono text-xs text-muted">
            /s/{open.slug}
          </span>
          <StatusBadge status={status} />
          <DeadmanChip onClick={() => setDeadmanOpen(true)} />
        </div>
        <div className="flex items-center gap-2">
          {!readOnly ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeadmanOpen(true)}
                title="Configure the dead-man's switch: release this vault to a beneficiary if you stop checking in"
              >
                <Clock size={14} /> Switch
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAddPasswordOpen(true)}
                title="Register another password that opens a different notebook on this URL"
              >
                <KeyRound size={14} /> Add password
              </Button>
              <Button variant="secondary" size="sm" onClick={save}>
                <Save size={14} /> Save
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={close}>
            <LogOut size={14} /> Lock
          </Button>
        </div>
      </div>

      <textarea
        value={open.content}
        onChange={(e) => {
          if (readOnly) return;
          dirtyRef.current = true;
          updateContent(e.target.value);
        }}
        onKeyDown={(e) => {
          if (
            !readOnly &&
            (e.metaKey || e.ctrlKey) &&
            e.key.toLowerCase() === "s"
          ) {
            e.preventDefault();
            void save();
          }
        }}
        spellCheck={false}
        readOnly={readOnly}
        placeholder={
          readOnly
            ? ""
            : "Start typing. Auto-saves to an encrypted slot every second or so."
        }
        className="mt-4 h-[68vh] w-full flex-1 resize-none rounded-xl border border-border bg-background-elev p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>
          Slot {open.slotIndex + 1} of {open.volume.slotCount} &middot; version{" "}
          {open.version}
        </span>
        <span className={pct > 90 ? "text-danger" : ""}>
          {bytes.toLocaleString()} / {capacity.toLocaleString()} bytes ({pct}%)
        </span>
      </div>

      <AddPasswordModal
        open={addPasswordOpen}
        onClose={() => setAddPasswordOpen(false)}
      />
      <DeadmanModal
        open={deadmanOpen}
        onClose={() => setDeadmanOpen(false)}
      />
    </main>
  );
}

function DeadmanChip({ onClick }: { onClick: () => void }) {
  const dm = useVault((s) => s.open?.deadman ?? null);
  const now = useNow(60_000);
  if (!dm) return null;
  if (dm.released) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20"
        title="This vault has been released by the dead-man's switch."
      >
        <CircleAlert size={12} /> Released
      </button>
    );
  }
  const expiresAt = deadmanExpiresAt(dm);
  const remaining = expiresAt !== null ? expiresAt - now : null;
  const label = remaining !== null ? formatRemaining(remaining) : "Active";
  const tone =
    remaining !== null && remaining < dm.intervalMs / 4
      ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
      : "border-success/30 bg-success/10 text-success hover:bg-success/20";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${tone}`}
      title={`Dead-man's switch active. Releases ${
        expiresAt ? new Date(expiresAt).toLocaleString() : "after the next interval"
      } if you don't save.`}
    >
      <Clock size={12} /> {label}
    </button>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "due now";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m left`;
}

function StatusBadge({ status }: { status: Status }) {
  if (status.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status.kind === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <Check size={12} /> Saved
      </span>
    );
  }
  if (status.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-danger">
        <CircleAlert size={12} /> {status.message}
      </span>
    );
  }
  return null;
}
