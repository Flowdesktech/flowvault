"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";
import { isValidSlug, normalizeSlug } from "@/lib/crypto/siteId";
import { APP_HOST } from "@/lib/config";
import { ArrowRight } from "lucide-react";

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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="mx-auto flex w-full max-w-md items-center gap-2"
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
  );
}
