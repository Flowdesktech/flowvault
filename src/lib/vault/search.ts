/**
 * Client-side search over an unlocked notebook bundle.
 *
 * Scope: operates entirely in memory on notebook plaintext that the
 * user has already decrypted in this session. Never touches the
 * server, never leaks bytes to a network, never persists an index.
 * Locking the vault drops the bundle and therefore drops every
 * search result with it.
 *
 * The corpus is small by design (max 32 notebooks per slot, each
 * slot a few KiB), so we do a straight case-insensitive substring
 * scan on each keystroke. No n-gram index, no fuzzy ranking, no
 * persistence. The value is in the UI, not the algorithm.
 *
 * Slot boundaries: search never crosses into slots whose password
 * the user hasn't supplied in the current session. That is the
 * deniability invariant, not a search limitation -- the other
 * slots are not even in memory here.
 */
import type { Notebook } from "./notebooks";

export type SearchHitKind = "title" | "content";

export interface SearchHit {
  /** Which notebook the hit came from. */
  notebookId: string;
  notebookTitle: string;
  kind: SearchHitKind;
  /**
   * Character offsets in the notebook's content string. For title
   * hits both are 0; the editor uses only `notebookId` to switch
   * tabs.
   */
  start: number;
  end: number;
  /** 1-indexed line number of the hit inside the content. 0 for title hits. */
  line: number;
  /** Clipped single-line snippet for display. */
  snippet: string;
  /** Match offsets inside `snippet`, used to render the highlight. */
  snippetMatchStart: number;
  snippetMatchEnd: number;
}

export interface SearchOptions {
  /** Total hit cap across all notebooks. Defaults to 100. */
  limit?: number;
  /** If false, only content is searched. Defaults to true. */
  matchTitles?: boolean;
  /**
   * Max number of content hits per notebook, to prevent a single
   * big notebook with the query in every line from flooding the
   * results list. Defaults to 20.
   */
  perNotebookLimit?: number;
  /**
   * Max characters kept on each side of the match in the snippet.
   * The full line is used if it fits in `snippetContext * 2 + query.length`.
   * Defaults to 48.
   */
  snippetContext?: number;
}

const DEFAULTS: Required<SearchOptions> = {
  limit: 100,
  matchTitles: true,
  perNotebookLimit: 20,
  snippetContext: 48,
};

/**
 * Case-insensitive substring search. Returns early on empty query.
 *
 * Order: title hits for all notebooks first (if enabled), then
 * content hits grouped per notebook in document order. The palette
 * relies on this order to render title matches at the top of each
 * notebook's group.
 */
export function searchBundle(
  notebooks: readonly Notebook[],
  query: string,
  options: SearchOptions = {},
): SearchHit[] {
  const opts = { ...DEFAULTS, ...options };
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const needle = trimmed.toLowerCase();
  const hits: SearchHit[] = [];

  if (opts.matchTitles) {
    for (const nb of notebooks) {
      if (hits.length >= opts.limit) return hits;
      const haystack = nb.title.toLowerCase();
      const idx = haystack.indexOf(needle);
      if (idx === -1) continue;
      hits.push({
        notebookId: nb.id,
        notebookTitle: nb.title,
        kind: "title",
        start: 0,
        end: 0,
        line: 0,
        snippet: nb.title,
        snippetMatchStart: idx,
        snippetMatchEnd: idx + needle.length,
      });
    }
  }

  for (const nb of notebooks) {
    if (hits.length >= opts.limit) return hits;
    let perNotebookAdded = 0;
    const lowerContent = nb.content.toLowerCase();
    let searchFrom = 0;
    while (perNotebookAdded < opts.perNotebookLimit) {
      const at = lowerContent.indexOf(needle, searchFrom);
      if (at === -1) break;
      const end = at + needle.length;
      const { snippet, matchStart, matchEnd, line } = buildSnippet(
        nb.content,
        at,
        end,
        opts.snippetContext,
      );
      hits.push({
        notebookId: nb.id,
        notebookTitle: nb.title,
        kind: "content",
        start: at,
        end,
        line,
        snippet,
        snippetMatchStart: matchStart,
        snippetMatchEnd: matchEnd,
      });
      perNotebookAdded += 1;
      if (hits.length >= opts.limit) return hits;
      // Advance past this match. We use `end` so overlapping matches
      // of the same needle do not double-report (e.g. "aaa" in
      // "aaaa" returns 2 hits, not 3).
      searchFrom = end;
    }
  }

  return hits;
}

/**
 * Build a single-line snippet centered on a match. If the containing
 * line fits in the budget we show the whole line; otherwise we clip
 * with leading/trailing ellipses. Offsets returned are positions
 * inside the returned `snippet`, not the original content.
 */
function buildSnippet(
  content: string,
  matchStart: number,
  matchEnd: number,
  context: number,
): {
  snippet: string;
  matchStart: number;
  matchEnd: number;
  line: number;
} {
  const lineStart = lineStartBefore(content, matchStart);
  const lineEnd = lineEndAfter(content, matchEnd);
  const line = countNewlines(content, 0, lineStart) + 1;

  const fullLine = content.slice(lineStart, lineEnd);
  // Prefer the whole line if it comfortably fits the budget.
  const budget = context * 2 + (matchEnd - matchStart);
  if (fullLine.length <= budget) {
    return {
      snippet: fullLine,
      matchStart: matchStart - lineStart,
      matchEnd: matchEnd - lineStart,
      line,
    };
  }

  const leftStart = Math.max(lineStart, matchStart - context);
  const rightEnd = Math.min(lineEnd, matchEnd + context);
  const clippedLeft = leftStart > lineStart;
  const clippedRight = rightEnd < lineEnd;
  const core = content.slice(leftStart, rightEnd);
  const snippet = `${clippedLeft ? "\u2026" : ""}${core}${clippedRight ? "\u2026" : ""}`;
  const prefix = clippedLeft ? 1 : 0;
  return {
    snippet,
    matchStart: prefix + (matchStart - leftStart),
    matchEnd: prefix + (matchEnd - leftStart),
    line,
  };
}

function lineStartBefore(s: string, at: number): number {
  for (let i = at - 1; i >= 0; i -= 1) {
    if (s[i] === "\n") return i + 1;
  }
  return 0;
}

function lineEndAfter(s: string, at: number): number {
  const nl = s.indexOf("\n", at);
  return nl === -1 ? s.length : nl;
}

function countNewlines(s: string, from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to; i += 1) {
    if (s[i] === "\n") n += 1;
  }
  return n;
}
