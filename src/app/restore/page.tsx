import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { RestoreVaultForm } from "@/components/RestoreVaultForm";
import { APP_URL } from "@/lib/config";

const TITLE = "Restore vault from backup — Flowvault";
const DESCRIPTION =
  "Restore a Flowvault encrypted backup (.fvault) to a fresh URL. The backup stays zero-knowledge: the server never sees your password, and every slot in the file remains encrypted under its original key.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/restore" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: `${APP_URL}/restore`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RestorePage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-accent">
            Flowvault &middot; Restore
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Restore from an encrypted backup.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Drop a{" "}
            <code className="rounded bg-background-elev-2 px-1 py-0.5 font-mono text-xs">
              .fvault
            </code>{" "}
            file to recreate a vault on this instance. The file itself
            is still zero-knowledge &mdash; every slot stays encrypted
            under its original password, we simply write the ciphertext
            and its KDF/volume metadata back into Firestore at the slug
            you choose. Restoring never needs a password; reading
            afterwards still does.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-background-elev p-6">
          <RestoreVaultForm />
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-background-elev p-6 text-sm text-muted">
          <h2 className="text-foreground font-medium">
            How does this stay zero-knowledge?
          </h2>
          <p className="mt-2">
            A Flowvault backup is exactly what the server already has
            for that vault: an opaque ciphertext blob plus the Argon2id
            salt and KDF parameters. No password is embedded, and
            individual notebooks are still packed inside the
            hidden-volume format &mdash; including any decoy passwords
            you might have added. The file alone is indistinguishable
            from random bytes without a password, modulo the thin JSON
            envelope.
          </p>
          <p className="mt-3">
            Don&apos;t have a backup yet? Open any vault and use{" "}
            <span className="font-medium text-foreground">
              Export &rarr; Encrypted backup
            </span>{" "}
            in the top toolbar.
          </p>
          <p className="mt-3">
            Or{" "}
            <Link href="/" className="text-accent hover:underline">
              head back to the home page
            </Link>{" "}
            to open an existing vault.
          </p>
        </section>
      </main>
    </>
  );
}
