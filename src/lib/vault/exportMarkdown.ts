/**
 * Plaintext export: take the currently-unlocked notebook bundle and
 * produce a ZIP of Markdown files the user can drop into Obsidian,
 * Standard Notes, a git repo, or anywhere else.
 *
 * WARNING (surfaced in the UI that calls this): the output is not
 * encrypted. Producing one intentionally moves data out of the
 * zero-knowledge envelope, so the UI must require a fresh,
 * deliberate confirmation before calling.
 *
 * Scope: current slot only. Other slots belong to different passwords
 * and MUST NOT be touched here — we only know how to unwrap the
 * currently-open one, and bundling a decoy slot would silently defeat
 * plausible deniability the moment a user exports while coerced.
 *
 * Zip format: STORE method (method 0, no compression) so we avoid
 * pulling in a compression library. A handful of tiny Markdown files
 * compresses poorly enough that the size penalty is small, and STORE
 * is trivially auditable — ~120 lines of well-known format below.
 */
import type { NotebookBundle } from "@/lib/vault/notebooks";

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Build the zip bytes for an array of {name, data} entries. All files
 * are stored uncompressed. File names are written as UTF-8; the
 * general-purpose bit flag 0x0800 signals UTF-8 to any compliant
 * unzipper (macOS Archive Utility, 7-Zip, unzip, browsers).
 */
function buildZip(entries: ZipEntry[]): Uint8Array {
  const te = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  let offset = 0;

  // DOS time/date = the moment the export was made. The DOS format
  // has 2-second resolution and a 1980 epoch; we encode "now" rather
  // than leave it zeroed so unzippers show a sensible timestamp.
  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((Math.floor(now.getSeconds() / 2)) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = te.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // --- Local file header ---
    const lfh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true); // version needed to extract (2.0)
    dv.setUint16(6, 0x0800, true); // general purpose flags: UTF-8 names
    dv.setUint16(8, 0, true); // method = STORE
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true); // compressed size
    dv.setUint32(22, size, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length
    lfh.set(nameBytes, 30);

    chunks.push(lfh);
    chunks.push(entry.data);

    // --- Central directory entry ---
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true); // central dir signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // flags
    cv.setUint16(10, 0, true); // method
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // LFH offset
    cdh.set(nameBytes, 46);
    centralDirs.push(cdh);

    offset += lfh.length + entry.data.length;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const cd of centralDirs) {
    chunks.push(cd);
    cdSize += cd.length;
  }

  // --- End of central directory ---
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // this disk
  ev.setUint16(6, 0, true); // disk with CD start
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true); // comment length
  chunks.push(eocd);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// Lazy CRC32 table (IEEE polynomial). Cached after first call.
let CRC_TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[i] = c >>> 0;
    }
    CRC_TABLE = t;
  }
  const table = CRC_TABLE;
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = (table[(c ^ data[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Convert a notebook title to a filesystem-safe Markdown filename.
 * Reserves a trailing numeric suffix (`-2`, `-3`, …) for collisions
 * so that two notebooks called "Notes" don't silently clobber each
 * other when extracted.
 */
function sanitizeFilename(title: string, used: Set<string>): string {
  const base =
    title
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-") // filesystem reserved chars
      .replace(/\s+/g, " ")
      .slice(0, 80) || "untitled";
  let candidate = `${base}.md`;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${n}.md`;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Build the Markdown zip for the given bundle. Every tab becomes one
 * `.md` file; a small `README.md` at the root lists them in their
 * on-screen order so the export round-trips back to a human reader
 * cleanly.
 */
export function buildMarkdownZip(
  bundle: NotebookBundle,
  slug: string,
): Uint8Array {
  const te = new TextEncoder();
  const used = new Set<string>();
  const entries: ZipEntry[] = [];
  const manifest: string[] = [];

  for (const n of bundle.notebooks) {
    const fname = sanitizeFilename(n.title, used);
    // Each file starts with a top-level heading so the title is
    // preserved even after the filename is renamed.
    const body = `# ${n.title}\n\n${n.content}\n`;
    entries.push({ name: fname, data: te.encode(body) });
    manifest.push(`- [${n.title}](./${encodeURI(fname)})`);
  }

  const readme =
    `# Flowvault export — /s/${slug}\n\n` +
    `Exported ${new Date().toISOString()}.\n\n` +
    `This archive is PLAINTEXT. Anyone with access to it can read every\n` +
    `tab in the slot that produced it. Store it somewhere you would\n` +
    `store the notes themselves, not somewhere more public.\n\n` +
    `## Notebooks\n\n${manifest.join("\n")}\n`;
  entries.unshift({ name: "README.md", data: te.encode(readme) });

  return buildZip(entries);
}

/**
 * Suggest a filename for the markdown zip, parallel to
 * `suggestedBackupFilename` but for plaintext exports so the user can
 * tell encrypted and plaintext downloads apart at a glance.
 */
export function suggestedMarkdownZipFilename(
  slug: string,
  when: Date = new Date(),
): string {
  const iso = when.toISOString().slice(0, 10);
  const safe = slug.replace(/[^a-z0-9_-]/gi, "-");
  return `flowvault-${safe}-${iso}.plaintext.zip`;
}
