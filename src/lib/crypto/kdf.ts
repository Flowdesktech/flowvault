/**
 * Password-based key derivation using Argon2id.
 * hash-wasm provides a WebAssembly Argon2 implementation that runs in both the
 * browser and Node.
 *
 * Parameters are chosen for an interactive web experience on commodity hardware
 * (~500ms on a modern laptop). They are intentionally aggressive relative to
 * PBKDF2-SHA256 used by classic tools like ProtectedText: 64 MiB memory and
 * 3 passes of Argon2id raise the cost of offline brute force dramatically.
 *
 * These parameters are embedded in the site document so future upgrades can be
 * rolled out without breaking old vaults.
 */
import { argon2id } from "hash-wasm";

export const KDF_PARAMS = {
  algorithm: "argon2id" as const,
  version: 1,
  memoryKiB: 64 * 1024, // 64 MiB
  iterations: 3,
  parallelism: 1,
  keyLengthBytes: 32,
};

export async function deriveMasterKey(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  if (salt.length < 16) throw new Error("salt must be >= 16 bytes");
  const hex = await argon2id({
    password,
    salt,
    parallelism: KDF_PARAMS.parallelism,
    iterations: KDF_PARAMS.iterations,
    memorySize: KDF_PARAMS.memoryKiB,
    hashLength: KDF_PARAMS.keyLengthBytes,
    outputType: "binary",
  });
  return hex as Uint8Array;
}
