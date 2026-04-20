"use client";

import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useVault } from "@/lib/store/vault";
import { useNow } from "@/lib/utils/useNow";
import type { DeadmanRecord } from "@/lib/firebase/sites";
import {
  configureDeadman,
  deadmanExpiresAt,
  disableDeadman,
} from "@/lib/vault/deadman";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  PowerOff,
  RotateCw,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DAY_MS = 86_400_000;

const PRESETS: Array<{ label: string; intervalMs: number; graceMs: number }> = [
  { label: "Weekly check-in (3 day grace)", intervalMs: 7 * DAY_MS, graceMs: 3 * DAY_MS },
  { label: "Monthly check-in (7 day grace)", intervalMs: 30 * DAY_MS, graceMs: 7 * DAY_MS },
  { label: "Quarterly check-in (14 day grace)", intervalMs: 90 * DAY_MS, graceMs: 14 * DAY_MS },
  { label: "Yearly check-in (30 day grace)", intervalMs: 365 * DAY_MS, graceMs: 30 * DAY_MS },
];

export function DeadmanModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dead-man's switch"
      description="If you stop checking in, a beneficiary you trust can decrypt this vault."
    >
      {/* Body is conditionally rendered so its local state resets each time
          the modal is opened. Without this, closing + reopening would
          preserve the previous password input in memory. */}
      {open ? <ModalBody onClose={onClose} /> : null}
    </Modal>
  );
}

function ModalBody({ onClose }: { onClose: () => void }) {
  const { open: vault, setVersion, setDeadman } = useVault();

  const [preset, setPreset] = useState(1);
  const [bp1, setBp1] = useState("");
  const [bp2, setBp2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!vault) return null;

  const dm = vault.deadman;
  const isReleased = dm?.released === true;

  const submitConfigure = async () => {
    if (!bp1) return setErr("Enter a beneficiary password.");
    if (bp1.length < 12)
      return setErr(
        "Use at least 12 characters. The beneficiary password is the only thing protecting your vault if it's ever released.",
      );
    if (bp1 !== bp2) return setErr("Passwords do not match.");

    setBusy(true);
    setErr(null);
    try {
      const choice = PRESETS[preset];
      const res = await configureDeadman({
        siteId: vault.siteId,
        expectedVersion: vault.version,
        masterKey: vault.masterKey,
        beneficiaryPassword: bp1,
        intervalMs: choice.intervalMs,
        graceMs: choice.graceMs,
      });
      if (res.kind === "conflict") {
        setErr(
          "Vault changed elsewhere. Reload the page so you have the latest version, then retry.",
        );
        return;
      }
      setVersion(res.newVersion);
      // Local stand-in until the next fetch replaces it with real server bytes.
      // The wrapped key and salt here are placeholders; only UI needs to know
      // the deadman is active, not its exact material.
      const nowMs = Date.now();
      setDeadman({
        wrappedKey: new Uint8Array(),
        beneficiarySalt: new Uint8Array(),
        intervalMs: choice.intervalMs,
        graceMs: choice.graceMs,
        lastHeartbeatAt: {
          toMillis: () => nowMs,
        } as unknown as DeadmanRecord["lastHeartbeatAt"],
        released: false,
        releasedAt: null,
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message ?? "Could not arm the dead-man's switch.");
    } finally {
      setBusy(false);
    }
  };

  const submitDisable = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await disableDeadman({
        siteId: vault.siteId,
        expectedVersion: vault.version,
      });
      if (res.kind === "conflict") {
        setErr("Vault changed elsewhere. Reload and retry.");
        return;
      }
      setVersion(res.newVersion);
      setDeadman(null);
      onClose();
    } catch (e) {
      setErr((e as Error).message ?? "Could not disable.");
    } finally {
      setBusy(false);
    }
  };

  if (dm) {
    return (
      <ConfiguredView
        deadman={dm}
        isReleased={isReleased}
        busy={busy}
        err={err}
        onDisable={submitDisable}
      />
    );
  }

  return (
    <ConfigureForm
      preset={preset}
      setPreset={setPreset}
      bp1={bp1}
      setBp1={setBp1}
      bp2={bp2}
      setBp2={setBp2}
      show={show}
      setShow={setShow}
      err={err}
      busy={busy}
      onSubmit={submitConfigure}
    />
  );
}

function ConfigureForm({
  preset,
  setPreset,
  bp1,
  setBp1,
  bp2,
  setBp2,
  show,
  setShow,
  err,
  busy,
  onSubmit,
}: {
  preset: number;
  setPreset: (i: number) => void;
  bp1: string;
  setBp1: (s: string) => void;
  bp2: string;
  setBp2: (s: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  err: string | null;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5 text-sm"
    >
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-foreground">
        <p className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
          <span>
            Choose a beneficiary password and share it with one trusted person
            <em> out of band</em> (sealed envelope, in person, password
            manager). Tell them the URL too. If you stop saving for the
            interval below, they&apos;ll be able to decrypt this notebook by
            visiting the URL and entering that password.
          </span>
        </p>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted">
          Check-in cadence
        </label>
        <div className="mt-2 grid gap-2">
          {PRESETS.map((p, i) => (
            <label
              key={p.label}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                preset === i
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background-elev-2 hover:border-border/80"
              }`}
            >
              <input
                type="radio"
                name="preset"
                checked={preset === i}
                onChange={() => setPreset(i)}
                className="accent-accent"
              />
              <span className="flex-1">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted">
          Beneficiary password
        </label>
        <div className="relative mt-2">
          <Input
            type={show ? "text" : "password"}
            value={bp1}
            onChange={(e) => setBp1(e.target.value)}
            placeholder="At least 12 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide" : "Show"}
            className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-muted hover:text-foreground"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Input
          type={show ? "text" : "password"}
          value={bp2}
          onChange={(e) => setBp2(e.target.value)}
          placeholder="Confirm beneficiary password"
          autoComplete="new-password"
          className="mt-2"
        />
      </div>

      {err ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {err}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" size="md" disabled={busy}>
          <Clock size={14} /> {busy ? "Arming…" : "Arm dead-man's switch"}
        </Button>
      </div>
    </form>
  );
}

function ConfiguredView({
  deadman,
  isReleased,
  busy,
  err,
  onDisable,
}: {
  deadman: DeadmanRecord;
  isReleased: boolean;
  busy: boolean;
  err: string | null;
  onDisable: () => void;
}) {
  const now = useNow(60_000);
  const expiresAt = deadmanExpiresAt(deadman);
  const remainingMs = expiresAt !== null ? expiresAt - now : null;

  return (
    <div className="space-y-5 text-sm">
      {isReleased ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs leading-relaxed text-foreground">
          <p className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
            <span>
              <strong className="text-foreground">This vault has been released.</strong>{" "}
              The dead-man&apos;s switch fired because no save happened
              within the configured window. The beneficiary can now decrypt
              this URL by entering the beneficiary password. The vault is
              also locked against further writes; if you still need to use
              it privately, create a new vault under a new URL.
            </span>
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs leading-relaxed text-foreground">
          <p className="flex items-start gap-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" />
            <span>
              <strong className="text-foreground">Active.</strong> Each save
              counts as a check-in. As long as you save before the interval
              expires (plus the grace), nothing happens. If not, the vault
              is released and your beneficiary can decrypt it.
            </span>
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted">Check-in interval</dt>
          <dd className="font-medium">{formatDuration(deadman.intervalMs)}</dd>
        </div>
        <div>
          <dt className="text-muted">Grace period</dt>
          <dd className="font-medium">{formatDuration(deadman.graceMs)}</dd>
        </div>
        <div>
          <dt className="text-muted">Last heartbeat</dt>
          <dd className="font-medium">
            {deadman.lastHeartbeatAt
              ? new Date(deadman.lastHeartbeatAt.toMillis()).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">
            {isReleased ? "Released" : "Releases at"}
          </dt>
          <dd className="font-medium">
            {expiresAt ? new Date(expiresAt).toLocaleString() : "—"}
            {!isReleased && remainingMs !== null ? (
              <span className="ml-1 text-muted">
                ({remainingMs > 0 ? formatDuration(remainingMs) + " left" : "now"})
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {err ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {err}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          To extend, just save the notebook (any save resets the timer).
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            title="Reload to fetch the latest heartbeat from the server"
          >
            <RotateCw size={14} /> Refresh
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy || isReleased}
            onClick={onDisable}
          >
            <PowerOff size={14} /> {busy ? "Disabling…" : "Disable"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const days = Math.round(ms / DAY_MS);
  if (days >= 365) {
    const years = Math.round(days / 365);
    return years === 1 ? "1 year" : `${years} years`;
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  if (days >= 1) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
