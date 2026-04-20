"use client";

import { useEffect, useState } from "react";
// useNow provides the live countdown clock for LockedView.
import {
  Copy,
  Check,
  Lock,
  Unlock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  fetchTimelock,
  type TimelockRecord,
} from "@/lib/firebase/timelocks";
import {
  tryDecrypt,
  unlockTimeForRound,
  type DecryptOutcome,
} from "@/lib/timelock/tlock";
import { useNow } from "@/lib/utils/useNow";

type Phase =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "locked"; capsule: TimelockRecord; unlockAtMs: number }
  | {
      kind: "unlocking";
      capsule: TimelockRecord;
    }
  | { kind: "unlocked"; capsule: TimelockRecord; plaintext: string }
  | { kind: "decrypt-failed"; capsule: TimelockRecord; message: string };

export function TimelockViewer({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const capsule = await fetchTimelock(id);
        if (cancelled) return;
        if (!capsule) {
          setPhase({ kind: "not-found" });
          return;
        }
        const unlockAtMs = unlockTimeForRound(capsule.round);
        if (Date.now() < unlockAtMs) {
          setPhase({ kind: "locked", capsule, unlockAtMs });
        } else {
          setPhase({ kind: "unlocking", capsule });
        }
      } catch (e) {
        if (cancelled) return;
        setPhase({
          kind: "error",
          message: (e as Error).message ?? "Failed to load capsule.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Once the capsule is loaded and the unlock moment passes, try
  // decryption. Re-runs automatically once `phase` transitions to
  // `unlocking`, which itself can be driven by the locked-phase
  // countdown below.
  useEffect(() => {
    if (phase.kind !== "unlocking") return;
    let cancelled = false;
    (async () => {
      const outcome: DecryptOutcome = await tryDecrypt(
        phase.capsule.ciphertext,
        phase.capsule.round,
      );
      if (cancelled) return;
      if (outcome.kind === "unlocked") {
        setPhase({
          kind: "unlocked",
          capsule: phase.capsule,
          plaintext: outcome.plaintext,
        });
      } else if (outcome.kind === "still-locked") {
        setPhase({
          kind: "locked",
          capsule: phase.capsule,
          unlockAtMs: outcome.unlockAtMs,
        });
      } else {
        setPhase({
          kind: "decrypt-failed",
          capsule: phase.capsule,
          message: outcome.message,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Schedule a single timer to promote `locked` → `unlocking` once the
  // wall-clock crosses the unlock moment. Re-registers if the phase
  // changes. Using a timer instead of a per-tick setState avoids the
  // `set-state-in-effect` pattern flagged by React&apos;s lint rule.
  useEffect(() => {
    if (phase.kind !== "locked") return;
    const delay = Math.max(0, phase.unlockAtMs - Date.now());
    const capsule = phase.capsule;
    const id = setTimeout(() => {
      setPhase({ kind: "unlocking", capsule });
    }, delay);
    return () => clearTimeout(id);
  }, [phase]);

  if (phase.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading capsule…
        </div>
      </Card>
    );
  }

  if (phase.kind === "not-found") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>Capsule not found</Header>
        <p className="mt-2 text-sm text-muted">
          Either the link is wrong or the capsule was never created. The
          ID in the URL is: <span className="font-mono">{id}</span>
        </p>
      </Card>
    );
  }

  if (phase.kind === "error") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>
          Couldn&apos;t load this capsule
        </Header>
        <p className="mt-2 text-sm text-muted">{phase.message}</p>
      </Card>
    );
  }

  if (phase.kind === "locked") {
    return <LockedView capsule={phase.capsule} unlockAtMs={phase.unlockAtMs} />;
  }

  if (phase.kind === "unlocking") {
    return (
      <Card>
        <Header icon={<Loader2 size={18} className="animate-spin" />}>
          Unlocking…
        </Header>
        <p className="mt-2 text-sm text-muted">
          Fetching the drand beacon signature for round{" "}
          <span className="font-mono">#{phase.capsule.round}</span> and
          decrypting in your browser.
        </p>
      </Card>
    );
  }

  if (phase.kind === "decrypt-failed") {
    return (
      <Card>
        <Header icon={<AlertTriangle size={18} />}>
          Decryption failed
        </Header>
        <p className="mt-2 text-sm text-muted">
          {phase.message} The drand beacon may not have caught up with
          this round yet. Try again in a minute.
        </p>
        <p className="mt-3 text-xs text-muted">
          Target round:{" "}
          <span className="font-mono">#{phase.capsule.round}</span>
        </p>
      </Card>
    );
  }

  return <UnlockedView plaintext={phase.plaintext} capsule={phase.capsule} />;
}

function LockedView({
  capsule,
  unlockAtMs,
}: {
  capsule: TimelockRecord;
  unlockAtMs: number;
}) {
  const now = useNow(1_000);
  const remaining = Math.max(0, unlockAtMs - now);
  return (
    <Card tone="accent">
      <Header icon={<Lock size={18} />}>Locked</Header>
      <p className="mt-2 text-sm text-muted">
        This capsule will open around{" "}
        <span className="text-foreground">
          {new Date(unlockAtMs).toLocaleString()}
        </span>
        .
      </p>

      <Countdown ms={remaining} />

      <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted">
        <Meta label="drand round" value={`#${capsule.round.toLocaleString()}`} />
        <Meta
          label="chain"
          value={`${capsule.chainHash.slice(0, 10)}…${capsule.chainHash.slice(
            -6,
          )}`}
        />
      </div>
      <p className="mt-6 text-xs text-muted">
        Nobody can decrypt this yet &mdash; not you, not Flowvault, not
        anyone with access to our database. The unlock key doesn&apos;t
        exist until the drand network publishes the target round.
      </p>
    </Card>
  );
}

function UnlockedView({
  plaintext,
  capsule,
}: {
  plaintext: string;
  capsule: TimelockRecord;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };
  return (
    <Card tone="success">
      <div className="flex items-center justify-between">
        <Header icon={<Unlock size={18} />}>Unlocked</Header>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background-elev px-2 py-1 text-xs text-muted hover:text-foreground"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 font-mono text-sm text-foreground">
        {plaintext}
      </pre>
      <p className="mt-4 text-xs text-muted">
        Decrypted locally in your browser using the drand signature for
        round{" "}
        <span className="font-mono text-foreground">#{capsule.round}</span>
        . We never saw the plaintext.
      </p>
    </Card>
  );
}

function Countdown({ ms }: { ms: number }) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const cells: { value: number; label: string }[] = [
    { value: d, label: "days" },
    { value: h, label: "hours" },
    { value: m, label: "minutes" },
    { value: s, label: "seconds" },
  ];
  return (
    <div className="mt-5 grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border bg-background-elev px-3 py-3 text-center"
        >
          <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {c.value.toString().padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success";
}) {
  const border =
    tone === "accent"
      ? "border-accent/30"
      : tone === "success"
        ? "border-success/30"
        : "border-border";
  const bg =
    tone === "accent"
      ? "bg-accent/5"
      : tone === "success"
        ? "bg-success/5"
        : "bg-background-elev";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-6`}>{children}</div>
  );
}

function Header({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
      <span className="text-accent">{icon}</span>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background-elev px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-foreground">
        {value}
      </div>
    </div>
  );
}
