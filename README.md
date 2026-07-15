# Wallet & Payments API

NestJS API for wallet funding and payouts: Flutterwave deposits, peer-to-peer transfers, and bank withdrawals. Money is tracked in an append-only journal; balances are always derived from successful ledger rows.

> **Transfer** means funding (Flutterwave credit). **Withdrawal** covers P2P and bank outflows.

## Features

- Register / login (JWT, bcrypt password hashing)
- Fund wallet via Flutterwave (webhook + async settlement)
- Withdraw to another wallet (P2P) or Nigerian bank account
- Client `Idempotency-Key` on money-moving POSTs
- Concurrent-safe debits (`FOR UPDATE` + fresh balance aggregation)
- Compensating **REVERSAL** credit when a bank payout fails
- OpenAPI / Swagger UI

## Naming

| Term | Meaning |
|------|---------|
| **Transfer** | Fund wallet via Flutterwave (credit / inflow) |
| **Withdrawal** | Send money out — `WALLET` (P2P) or `BANK` |
| **WalletTransaction** | Append-only journal; source of truth for balances |
| **Balance** | `SUM(SUCCESSFUL CREDIT) − SUM(SUCCESSFUL DEBIT)` — computed on read |
| **Amounts** | Integer **kobo** (minor units), never floats |

## Quick start

```bash
cp .env.example .env

# Postgres (:5433) + Redis (:6380)
npm run docker:infra

npm install
npx prisma migrate deploy

npm run dev
```

| | URL |
|--|-----|
| Health | `GET http://localhost:3010/api/v1/health` |
| Swagger | `http://localhost:3010/api/docs` |

Default local ports: API **3010**, Postgres **5433**, Redis **6380**.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | BullMQ / job workers |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Auth tokens — use a strong secret in production |
| `FLUTTERWAVE_MOCK` | `true` for local mock provider (no real FLW calls) |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave secret when mock is off |
| `FLUTTERWAVE_PUBLIC_KEY` | Flutterwave public key |
| `FLUTTERWAVE_WEBHOOK_SECRET` | Must match dashboard hash (`verif-hash` header) |
| `FLUTTERWAVE_REDIRECT_URL` | Checkout return URL |
| `SWAGGER_ENABLED` | Set `true` to expose `/api/docs` in production |

See `.env.example` for a full template.

## API overview

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/auth/register` | Creates user + empty wallet |
| `POST` | `/api/v1/auth/login` | Returns JWT |
| `GET` | `/api/v1/auth/me` | Current user |
| `GET` | `/api/v1/wallets/me` | Wallet + live balance |
| `GET` | `/api/v1/wallets/me/transactions` | Journal (paginated) |
| `POST` | `/api/v1/transfers` | Fund via Flutterwave — requires `Idempotency-Key` |
| `GET` | `/api/v1/transfers/:id` | Funding status |
| `POST` | `/api/v1/withdrawals` | P2P or bank — requires `Idempotency-Key` |
| `GET` | `/api/v1/withdrawals/:id` | Withdrawal status |
| `POST` | `/api/v1/webhooks/flutterwave` | Provider webhook |

Interactive docs: [http://localhost:3010/api/docs](http://localhost:3010/api/docs).

## Flows

### Auth

`POST /auth/register` creates a user and wallet in one transaction. Passwords are hashed with **bcrypt** (cost 12). Login issues a JWT bearer token.

### Fund (Transfer)

1. `POST /transfers` with `Idempotency-Key` creates a Transfer and a **PENDING** credit (does not affect balance).
2. Client completes Flutterwave checkout.
3. Webhook → persist event → BullMQ `transfer.complete` → mark credit **SUCCESSFUL**.

### P2P withdrawal

`POST /withdrawals` with `destinationType: WALLET`. One database transaction locks both wallets (by ascending id), checks sender balance via fresh `SUM`, writes sender DEBIT + recipient CREDIT, and marks the Withdrawal successful.

### Bank withdrawal

1. Atomic DEBIT + Withdrawal `PROCESSING`, then enqueue `withdrawal.payout`.
2. Worker initiates Flutterwave transfer; settle job finalizes success or failure.
3. On failure: compensating **CREDIT `REVERSAL`** (original debit is never rewritten or deleted).

With `FLUTTERWAVE_MOCK=true`: account numbers ending in `000` fail initiate; ending in `999` fail settle (exercises reversal).

## Webhook setup

`POST /api/v1/webhooks/flutterwave`

1. Point Flutterwave’s webhook URL at your public host + `/api/v1/webhooks/flutterwave`.
2. Set the dashboard secret hash to match `FLUTTERWAVE_WEBHOOK_SECRET`.
3. The handler verifies `verif-hash`, stores a unique `WebhookEvent`, enqueues a worker, and returns **200**. Ledger updates happen only in workers—not in the HTTP handler.

## Idempotency

`Idempotency-Key` (UUID) is required on `POST /transfers` and `POST /withdrawals`, scoped per user.

Clients own retry semantics: the same key marks a retry of the same intent (e.g. after a timeout). The server cannot reliably infer that from body fingerprints alone—same convention as Stripe’s `Idempotency-Key`.

| Condition | Result |
|-----------|--------|
| Same key + same body hash | Replay prior response (no new side effects) |
| Same key + different body | `409 Conflict` |

Provider webhooks are idempotent separately via unique event ids.

## Concurrency & balance safety

Balances are never trusted from a cached column. Every debit:

1. Starts a transaction
2. Locks the wallet row with `SELECT … FOR UPDATE` (P2P locks both wallets, ascending id order, to avoid deadlocks)
3. Recomputes available balance with a fresh `SUM` of successful journal rows
4. Inserts the DEBIT (and P2P CREDIT) only if funds are sufficient — otherwise rolls back with `422`

## Concurrency test

```bash
npm run docker:infra
npm run test:concurrency
```

Asserts that exactly one of twenty concurrent P2P withdrawals of **6000** kobo succeeds against a **10000** balance (others `422`), and that bidirectional stress keeps balances non-negative with a conserved system total.

Against a running API: `API_BASE=http://127.0.0.1:3010/api/v1 node scripts/concurrency-test.js`

## Design notes

- Currency is **NGN** / amounts in **kobo**.
- P2P money movement is synchronous (single Postgres transaction).
- Bank payouts are asynchronous; failed payouts are corrected with a REVERSAL credit.
- Set `FLUTTERWAVE_MOCK=false` and real keys for production funding and payouts.

## Production / Docker

```bash
npm run build
NODE_ENV=production node dist/main
```

Or build the included `Dockerfile` (runs migrations then starts the API). Provide managed Postgres + Redis, a strong `JWT_SECRET`, Flutterwave credentials, and `FLUTTERWAVE_MOCK=false`. Point Flutterwave webhooks at `https://<host>/api/v1/webhooks/flutterwave`. Set `SWAGGER_ENABLED=true` if you want docs exposed publicly.
