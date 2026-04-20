"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock } from "lucide-react";

interface Props {
  slug: string;
  releasedAt: number | null;
  busy: boolean;
  /** Try to unlock as the beneficiary. Return null on success, error otherwise. */
  onBeneficiarySubmit: (password: string) => Promise<{ error: string } | void>;
  /** Try to unlock as the original owner. Return null on success, error otherwise. */
  onOwnerSubmit: (password: string) => Promise<{ error: string } | void>;
}

type Tab = "beneficiary" | "owner";

export function ReleasedGate({
  slug,
  releasedAt,
  busy,
  onBeneficiarySubmit,
  onOwnerSubmit,
}: Props) {
  const [tab, setTab] = useState<Tab>("beneficiary");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return setErr("Enter a password.");
    setErr(null);
    const fn = tab === "beneficiary" ? onBeneficiarySubmit : onOwnerSubmit;
    const res = await fn(password);
    if (res && "error" in res) setErr(res.error);
  };

  return (
    <form
      onSubmit={submit}
      className="w-full rounded-2xl border border-warning/30 bg-background-elev p-6 shadow-lg shadow-black/30"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-warning/15 text-warning">
          <AlertTriangle size={18} />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-warning">
            Vault released
          </p>
          <p className="text-sm text-foreground">/s/{slug}</p>
          {releasedAt ? (
            <p className="mt-1 text-xs text-muted">
              The dead-man&apos;s switch fired on{" "}
              {new Date(releasedAt).toLocaleString()}. The owner did not check
              in within the configured window. The vault is read-only and the
              beneficiary password unlocks it.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 inline-flex w-full rounded-lg border border-border bg-background-elev-2 p-1 text-xs">
        <TabBtn active={tab === "beneficiary"} onClick={() => setTab("beneficiary")}>
          <KeyRound size={12} /> I&apos;m the beneficiary
        </TabBtn>
        <TabBtn active={tab === "owner"} onClick={() => setTab("owner")}>
          <Lock size={12} /> I&apos;m the owner
        </TabBtn>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        {tab === "beneficiary"
          ? "Enter the beneficiary password the owner shared with you out of band. It unwraps the vault key and decrypts the released notebook."
          : "If you're the original owner, your normal vault password still works in read-only mode. (To start a fresh vault, pick a new URL — this one is locked against further writes.)"}
      </p>

      <div className="relative mt-3">
        <Input
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            tab === "beneficiary" ? "Beneficiary password" : "Vault password"
          }
          autoFocus
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-muted hover:text-foreground"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}

      <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
        {busy ? "Unlocking…" : "Unlock"}
      </Button>
    </form>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
        active
          ? "bg-background-elev text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
