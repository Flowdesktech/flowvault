# Flowvault

> **Available for hire** — I build privacy-first apps and take on contract
> engineering or business-idea work. If you have a project, a product
> concept, or just want someone who ships zero-knowledge / crypto UX
> carefully, reach out: **[contact@flowdesk.tech](mailto:contact@flowdesk.tech)**.

A zero-knowledge encrypted notepad with **plausible deniability** — a single
URL can hide multiple notebooks behind different passwords, and the server
cannot tell how many notebooks actually exist.

- **Live**: [https://flowvault.flowdesk.tech](https://flowvault.flowdesk.tech)
- **Source**: [https://github.com/Flowdesktech/flowvault](https://github.com/Flowdesktech/flowvault) — frontend, Cloud Functions, and Firestore rules all in this repo
- **Hire / business**: [contact@flowdesk.tech](mailto:contact@flowdesk.tech)

Built with Next.js, Firebase Firestore for opaque ciphertext storage, and
Firebase Functions for dead-man's-switch orchestration. All cryptography runs
in the browser.

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


### Features you actually want

- **Hidden-volume vaults** — the headline feature. One URL, N notebooks, one blob. If someone coerces a password out of you at a border crossing, you hand over the decoy. Cryptographically indistinguishable from a single-notebook vault.
- **Time-locked notes** — encrypt a message to a future date using the [drand](https://drand.love) public randomness beacon and the [tlock](https://github.com/drand/tlock-js) scheme (identity-based encryption over BLS12-381). The ciphertext is stored opaquely; the decryption key literally does not exist until drand's network publishes the target round signature. Nobody — not us, not the sender, not a subpoena — can unlock it early. Share links look like `flowvault.flowdesk.tech/t/<id>`. **Optional password gate:** tick *"Also require a password to read"* and the note is double-wrapped — an inner AES-256-GCM layer keyed by Argon2id(password), and an outer tlock layer keyed to the unlock round. Leaked link alone can't read it; the reader needs both the time to pass and the password (shared out-of-band).
- **Dead-man's switch** — arm a vault so it auto-releases to a pre-chosen beneficiary password if you stop saving for the interval + grace you configure. Weekly / monthly / quarterly / yearly presets. The beneficiary key wraps your master key client-side; the server just schedules the release. Hourly Cloud Function sweeps expired configs; the Firestore rules forbid clients from faking a release or extending one they can't actually open.
- **Optimistic concurrency** — edit the same vault in two browser tabs without losing work.
- **Modern editor** — keyboard-first (Ctrl/Cmd+S), auto-save with visible status, dark mode, clean typography.
- **Slot capacity meter** — you always know how much space you have in your notebook.

### Trust & transparency

- **Open source, end to end.** Not just the frontend — the **Cloud Functions** (the dead-man's-switch sweep) and the **Firestore security rules** (the actual boundary that stops us from reading or mutating your data) are in the same repository, deployed unmodified. ProtectedText publishes its client JS for inspection but explicitly does not open its server code (per their own FAQ). Flowvault is reviewable, licensed, forkable, and self-hostable end-to-end.
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
- Dead-man's switch: configure / heartbeat-on-save / scheduled release / beneficiary unlock flow
- drand-backed time-locked notes (`/timelock/new` compose → `/t/{id}` view) via [tlock-js](https://github.com/drand/tlock-js)

In progress / planned:

- Multi-slot notebooks (currently one slot = one notebook)
- Markdown preview + code syntax highlighting
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

### Why direct wallet addresses, not Plisio / NOWPayments / etc.

We evaluated crypto payment gateways (Plisio, NOWPayments, CoinGate) and
passed. Even though those services handle crypto, their donation flows
**still collect a donor email** for receipts — which contradicts the
product. Instead, Flowvault publishes raw wallet addresses on `/donate`:

- No middleman — your wallet talks directly to the blockchain
- No email or personal info ever requested
- No third-party JavaScript loaded on the donate page
- Monero supported for donors who want amounts + identities cryptographically
hidden, not merely pseudonymous

Every traditional payment rail (cards, PayPal, Stripe) requires identifying
info to receive money. Crypto addresses are the only option that lets us
receive your support without also receiving a dossier on you.

### Configuring addresses

Set any of the following in `.env.local` (leave empty to hide that coin):

```
NEXT_PUBLIC_BTC_ADDRESS=
NEXT_PUBLIC_ETH_ADDRESS=
NEXT_PUBLIC_LTC_ADDRESS=
NEXT_PUBLIC_XMR_ADDRESS=
NEXT_PUBLIC_USDT_TRC20_ADDRESS=
NEXT_PUBLIC_USDT_ERC20_ADDRESS=
NEXT_PUBLIC_SOL_ADDRESS=
```

The `/donate` page renders QR codes and copy buttons for whichever
addresses are set.

### Non-crypto ways to help

If crypto is a non-starter for you, no pressure — these help just as much:

- Use Flowvault and tell someone who'd benefit
- Star the GitHub repository
- File a thoughtful bug report or security issue
- Submit a PR

## License

MIT (planned).