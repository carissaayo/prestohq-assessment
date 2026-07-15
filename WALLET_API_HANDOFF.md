# Wallet & Payments API — Project Handoff
> Use this doc to continue work without re-deriving design decisions.
> Stack conventions follow the hrflow NestJS API layout (see `fafi/.cursor/skills/nestjs-api-structure/SKILL.md`).

## Goal (take-home brief)
Build a **Wallet & Payments API in NestJS** that feels like real fintech code:
- Register / login (email, username, password hashed)
- Fund wallet via **Flutterwave** (real webhook + signature verification)
- Move money out: **bank withdrawal** or **P2P to another user's wallet**
- Money must not be lost, duplicated, or double-spent
- Survive duplicate webhooks and concurrent requests
- At least one **BullMQ** background job doing real async work
- PostgreSQL for financial data
- Deployed publicly + Swagger/Postman + README (how to run + assumptions)

**Out of scope:** Credlock LMS (BNPL, agents, full GL chart of accounts). Patterns only.

---

## Locked product naming
| Term | Meaning |
|------|---------|
| **Transfer** | Credit — fund wallet via Flutterwave |
| **Withdrawal** | Debit outflow — P2P (`WALLET`) or bank (`BANK`) |
| **WalletTransaction** | Append-only money journal (source of truth for balance) |

README must state: *"Transfer means funding; withdrawal covers P2P and bank outflows."*

---

## Locked money model

### Tables
- `User` — email, username, passwordHash (**bcrypt**, cost factor 12)
- `Wallet` — userId, currency (NGN), status (optional balance column — **do not treat as API truth**)
- `WalletTransaction` — journal (CREDIT/DEBIT), **source of truth**
- `Transfer` — Flutterwave funding **operation** / lifecycle
- `Withdrawal` — outflow **operation** / lifecycle (sender-owned)
- `WebhookEvent` — idempotent provider event store
- Optional: `BankAccount`

### WalletTransaction enums
- `type`: `CREDIT` | `DEBIT`
- `purpose`: `FLUTTERWAVE_FUNDING` | `P2P` | `BANK_PAYOUT` | `REVERSAL`
- `status`: `PENDING` | `SUCCESSFUL` | `FAILED`
- Unique `idempotencyKey`
- Links: `transferId` / `withdrawalId` / `reversesTransactionId` / `counterpartWalletId`

### Balance (fresh — no cached balance as API response)
balance = Σ SUCCESSFUL CREDIT amounts − Σ SUCCESSFUL DEBIT amounts

Compute on read via aggregation over `wallet_transactions`.
If `wallet.balance` exists, it is only a denormalized cache for **display/analytics convenience** — **never return it as truth without reconciling to the SUM** (always SUM on `GET /wallets/me`).

### Amounts
Use **integer minor units** (kobo), not floats.

### Who gets journal rows?
| Flow | Journal |
|------|---------|
| Flutterwave fund | 1× CREDIT on funder's wallet (`FLUTTERWAVE_FUNDING`) |
| P2P | Sender DEBIT + recipient CREDIT (`P2P`), same `withdrawalId` |
| Bank payout | Sender DEBIT (`BANK_PAYOUT`); on fail → CREDIT (`REVERSAL`) |
| Recipient of P2P | **Has a CREDIT WalletTransaction** — not a Transfer, not their own Withdrawal |

`Transfer` / `Withdrawal` = workflow parents.
`WalletTransaction` = money truth for **every** wallet every time.

---

## Locked concurrency model — Option A (decided)

**No reliance on a cached balance column for correctness. Ever.** Concurrency safety comes entirely from row locking + fresh aggregation inside the same DB transaction:

1. `BEGIN` transaction.
2. `SELECT * FROM wallets WHERE id = $1 FOR UPDATE` — locks the wallet row, blocks concurrent debits against the same wallet.
3. Inside the same transaction, compute available balance via fresh `SUM` over `wallet_transactions` for that wallet (only `SUCCESSFUL` rows).
4. If `available >= amount`: insert the DEBIT `WalletTransaction` (`SUCCESSFUL`), update workflow row (`Withdrawal`/`Transfer`), `COMMIT`.
5. If insufficient: `ROLLBACK`, return `422`.

For P2P, lock **both** wallets in a single transaction, **ordered by ascending wallet id** (never by "sender then recipient") to avoid deadlocks when two transfers happen in opposite directions concurrently. Debit sender (steps 2–4 above), then credit recipient, then mark `Withdrawal` `SUCCESSFUL` — all in the one transaction.

Any `wallet.balance` column, if it exists at all, is written **only** as a best-effort cache in the same transaction as the journal insert, purely for cheap list/dashboard reads elsewhere in the app — **never** consulted for the `WHERE balance >= amount` guard, and never returned by `GET /wallets/me` without being reconciled against SUM first. Simplest to just omit the column entirely for this take-home and say so in the README.

---

## Locked idempotency model

**Client-supplied idempotency keys**, not server-derived fingerprints. Rationale to put in README:

> Idempotency protects against retries of a specific client intent (e.g. a timed-out request being resent). Only the client can distinguish "this is a retry" from "the user genuinely means to repeat this action." A server-generated fingerprint from request contents can't make that distinction reliably. This mirrors Stripe's `Idempotency-Key` / PayPal's `PayPal-Request-Id` convention.

Implementation:
- Client sends `Idempotency-Key: <uuid>` header on `POST /transfers`, `POST /withdrawals`.
- Key is required, validated as UUID, scoped per-user (unique constraint on `(userId, idempotencyKey)`).
- Store a hash of the normalized request body alongside the key.
  - Same key + same body hash → return the original response (replay), no new side effects.
  - Same key + different body hash → `409 Conflict` (misuse of the key, not a legitimate retry).
- Webhook idempotency (`WebhookEvent`) is separate and provider-controlled — unique constraint on provider event id, not client-supplied.

---

## Locked safety rules (non-negotiable)
1. Never change money without a journal row in the same DB transaction.
2. `PENDING` credits do **not** count toward balance.
3. Idempotency on transfers, withdrawals, reversals, webhook events (see model above).
4. Atomic spend on every debit: row lock (`FOR UPDATE`) + fresh SUM check inside the transaction, per Option A above. No cached-balance guard.
5. Webhook: verify signature → persist event (unique) → enqueue BullMQ → HTTP 200. Money only in workers.
6. P2P: **one Postgres transaction**, both journal legs, wallets locked in ascending id order; no BullMQ for money legs.
7. Bank fail: compensating **CREDIT `REVERSAL`** linked to original debit — do not rewrite/delete the debit.
8. Services inject **abstract repositories**, not raw Prisma (hrflow convention).

---

## Flows (summary)

### Auth
Register → User + Wallet (balance 0) in one TX. Password hashed with **bcrypt** (cost 12). Login → JWT.

### Transfer (fund)
1. Create `Transfer` + CREDIT `WalletTransaction` **PENDING** (no balance impact).
2. Init Flutterwave; return checkout/payment details.
3. Webhook → `WebhookEvent` → queue `transfer.complete`.
4. Worker verifies with Flutterwave API → mark CREDIT + Transfer SUCCESSFUL.

### Withdrawal P2P
Sync: lock wallets ordered by id (`FOR UPDATE`) → fresh-SUM check sender → debit sender if sufficient → credit recipient → two SUCCESSFUL journal rows → one sender `Withdrawal` SUCCESSFUL. All one transaction.

### Withdrawal bank
1. Lock wallet, fresh-SUM check, atomic DEBIT SUCCESSFUL + Withdrawal PROCESSING → enqueue `withdrawal.payout`.
2. Worker calls Flutterwave transfer.
3. Webhook/reconcile `withdrawal.settle`: SUCCESS → finalize; FAILED → REVERSAL CREDIT + mark REVERSED/FAILED.

### BullMQ queues
- `transfer.complete`
- `withdrawal.payout`
- `withdrawal.settle` (or reconcile)

---

## Nest / hrflow structure (must match)
```
src/
├── main.ts, app.module.ts
├── config/
├── common/          # customError, ServiceResponseData, filters, money utils
├── core/             # security (JWT, @Public), logger, redis, queue (BullMQ)
├── database/         # abstract repos + prisma/* impls + database.module bindings
├── prisma/
└── modules/
    ├── auth/
    ├── wallets/       # read balance (SUM), list txs; wallet-ledger write helpers
    ├── transfers/     # funding + providers/flutterwave + processors
    ├── withdrawals/   # facade → p2p + bank services + processors
    └── webhooks/      # optional; or public controller under transfers
```

Every feature module **must** have: `controllers/`, `services/`, `dto/`, `interfaces/`.
**File size hard rule: ≤ ~200 LOC per file** — split into facade + concern services / mappers / processors.

Skill reference: `fafi/.cursor/skills/nestjs-api-structure/SKILL.md`
Also: `fafi/.cursor/rules/nestjs-api-structure.mdc`

### Closest hrflow references
- Auth facade split: `hrflow/apps/api/src/modules/auth/`
- Payment provider interface: `hrflow/apps/api/src/modules/billing/providers/`
- BullMQ: `hrflow/apps/api/src/core/queue/` + `modules/exports/processors/`

### Skip from hrflow for this take-home
Org tenancy, permission catalog, platform admin, audit/mail/storage (unless easy wins).

---

## Suggested API surface
```
POST /auth/register
POST /auth/login

GET  /wallets/me                  # balance from SUM(successful txs)
GET  /wallets/me/transactions

POST /transfers                   # requires Idempotency-Key header
GET  /transfers/:id

POST /withdrawals                 # requires Idempotency-Key header, { destinationType: WALLET | BANK, ... }
GET  /withdrawals/:id

POST /webhooks/flutterwave        # @Public, raw body, signature verify
```

---

## Implementation tasks
Track status: `[ ]` todo · `[~]` in progress · `[x]` done

### Task 0 — Repo scaffold
- [x] NestJS app with hrflow-style folders (`config`, `common`, `core`, `database`, `prisma`, `modules`)
- [x] Env validation, Swagger, global filter/interceptor/response shape
- [x] Redis + BullMQ `QueueModule`
- [x] Prisma multi-file schema skeleton + migrate
- [x] `.env.example`, basic README stub

**Done when:** app boots, Swagger loads, Redis connects, empty health route works.

### Task 1 — Auth + Wallet create
- [x] User + Wallet Prisma models/repos
- [x] Register (bcrypt hash password, cost 12, create wallet) / login / JWT
- [x] `@Public()`, `@CurrentUser()`, JwtAuthGuard

**Done when:** can register, login, hit a protected route with JWT.

### Task 2 — Ledger + wallets read
- [x] `WalletTransaction` model/repo
- [x] `WalletLedgerService` (credit pending/successful, debit if sufficient via lock+SUM, reversal) — keep <200 LOC; split if needed
- [x] `GET /wallets/me` fresh balance via SUM
- [x] `GET /wallets/me/transactions`

**Done when:** unit/integration-level confidence that SUM matches posted successful txs; no raw Prisma in services.

### Task 3 — Transfers (Flutterwave funding)
- [x] `Transfer` model/repo
- [x] `FlutterwaveProvider` (init payment, verify by tx_ref, webhook signature)
- [x] Initiate transfer → PENDING credit journal
- [x] Idempotency-Key handling on `POST /transfers` (uuid, per-user, body-hash check)
- [x] Webhook persist + enqueue `transfer.complete`
- [x] Processor marks SUCCESSFUL idempotently

**Done when:** duplicate webhook does not double-credit; pending does not inflate balance.

### Task 4 — Withdrawals P2P
- [x] `Withdrawal` model/repo
- [x] Idempotency-Key handling on `POST /withdrawals`
- [x] Sync P2P in one TX: `FOR UPDATE` lock both wallets (ascending id order) → fresh SUM check → sender DEBIT + recipient CREDIT + Withdrawal SUCCESSFUL
- [x] Reject self-transfer

**Done when:** concurrent P2P cannot overdraw; recipient balance reflects CREDIT journal via SUM.

### Task 5 — Withdrawals bank + reversal
- [x] Accept bank withdrawal → lock + fresh SUM check → DEBIT + PROCESSING → `withdrawal.payout`
- [x] Payout processor + settle/reconcile processor
- [x] On fail: CREDIT `REVERSAL` with `reversesTransactionId`, idempotent
- [x] Flutterwave transfer initiate + status

**Done when:** failed payout restores spendable balance via reversal credit; retries safe.

### Task 6 — Concurrency test (high priority — proves the safety claims)
- [x] Seed a wallet with a known balance (e.g. 10,000 kobo).
- [x] Fire N (e.g. 20) simultaneous withdrawal/P2P requests each requesting an amount that would overdraw if more than one succeeded (e.g. 6,000 kobo each against a 10,000 balance, N=20).
- [x] Assert: exactly the number of requests that fit the balance succeed (here: 1), the rest fail with `422`, and final balance via SUM matches exactly one successful debit.
- [x] Repeat for P2P (two wallets, concurrent bidirectional transfers) to confirm no deadlock and no overdraw.
- [x] Include this as an automated test (Jest + supertest against a real Postgres, or a script hitting the deployed instance) and document the exact command to run it in the README.

**Command:** `npm run test:concurrency` (needs `docker:infra`; also `scripts/concurrency-test.js` against a live API).

**Done when:** test is reproducible, passes consistently across multiple runs, and is referenced in the README as evidence of safety — not just asserted in prose.

### Task 7 — Polish & ship
- [x] Swagger complete; Postman optional
- [x] README: run instructions, env, assumptions, naming glossary, webhook setup, idempotency-key rationale, concurrency-model rationale (Option A), concurrency test command
- [ ] Deploy publicly (Railway/Render/Fly/etc.) — Dockerfile ready; needs host + secrets from you
- [ ] Optional: simple reconcile job comparing nothing-to-hide SUM health

**Done when:** brief non-negotiables checklist all pass + public URL.

---

## Explicit non-goals / do not port
- Credlock full ledger accounts / journals / control accounts
- BNPL, agent wallets, cron-based payment confirm as primary path
- Async P2P
- Soft "recent duplicate within 2 minutes" as sole idempotency
- Returning stale `wallet.balance` as the balance API
- Server-derived idempotency keys (fingerprinting) — client-supplied only

---

## Credlock inspiration (patterns only)
Path: `c:\Users\owner\Desktop\work\credlock-lms-backend-new\src`
Steal: idempotent posts, atomic debit condition, webhook verify→store→async, payout provider interface, reverse-on-failed-payout.
Do not copy Mongo/Mongoose or LMS domains.

---

## Agent continuity notes
- Last agreed design: **user's slim wallet-journal model** + safety from earlier Credlock advice + BullMQ (not cron) + **Option A concurrency (lock + fresh SUM, no cached-balance guard)** + **client-supplied idempotency keys** + **bcrypt** password hashing.
- If confused about P2P recipient: they get a **WalletTransaction CREDIT**, not a Transfer/Withdrawal row.
- If confused about reversal: bank fail only → new CREDIT `REVERSAL`; P2P failures roll back TX (no reversal row).
- Prefer splitting files early over letting any service approach 200+ LOC.
- Concurrency test (Task 6) is a first-class deliverable, not an afterthought — build it alongside Task 4/5, not after.

### Status snapshot
- Design: **agreed**
- Code: **Task 7 nearly done** — README + Swagger + Dockerfile; **public deploy pending** your host choice/credentials
- Repo location: `c:\Users\owner\Desktop\fafi\wallet-api`
- Concurrency: `npm run test:concurrency` passed 3× in a row (overdraw 1/20 + bidirectional conservation)
