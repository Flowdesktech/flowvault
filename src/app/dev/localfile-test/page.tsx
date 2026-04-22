"use client";

/**
 * Development-only harness for the LocalFile BYOS adapter.
 *
 * This page is intentionally ugly: it exists so we can exercise
 * `createLocalFileVaultStorage` by hand against a real
 * `FileSystemFileHandle` before wiring the adapter into the real UI.
 * It does NOT use the real vault crypto — payloads are random bytes
 * sized to match `VOLUME_DEFAULTS`, which is enough to prove the
 * format, CAS semantics, and permission flow end-to-end.
 *
 * Routes under `/dev/*` are not linked from the app chrome; do not
 * ship this page to end users, and remove it (or gate it behind an
 * env flag) before production rollout of BYOS.
 */
import { useCallback, useState } from "react";
import { createLocalFileVaultStorage } from "@/lib/storage/localFile/adapter";
import {
  decodeLocalVaultFile,
  looksLikeLocalVaultFile,
} from "@/lib/storage/localFile/format";
import {
  ensurePermission,
  forgetHandle,
  isFileSystemAccessSupported,
  rememberHandle,
  touchOpened,
} from "@/lib/storage/localFile/handleRegistry";
import { VOLUME_DEFAULTS } from "@/lib/crypto/volume";
import { randomBytes } from "@/lib/crypto/random";
import type { VaultStorageAdapter } from "@/lib/storage/adapter";

interface HarnessState {
  fileName: string;
  localSiteId: string;
  version: number;
  adapter: VaultStorageAdapter;
}

type LogLine = { kind: "info" | "ok" | "err"; text: string };

function makeRandomCiphertext(): Uint8Array {
  return randomBytes(VOLUME_DEFAULTS.slotCount * VOLUME_DEFAULTS.slotSize);
}

function makeLocalSiteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Tolerable fallback for unusual environments.
  const b = randomBytes(16);
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

// File System Access picker APIs are not yet in the default DOM lib in
// some TypeScript targets; narrow the surface we call against `window`.
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}
interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}
type PickerWindow = typeof window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
};

const FLOWVAULT_FILE_TYPE: FilePickerAcceptType = {
  description: "Flowvault local vault",
  accept: { "application/octet-stream": [".flowvault"] },
};

export default function LocalFileTestPage() {
  const [state, setState] = useState<HarnessState | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [staleVersion, setStaleVersion] = useState<number | null>(null);

  const supported =
    typeof window !== "undefined" && isFileSystemAccessSupported();

  const append = useCallback((line: LogLine) => {
    setLog((prev) => [...prev.slice(-49), line]);
  }, []);
  const info = useCallback(
    (text: string) => append({ kind: "info", text }),
    [append],
  );
  const ok = useCallback(
    (text: string) => append({ kind: "ok", text }),
    [append],
  );
  const err = useCallback(
    (text: string) => append({ kind: "err", text }),
    [append],
  );

  const onCreate = useCallback(async () => {
    try {
      const w = window as PickerWindow;
      if (!w.showSaveFilePicker) {
        err("showSaveFilePicker is not available in this browser.");
        return;
      }
      const handle = await w.showSaveFilePicker({
        suggestedName: "dev-vault.flowvault",
        types: [FLOWVAULT_FILE_TYPE],
      });
      const granted = await ensurePermission(handle, "readwrite");
      if (!granted) {
        err("Permission denied for the selected file.");
        return;
      }
      const localSiteId = makeLocalSiteId();
      const adapter = createLocalFileVaultStorage(handle, localSiteId);
      await adapter.create({
        siteId: localSiteId,
        ciphertext: makeRandomCiphertext(),
        kdfSalt: randomBytes(16),
      });
      await rememberHandle(localSiteId, handle);
      await touchOpened(localSiteId);
      setState({
        fileName: handle.name,
        localSiteId,
        version: 1,
        adapter,
      });
      setStaleVersion(null);
      ok(
        `Created vault file "${handle.name}" with localSiteId=${localSiteId}, version=1.`,
      );
    } catch (e) {
      err(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [err, ok]);

  const onOpen = useCallback(async () => {
    try {
      const w = window as PickerWindow;
      if (!w.showOpenFilePicker) {
        err("showOpenFilePicker is not available in this browser.");
        return;
      }
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        types: [FLOWVAULT_FILE_TYPE],
      });
      const granted = await ensurePermission(handle, "readwrite");
      if (!granted) {
        err("Permission denied for the selected file.");
        return;
      }
      const file = await handle.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length === 0) {
        err("The selected file is empty. Use Create instead.");
        return;
      }
      if (!looksLikeLocalVaultFile(bytes)) {
        err("Not a Flowvault local vault file (magic mismatch).");
        return;
      }
      const parsed = decodeLocalVaultFile(bytes);
      const adapter = createLocalFileVaultStorage(handle, parsed.localSiteId);
      await rememberHandle(parsed.localSiteId, handle);
      await touchOpened(parsed.localSiteId);
      setState({
        fileName: handle.name,
        localSiteId: parsed.localSiteId,
        version: parsed.vaultVersion,
        adapter,
      });
      setStaleVersion(null);
      ok(
        `Opened "${handle.name}" — localSiteId=${parsed.localSiteId}, version=${parsed.vaultVersion}, ciphertext=${parsed.ciphertext.length} B.`,
      );
    } catch (e) {
      err(`Open failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [err, ok]);

  const onRead = useCallback(async () => {
    if (!state) return;
    try {
      const record = await state.adapter.read(state.localSiteId);
      if (!record) {
        err("Read returned null (file deleted or empty).");
        return;
      }
      ok(
        `Read: version=${record.version}, ciphertext=${record.ciphertext.length} B, deadman=${record.deadman === null ? "null" : "present"}.`,
      );
      setState({ ...state, version: record.version });
    } catch (e) {
      err(`Read failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [state, err, ok]);

  const onWriteOk = useCallback(async () => {
    if (!state) return;
    try {
      const before = state.version;
      const result = await state.adapter.writeCiphertext({
        siteId: state.localSiteId,
        ciphertext: makeRandomCiphertext(),
        expectedVersion: before,
      });
      if (!result.ok) {
        err(
          `CAS conflict: expected version ${before}, server says ${result.currentVersion}.`,
        );
        setState({ ...state, version: result.currentVersion });
        return;
      }
      ok(`Wrote new ciphertext. Version ${before} -> ${result.newVersion}.`);
      setStaleVersion(before);
      setState({ ...state, version: result.newVersion });
    } catch (e) {
      err(`Write failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [state, err, ok]);

  const onWriteStale = useCallback(async () => {
    if (!state) return;
    if (staleVersion === null) {
      err("No stale version captured. Write at least once first.");
      return;
    }
    try {
      const result = await state.adapter.writeCiphertext({
        siteId: state.localSiteId,
        ciphertext: makeRandomCiphertext(),
        expectedVersion: staleVersion,
      });
      if (result.ok) {
        err(
          `Unexpected success writing with stale version ${staleVersion}. CAS is broken.`,
        );
        setState({ ...state, version: result.newVersion });
        return;
      }
      ok(
        `CAS correctly rejected stale version ${staleVersion}; current is ${result.currentVersion}.`,
      );
      setState({ ...state, version: result.currentVersion });
    } catch (e) {
      err(
        `Stale write threw unexpectedly: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [state, staleVersion, err, ok]);

  const onForget = useCallback(async () => {
    if (!state) return;
    try {
      await forgetHandle(state.localSiteId);
      ok(`Forgot handle for ${state.localSiteId}.`);
      setState(null);
      setStaleVersion(null);
    } catch (e) {
      err(`Forget failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [state, err, ok]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 font-mono text-sm">
      <header className="border-b border-neutral-700 pb-4">
        <h1 className="text-xl font-bold">LocalFile BYOS harness</h1>
        <p className="mt-1 text-neutral-400">
          Developer-only page. Exercises the File System Access adapter
          without the real vault crypto. Random bytes are used as
          &ldquo;ciphertext&rdquo; to verify the format, CAS, and permission
          flow.
        </p>
      </header>

      {!supported ? (
        <div className="rounded border border-red-700 bg-red-950/40 p-3 text-red-200">
          This browser does not expose the File System Access API. Try
          Chrome, Edge, or another Chromium-based browser.
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!supported}
          className="rounded bg-emerald-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Create new vault file
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={!supported}
          className="rounded bg-sky-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Open existing vault file
        </button>
        <button
          type="button"
          onClick={onRead}
          disabled={!state}
          className="rounded bg-neutral-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Read
        </button>
        <button
          type="button"
          onClick={onWriteOk}
          disabled={!state}
          className="rounded bg-neutral-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Write (CAS ok)
        </button>
        <button
          type="button"
          onClick={onWriteStale}
          disabled={!state || staleVersion === null}
          className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Write with stale version (expect conflict)
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={!state}
          className="rounded bg-red-800 px-3 py-1 text-white disabled:opacity-50"
        >
          Forget handle
        </button>
      </section>

      <section className="rounded border border-neutral-700 p-3">
        <h2 className="mb-2 font-bold">Current state</h2>
        {state ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-neutral-400">file</dt>
            <dd>{state.fileName}</dd>
            <dt className="text-neutral-400">localSiteId</dt>
            <dd>{state.localSiteId}</dd>
            <dt className="text-neutral-400">vaultVersion</dt>
            <dd>{state.version}</dd>
            <dt className="text-neutral-400">staleVersion (for CAS test)</dt>
            <dd>{staleVersion === null ? "—" : staleVersion}</dd>
          </dl>
        ) : (
          <p className="text-neutral-500">No vault file bound.</p>
        )}
      </section>

      <section className="rounded border border-neutral-700 p-3">
        <h2 className="mb-2 font-bold">Log</h2>
        <ol className="flex flex-col gap-1">
          {log.length === 0 ? (
            <li className="text-neutral-500">(empty)</li>
          ) : (
            log.map((line, i) => (
              <li
                key={i}
                className={
                  line.kind === "ok"
                    ? "text-emerald-400"
                    : line.kind === "err"
                      ? "text-red-400"
                      : "text-neutral-300"
                }
              >
                {line.text}
              </li>
            ))
          )}
        </ol>
      </section>
    </main>
  );
}
