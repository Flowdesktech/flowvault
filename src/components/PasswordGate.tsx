"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Eye, EyeOff, Lock } from "lucide-react";

interface Props {
  slug: string;
  exists: boolean;
  busy: boolean;
  onSubmit: (password: string) => Promise<{ error: string } | void>;
  /**
   * When set, the subtitle under "Unlock / Create vault" renders this
   * exact string instead of `/s/<slug>`. Used by the BYOS local-vault
   * route, where there is no public URL and the natural label is the
   * file name the user picked.
   */
  displayOverride?: string;
  /** Optional copy replacing the default explanatory paragraph. */
  descriptionOverride?: React.ReactNode;
}

export function PasswordGate({
  slug,
  exists,
  busy,
  onSubmit,
  displayOverride,
  descriptionOverride,
}: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErr("Enter a password.");
      return;
    }
    if (!exists && password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    if (!exists && password.length < 8) {
      setErr("Choose at least 8 characters for a new vault.");
      return;
    }
    setErr(null);
    const res = await onSubmit(password);
    if (res && "error" in res) setErr(res.error);
  };

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-2xl border border-border bg-background-elev p-6 shadow-lg shadow-black/30"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent">
          <Lock size={18} />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            {exists ? "Unlock" : "Create vault"}
          </p>
          <p className="text-sm text-foreground">
            {displayOverride ?? `/s/${slug}`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        {descriptionOverride ??
          (exists
            ? "Enter a password. Different passwords may unlock different notebooks on this URL; nobody can tell which notebook is “real.”"
            : "This vault does not exist yet. Choose a password to create it. Store it carefully — without it, your notes are unrecoverable.")}
      </p>

      <div className="mt-5 space-y-3">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete={exists ? "current-password" : "new-password"}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-muted hover:text-foreground"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {!exists ? (
          <Input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
          />
        ) : null}

        {err ? <p className="text-xs text-danger">{err}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? (exists ? "Unlocking…" : "Creating…") : exists ? "Unlock" : "Create"}
        </Button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Key derivation: Argon2id, 64 MiB, 3 iterations. First unlock on a slow
        device may take a few seconds — that cost is what protects your vault
        from brute force.
      </p>
    </form>
  );
}
