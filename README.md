# Wallet API

NestJS service for NGN wallet balances, Flutterwave funding, peer-to-peer transfers, and bank payouts.

Balances are never stored as a mutable cache. The ledger is append-only; available balance is always:

`SUM(SUCCESSFUL CREDIT) − SUM(SUCCESSFUL DEBIT)` (amounts in **kobo**).

| Term | Meaning |
|------|---------|
| **Transfer** | Inflow — fund a wallet via Flutterwave |
| **Withdrawal** | Outflow — `WALLET` (P2P) or `BANK` (Flutterwave payout) |
| **WalletTransaction** | Journal row (`CREDIT` / `DEBIT` / `REVERSAL`) |

## Deployed API

Base URL: [https://prestohq-assessment.onrender.com](https://prestohq-assessment.onrender.com)

All JSON API routes are under **`/api/v1`**. Examples:

| | |
|--|--|
| Health | `GET https://prestohq-assessment.onrender.com/api/v1/health` |
| OpenAPI | [https://prestohq-assessment.onrender.com/api/docs](https://prestohq-assessment.onrender.com/api/docs) |
| Flutterwave webhook | `POST https://prestohq-assessment.onrender.com/api/v1/webhooks/flutterwave` |
| Checkout return | `GET https://prestohq-assessment.onrender.com/funding/callback` (not under `/api/v1`) |

On the free Render tier the service may **sleep when idle**. The first request after idle can take **30–60+ seconds** while the instance wakes; later requests are normal. Retry once if the first call times out.

## Decisions

The wallet has no cached balance column. Every spendable amount is derived from successful journal rows only, so a row’s status—not a side counter—is the source of truth.

**Duplicate webhook:** Events are unique on `(provider, providerEventId)` from Flutterwave `data.id`. A second delivery returns `200`, does not insert another event, and does not double-credit; if the first was not yet `PROCESSED`, the complete job may be re-enqueued safely (transfer/credit completion is idempotent).

**Concurrent withdrawals against insufficient combined funds:** Debits run in a DB transaction with `SELECT … FOR UPDATE` on the wallet row(s), then a fresh `SUM` of successful rows, then the debit insert. Only one concurrent debit can pass the check; the other rolls back with `422`. P2P locks both wallets in ascending id order to avoid deadlocks.

**Deposit never confirmed:** `POST /transfers` creates a **PENDING** credit (excluded from `SUM`) and a pending transfer. Until a verified webhook → worker marks that credit **SUCCESSFUL**, the funds never appear in balance. Abandoned checkouts leave spendable balance unchanged.

Failed bank payouts add a compensating **REVERSAL** credit; original debits are never deleted or rewritten.

## Requirements

- Node.js 20+
- Docker (Postgres + Redis for local infra)
- Flutterwave credentials when `FLUTTERWAVE_MOCK=false`

## Run

```bash
cp .env.example .env
npm run docker:infra
npm install
npx prisma migrate deploy
npm run dev
```

| | |
|--|--|
| API | `http://localhost:3010` |
| Health | `GET /api/v1/health` |
| OpenAPI | `http://localhost:3010/api/docs` (non-production by default) |

Default ports: API **3010**, Postgres **5433**, Redis **6380**.

Production process:

```bash
npm run build
NODE_ENV=production node dist/main
```

Or use the included `Dockerfile` (migrate then start). Provide managed Postgres, Redis, a strong `JWT_SECRET`, and live Flutterwave keys with `FLUTTERWAVE_MOCK=false`.

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3010`) |
| `DATABASE_URL` | PostgreSQL |
| `REDIS_HOST` / `REDIS_PORT` | Local / Docker Redis (compose maps **6380**) |
| `REDIS_URL` | Optional; managed Redis (`redis://` or `rediss://…`). **Overrides** host/port when set |
| `REDIS_KEY_PREFIX` | Redis key namespace |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access tokens |
| `FLUTTERWAVE_MOCK` | `true` = in-process mock provider; `false` = live Flutterwave HTTP |
| `FLUTTERWAVE_SECRET_KEY` | Secret key (required when mock is off) |
| `FLUTTERWAVE_PUBLIC_KEY` | Public key |
| `FLUTTERWAVE_WEBHOOK_SECRET` | Must match dashboard hash (`verif-hash` header) |
| `FLUTTERWAVE_REDIRECT_URL` | Checkout return URL (e.g. `https://prestohq-assessment.onrender.com/funding/callback`) |
| `SWAGGER_ENABLED` | Force OpenAPI on/off (`true` to expose in production) |

Template: `.env.example`.

## HTTP API

Base path: `/api/v1` (except the funding return page).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/auth/register` | — | User + empty wallet; `confirmPassword` must match |
| `POST` | `/auth/login` | — | JWT; failed password attempts lock for 5 minutes after 3 tries |
| `POST` | `/auth/pin` | Bearer | Set 4-digit transaction PIN (requires password) |
| `GET` | `/auth/me` | Bearer | Current user |
| `GET` | `/wallets/me` | Bearer | Wallet + live balance |
| `GET` | `/wallets/me/transactions` | Bearer | Journal (newest first) |
| `POST` | `/transfers` | Bearer | Start Flutterwave funding; body includes `pin`; header `Idempotency-Key` |
| `GET` | `/transfers/:id` | Bearer | Funding transfer |
| `POST` | `/withdrawals` | Bearer | P2P or bank; body includes `pin`; header `Idempotency-Key` |
| `GET` | `/withdrawals` | Bearer | List own withdrawals |
| `GET` | `/withdrawals/:id` | Bearer | One withdrawal |
| `POST` | `/webhooks/flutterwave` | `verif-hash` | Provider webhook |
| `GET` | `/funding/callback` | — | Browser landing after checkout (outside `/api/v1`; does not settle funds) |

Money-moving POSTs require a configured transaction PIN. Wrong PIN: 3 failures → 5 minute lock.

### Withdrawal body

- `destinationType: WALLET` — `recipientUsername`, `amount`, `pin`
- `destinationType: BANK` — `bankCode`, `accountNumber`, `accountName`, `amount`, `pin` (no username)

## Behaviour

### Funding (transfer)

1. `POST /transfers` creates a transfer (`PENDING`) and a **PENDING** credit (excluded from balance).
2. Client pays on Flutterwave checkout.
3. Flutterwave calls `POST /webhooks/flutterwave` with `verif-hash`.
4. API verifies the hash, stores a `WebhookEvent` keyed by Flutterwave `data.id`, enqueues BullMQ `transfer.complete`, returns `200`.
5. Worker re-verifies the charge with Flutterwave, completes the credit to **SUCCESSFUL**, marks the transfer **SUCCESSFUL**.

Redirect to `/funding/callback` is UX only. Settlement is webhook + worker.

### P2P withdrawal

Synchronous. One Postgres transaction: lock both wallets in ascending id order, recompute sender balance, write DEBIT + CREDIT (`SUCCESSFUL`), mark withdrawal **SUCCESSFUL**.

### Bank withdrawal

1. Accept request: lock wallet, DEBIT **SUCCESSFUL**, withdrawal **PROCESSING**, enqueue `withdrawal.payout`.
2. Payout worker calls Flutterwave; may enqueue `withdrawal.settle` to poll status.
3. On provider failure: **REVERSAL** credit (compensating journal row); withdrawal **REVERSED**. Original debit rows are never deleted.

### Idempotency

`Idempotency-Key` (UUID v4) required on `POST /transfers` and `POST /withdrawals`, scoped per user. PIN is excluded from the body hash.

| | |
|--|--|
| Same key + same body | Replay prior result |
| Same key + different body | `409 Conflict` |

Webhooks are idempotent on `(provider, providerEventId)`.

### Concurrency

Debits take `SELECT … FOR UPDATE` on wallet row(s), then a fresh successful-journal `SUM`, then insert. Insufficient funds → `422` and rollback.

```bash
npm run test:concurrency
```

## Flutterwave

Dashboard (deployed):

1. Webhook URL: `https://prestohq-assessment.onrender.com/api/v1/webhooks/flutterwave`
2. Secret hash = `FLUTTERWAVE_WEBHOOK_SECRET`
3. Redirect URL = `https://prestohq-assessment.onrender.com/funding/callback`

With `FLUTTERWAVE_MOCK=true`, no live Flutterwave HTTP is used; webhook signature expects `verif-hash: mock-webhook-secret`. Mock bank account suffixes: `000` fails initiate, `999` fails settle.

## Stack

NestJS 11, Prisma, PostgreSQL, Redis, BullMQ, JWT (HS256), bcrypt (cost 12), Helmet, class-validator.
