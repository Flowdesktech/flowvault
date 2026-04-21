"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";
import { isValidSlug, normalizeSlug } from "@/lib/crypto/siteId";
import { APP_HOST } from "@/lib/config";
import { ArrowRight, Upload } from "lucide-react";

export function OpenVaultForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const go = () => {
    const normalized = normalizeSlug(slug);
    if (!isValidSlug(normalized)) {
      setErr(
        "Use 3-64 characters: lowercase letters, numbers, dashes or underscores.",
      );
      return;
    }
    setErr(null);
    router.push(`/s/${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex items-center gap-2"
      >
        <div className="flex flex-1 items-center rounded-lg border border-border bg-background-elev pl-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <span className="select-none text-sm text-muted">{APP_HOST}/s/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-secret"
            className="h-11 flex-1 bg-transparent pr-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
            autoComplete="off"
            autoFocus
          />
        </div>
        <Button type="submit" size="lg" className="h-11">
          Open <ArrowRight size={16} />
        </Button>
        {err ? (
          <p className="absolute mt-14 text-xs text-danger">{err}</p>
        ) : null}
      </form>
      <p className="mt-3 text-center text-xs text-muted">
        Have a{" "}
        <code className="rounded bg-background-elev-2 px-1 py-0.5 font-mono text-[11px]">
          .fvault
        </code>{" "}
        backup?{" "}
        <Link
          href="/restore"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          <Upload size={11} /> Restore it to a new URL
        </Link>
      </p>
    </div>
  );
}
