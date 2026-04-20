/**
 * Notebook bundle: the structured payload that lives inside a single
 * hidden-volume slot.
 *
 * Prior to this, one slot held a single string of text: one password ->
 * one notebook. Now one slot holds a bundle of multiple named notebooks
 * with one active, so a password unlocks a whole workspace of tabs.
 *
 * The deniability story is unchanged:
 *   - Slots in the Firestore ciphertext blob are still indistinguishable
 *     until AEAD-decrypted under the right master key.
 *   - Decoy / secondary passwords still land in their own slots with
 *     their own bundles. A different password means a different tab
 *     set; observers cannot see that either exists.
 *
 * Encoding is JSON for readability, because the slot's capacity is a
 * few kilobytes of text plus AEAD overhead; a tighter binary container
 * would save ~20% on envelope bytes but cost clarity and make bug
 * bisection much harder.
 *
 * The bundle format carries its own version field (`v`). The current
 * and only version is 1. Future versions can be detected here without
 * touching the lower-level volume/frame format.
 */
import { nanoid } from "nanoid";

export interface Notebook {
  /** Stable id used for React keys and active-tab tracking. Never shown. */
  id: string;
  title: string;
  content: string;
}

export interface NotebookBundle {
  v: 1;
  notebooks: Notebook[];
  activeId: string;
}

/**
 * Soft caps. The hard cap is slot capacity in bytes, enforced at save
 * time by the volume layer. These keep the UI sane (no 500-tab scroll
 * bars) and make JSON parses bounded.
 */
export const MAX_NOTEBOOK_TITLE_LEN = 80;
export const MAX_NOTEBOOKS_PER_SLOT = 32;

function newId(): string {
  return nanoid(10);
}

function clampTitle(raw: string, fallback: string): string {
  const t = raw.trim().slice(0, MAX_NOTEBOOK_TITLE_LEN);
  return t.length > 0 ? t : fallback;
}

/**
 * Build a brand-new bundle. Used when creating a vault or when an
 * existing slot decodes to something unparseable (we wrap the raw text
 * as a single notebook rather than stranding the user).
 */
export function createBundle(
  initial: { title?: string; content?: string } = {},
): NotebookBundle {
  const nb: Notebook = {
    id: newId(),
    title: clampTitle(initial.title ?? "", "Notebook 1"),
    content: initial.content ?? "",
  };
  return { v: 1, notebooks: [nb], activeId: nb.id };
}

/** Canonical bundle -> JSON bytes (UTF-8 via TextEncoder at write time). */
export function serializeBundle(b: NotebookBundle): string {
  return JSON.stringify({
    v: b.v,
    notebooks: b.notebooks.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
    })),
    activeId: b.activeId,
  });
}

/**
 * Parse slot plaintext into a bundle. Unrecognized or malformed input
 * becomes a single-notebook bundle holding the raw text, so nothing the
 * user typed before is ever discarded by a shape mismatch.
 */
export function deserializeBundle(raw: string): NotebookBundle {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidate = parsed as Partial<NotebookBundle> & {
      notebooks?: unknown;
      activeId?: unknown;
    };
    if (
      candidate &&
      typeof candidate === "object" &&
      candidate.v === 1 &&
      Array.isArray(candidate.notebooks) &&
      candidate.notebooks.length >= 1 &&
      typeof candidate.activeId === "string"
    ) {
      const notebooks: Notebook[] = [];
      for (const n of candidate.notebooks as unknown[]) {
        if (!n || typeof n !== "object") continue;
        const rec = n as Record<string, unknown>;
        const id = typeof rec.id === "string" && rec.id.length > 0 ? rec.id : newId();
        const title = clampTitle(
          typeof rec.title === "string" ? rec.title : "",
          `Notebook ${notebooks.length + 1}`,
        );
        const content = typeof rec.content === "string" ? rec.content : "";
        notebooks.push({ id, title, content });
        if (notebooks.length >= MAX_NOTEBOOKS_PER_SLOT) break;
      }
      if (notebooks.length > 0) {
        const activeId = notebooks.some((n) => n.id === candidate.activeId)
          ? (candidate.activeId as string)
          : notebooks[0].id;
        return { v: 1, notebooks, activeId };
      }
    }
  } catch {
    // Not JSON, or not our JSON. Fall through to single-notebook wrap.
  }
  return createBundle({ content: raw });
}

/** The currently-focused notebook. Always defined; bundle is invariant non-empty. */
export function getActive(b: NotebookBundle): Notebook {
  return b.notebooks.find((n) => n.id === b.activeId) ?? b.notebooks[0];
}

export function updateActiveContent(
  b: NotebookBundle,
  content: string,
): NotebookBundle {
  return {
    ...b,
    notebooks: b.notebooks.map((n) =>
      n.id === b.activeId ? { ...n, content } : n,
    ),
  };
}

export function renameNotebook(
  b: NotebookBundle,
  id: string,
  title: string,
): NotebookBundle {
  const clamped = clampTitle(title, "Untitled");
  return {
    ...b,
    notebooks: b.notebooks.map((n) =>
      n.id === id ? { ...n, title: clamped } : n,
    ),
  };
}

export function addNotebook(
  b: NotebookBundle,
  title?: string,
): NotebookBundle {
  if (b.notebooks.length >= MAX_NOTEBOOKS_PER_SLOT) return b;
  const nb: Notebook = {
    id: newId(),
    title: clampTitle(title ?? "", `Notebook ${b.notebooks.length + 1}`),
    content: "",
  };
  return {
    ...b,
    notebooks: [...b.notebooks, nb],
    activeId: nb.id,
  };
}

/**
 * Remove a notebook. The bundle must remain non-empty (we need
 * somewhere for the cursor to live), so attempting to remove the last
 * one is a no-op instead of an error.
 */
export function removeNotebook(b: NotebookBundle, id: string): NotebookBundle {
  if (b.notebooks.length <= 1) return b;
  const next = b.notebooks.filter((n) => n.id !== id);
  const activeId =
    id === b.activeId ? next[0].id : b.activeId;
  return { ...b, notebooks: next, activeId };
}

export function setActive(b: NotebookBundle, id: string): NotebookBundle {
  if (!b.notebooks.some((n) => n.id === id)) return b;
  return { ...b, activeId: id };
}

/**
 * Move a notebook to a new index. Both indices are clamped to
 * `[0, notebooks.length - 1]`; no-op if they resolve equal. Preserves
 * the active id.
 */
export function moveNotebook(
  b: NotebookBundle,
  fromIndex: number,
  toIndex: number,
): NotebookBundle {
  const len = b.notebooks.length;
  if (len < 2) return b;
  const from = Math.max(0, Math.min(len - 1, fromIndex));
  const to = Math.max(0, Math.min(len - 1, toIndex));
  if (from === to) return b;
  const next = b.notebooks.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return { ...b, notebooks: next };
}

/** Serialized size in bytes. Used by the UI for its capacity meter. */
export function bundleByteLength(b: NotebookBundle): number {
  return new TextEncoder().encode(serializeBundle(b)).length;
}
