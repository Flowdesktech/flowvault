"use client";

/**
 * Home-page entry point for the Bring-Your-Own-Storage (BYOS)
 * local-file backend.
 *
 * Two actions:
 *
 *   - "Create local vault": `showSaveFilePicker` to pick a new file,
 *     prompt for a password inline, decrypt-ready vault is minted on
 *     the spot, then we navigate to `/local/<newSiteId>` with the
 *     already-decrypted state handed off in-memory so the editor
 *     opens immediately without re-prompting.
 *
 *   - "Open local vault": `showOpenFilePicker` to pick an existing
 *     `.flowvault` file, peek its header to learn the `localSiteId`,
 *     and navigate to `/local/<existingSiteId>`. The route itself
 *     takes over the password prompt.
 *
 * This component does not hold or cache master keys, passphrases, or
 * handles across renders: everything lives inside the async handlers
 * that fire from user clicks, and the decrypted output is transferred
 * to the `/local/<id>` route via the `handoff` module.
 */
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, HardDrive, Lock, Plus } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { createLocalVault } from "@/lib/vault/service";
import { stashLocalVaultHandoff } from "@/lib/storage/localFile/handoff";
import {
  decodeLocalVaultFile,
  looksLikeLocalVaultFile,
} from "@/lib/storage/localFile/format";
import { isFileSystemAccessSupported } from "@/lib/storage/localFile/handleRegistry";

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}
interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}
type PickerWindow = typeof window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
};
const FLOWVAULT_FILE_TYPE: FilePickerAcceptType = {
  description: "Flowvault local vault",
  accept: { "application/octet-stream": [".flowvault"] },
};

type Modal =
  | { kind: "none" }
  | { kind: "create"; handle: FileSystemFileHandle }
  | { kind: "error"; message: string };

export function LocalVaultEntry() {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [busy, setBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && isFileSystemAccessSupported();

  const reset = useCallback(() => {
    setPassword("");
    setConfirm("");
    setFormErr(null);
  }, []);

  const onCreateClick = useCallback(async () => {
    try {
      const w = window as PickerWindow;
      if (!w.showSaveFilePicker) {
        setModal({
          kind: "error",
          message: "This browser does not expose the save-file picker.",
        });
        return;
      }
      const handle = await w.showSaveFilePicker({
        suggestedName: "my-vault.flowvault",
        types: [FLOWVAULT_FILE_TYPE],
      });
      reset();
      setModal({ kind: "create", handle });
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      setModal({
        kind: "error",
        message: (e as Error).message ?? "Could not pick a file.",
      });
    }
  }, [reset]);

  const onOpenClick = useCallback(async () => {
    try {
      const w = window as PickerWindow;
      if (!w.showOpenFilePicker) {
        setModal({
          kind: "error",
          message: "This browser does not expose the file picker.",
        });
        return;
      }
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        types: [FLOWVAULT_FILE_TYPE],
      });
      const file = await handle.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length === 0 || !looksLikeLocalVaultFile(bytes)) {
        setModal({
          kind: "error",
          message:
            "That file is not a Flowvault local vault. If you meant to restore a .fvault backup, use the Restore page.",
        });
        return;
      }
      const parsed = decodeLocalVaultFile(bytes);
      // Hand off the handle to /local/<id>; the route prompts for the
      // password and runs `tryOpenLocalVault` itself. We don't ask for
      // the password here because a wrong-password retry is cheaper
      // on a route that already has UI state for it.
      stashLocalVaultHandoff(parsed.localSiteId, { handle });
      router.push(`/local/${encodeURIComponent(parsed.localSiteId)}`);
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      setModal({
        kind: "error",
        message: (e as Error).message ?? "Could not open the file.",
      });
    }
  }, [router]);

  const submitCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (modal.kind !== "create") return;
      if (!password) {
        setFormErr("Enter a password.");
        return;
      }
      if (password !== confirm) {
        setFormErr("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setFormErr("Choose at least 8 characters for a new vault.");
        return;
      }
      setFormErr(null);
      setBusy(true);
      try {
        const opened = await createLocalVault({
          handle: modal.handle,
          password,
        });
        stashLocalVaultHandoff(opened.siteId, {
          handle: modal.handle,
          opened,
        });
        router.push(`/local/${encodeURIComponent(opened.siteId)}`);
      } catch (err) {
        setFormErr((err as Error).message ?? "Could not create vault.");
      } finally {
        setBusy(false);
      }
    },
    [modal, password, confirm, router],
  );

  return (
    <>
      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCreateClick}
          disabled={!supported}
          title={
            supported
              ? "Store the vault as a .flowvault file on this device"
              : "Local vaults require a Chromium-based browser"
          }
        >
          <HardDrive size={14} /> Create local vault
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenClick}
          disabled={!supported}
          title={
            supported
              ? "Open an existing .flowvault file"
              : "Local vaults require a Chromium-based browser"
          }
        >
          <FolderOpen size={14} /> Open local vault
        </Button>
      </div>
      {!supported ? (
        <p className="mt-2 text-center text-[11px] text-muted">
          Local vaults need the File System Access API. Works in Chrome,
          Edge, Brave, Arc. Hosted vaults work everywhere.
        </p>
      ) : null}

      {modal.kind === "create" ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => !busy && setModal({ kind: "none" })}
        >
          <form
            className="w-full max-w-sm rounded-2xl border border-border bg-background-elev p-6 shadow-lg shadow-black/30"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitCreate}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent">
                <Plus size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">
                  New local vault
                </p>
                <p className="text-sm text-foreground">
                  {modal.handle.name}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Pick a password. The entire vault lives in this file on your
              device &mdash; our servers never see the ciphertext, salt,
              or password. Lose the file or the password and your notes
              are unrecoverable.
            </p>
            <div className="mt-5 space-y-3">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="new-password"
                autoFocus
              />
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              {formErr ? (
                <p className="text-xs text-danger">{formErr}</p>
              ) : null}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="flex-1"
                  onClick={() => setModal({ kind: "none" })}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  disabled={busy}
                >
                  <Lock size={16} />
                  {busy ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {modal.kind === "error" ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setModal({ kind: "none" })}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-background-elev p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-danger">{modal.message}</p>
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModal({ kind: "none" })}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
