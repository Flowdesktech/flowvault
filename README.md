# Flowvault

**A zero-knowledge encrypted notepad with plausible deniability.** One
URL can hide multiple notebooks behind different passwords, and neither
the server nor anyone who steals the ciphertext blob can tell how many
notebooks actually exist.

**[Try it](https://flowvault.flowdesk.tech)** · **[Blog](https://flowvault.flowdesk.tech/blog)** · **[Security](https://flowvault.flowdesk.tech/security)** · **[Self-host](#setup)** · **[Donate](https://flowvault.flowdesk.tech/donate)**

What&rsquo;s unique in this category:

- **Hidden volumes** &mdash; VeraCrypt-style plausible deniability for a browser notepad. One URL, up to 64 notebooks, each behind its own password. Empty slots are indistinguishable from real ciphertext. ([deep dive](https://flowvault.flowdesk.tech/blog/plausible-deniability-hidden-volumes-explained))
- **Trusted handover** &mdash; nominate a beneficiary with a separate password; if you stop checking in for an interval you configure, the vault auto-hands over. No account required for either party. ([deep dive](https://flowvault.flowdesk.tech/blog/trusted-handover-encrypted-notes-beneficiary))
- **Time-locked notes** &mdash; drand + tlock identity-based encryption, so even the sender can&rsquo;t decrypt a message before its target date. ([deep dive](https://flowvault.flowdesk.tech/blog/time-locked-notes-drand-tlock))
- **Encrypted Send** &mdash; one-shot, self-destructing links for sharing a password or recovery phrase. Key in the URL fragment, view cap enforced server-side by a Cloud Function. ([vs Bitwarden Send / Privnote](https://flowvault.flowdesk.tech/blog/encrypted-send-vs-bitwarden-send-privnote))
- **Bring Your Own Storage** &mdash; keep the whole ciphertext on your own disk as a single `.flowvault` file via the File System Access API. Same hidden-volume format, same Argon2id + AES-GCM, same multi-notebook tabs &mdash; the server just never sees the blob. S3-compatible and WebDAV backends are on the roadmap.
- **Markdown preview &amp; syntax-highlighted code blocks** &mdash; GitHub-flavored Markdown (tables, task lists, fenced code) renders in-browser with a toggleable Edit / Preview / Split view. HTML is blocked by default, external images are click-to-load, and external links use `no-referrer` &mdash; a preview that can&rsquo;t quietly exfiltrate your vault contents. ([deep dive](https://flowvault.flowdesk.tech/blog/markdown-preview-code-highlighting))
- **Zero-knowledge `.fvault` backup + plaintext Markdown export** &mdash; portable across self-hosted instances, still opaque on disk. ([format spec](https://flowvault.flowdesk.tech/blog/encrypted-backup-fvault-format))
- **Open end-to-end.** Frontend, Cloud Functions, and Firestore security rules all live in this repo. MIT-licensed. Self-hostable. ([vs ProtectedText](https://flowvault.flowdesk.tech/blog/flowvault-vs-protectedtext))

Built with Next.js, Firebase Firestore (opaque ciphertext storage),
Firebase Functions, and client-side Argon2id (64 MiB / 3 iter) +
AES-256-GCM. No account, no email, no phone number &mdash; a URL slug
and a password is the whole identity system.

> **Available for hire** &mdash; Flowvault is built by
> **[Flowdesk](https://flowdesk.tech)**, a small studio shipping
> privacy-first web apps, end-to-end encrypted systems, crypto/web3
> products, and native & hybrid mobile apps. Led by a senior engineer
> with **4 years shipping production cryptography at
> [FlowCrypt](https://flowcrypt.com)** (OpenPGP email &mdash; iOS + Chrome
> Extension, 2022&ndash;2026). Limited engagements per quarter &mdash;
> reach out at
> **[contact@flowdesk.tech](mailto:contact@flowdesk.tech?subject=Flowdesk%20%E2%80%94%20project%20inquiry%20(via%20Flowvault))**.

---

## Why use Flowvault instead of ProtectedText (or similar)?

Flowvault is not "another ProtectedText clone." It's a deliberate upgrade on
nearly every dimension that matters for a zero-knowledge notepad.

### Security


| Property                           | Flowvault                                                                      | ProtectedText                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Password-to-key derivation         | **Argon2id**, 64 MiB memory-hard, 3 iterations, HKDF expansion                 | Argon2id, 32 MiB, adaptive ~300 ms (per current `main.js`)                                |
| Legacy plaintext-password blob     | **No** — every blob requires the full Argon2 chain                             | **Yes** — every save also uploads `encryptedContentLegacy` keyed only by the raw password |
| Encryption                         | **AES-256-GCM** (authenticated: ciphertext cannot be tampered with undetected) | AES-256-CBC via CryptoJS (no authentication, malleable)                                   |
| Plausible deniability              | **Yes** — multiple passwords unlock different notebooks on the same URL        | No — one password, one blob                                                               |
| Fixed-size ciphertext              | **Yes** — every vault is exactly 512 KiB regardless of content                 | No — blob size leaks how much you've written                                              |
| Tamper detection                   | **Yes** — GCM auth tag fails on any modification                               | No — bitflips go undetected                                                               |
| KDF parameters stored in the vault | **Yes** — upgradable without breaking old vaults                               | No — clients pick parameters at save time                                                 |
| Optimistic concurrency on writes   | **Yes** — two tabs can't silently clobber each other                           | Hash-based overwrite protection (works, but pessimistic — fails the second writer)        |
| Open source                        | **Frontend + Cloud Functions + Firestore rules**, MIT-licensed, self-hostable  | Client JS inspectable in browser; **server code explicitly closed** (per their own FAQ)   |
| Bring Your Own Storage             | **Yes** — vault can live as a single `.flowvault` file on your own disk (File System Access API); S3-compatible & WebDAV planned | No — vault always lives on their server                                                    |


### Features you actually want

- **Hidden-volume vaults** — the headline feature. One URL, N notebooks, one blob. If someone coerces a password out of you at a border crossing, you hand over the decoy. Cryptographically indistinguishable from a single-notebook vault.
- **Multi-notebook tabs** — each password now unlocks a *workspace*, not just one page. Add tabs, rename them, reorder them, delete them. Everything lives inside the same encrypted slot, so the tab list, titles, and contents are all zero-knowledge — the server sees one opaque blob, same as always. Decoy passwords get their own independent tab set in their own slot; adding tabs in your real notebook doesn't touch the decoy and vice versa.
- **Time-locked notes** — encrypt a message to a future date using the [drand](https://drand.love) public randomness beacon and the [tlock](https://github.com/drand/tlock-js) scheme (identity-based encryption over BLS12-381). The ciphertext is stored opaquely; the decryption key literally does not exist until drand's network publishes the target round signature. Nobody — not us, not the sender, not a subpoena — can unlock it early. Share links look like `flowvault.flowdesk.tech/t/<id>`. **Optional password gate:** tick *"Also require a password to read"* and the note is double-wrapped — an inner AES-256-GCM layer keyed by Argon2id(password), and an outer tlock layer keyed to the unlock round. Leaked link alone can't read it; the reader needs both the time to pass and the password (shared out-of-band).
- **Encrypted Send** — one-shot, self-destructing notes for sharing a password, an API key, a recovery phrase, or any snippet you'd rather not sit in chat history. AES-256-GCM encrypted in the browser; the 256-bit key travels in the URL fragment (`#k=...`), which browsers never send to servers. Pick an expiry (up to 30 days) and a view count (default 1); the server hard-deletes the ciphertext the moment the last view is consumed, and a scheduled sweep removes anything past its TTL. Reads go through a Cloud Function so the view counter is atomic — clients can't read the document directly (rules deny it). **Optional password gate** on top, using the same FVPW frame as time-locks, so even a leaked link needs an out-of-band password. Share links look like `flowvault.flowdesk.tech/send/<id>#k=<key>`.
- **Bring Your Own Storage (BYOS) — local `.flowvault` files.** Prefer not to leave even ciphertext on a server? Create a vault that lives as a single file on your own disk (`D:\notes\journal.flowvault`, an encrypted external drive, whatever you like). The editor opens the file via the File System Access API and reads/writes ciphertext in place; our backend never sees the blob or the file name. The on-disk format is a small JSON header (UUID, Argon2id salt, KDF params, volume layout, monotonic CAS counter) followed by the raw fixed-size hidden-volume blob — byte-for-byte the same ciphertext that would live in Firestore for a hosted vault. Multi-notebook tabs, decoy passwords, and `.fvault` backup/plaintext-Markdown export all work the same; trusted handover is disabled for local vaults because it needs a server-held scheduler. Chromium-based browsers only for now (Chrome, Edge, Brave, etc.); S3-compatible (R2, B2, MinIO) and WebDAV backends are on the roadmap — [open an issue](https://github.com/Flowdesktech/flowvault/issues/new) if one of those would unblock you.
- **Trusted handover** — nominate a beneficiary and a check-in cadence. If you stop saving for the interval + grace you configure, the vault auto-hands over to a pre-chosen beneficiary password. Weekly / monthly / quarterly / yearly presets. The beneficiary key wraps your master key client-side; the server just schedules the release. Hourly Cloud Function sweeps expired configs; the Firestore rules forbid clients from faking a release or extending one they can't actually open.
- **Markdown preview with security-first defaults.** Notes render as GitHub-flavored Markdown in-browser: tables, task lists, strikethrough, autolinks, fenced code blocks with Prism syntax highlighting for every common language. A segmented toggle in the toolbar flips between Edit / Preview / Split; the mode preference persists per device in `localStorage` (not in the encrypted blob, so you don't burn bytes of your 512 KiB slot on UI state). The preview is deliberately unusual: **raw HTML is blocked** (`<script>`, `<iframe>`, arbitrary tags render as literal text), **external images are click-to-load** with a placeholder showing the URL (so `![](https://attacker/pixel?v=target)` can't silently phone home the moment your vault opens), and **external links open with `target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"`** so the destination site never learns where the referrer was. Code highlighting runs locally via `prism-react-renderer` &mdash; no network request, no WASM, no remote theme fetch. The renderer bundle itself is lazy-loaded via `next/dynamic`, so users who live in Edit mode never download it.
- **Optimistic concurrency** — edit the same vault in two browser tabs without losing work.
- **Modern editor** — keyboard-first (Ctrl/Cmd+S), auto-save with visible status, dark mode, clean typography.
- **Slot capacity meter** — you always know how much space you have in your notebook.
- **Encrypted backup & restore** — download the full vault as a `.fvault` file (opaque ciphertext + KDF params + volume layout). The file is exactly as zero-knowledge as the live vault: it still needs your password to read, and every decoy slot stays indistinguishable from random bytes. Restore to any fresh slug on any Flowvault instance (including a self-hosted one) from `/restore`. Plaintext Markdown export (current slot only) is also available, behind a confirmation, for migrating out to Obsidian et al.

### Trust & transparency

- **Open source, end to end.** Not just the frontend — the **Cloud Functions** (the trusted-handover sweep) and the **Firestore security rules** (the actual boundary that stops us from reading or mutating your data) are in the same repository, deployed unmodified. ProtectedText publishes its client JS for inspection but explicitly does not open its server code (per their own FAQ). Flowvault is reviewable, licensed, forkable, and self-hostable end-to-end.
- **No ads. No tracking. No analytics.** Your browser talks to Firestore and nothing else.
- **No account, no email, no phone number.** A URL slug and a password are all you ever provide.
- **Self-hostable, whole-stack.** Bring your own Firebase project; the frontend, Functions, and rules all deploy from a single `npm` workspace.
- **Published threat model.** We tell you exactly what we can and cannot protect against — including the cases where plausible deniability is weaker (e.g., a persistent network observer correlating writes).
- **Zero-knowledge firewall enforced by Firestore rules.** The rules are short, public, and auditable. We physically can't read your notes even if we wanted to.
- **Planned build transparency.** Release commits will be tagged and their bundle hashes published, so you can verify the JS your browser runs matches a reviewable commit.

### Ergonomic upgrades

- Clean, modern UI with dark mode by default
- Ctrl/Cmd+S to save, save status indicator, dirty-state warning before close
- Slug validation (no surprises with weird characters)
- Fast password gate that tells you clearly whether a vault exists or is new
- Byte/capacity counter so you see when you're near slot limits

---

## Setup

```bash
# 1. Install deps
npm install
(cd functions && npm install)

# 2. Create a Firebase project and paste the config
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_FIREBASE_* values from the Firebase console.

# 3. Deploy the security rules (requires firebase-tools)
npx firebase deploy --only firestore:rules

# 4. Run locally
npm run dev
```

To exercise the Firebase emulators instead of deploying:

```bash
npx firebase emulators:start --only firestore,functions
```

## Firestore schema (summary)

```
sites/{siteId}
  ciphertext:  bytes         # fixed-size hidden-volume blob (default 64 × 8 KiB = 512 KiB)
  kdfSalt:     bytes         # per-site Argon2id salt
  kdfParams:   map           # algorithm + cost parameters, upgradable
  volume:      map           # { slotCount, slotSize, frameVersion }
  version:     number        # CAS counter
  createdAt:   Timestamp
  updatedAt:   Timestamp
```

See `firestore.rules` for the complete zero-knowledge rule set.

## Security & threat model

See the `/security` page rendered in the app, which documents what the server
sees, what the hidden-volume format protects against, and — honestly — the
cases where it does not (e.g., persistent network observation of writes).

## Roadmap

Shipped:

- Core zero-knowledge notepad
- Hidden-volume format for plausible deniability (64 × 8 KiB slots)
- Argon2id + AES-GCM
- Optimistic concurrency on writes
- Decoy-password management UI ("Add password" in the editor)
- Trusted handover: configure / heartbeat-on-save / scheduled release / beneficiary unlock flow
- drand-backed time-locked notes (`/timelock/new` compose → `/t/{id}` view) via [tlock-js](https://github.com/drand/tlock-js)
- Encrypted Send: one-shot, self-destructing notes (`/send/new` → `/send/{id}#k=<key>`)
- Multi-notebook tabs per slot — one password, many tabs, all inside the same encrypted blob
- Encrypted backup/restore (`.fvault`) + plaintext Markdown export for migration
- Bring Your Own Storage — local `.flowvault` vault files via the File System Access API (first non-Firestore adapter)
- Markdown preview + syntax-highlighted code blocks — GitHub-flavored Markdown, Edit / Preview / Split toggle, HTML blocked, external images click-to-load, external links `no-referrer`

In progress / planned:

- **Bring Your Own Storage: more backends** — S3-compatible (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO), WebDAV (Nextcloud, ownCloud), and experimental IPFS / Storj. All sharing the same `VaultStorageAdapter` interface the local-file adapter already uses. Prioritised by user demand — [open a GitHub issue](https://github.com/Flowdesktech/flowvault/issues/new) if one of these would unblock you.
- PWA / offline mode
- Signed build hashes + transparency log

## Deployment & CI

The split is: **Vercel deploys the Next.js frontend automatically via its
GitHub integration. GitHub Actions deploys the Firebase backend** — Cloud
Functions, Firestore security rules, and Firestore indexes — which Vercel
does not touch.

Workflows in `.github/workflows/`:

- `ci.yml` — runs on every PR and push: lint, TypeScript type-check, and
production build for both the Next.js app and the Cloud Functions
workspace. Catches regressions before they reach either Vercel or
Firebase.
- `deploy-firebase.yml` — runs on pushes to `master` that touch
`functions/`**, `firestore.rules`, `firestore.indexes.json`, or
`firebase.json` (plus a manual `workflow_dispatch`). Builds the
Functions, authenticates with a service account, and runs
`firebase deploy --only functions,firestore:rules,firestore:indexes`.

Required repository **secrets** (Settings → Secrets and variables → Actions):


| Secret                                     | Purpose                                                                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT`                 | Full JSON of a service account with roles: Cloud Functions Admin, Firebase Rules Admin, Service Account User, Cloud Datastore Index Admin, and (first deploy only) Artifact Registry Writer. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Public client config — also configured in Vercel, duplicated here so CI builds succeed.                                                                                                      |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | same                                                                                                                                                                                         |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | same                                                                                                                                                                                         |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | same                                                                                                                                                                                         |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | same                                                                                                                                                                                         |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | same                                                                                                                                                                                         |


Required repository **variables** (non-secret, Settings → Secrets and
variables → Actions → *Variables* tab):


| Variable                 | Example                                     |
| ------------------------ | ------------------------------------------- |
| `FIREBASE_PROJECT_ID`    | `flowvault-prod`                            |
| `NEXT_PUBLIC_APP_URL`    | `https://flowvault.flowdesk.tech`           |
| `NEXT_PUBLIC_GITHUB_URL` | `https://github.com/Flowdesktech/flowvault` |


**Vercel's GitHub integration handles the frontend automatically.**
Connecting the repository to a Vercel project is enough:

- Push to `master` &rarr; production deploy at the canonical domain.
- Push to any other branch, or open a PR &rarr; preview deploy at a
  `*.vercel.app` URL.
- `NEXT_PUBLIC_*` env vars live in Vercel's project settings and are
  injected at build time.

Nothing in this repo needs to push to Vercel, so no `VERCEL_TOKEN` /
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` secrets are required in GitHub.
The Firebase workflow above is the only deploy this repo owns.

(If you ever want to drive Vercel from Actions instead &mdash; for
example to keep all build logs in one place &mdash; the commands are
`vercel pull --environment=production`, `vercel build --prod`, and
`vercel deploy --prebuilt --prod`. Plain `vercel deploy` without
`--prod` produces a preview, not a production release.)

## Support Flowvault

Flowvault is built on the honor system. We don't show ads, sell data, or ask
for your email — by design, not oversight. Those are the usual ways an app
pays for itself, and all of them conflict with being zero-knowledge.

### Crypto donations via NOWPayments

Donations go through the [NOWPayments](https://nowpayments.io) donation
widget, embedded on `/donate`. We picked it because it's one of the
very few processors where **a donor can contribute without creating an
account or providing an email** — receipts are optional, only generated
if the donor wants one. The widget also generates a fresh deposit
address per donation, so two donors can't cross-reference each other
on-chain.

- ~100+ coins supported (BTC, ETH, LTC, XMR, USDT on TRC-20 / ERC-20, SOL, and many more)
- Monero (XMR) available for donors who want amount + identity cryptographically hidden, not merely pseudonymous
- No donor sign-up, no donor email required
- Tor / VPN friendly on the donor side
- Short / vanity link: `https://nowpayments.io/donation/flowdesktech`

Every traditional payment rail (cards, PayPal, Stripe) requires
identifying info to receive money. A processor with an anonymous
donation flow is the closest match to the rest of Flowvault's model.

### Configuring the donation widget

Set these in `.env.local` (they aren't secrets — both are embedded in
the public bundle and visible in the iframe `src`):

```
NEXT_PUBLIC_NOWPAYMENTS_API_KEY=d1809dbe-265d-44fc-af65-16cce1b7186b
NEXT_PUBLIC_NOWPAYMENTS_DONATION_URL=https://nowpayments.io/donation/flowdesktech
```

If you fork Flowvault and want donations to go to your own NOWPayments
account, replace both values with your own api key and vanity slug.

### Non-crypto ways to help

If crypto is a non-starter for you, no pressure — these help just as much:

- Use Flowvault and tell someone who'd benefit
- Star the GitHub repository
- File a thoughtful bug report or security issue
- Submit a PR

## License

MIT. See [`LICENSE`](./LICENSE) for the full text.

---

<p align="center">
  <a href="https://www.shipit.buzz/products/flowvault?ref=badge" target="_blank" rel="noopener noreferrer"><img src="https://www.shipit.buzz/api/products/flowvault/badge?theme=dark" alt="Featured on Shipit" /></a>
</p>