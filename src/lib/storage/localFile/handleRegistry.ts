/**
 * Persistent registry for File System Access API handles.
 *
 * `FileSystemFileHandle` objects are structured-cloneable, which means the
 * browser can store them in IndexedDB and hand them back across reloads.
 * This registry keeps a small key-value store that maps our
 * `localSiteId` (the UUID stamped into the `.flowvault` file header) to
 * the handle the user originally granted us.
 *
 * Important browser-model notes:
 *
 *   - Storing the handle does NOT persist the *permission*. Each new
 *     browser session (or even a tab restore, on some builds) requires
 *     calling `requestPermission` again before the first read/write.
 *     We centralize that call in `ensurePermission` below.
 *   - The user can revoke access or delete the file between sessions.
 *     The adapter always has to handle "file gone" gracefully.
 *   - Handles are origin-scoped. They travel with the localStorage /
 *     IndexedDB for this origin; they are NOT shared with other domains
 *     and do NOT need encryption at rest on our side.
 *
 * We do not store secrets here. The handle only grants access to the
 * specific file the user picked; no passphrase or key material is
 * persisted.
 */

const DB_NAME = "flowvault-byos";
const DB_VERSION = 1;
const STORE_HANDLES = "localFileHandles";
const STORE_META = "localFileMeta";

/** Minimal metadata we show in the vault list without touching the actual file. */
export interface LocalVaultMeta {
  localSiteId: string;
  /** The file name at the time the user last picked it. Display-only. */
  fileName: string;
  /** Unix ms when we first registered this handle. */
  registeredAt: number;
  /** Unix ms of the last successful open. */
  lastOpenedAt: number | null;
}

// The File System Access permission API is not yet in TypeScript's lib.dom.
// Augment the global types minimally so the call sites are type-checked.
type FsPermissionState = "granted" | "denied" | "prompt";
interface FsPermissionDescriptor {
  mode?: "read" | "readwrite";
}
declare global {
  interface FileSystemHandle {
    queryPermission?(
      descriptor?: FsPermissionDescriptor,
    ): Promise<FsPermissionState>;
    requestPermission?(
      descriptor?: FsPermissionDescriptor,
    ): Promise<FsPermissionState>;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

/** Store (or replace) the handle + metadata for a local vault. */
export async function rememberHandle(
  localSiteId: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  await tx<IDBValidKey>(STORE_HANDLES, "readwrite", (store) =>
    store.put(handle, localSiteId),
  );
  const now = Date.now();
  const existing = await getMeta(localSiteId);
  const meta: LocalVaultMeta = existing
    ? { ...existing, fileName: handle.name }
    : {
        localSiteId,
        fileName: handle.name,
        registeredAt: now,
        lastOpenedAt: null,
      };
  await tx<IDBValidKey>(STORE_META, "readwrite", (store) =>
    store.put(meta, localSiteId),
  );
}

/** Retrieve a previously-stored handle, or `null` if unknown. */
export async function recallHandle(
  localSiteId: string,
): Promise<FileSystemFileHandle | null> {
  const result = await tx<FileSystemFileHandle | undefined>(
    STORE_HANDLES,
    "readonly",
    (store) =>
      store.get(localSiteId) as IDBRequest<FileSystemFileHandle | undefined>,
  );
  return result ?? null;
}

/** Retrieve the metadata for a local vault without touching the file. */
export async function getMeta(
  localSiteId: string,
): Promise<LocalVaultMeta | null> {
  const result = await tx<LocalVaultMeta | undefined>(
    STORE_META,
    "readonly",
    (store) =>
      store.get(localSiteId) as IDBRequest<LocalVaultMeta | undefined>,
  );
  return result ?? null;
}

/** Update the `lastOpenedAt` timestamp. Best-effort; failures are swallowed. */
export async function touchOpened(localSiteId: string): Promise<void> {
  try {
    const meta = await getMeta(localSiteId);
    if (!meta) return;
    meta.lastOpenedAt = Date.now();
    await tx<IDBValidKey>(STORE_META, "readwrite", (store) =>
      store.put(meta, localSiteId),
    );
  } catch {
    // Non-fatal: metadata is only for display.
  }
}

/** Remove both the handle and metadata. */
export async function forgetHandle(localSiteId: string): Promise<void> {
  await tx<undefined>(STORE_HANDLES, "readwrite", (store) =>
    store.delete(localSiteId),
  );
  await tx<undefined>(STORE_META, "readwrite", (store) =>
    store.delete(localSiteId),
  );
}

/** List all registered local vaults. Order is implementation-defined. */
export async function listLocalVaults(): Promise<LocalVaultMeta[]> {
  return tx<LocalVaultMeta[]>(STORE_META, "readonly", (store) => store.getAll());
}

/**
 * Ensure we have the required permission on a handle.
 *
 * Call sites:
 *   - Before `read` / `refresh`: pass `"read"`.
 *   - Before `create` / `restore` / `writeCiphertext`: pass `"readwrite"`.
 *
 * Must be invoked from a user gesture the first time per session (the
 * spec requires it for prompts). Subsequent calls in the same session
 * return synchronously with the cached grant.
 */
export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  if (typeof handle.queryPermission !== "function") {
    // Very old browsers: assume access is already granted by the picker.
    return true;
  }
  const current = await handle.queryPermission({ mode });
  if (current === "granted") return true;
  if (typeof handle.requestPermission !== "function") return false;
  const requested = await handle.requestPermission({ mode });
  return requested === "granted";
}

/**
 * True if the current browser exposes the subset of File System Access API
 * we rely on. UI should gate the BYOS option on this being true.
 */
export function isFileSystemAccessSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    showOpenFilePicker?: unknown;
    showSaveFilePicker?: unknown;
  };
  return (
    typeof w.showOpenFilePicker === "function" &&
    typeof w.showSaveFilePicker === "function"
  );
}
