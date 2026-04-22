"use client";

import { Columns, Eye, Pencil } from "lucide-react";
import type { EditorViewMode } from "@/lib/hooks/useEditorViewMode";

/**
 * Segmented control for switching between Edit / Preview / Split.
 *
 * The "Split" option is hidden when the viewport is too narrow for
 * side-by-side to make sense — we expose that through the `canSplit`
 * prop so the parent hook is the single source of truth.
 */
export function ViewModeToggle({
  mode,
  onChange,
  canSplit,
}: {
  mode: EditorViewMode;
  onChange: (next: EditorViewMode) => void;
  canSplit: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Editor view mode"
      className="inline-flex items-center overflow-hidden rounded-md border border-border bg-background-elev"
    >
      <ModeButton
        label="Edit"
        icon={<Pencil size={12} />}
        active={mode === "edit"}
        onClick={() => onChange("edit")}
      />
      <ModeButton
        label="Preview"
        icon={<Eye size={12} />}
        active={mode === "preview"}
        onClick={() => onChange("preview")}
      />
      {canSplit ? (
        <ModeButton
          label="Split"
          icon={<Columns size={12} />}
          active={mode === "split"}
          onClick={() => onChange("split")}
        />
      ) : null}
    </div>
  );
}

function ModeButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={`${label} mode`}
      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-accent/15 text-accent"
          : "text-muted hover:bg-background-elev-2 hover:text-foreground"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
