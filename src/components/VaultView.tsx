"use client";

import { useCallback, useEffect, useState } from "react";
import { PasswordGate } from "./PasswordGate";
import { ReleasedGate } from "./ReleasedGate";
import { Editor } from "./Editor";
import { useVault } from "@/lib/store/vault";
import { tryOpenVault, createVault, type OpenResult } from "@/lib/vault/service";
import { unlockReleased } from "@/lib/vault/deadman";
import type { DeadmanRecord } from "@/lib/firebase/sites";

type Phase =
  | { kind: "probing" }
  | { kind: "needs-password"; exists: boolean }
  | { kind: "released"; siteId: string; releasedAt: number | null }
  | { kind: "error"; message: string }
  | { kind: "open" };

export function VaultView({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "probing" });
  const [working, setWorking] = useState(false);
  const { open, setOpen, close } = useVault();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { deriveSiteId } = await import("@/lib/crypto/siteId");
        const { fetchSite } = await import("@/lib/firebase/sites");
        const id = await deriveSiteId(slug);
        const site = await fetchSite(id);
        if (cancelled) return;
        if (site?.deadman?.released) {
          setPhase({
            kind: "released",
            siteId: id,
            releasedAt: site.deadman.releasedAt
              ? site.deadman.releasedAt.toMillis()
              : null,
          });
          return;
        }
        setPhase({ kind: "needs-password", exists: site !== null });
      } catch (e) {
        if (cancelled) return;
        setPhase({
          kind: "error",
          message: (e as Error).message ?? "Failed to reach Flowvault.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  const handleSubmit = useCallback(
    async (password: string) => {
      setWorking(true);
      try {
        const opened = await tryOpenVault(slug, password);
        if (opened.kind === "opened") {
          applyOpen(opened, false, setOpen);
          setPhase({ kind: "open" });
          return;
        }
        if (opened.kind === "not-found") {
          const created = await createVault(slug, password);
          applyOpen(created, false, setOpen);
          setPhase({ kind: "open" });
          return;
        }
        return { error: "Wrong password." as const };
      } catch (e) {
        return { error: (e as Error).message ?? "Something went wrong." };
      } finally {
        setWorking(false);
      }
    },
    [slug, setOpen],
  );

  const handleBeneficiarySubmit = useCallback(
    async (password: string) => {
      if (phase.kind !== "released") return;
      setWorking(true);
      try {
        const res = await unlockReleased({
          siteId: phase.siteId,
          beneficiaryPassword: password,
        });
        if (res.kind === "unlocked") {
          setOpen({
            slug,
            siteId: res.siteId,
            slotIndex: res.slotIndex,
            masterKey: res.masterKey,
            kdfSalt: res.kdfSalt,
            volume: res.volume,
            blob: res.blob,
            version: res.version,
            content: res.content,
            deadman: res.deadman,
            beneficiary: true,
          });
          setPhase({ kind: "open" });
          return;
        }
        if (res.kind === "wrong-password") {
          return { error: "Wrong beneficiary password." };
        }
        if (res.kind === "not-released") {
          return { error: "This vault is no longer in the released state." };
        }
        if (res.kind === "no-deadman") {
          return { error: "This vault has no dead-man's switch configured." };
        }
        return { error: "Vault not found." };
      } catch (e) {
        return { error: (e as Error).message ?? "Could not unlock." };
      } finally {
        setWorking(false);
      }
    },
    [phase, slug, setOpen],
  );

  const handleOwnerSubmit = useCallback(
    async (password: string) => {
      if (phase.kind !== "released") return;
      setWorking(true);
      try {
        const opened = await tryOpenVault(slug, password);
        if (opened.kind === "opened") {
          applyOpen(opened, true, setOpen);
          setPhase({ kind: "open" });
          return;
        }
        return { error: "Wrong password." };
      } catch (e) {
        return { error: (e as Error).message ?? "Could not unlock." };
      } finally {
        setWorking(false);
      }
    },
    [phase, slug, setOpen],
  );

  if (phase.kind === "probing") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-20">
        <p className="text-sm text-muted">Looking up vault…</p>
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

  if (phase.kind === "released") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-20">
        <ReleasedGate
          slug={slug}
          releasedAt={phase.releasedAt}
          busy={working}
          onBeneficiarySubmit={handleBeneficiarySubmit}
          onOwnerSubmit={handleOwnerSubmit}
        />
      </main>
    );
  }

  if (phase.kind === "needs-password") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-20">
        <PasswordGate
          slug={slug}
          exists={phase.exists}
          busy={working}
          onSubmit={handleSubmit}
        />
      </main>
    );
  }

  if (!open) return null;
  return <Editor />;
}

function applyOpen(
  result: OpenResult,
  beneficiary: boolean,
  setOpen: (v: ReturnType<typeof toVault>) => void,
) {
  setOpen(toVault(result, beneficiary));
}

function toVault(r: OpenResult, beneficiary: boolean) {
  return {
    slug: r.slug,
    siteId: r.siteId,
    slotIndex: r.slotIndex,
    masterKey: r.masterKey,
    kdfSalt: r.kdfSalt,
    volume: r.volume,
    blob: r.blob,
    version: r.version,
    content: r.content,
    deadman: r.deadman,
    beneficiary,
  };
}

// re-export for convenience in tests / future imports
export type { DeadmanRecord };
