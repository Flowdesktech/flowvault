"use client";

/**
 * Route-level shell for a local-file-backed (BYOS) vault.
 *
 * Mirrors `VaultView` for Firestore vaults, but with extra work at the
 * top: we need a `FileSystemFileHandle` before we can even decide
 * whether the vault exists. There are three ways one can arrive here:
 *
 *   1. Freshly created/opened from the home page. The caller passed a
 *      ready-to-use `initialHandle` via a session-scoped handoff, and
 *      in some cases already has a decrypted `OpenVault` snapshot ready
 *      to install (the create flow). We short-circuit most of the
 *      below.
 *
 *   2. Returning to a known localSiteId (bookmark, reload). The handle
 *      lives in IndexedDB; we recall it and prompt for read/write
 *      permission (required once per session by the spec).
 *
 *   3. The handle was lost (different browser profile, cleared storage,
 *      user revoked). We render a "Locate your vault file" card that
 *      invokes `showOpenFilePicker` so the user can re-bind the same
 *      file to this URL.
 *
 * All three funnel into the same password gate, which in turn calls
 * into `tryOpenLocalVault` / `createLocalVault` in the service layer.
 *
 * BYOS vaults have no hosted deadman sweep, so the "released" phase
 * that `VaultView` handles is not reachable here.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./Editor";
import { PasswordGate } from "./PasswordGate";
import { Button } from "./ui/Button";
import { useVault } from "@/lib/store/vault";
import {
  tryOpenLocalVault,
  type OpenResult,
} from "@/lib/vault/service";
import {
  ensurePermission,
  getMeta,
  isFileSystemAccessSupported,
  recallHandle,
} from "@/lib/storage/localFile/handleRegistry";
import {
  decodeLocalVaultFile,
  looksLikeLocalVaultFile,
} from "@/lib/storage/localFile/format";
import { takeLocalVaultHandoff } from "@/lib/storage/localFile/handoff";
import { FolderOpen, HardDrive, TriangleAlert } from "lucide-react";

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}
interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}
type PickerWindow = typeof window & {
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
};
const FLOWVAULT_FILE_TYPE: FilePickerAcceptType = {
  description: "Flowvault local vault",
  accept: { "application/octet-stream": [".flowvault"] },
};

type Phase =
  | { kind: "probing" }
  | { kind: "needs-handle"; reason: "unknown" | "permission-denied" | "moved" }
  | { kind: "unsupported" }
  | { kind: "error"; message: string }
  | { kind: "needs-password"; handle: FileSystemFileHandle; exists: true }
  | { kind: "open" };

export function LocalVaultView({ localSiteId }: { localSiteId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "probing" });
  const [working, setWorking] = useState(false);
  // Friendly file name for chrome (the handle's `.name` survives
  // IndexedDB storage, so we can pull it even before prompting).
  const [fileName, setFileName] = useState<string | null>(null);
  const { open, setOpen } = useVault();
  const didHandoffRef = useRef(false);

  // Run the bootstrap sequence once per siteId. The dance:
  //   1. If the home page handed us a pre-decrypted vault, install it.
  //   2. Otherwise, recall the handle from IndexedDB (if we have one).
  //   3. Verify/request the read+write permission.
  //   4. Peek the file to confirm the siteId matches.
  //   5. Show the password gate.
  //
  // Intentional: we do NOT call `close()` or
  // `unregisterVaultStorageAdapter()` from any cleanup here. React
  // StrictMode in dev double-invokes every effect's cleanup between
  // the first and second mount; if we cleared the store on the first
  // pseudo-unmount, the `setOpen(handoff.opened)` from the create path
  // would be erased before the second mount had a chance to re-read
  // the (already-popped) handoff. Teardown lives in the user-initiated
  // Lock button instead, where double-fire is harmless. The adapter
  // override and in-memory store are both overwritten the next time a
  // vault is opened, so not tearing them down here is a minor
  // heap-until-tab-close footprint rather than a correctness issue.
  useEffect(() => {
    if (didHandoffRef.current) return;
    didHandoffRef.current = true;

    let cancelled = false;
    (async () => {
      if (!isFileSystemAccessSupported()) {
        setPhase({ kind: "unsupported" });
        return;
      }

      // (1) direct handoff from the home page.
      const handoff = takeLocalVaultHandoff(localSiteId);
      if (handoff) {
        setFileName(handoff.handle.name);
        if (handoff.opened) {
          // Create path: the home page already decrypted the fresh vault
          // and handed us the OpenResult. Install it and we're done.
          setOpen(toVault(handoff.opened, false));
          setPhase({ kind: "open" });
          return;
        }
        // Open-existing path: handle is valid, but we still need a
        // password from the user to unlock.
        setPhase({ kind: "needs-password", handle: handoff.handle, exists: true });
        return;
      }

      // (2) recall from IndexedDB.
      const recalled = await recallHandle(localSiteId);
      if (cancelled) return;
      if (!recalled) {
        const meta = await getMeta(localSiteId);
        if (!cancelled && meta) setFileName(meta.fileName);
        if (!cancelled) setPhase({ kind: "needs-handle", reason: "unknown" });
        return;
      }
      setFileName(recalled.name);

      // (3) permission prompt.
      const granted = await ensurePermission(recalled, "readwrite");
      if (cancelled) return;
      if (!granted) {
        setPhase({ kind: "needs-handle", reason: "permission-denied" });
        return;
      }

      // (4) sanity-check that the file at the end of this handle is
      // actually the vault we think it is. Users can rename/move files
      // between sessions; catching a mismatch here gives a better
      // error than letting the adapter throw on first read.
      try {
        const file = await recalled.getFile();
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        if (bytes.length === 0 || !looksLikeLocalVaultFile(bytes)) {
          setPhase({ kind: "needs-handle", reason: "moved" });
          return;
        }
        const parsed = decodeLocalVaultFile(bytes);
        if (parsed.localSiteId !== localSiteId) {
          setPhase({ kind: "needs-handle", reason: "moved" });
          return;
        }
      } catch (e) {
        if (cancelled) return;
        setPhase({
          kind: "error",
          message: (e as Error).message ?? "Could not read the vault file.",
        });
        return;
      }

      // (5) ready for the password.
      setPhase({ kind: "needs-password", handle: recalled, exists: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [localSiteId, setOpen]);

  const pickHandle = useCallback(async () => {
    try {
      const w = window as PickerWindow;
      if (!w.showOpenFilePicker) {
        setPhase({
          kind: "error",
          message: "This browser does not expose the file picker.",
        });
        return;
      }
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        types: [FLOWVAULT_FILE_TYPE],
      });
      const granted = await ensurePermission(handle, "readwrite");
      if (!granted) {
        setPhase({ kind: "needs-handle", reason: "permission-denied" });
        return;
      }
      // Validate that the user actually pointed us at the right vault.
      const file = await handle.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length === 0 || !looksLikeLocalVaultFile(bytes)) {
        setPhase({
          kind: "error",
          message:
            "That file is not a Flowvault local vault. Pick a different file.",
        });
        return;
      }
      const parsed = decodeLocalVaultFile(bytes);
      if (parsed.localSiteId !== localSiteId) {
        setPhase({
          kind: "error",
          message:
            "That file is a different local vault than the one this URL refers to. Pick the right file or return to the home page.",
        });
        return;
      }
      setFileName(handle.name);
      setPhase({ kind: "needs-password", handle, exists: true });
    } catch (e) {
      // AbortError: user closed the picker. Stay in whatever state we
      // were in and say nothing noisy.
      if ((e as DOMException)?.name === "AbortError") return;
      setPhase({
        kind: "error",
        message: (e as Error).message ?? "Could not open the file.",
      });
    }
  }, [localSiteId]);

  const submitPassword = useCallback(
    async (password: string) => {
      if (phase.kind !== "needs-password") return;
      setWorking(true);
      try {
        const res = await tryOpenLocalVault({
          handle: phase.handle,
          password,
        });
        if (res.kind === "opened") {
          setOpen(toVault(res, false));
          setPhase({ kind: "open" });
          return;
        }
        if (res.kind === "not-found") {
          // The file emptied out between recall and unlock. Extremely
          // rare; best response is to re-offer the picker.
          setPhase({ kind: "needs-handle", reason: "moved" });
          return;
        }
        return { error: "Wrong password." as const };
      } catch (e) {
        return { error: (e as Error).message ?? "Could not unlock." };
      } finally {
        setWorking(false);
      }
    },
    [phase, setOpen],
  );

  if (phase.kind === "probing") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-20">
        <p className="text-sm text-muted">Locating local vault…</p>
      </main>
    );
  }

  if (phase.kind === "unsupported") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center px-4 py-20">
        <UnsupportedCard />
      </main>
    );
  }

  if (phase.kind === "error") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-20">
        <p className="text-sm text-danger">{phase.message}</p>
      </main>
    );
  }

  if (phase.kind === "needs-handle") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center px-4 py-20">
        <LocateCard
          reason={phase.reason}
          fileName={fileName}
          onPick={pickHandle}
        />
      </main>
    );
  }

  if (phase.kind === "needs-password") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-20">
        <PasswordGate
          slug=""
          exists={phase.exists}
          busy={working}
          onSubmit={submitPassword}
          displayOverride={`local: ${phase.handle.name}`}
          descriptionOverride={
            <>
              Enter the password for this local vault. The file on disk
              is the entire storage &mdash; nothing about this unlock
              touches Flowvault&apos;s servers. Different passwords may
              unlock different notebooks inside the same file; nobody
              can tell which is &ldquo;real.&rdquo;
            </>
          }
        />
      </main>
    );
  }

  if (!open) return null;
  return <Editor />;
}

function toVault(r: OpenResult, beneficiary: boolean) {
  return {
    slug: r.slug,
    siteId: r.siteId,
    storageKind: r.storageKind,
    displayLabel: r.displayLabel,
    slotIndex: r.slotIndex,
    masterKey: r.masterKey,
    kdfSalt: r.kdfSalt,
    volume: r.volume,
    blob: r.blob,
    version: r.version,
    bundle: r.bundle,
    deadman: r.deadman,
    beneficiary,
  };
}

function UnsupportedCard() {
  return (
    <div className="rounded-2xl border border-border bg-background-elev p-6 text-sm">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <TriangleAlert size={16} className="text-warning" />
        Local vaults need a Chromium browser
      </div>
      <p className="mt-3 leading-relaxed text-muted">
        This browser does not expose the File System Access API. Try
        Chrome, Edge, Brave, or Arc, or switch to a hosted vault on the{" "}
        <Link href="/" className="text-accent hover:underline">
          home page
        </Link>
        .
      </p>
    </div>
  );
}

function LocateCard({
  reason,
  fileName,
  onPick,
}: {
  reason: "unknown" | "permission-denied" | "moved";
  fileName: string | null;
  onPick: () => void;
}) {
  const title =
    reason === "permission-denied"
      ? "Grant access to continue"
      : reason === "moved"
        ? "Find this vault's file"
        : "Locate your local vault";
  const body =
    reason === "permission-denied" ? (
      <>
        This browser prompts for file access once per session. Grant
        read &amp; write permission on{" "}
        <span className="font-mono text-foreground">
          {fileName ?? "the file"}
        </span>{" "}
        to open the vault.
      </>
    ) : reason === "moved" ? (
      <>
        The file we had on record for this URL is gone or has been
        replaced with something else. Pick the{" "}
        <span className="font-mono text-foreground">.flowvault</span>{" "}
        file that belongs to this vault to re-bind it.
      </>
    ) : (
      <>
        This browser profile has never seen this local vault. Pick the{" "}
        <span className="font-mono text-foreground">.flowvault</span>{" "}
        file on disk and we&apos;ll remember it on this device.
      </>
    );

  return (
    <div className="w-full rounded-2xl border border-border bg-background-elev p-6 shadow-lg shadow-black/30">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent">
          <HardDrive size={18} />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Local vault
          </p>
          <p className="text-sm text-foreground">{title}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">{body}</p>
      <Button size="lg" className="mt-5 w-full" onClick={onPick}>
        <FolderOpen size={16} /> Pick file
      </Button>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Handles are stored only in this browser profile and never leave
        your device. No server request is made to open the file.
      </p>
    </div>
  );
}
