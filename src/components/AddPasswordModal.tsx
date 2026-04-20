"use client";

import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useVault } from "@/lib/store/vault";
import { addDecoyPassword } from "@/lib/vault/service";
import { slotCapacity } from "@/lib/crypto/volume";
import { AlertTriangle, Eye, EyeOff, KeyRound, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase =
  | { kind: "form" }
  | { kind: "working" }
  | { kind: "error"; message: string }
  | { kind: "done"; slotIndex: number };

export function AddPasswordModal({ open, onClose }: Props) {
  const { open: vault, updateAfterSave } = useVault();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [content, setContent] = useState("");
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  const reset = () => {
    setPassword("");
    setConfirm("");
    setContent("");
    setShow(false);
    setPhase({ kind: "form" });
  };

  const close = () => {
    onClose();
    // Delay reset so closing animation doesn't flash cleared state.
    setTimeout(reset, 120);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    if (password.length < 8) {
      setPhase({
        kind: "error",
        message: "Choose at least 8 characters for the new password.",
      });
      return;
    }
    if (password !== confirm) {
      setPhase({ kind: "error", message: "Passwords do not match." });
      return;
    }
    if (password === "") {
      setPhase({ kind: "error", message: "Enter a password." });
      return;
    }
    setPhase({ kind: "working" });
    const res = await addDecoyPassword({
      siteId: vault.siteId,
      currentBlob: vault.blob,
      currentVersion: vault.version,
      currentSlotIndex: vault.slotIndex,
      kdfSalt: vault.kdfSalt,
      volume: vault.volume,
      newPassword: password,
      newContent: content,
    });
    if (res.kind === "added") {
      // We only changed a different slot; our own bundle is unchanged.
      // Just refresh the blob + version so the next local save doesn't
      // race the optimistic-concurrency guard.
      updateAfterSave({
        blob: res.blob,
        version: res.version,
      });
      setPhase({ kind: "done", slotIndex: res.slotIndex });
      return;
    }
    if (res.kind === "collides-with-current") {
      setPhase({
        kind: "error",
        message:
          "That password would overwrite the notebook you're currently viewing. Pick a different password.",
      });
      return;
    }
    if (res.kind === "already-set-up") {
      setPhase({
        kind: "error",
        message: `That password is already registered on this vault (slot ${res.slotIndex + 1}).`,
      });
      return;
    }
    if (res.kind === "too-large") {
      setPhase({
        kind: "error",
        message: `Initial content too long. Max ${res.maxBytes.toLocaleString()} bytes.`,
      });
      return;
    }
    if (res.kind === "conflict") {
      setPhase({
        kind: "error",
        message:
          "Your local copy of the vault is stale. Reload and try again.",
      });
      return;
    }
  };

  if (!vault) return null;
  const cap = slotCapacity(vault.volume);
  const bytes = new Blob([content]).size;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add another password"
      description="Give this vault a second (or third, or tenth) notebook, each unlocked by its own password."
    >
      {phase.kind === "done" ? (
        <DoneScreen slotIndex={phase.slotIndex} onClose={close} />
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <WhyPanel />

          <Field label="New password">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Something you won't forget"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-muted hover:text-foreground"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <Field label="Confirm password">
            <Input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              autoComplete="new-password"
            />
          </Field>

          <Field
            label="Initial content for this notebook"
            hint={`${bytes.toLocaleString()} / ${cap.toLocaleString()} bytes`}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Optional. Handy if you're creating a decoy — put some believable notes here."
              spellCheck={false}
              rows={4}
              className="w-full resize-y rounded-lg border border-border bg-background-elev-2 p-3 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </Field>

          {phase.kind === "error" ? (
            <p className="text-xs text-danger">{phase.message}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={phase.kind === "working"}>
              {phase.kind === "working" ? (
                "Adding…"
              ) : (
                <>
                  <KeyRound size={14} /> Add password
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function WhyPanel() {
  return (
    <div className="rounded-lg border border-border bg-background-elev-2 p-3 text-[12px] leading-relaxed text-muted">
      <div className="flex items-center gap-2 text-foreground">
        <AlertTriangle size={14} className="text-accent" />
        <span className="font-medium">A few things to know</span>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Each password unlocks its own notebook. You choose which is &ldquo;real&rdquo;
          and which is a decoy &mdash; Flowvault cannot tell.
        </li>
        <li>
          Passwords hash into 1 of 64 slots. If two passwords land in the
          same slot (~1.6% per pair), one will overwrite the other. If that
          happens, just try a different password.
        </li>
        <li>
          Your current notebook is safe: Flowvault refuses to register a
          password whose slot would overwrite the one you&apos;re using now.
        </li>
      </ul>
    </div>
  );
}

function DoneScreen({
  slotIndex,
  onClose,
}: {
  slotIndex: number;
  onClose: () => void;
}) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
        <Check size={20} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        Password registered
      </h3>
      <p className="mt-2 text-sm text-muted">
        A new notebook now lives in slot {slotIndex + 1}. Open it any time by
        unlocking this URL with that password. Flowvault will not remember it
        for you &mdash; store it somewhere safe.
      </p>
      <div className="mt-5 flex justify-center">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        {hint ? <span className="font-mono">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}
