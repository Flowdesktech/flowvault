"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { useVault } from "@/lib/store/vault";
import { saveVault } from "@/lib/vault/service";
import { slotCapacity } from "@/lib/crypto/volume";
import { fetchSiteRefresh } from "@/lib/firebase/sites";
import {
  bundleByteLength,
  getActive,
  MAX_NOTEBOOKS_PER_SLOT,
  MAX_NOTEBOOK_TITLE_LEN,
} from "@/lib/vault/notebooks";
import {
  Check,
  CircleAlert,
  Clock,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { AddPasswordModal } from "./AddPasswordModal";
import { DeadmanModal } from "./DeadmanModal";
import { ExportMenu } from "./ExportMenu";
import { deadmanExpiresAt } from "@/lib/vault/deadman";
import { useNow } from "@/lib/utils/useNow";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const AUTO_SAVE_MS = 1500;

export function Editor() {
  const {
    open,
    updateActive,
    rename,
    add,
    remove,
    switchTo,
    move,
    updateAfterSave,
    syncFromServer,
    close,
  } = useVault();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [addPasswordOpen, setAddPasswordOpen] = useState(false);
  const [deadmanOpen, setDeadmanOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Serialization primitives for the save path. We deliberately do NOT
   * allow two saves to be in flight concurrently:
   *   - Firestore transactions are fine with two overlapping commits,
   *     but the *rule* evaluation against rapidly-changing doc state
   *     can produce subtle permission-denied errors that are very hard
   *     to reason about from the browser.
   *   - It also wastes bandwidth and Argon2 reuses nothing, so two
   *     back-to-back saves each re-encrypt the full 512 KiB blob.
   *
   * Instead: when a save is requested while one is in flight, we set
   * `pendingRef` and re-check on completion. This collapses any number
   * of rapid edits during a long save into one follow-up save.
   */
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  /**
   * Read the current vault state directly from the Zustand store
   * rather than from a React-synced ref. React state (via `useRef` +
   * `useEffect`) only settles after commit, so a user action that
   * mutates the store and then immediately calls `saveRef.current()`
   * inside the same event handler would otherwise race against the
   * effect that writes the new value into the ref and save a stale
   * bundle. The store is the source of truth, so we just ask it.
   */
  const getOpen = useCallback(() => useVault.getState().open, []);

  // Hoisting these out of the useMemo deps lets React only recompute
  // when the referenced sub-tree actually changes. `activeId` alone
  // (tab switch) is not a dep of any of these, so flipping tabs
  // stays free.
  const volume = open?.volume;
  const bundle = open?.bundle;
  const notebooks = bundle?.notebooks;
  const capacity = useMemo(
    () => (volume ? slotCapacity(volume) : 0),
    [volume],
  );
  const activeNotebook = useMemo(
    () => (bundle ? getActive(bundle) : null),
    [bundle],
  );
  // bundleByteLength JSON-stringifies all notebooks; memoizing on
  // `notebooks` (same ref unless structural/content change) means
  // switching tabs (which only mutates `activeId`) does NOT recompute.
  // `activeId` is a fixed-length nanoid, so the JSON byte count is
  // effectively a function of `notebooks` alone.
  const bundleBytes = useMemo(
    () => (notebooks ? bundleByteLength({ v: 1, notebooks, activeId: "" }) : 0),
    [notebooks],
  );

  // We expose `save` both to the auto-save effect and to the Save
  // button. Implemented as a ref-held function so that recursive
  // re-queueing on completion can call the *same* stable identity,
  // and so React Compiler doesn't fight us over memoization when the
  // closure references itself.
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  useEffect(() => {
    saveRef.current = async (): Promise<void> => {
      const current = getOpen();
      if (!current) return;

      if (inFlightRef.current) {
        // Coalesce: another save is running. Let it finish and then
        // re-save if this dirty state is still meaningful.
        pendingRef.current = true;
        return;
      }

      inFlightRef.current = true;
      pendingRef.current = false;
      setStatus({ kind: "saving" });

      try {
        const res = await saveVault({
          siteId: current.siteId,
          masterKey: current.masterKey,
          slotIndex: current.slotIndex,
          volume: current.volume,
          previousBlob: current.blob,
          expectedVersion: current.version,
          bundle: current.bundle,
        });

        if (res.kind === "saved") {
          updateAfterSave({ blob: res.blob, version: res.version });
          // Only clear dirty if no new edits arrived while we were
          // saving. New edits show up as either:
          //   - `pendingRef` (structural op called saveRef.current
          //     during the in-flight save)
          //   - a live debounce `saveTimer` (user kept typing; the
          //     scheduled debounced save hasn't fired yet)
          // Either signal means the beforeunload prompt should still
          // fire, and the scheduled/queued save will flush the rest.
          if (!pendingRef.current && !saveTimer.current) {
            dirtyRef.current = false;
          }
          setStatus({ kind: "saved", at: Date.now() });
          return;
        }

        if (res.kind === "too-large") {
          setStatus({
            kind: "error",
            message: `This slot is full. Trim the notebooks — max ${res.maxBytes.toLocaleString()} bytes across all tabs.`,
          });
          return;
        }

        if (res.kind === "conflict") {
          // Another writer incremented the version between our last
          // save and now. Refetch to resync, and queue a retry once
          // we've merged the new blob/version/deadman. In the common
          // case (same user, two tabs, only one actively editing)
          // this is fully transparent.
          try {
            const fresh = await fetchSiteRefresh(current.siteId);
            if (fresh) {
              syncFromServer({
                blob: fresh.ciphertext,
                version: fresh.version,
                deadman: fresh.deadman,
              });
              // If the refresh revealed that the dead-man's switch
              // fired in the meantime, don't chain another save —
              // the server will just reject it again. The readOnly
              // banner will light up once React re-renders.
              if (fresh.deadman?.released) {
                setStatus({
                  kind: "error",
                  message:
                    "This vault was handed over to its beneficiary while you were editing. No further writes accepted.",
                });
                return;
              }
              pendingRef.current = true;
            } else {
              setStatus({
                kind: "error",
                message: "This vault was deleted on the server.",
              });
              return;
            }
          } catch {
            setStatus({
              kind: "error",
              message:
                "This vault was edited elsewhere. Reload to see the latest version.",
            });
          }
        }
      } catch (e) {
        // Most commonly: a Firestore permission-denied because the
        // security rules rejected the write (e.g. the dead-man's
        // switch released the vault while we were editing). Surface
        // a concise message and keep the local edits; the user can
        // retry or reload to see the released state.
        const err = e as { code?: string; message?: string };
        const msg =
          err?.code === "permission-denied"
            ? "Save rejected by the server. If you configured a trusted handover, it may have already handed this vault over to its beneficiary. Reload to refresh."
            : (err?.message ?? "Save failed.");
        setStatus({ kind: "error", message: msg });
      } finally {
        inFlightRef.current = false;
        // If any edits came in while we were saving, chain one more
        // save. We don't re-chain on error to avoid tight retry loops.
        if (
          pendingRef.current &&
          dirtyRef.current &&
          getOpen()
        ) {
          pendingRef.current = false;
          // Defer to a microtask so React has a chance to flush any
          // pending state updates (notably the syncFromServer patch).
          queueMicrotask(() => {
            void saveRef.current();
          });
        }
      }
    };
  }, [updateAfterSave, syncFromServer, getOpen]);

  /**
   * Save-scheduling helpers.
   *
   * The product rule is:
   *   - Typing inside the active notebook ⇒ debounced autosave
   *     (AUTO_SAVE_MS). Cheap to batch; the user is actively editing
   *     and we don't want to commit on every keystroke.
   *   - Tab operations (add, delete, rename, reorder) ⇒ flush now.
   *     These are discrete, intentional commits; there is no value in
   *     waiting, and it's jarring if a tab you just renamed shows
   *     "Saving…" 1.5 s later when you've already moved on.
   *   - Tab switch ⇒ does not touch save state at all. The debounced
   *     save from prior typing is preserved and will fire on its own.
   */
  const scheduleDebouncedSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveRef.current();
    }, AUTO_SAVE_MS);
  }, []);

  const flushSaveNow = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void saveRef.current();
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (!open || !activeNotebook) return null;

  const pct = Math.min(100, Math.round((bundleBytes / capacity) * 100));
  const readOnly = open.beneficiary || open.deadman?.released === true;
  // A save is in flight when the status banner says "saving". The
  // inner editor area uses this to show a non-blocking spinner that
  // communicates "we're syncing" without stealing focus from the
  // textarea.
  const isSaving = status.kind === "saving";

  const onAdd = () => {
    if (readOnly) return;
    if (open.bundle.notebooks.length >= MAX_NOTEBOOKS_PER_SLOT) return;
    add();
    flushSaveNow();
  };

  const onDelete = (id: string) => {
    if (readOnly) return;
    if (open.bundle.notebooks.length <= 1) return;
    remove(id);
    setConfirmDelete(null);
    flushSaveNow();
  };

  const onRename = (id: string, title: string) => {
    if (readOnly) return;
    rename(id, title);
    setRenameTarget(null);
    flushSaveNow();
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
      {readOnly ? (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          {open.beneficiary
            ? "Beneficiary view: this vault was handed over to you because the owner stopped checking in. You can read but not modify it."
            : "This vault has been handed over to its beneficiary and is locked against further writes. To start fresh, create a new vault under a new URL."}
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
                title="Set up a trusted handover: hand this vault over to a beneficiary if you stop checking in for a configurable interval"
              >
                <Clock size={14} /> Handover
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAddPasswordOpen(true)}
                title="Register another password that opens a different notebook on this URL"
              >
                <KeyRound size={14} /> Add password
              </Button>
            </>
          ) : null}
          {/* Export stays available in read-only (beneficiary / released)
              views too so the holder can still archive or migrate. */}
          <ExportMenu />
          {!readOnly ? (
            <Button variant="secondary" size="sm" onClick={flushSaveNow}>
              <Save size={14} /> Save
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={close}>
            <LogOut size={14} /> Lock
          </Button>
        </div>
      </div>

      <TabBar
        notebooks={open.bundle.notebooks}
        activeId={open.bundle.activeId}
        readOnly={readOnly}
        onSwitch={switchTo}
        onAdd={onAdd}
        onRequestRename={setRenameTarget}
        onRequestDelete={setConfirmDelete}
        onReorder={(from, to) => {
          if (readOnly) return;
          if (from === to) return;
          move(from, to);
          flushSaveNow();
        }}
      />

      {/* Relative wrapper so the sync indicator can sit in the corner
          of the textarea without pushing layout around. */}
      <div className="relative flex-1">
        <textarea
          key={activeNotebook.id}
          value={activeNotebook.content}
          onChange={(e) => {
            if (readOnly) return;
            updateActive(e.target.value);
            scheduleDebouncedSave();
          }}
          onKeyDown={(e) => {
            if (
              !readOnly &&
              (e.metaKey || e.ctrlKey) &&
              e.key.toLowerCase() === "s"
            ) {
              e.preventDefault();
              flushSaveNow();
            }
          }}
          spellCheck={false}
          readOnly={readOnly}
          placeholder={
            readOnly
              ? ""
              : "Start typing. Auto-saves to an encrypted slot every second or so."
          }
          className="h-[62vh] w-full resize-none rounded-b-xl rounded-tr-xl border-2 border-t-0 border-border bg-background-elev p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {isSaving ? (
          <span
            className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background-elev-2/95 px-2.5 py-1 text-[11px] text-muted shadow-sm backdrop-blur"
            aria-live="polite"
            aria-label="Syncing"
            title="Encrypting and uploading this slot"
          >
            <Loader2 size={11} className="animate-spin" /> Syncing
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>
          Slot {open.slotIndex + 1} of {open.volume.slotCount} &middot;{" "}
          {open.bundle.notebooks.length}{" "}
          {open.bundle.notebooks.length === 1 ? "notebook" : "notebooks"}{" "}
          &middot; version {open.version}
        </span>
        <span className={pct > 90 ? "text-danger" : ""}>
          {bundleBytes.toLocaleString()} / {capacity.toLocaleString()} bytes ({pct}%)
        </span>
      </div>

      {renameTarget ? (
        <RenameDialog
          initialTitle={
            open.bundle.notebooks.find((n) => n.id === renameTarget)?.title ?? ""
          }
          onClose={() => setRenameTarget(null)}
          onSubmit={(t) => onRename(renameTarget, t)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDeleteDialog
          title={
            open.bundle.notebooks.find((n) => n.id === confirmDelete)?.title ??
            "this notebook"
          }
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => onDelete(confirmDelete)}
        />
      ) : null}

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

interface TabBarProps {
  notebooks: { id: string; title: string }[];
  activeId: string;
  readOnly: boolean;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRequestRename: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * Drag-to-reorder: uses the native HTML5 drag API rather than a heavier
 * DnD library, because tabs are a simple one-dimensional list and
 * native drag is already keyboard-accessible in every mainstream
 * browser. We track the source index in `dragFrom` and the current
 * hover target in `dragOver`, and commit on drop.
 *
 * The `data-dragging` / `data-dropzone` attributes drive the subtle
 * visual feedback in CSS. We intentionally avoid `setDragImage` or
 * custom ghosts &mdash; the default browser ghost is fine and removes
 * a whole class of platform-specific bugs.
 */
function TabBar({
  notebooks,
  activeId,
  readOnly,
  onSwitch,
  onAdd,
  onRequestRename,
  onRequestDelete,
  onReorder,
}: TabBarProps) {
  const canAdd = notebooks.length < MAX_NOTEBOOKS_PER_SLOT;
  const canDelete = notebooks.length > 1;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const canReorder = !readOnly && notebooks.length > 1;

  return (
    <div
      role="tablist"
      className="mt-4 flex items-end gap-1 overflow-x-auto border-b-2 border-border pb-0"
    >
      {notebooks.map((n, idx) => {
        const active = n.id === activeId;
        const isDragSource = dragFrom === idx;
        const isDropTarget =
          dragOver === idx && dragFrom !== null && dragFrom !== idx;
        // Active tabs sit on top of the bar and "connect" into the
        // textarea below by sharing its background + hiding their
        // bottom border with a -2px offset onto the parent bar.
        // Inactive tabs stay visibly bounded so the list of notebooks
        // reads as a set of discrete cards.
        const tabBase =
          "group relative flex shrink-0 items-center gap-1 rounded-t-md border-2 border-b-0 px-3 py-2 text-xs font-medium transition-colors";
        // Active tab: accent-colored top border, matching textarea
        // background, and a -2px negative margin to tuck under the
        // tablist's 2px bottom border, creating a "connected folder
        // tab" look. Inactive tabs stay visibly boxed and dimmer.
        const tabTone = active
          ? "z-10 -mb-[2px] border-border border-t-accent bg-background-elev text-foreground"
          : "border-border/60 bg-background-elev-2/60 text-muted hover:border-border hover:bg-background-elev hover:text-foreground";
        return (
          <div
            key={n.id}
            role="tab"
            aria-selected={active}
            draggable={canReorder}
            onDragStart={(e) => {
              if (!canReorder) return;
              setDragFrom(idx);
              // Firefox ignores drag unless setData is called.
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(idx));
            }}
            onDragOver={(e) => {
              if (!canReorder || dragFrom === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOver !== idx) setDragOver(idx);
            }}
            onDragLeave={() => {
              if (dragOver === idx) setDragOver(null);
            }}
            onDrop={(e) => {
              if (!canReorder || dragFrom === null) return;
              e.preventDefault();
              onReorder(dragFrom, idx);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            className={`${tabBase} ${tabTone} ${
              isDragSource ? "opacity-40" : ""
            } ${
              isDropTarget ? "ring-2 ring-accent/60" : ""
            } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <button
              type="button"
              onClick={() => onSwitch(n.id)}
              onDoubleClick={() => !readOnly && onRequestRename(n.id)}
              className="max-w-[180px] truncate text-left focus:outline-none"
              title={canReorder ? `${n.title} (drag to reorder)` : n.title}
            >
              {n.title}
            </button>
            {!readOnly ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestRename(n.id);
                  }}
                  aria-label="Rename notebook"
                  className="ml-1 rounded p-1 text-muted/80 transition hover:bg-background-elev-2 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-accent/60"
                  title="Rename"
                >
                  <Pencil size={12} />
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete(n.id);
                    }}
                    aria-label="Delete notebook"
                    className="rounded p-1 text-muted/80 transition hover:bg-danger/15 hover:text-danger focus:outline-none focus:ring-1 focus:ring-danger/60"
                    title="Delete"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })}
      {!readOnly && canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add notebook"
          className="inline-flex shrink-0 items-center gap-1 rounded-t-md border-2 border-dashed border-border/60 border-b-0 px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:bg-background-elev hover:text-foreground"
          title="New notebook"
        >
          <Plus size={12} /> New
        </button>
      ) : null}
    </div>
  );
}

function RenameDialog({
  initialTitle,
  onSubmit,
  onClose,
}: {
  initialTitle: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-border bg-background-elev p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(title);
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Pencil size={14} className="text-accent" /> Rename notebook
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_NOTEBOOK_TITLE_LEN}
          className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          placeholder="Notebook name"
        />
        <p className="mt-2 text-xs text-muted">
          Only stored inside this slot &mdash; visible only to someone who
          already has this password.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save name
          </Button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background-elev p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Trash2 size={14} className="text-danger" /> Delete notebook
        </div>
        <p className="mt-3 text-sm text-muted">
          Delete <span className="font-medium text-foreground">{title}</span>?
          This removes the tab and its contents. The change takes effect on the
          next save and cannot be undone once saved.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
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
        title="This vault has been handed over to its beneficiary."
      >
        <CircleAlert size={12} /> Handed over
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
      title={`Trusted handover active. Hands over ${
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
