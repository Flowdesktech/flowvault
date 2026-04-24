"use client";

/**
 * Command-palette search over the currently-unlocked notebook bundle.
 *
 * Opens on Ctrl/Cmd+K from the Editor. Operates in memory only,
 * scoped to notebooks the user already decrypted in this session;
 * locked or unloaded slots are invisible to it by construction.
 *
 * Keyboard contract:
 *   - Enter          : select the highlighted hit
 *   - ArrowUp/Down   : move the selection
 *   - Home/End       : jump to first/last hit
 *   - Esc            : close
 *
 * Mouse interactions (click / hover-to-highlight) are kept in sync
 * with the keyboard selection so the two drivers never fight.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, Hash, Search, X } from "lucide-react";
import type { Notebook } from "@/lib/vault/notebooks";
import {
  searchBundle,
  type SearchHit,
} from "@/lib/vault/search";

interface Props {
  open: boolean;
  onClose: () => void;
  notebooks: readonly Notebook[];
  onSelectHit: (hit: SearchHit) => void;
}

/**
 * Outer shell keeps the palette unmounted while closed. This makes
 * each open a fresh mount of `SearchPaletteInner` with default
 * state, so we never need a state-reset effect (which would trip
 * the project's `set-state-in-effect` rule).
 */
export function SearchPalette({ open, onClose, notebooks, onSelectHit }: Props) {
  if (!open) return null;
  return (
    <SearchPaletteInner
      onClose={onClose}
      notebooks={notebooks}
      onSelectHit={onSelectHit}
    />
  );
}

function SearchPaletteInner({
  onClose,
  notebooks,
  onSelectHit,
}: Omit<Props, "open">) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(
    () => searchBundle(notebooks, query),
    [notebooks, query],
  );

  /**
   * Derive the effective selection index at render time. When the
   * user narrows their query and the hit list shrinks, we want the
   * highlight to clamp to the last row without needing an effect
   * that observes `hits.length` and writes state.
   */
  const effectiveIndex =
    hits.length === 0 ? 0 : Math.min(selectedIndex, hits.length - 1);

  useEffect(() => {
    // Focus after paint so the input exists in the DOM; avoids the
    // occasional dropped first keypress on slow-first-render.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const commit = useCallback(
    (hit: SearchHit | undefined) => {
      if (!hit) return;
      onSelectHit(hit);
    },
    [onSelectHit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commit(hits[effectiveIndex]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (hits.length === 0) return;
        setSelectedIndex((effectiveIndex + 1) % hits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (hits.length === 0) return;
        setSelectedIndex((effectiveIndex - 1 + hits.length) % hits.length);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setSelectedIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        if (hits.length > 0) setSelectedIndex(hits.length - 1);
      }
    },
    [commit, hits, onClose, effectiveIndex],
  );

  // Keep the highlighted row in view as the user arrow-keys through
  // results. Using `scrollIntoView({ block: "nearest" })` keeps the
  // scroll movement minimal instead of jumping to center.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-hit-index="${effectiveIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [effectiveIndex]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search this vault"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      onKeyDown={onKeyDown}
    >
      <button
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background-elev shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search unlocked notebooks…"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            aria-label="Search query"
            aria-controls="search-palette-results"
            aria-activedescendant={
              hits.length > 0 ? `search-hit-${effectiveIndex}` : undefined
            }
          />
          <span className="hidden shrink-0 rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
            Esc
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-background-elev-2 hover:text-foreground sm:hidden"
          >
            <X size={14} />
          </button>
        </div>

        <div
          id="search-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[min(60vh,480px)] overflow-y-auto"
        >
          {query.trim().length === 0 ? (
            <EmptyState
              icon={<Search size={22} className="text-muted" />}
              title="Search unlocked notebooks"
              body="Type to find text across every notebook you have open in this session. Results are matched in memory and never leave the browser."
            />
          ) : hits.length === 0 ? (
            <EmptyState
              icon={<Search size={22} className="text-muted" />}
              title={`No matches for "${query.trim()}"`}
              body="Only notebooks unlocked in this session are searched. A match in another slot would require its password first."
            />
          ) : (
            <ResultList
              hits={hits}
              selectedIndex={effectiveIndex}
              onHover={setSelectedIndex}
              onPick={commit}
            />
          )}
        </div>

        <Footer hitCount={hits.length} query={query} />
      </div>
    </div>
  );
}

function ResultList({
  hits,
  selectedIndex,
  onHover,
  onPick,
}: {
  hits: SearchHit[];
  selectedIndex: number;
  onHover: (i: number) => void;
  onPick: (h: SearchHit) => void;
}) {
  // Group by notebook so the user gets a clear visual hierarchy;
  // title hits sort above content hits within each group because
  // searchBundle returns them in that order.
  const groups: { notebookId: string; title: string; items: Array<{ hit: SearchHit; index: number }> }[] = [];
  let current: (typeof groups)[number] | null = null;
  hits.forEach((hit, index) => {
    if (!current || current.notebookId !== hit.notebookId) {
      current = {
        notebookId: hit.notebookId,
        title: hit.notebookTitle,
        items: [],
      };
      groups.push(current);
    }
    current.items.push({ hit, index });
  });

  return (
    <div className="py-1">
      {groups.map((g) => (
        <section key={g.notebookId} aria-label={`Results in ${g.title}`}>
          <div className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <FileText size={10} aria-hidden /> {g.title}
          </div>
          {g.items.map(({ hit, index }) => (
            <HitRow
              key={`${hit.notebookId}-${hit.kind}-${hit.start}-${index}`}
              hit={hit}
              index={index}
              selected={index === selectedIndex}
              onHover={() => onHover(index)}
              onPick={() => onPick(hit)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function HitRow({
  hit,
  index,
  selected,
  onHover,
  onPick,
}: {
  hit: SearchHit;
  index: number;
  selected: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const tone = selected
    ? "bg-accent/15 text-foreground"
    : "hover:bg-background-elev-2/70 text-foreground";
  return (
    <button
      type="button"
      id={`search-hit-${index}`}
      role="option"
      aria-selected={selected}
      data-hit-index={index}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onClick={onPick}
      className={`flex w-full items-start gap-3 px-4 py-2 text-left text-sm transition-colors ${tone}`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
          selected
            ? "border-accent/60 bg-accent/20 text-accent"
            : "border-border/70 bg-background text-muted"
        }`}
        aria-hidden
      >
        {hit.kind === "title" ? <FileText size={11} /> : <Hash size={11} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs leading-relaxed text-foreground">
          {renderSnippet(hit.snippet, hit.snippetMatchStart, hit.snippetMatchEnd)}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">
          {hit.kind === "title"
            ? "Notebook name"
            : `Line ${hit.line}`}
        </span>
      </span>
    </button>
  );
}

function renderSnippet(snippet: string, start: number, end: number) {
  const before = snippet.slice(0, start);
  const match = snippet.slice(start, end);
  const after = snippet.slice(end);
  return (
    <>
      <span className="text-muted">{before}</span>
      <mark className="rounded-sm bg-accent/25 px-0.5 text-foreground">
        {match}
      </mark>
      <span className="text-muted">{after}</span>
    </>
  );
}

function Footer({ hitCount, query }: { hitCount: number; query: string }) {
  const hasQuery = query.trim().length > 0;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border bg-background-elev-2/50 px-4 py-2 text-[11px] text-muted">
      <div className="flex items-center gap-3">
        <KeyHint label="↑↓" desc="navigate" />
        <KeyHint label="↵" desc="go" />
        <KeyHint label="esc" desc="close" />
      </div>
      <span>
        {hasQuery
          ? `${hitCount} match${hitCount === 1 ? "" : "es"}`
          : "In-memory \u00b7 client-only"}
      </span>
    </div>
  );
}

function KeyHint({ label, desc }: { label: string; desc: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-border/80 bg-background px-1 font-mono text-[10px] text-foreground">
        {label}
      </kbd>
      <span>{desc}</span>
    </span>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background">
        {icon}
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="max-w-sm text-xs leading-relaxed text-muted">{body}</div>
    </div>
  );
}
