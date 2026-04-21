"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileDown, FileLock2, FileText } from "lucide-react";
import { Button } from "./ui/Button";
import { useVault } from "@/lib/store/vault";
import {
  buildBackupFromOpenVault,
} from "@/lib/vault/service";
import {
  encodeBackup,
  suggestedBackupFilename,
} from "@/lib/vault/portable";
import {
  buildMarkdownZip,
  suggestedMarkdownZipFilename,
} from "@/lib/vault/exportMarkdown";

/**
 * Trigger a client-side download of `bytes` as `filename`. Revokes the
 * object URL on the next tick so long-lived tabs don't leak blob URLs.
 */
function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime: string,
): void {
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Editor-toolbar export dropdown. Exposes two distinct actions:
 *
 * 1. "Encrypted backup (.fvault)" — always safe. The file is the
 *    entire fixed-size ciphertext plus KDF/volume metadata; reading
 *    it still requires the password. Intended for cold backup or
 *    migrating to a self-hosted Flowvault.
 *
 * 2. "Plaintext Markdown (.zip)" — intentionally moves data out of
 *    the zero-knowledge envelope. Only the currently-unlocked slot's
 *    tabs are included, never other slots' decoys. Requires an
 *    explicit confirmation click to avoid accidental plaintext
 *    dumps.
 *
 * The menu closes on outside click or Escape so it behaves like a
 * native menu without a heavy Popover library.
 */
export function ExportMenu() {
  const open = useVault((s) => s.open);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmPlain, setConfirmPlain] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!open) return null;

  const doEncryptedBackup = () => {
    const envelope = buildBackupFromOpenVault({
      slug: open.slug,
      ciphertext: open.blob,
      kdfSalt: open.kdfSalt,
      volume: open.volume,
    });
    const bytes = encodeBackup(envelope);
    downloadBytes(
      bytes,
      suggestedBackupFilename(open.slug),
      "application/json",
    );
    setMenuOpen(false);
  };

  const doPlaintextZip = () => {
    const bytes = buildMarkdownZip(open.bundle, open.slug);
    downloadBytes(
      bytes,
      suggestedMarkdownZipFilename(open.slug),
      "application/zip",
    );
    setConfirmPlain(false);
    setMenuOpen(false);
  };

  return (
    <>
      <div ref={rootRef} className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMenuOpen((v) => !v)}
          title="Export this vault"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Download size={14} /> Export
        </Button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-background-elev shadow-xl"
          >
            <button
              role="menuitem"
              onClick={doEncryptedBackup}
              className="flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition hover:bg-background-elev-2 focus:bg-background-elev-2 focus:outline-none"
            >
              <FileLock2 size={16} className="mt-0.5 text-accent" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  Encrypted backup (.fvault)
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted">
                  The full ciphertext plus KDF params. Still requires
                  your password to open. Safe to store anywhere.
                </div>
              </div>
            </button>
            <div className="h-px bg-border/70" />
            <button
              role="menuitem"
              onClick={() => setConfirmPlain(true)}
              className="flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition hover:bg-background-elev-2 focus:bg-background-elev-2 focus:outline-none"
            >
              <FileText size={16} className="mt-0.5 text-warning" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  Plaintext Markdown (.zip)
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted">
                  Current slot only ({open.bundle.notebooks.length}{" "}
                  {open.bundle.notebooks.length === 1 ? "tab" : "tabs"}).
                  Unencrypted — will ask for confirmation.
                </div>
              </div>
            </button>
          </div>
        ) : null}
      </div>
      {confirmPlain ? (
        <PlaintextConfirmDialog
          slug={open.slug}
          tabCount={open.bundle.notebooks.length}
          onCancel={() => setConfirmPlain(false)}
          onConfirm={doPlaintextZip}
        />
      ) : null}
    </>
  );
}

function PlaintextConfirmDialog({
  slug,
  tabCount,
  onCancel,
  onConfirm,
}: {
  slug: string;
  tabCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background-elev p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileDown size={14} className="text-warning" /> Plaintext export
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This downloads the {tabCount}{" "}
          {tabCount === 1 ? "notebook" : "notebooks"} in the currently
          unlocked slot of{" "}
          <span className="font-mono text-foreground">/s/{slug}</span>{" "}
          as unencrypted Markdown files.
        </p>
        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
          <li>
            &middot; Other slots (other passwords) are <b>not</b> included.
          </li>
          <li>
            &middot; Anyone with access to the resulting file can read
            these notes.
          </li>
          <li>
            &middot; Your vault itself stays untouched.
          </li>
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            <FileText size={14} /> Download .zip
          </Button>
        </div>
      </div>
    </div>
  );
}
