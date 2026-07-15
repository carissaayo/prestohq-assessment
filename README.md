# Wallet & Payments API

NestJS + PostgreSQL + BullMQ take-home. Locked design lives in **[WALLET_API_HANDOFF.md](./WALLET_API_HANDOFF.md)**.

> **Transfer** means funding (Flutterwave credit). **Withdrawal** covers P2P and bank outflows.

## Naming glossary

| Term | Meaning |
|------|---------|
| **Transfer** | Fund wallet via Flutterwave (credit / inflow) |
| **Withdrawal** | Send money out — `WALLET` (P2P) or `BANK` |
| **WalletTransaction** | Append-only journal; **source of truth for money** |
| **Balance** | `SUM(SUCCESSFUL CREDIT) − SUM(SUCCESSFUL DEBIT)` — always fresh; never a cached column as API truth |
| **Amounts** | Integer **kobo** (minor units), never floats |

## Quick start

```bash
cp .env.example .env

# Infra (Postgres :5433, Redis :6380 — avoids clashes with other local stacks)
npm run docker:infra

npm install
npx prisma migrate deploy   # or: npx prisma migrate dev

npm run dev
```

| | URL |
|--|-----|
| Health | `GET http://localhost:3010/api/v1/health` |
| Swagger | `http://localhost:3010/api/docs` |

Ports: API **3010**, Postgres **5433**, Redis **6380**.

## Environment

Copy `.env.example`. Important variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection |
| `REDIS_HOST` / `REDIS_PORT` | BullMQ |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Auth (change before deploy) |
| `FLUTTERWAVE_MOCK` | `true` = no real FLW calls (default local) |
| `FLUTTERWAVE_SECRET_KEY` | Real API when mock is off |
| `FLUTTERWAVE_WEBHOOK_SECRET` | Must match Flutterwave dashboard hash (`verif-hash` header) |
| `FLUTTERWAVE_REDIRECT_URL` | Checkout return URL |
| `SWAGGER_ENABLED` | Set `true` to expose docs in production |

## Main flows

1. **Auth** — `POST /auth/register` creates user + empty wallet; password **bcrypt cost 12**. `POST /auth/login` → JWT.
2. **Fund (Transfer)** — `POST /transfers` + `Idempotency-Key` → PENDING credit → Flutterwave checkout. Webhook → BullMQ `transfer.complete` → SUCCESSFUL credit.
3. **P2P withdrawal** — `POST /withdrawals` with `destinationType: WALLET` — one Postgres TX, both journal legs.
4. **Bank withdrawal** — `destinationType: BANK` — debit + PROCESSING → `withdrawal.payout` → settle; fail → CREDIT `REVERSAL`.

Mock bank shortcuts (`FLUTTERWAVE_MOCK=true`): account ending `000` fails initiate; ending `999` fails settle (triggers reversal).

## Webhook setup

`POST /api/v1/webhooks/flutterwave`

1. In Flutterwave dashboard, set webhook URL to your public `/api/v1/webhooks/flutterwave`.
2. Configure the secret hash to match `FLUTTERWAVE_WEBHOOK_SECRET` (header `verif-hash`).
3. Handler verifies signature → stores `WebhookEvent` (unique provider id) → enqueues worker → returns **200**. Money moves only in workers (never in the HTTP handler).

Local mock does not need a real webhook; funding can still be completed by the mock provider path used in smoke scripts.

## Idempotency (`Idempotency-Key`)

Required on `POST /transfers` and `POST /withdrawals` (UUID). Scoped per user.

Idempotency protects retries of a **specific client intent** (e.g. timed-out request resent). Only the client can tell “retry” from “user means to do it again.” Server fingerprinting of the body cannot make that distinction reliably — same idea as Stripe’s `Idempotency-Key`.

| Same key + … | Result |
|--------------|--------|
| Same body hash | Replay original response (no new side effects) |
| Different body hash | `409 Conflict` |

Webhook idempotency is separate: unique provider event id on `WebhookEvent`.

## Concurrency model (Option A)

No cached-balance guard. Safety is:

1. `BEGIN`
2. `SELECT … FROM wallets WHERE id = $1 FOR UPDATE` (P2P: lock **both** wallets ordered by **ascending id**)
3. Fresh `SUM` of SUCCESSFUL journal rows inside the same TX
4. Insert DEBIT (and P2P CREDIT) only if sufficient → `COMMIT`; else `ROLLBACK` → `422`

## Concurrency test

```bash
npm run docker:infra
npm run test:concurrency
```

Expect: exactly **1** of 20 concurrent P2P withdrawals of **6000** kobo against **10000** succeeds (rest `422`); bidirectional stress ends with non-negative balances and conserved **20000** system total.

Optional live probe: `API_BASE=http://127.0.0.1:3010/api/v1 node scripts/concurrency-test.js`

## Assumptions

- NGN / kobo only for this take-home.
- P2P is synchronous (no BullMQ money legs).
- Bank payout is async; failure is fixed with a compensating REVERSAL credit, not by rewriting the debit.
- Flutterwave mock is fine for local demos; production needs real keys + webhook URL.
- JWT is HS256 with env secret — rotate before any public deploy.

## Stack layout

hrflow-style Nest layout: `config/`, `common/`, `core/`, `database/`, `prisma/`, `modules/*` (`controllers|services|dto|interfaces`). Prefer files ≤ ~200 LOC; services inject **abstract repositories**.

## Deploy

Build: `npm run build` → `node dist/main` (set `NODE_ENV=production`, managed Postgres + Redis, strong `JWT_SECRET`, `FLUTTERWAVE_MOCK=false` + real keys, `SWAGGER_ENABLED=true` if you want public docs).

Point Flutterwave webhooks at `https://<host>/api/v1/webhooks/flutterwave`.

A minimal `Dockerfile` is included for container hosts (Railway / Render / Fly). Public URL and secrets are environment-specific — set them in the host dashboard after first deploy.

## Status

Tasks 0–6 complete (including concurrency proof). Task 7: README + Swagger polish; public deploy when you attach hosting credentials.
