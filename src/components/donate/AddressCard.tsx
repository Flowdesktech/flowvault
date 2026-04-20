"use client";

import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Props {
  name: string;
  symbol: string;
  chain?: string;
  accent?: string;
  address: string;
}

export function AddressCard({ name, symbol, chain, accent, address }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked (iframe, non-secure context). Fall back to
      // selecting the text so the user can copy manually.
      const el = document.getElementById(`addr-${symbol}`);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-background-elev p-4",
        accent ? "border-accent/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {name}{" "}
              <span className="font-mono text-xs font-normal text-muted">
                {symbol}
              </span>
            </h3>
            {accent ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                {accent}
              </span>
            ) : null}
          </div>
          {chain ? (
            <p className="mt-0.5 text-xs text-muted">{chain}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="shrink-0 rounded-lg bg-white p-2">
          <QRCodeSVG
            value={address}
            size={96}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            id={`addr-${symbol}`}
            className="break-all rounded-md border border-border bg-background-elev-2 p-2 font-mono text-[11px] leading-relaxed text-foreground"
          >
            {address}
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background-elev-2 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {copied ? (
              <>
                <Check size={12} /> Copied
              </>
            ) : (
              <>
                <Copy size={12} /> Copy address
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
