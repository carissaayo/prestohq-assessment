# Wallet & Payments API

NestJS + PostgreSQL + BullMQ take-home. See **[WALLET_API_HANDOFF.md](./WALLET_API_HANDOFF.md)** for locked design, tasks, and continuity notes.

## Naming

- **Transfer** = fund wallet via Flutterwave (credit)
- **Withdrawal** = send out — P2P or bank (debit)
- Balance = `SUM(successful credits) − SUM(successful debits)` over `wallet_transactions` (always fresh; no cached balance as API truth)

## Quick start

```bash
# Infra (Postgres :5433, Redis :6380 — avoids clashes with other local stacks)
npm run docker:infra

# Install + Prisma client
npm install
npx prisma migrate dev --name init

# Run API
npm run dev
```

- Health: `GET http://localhost:3010/api/v1/health`
- Swagger: `http://localhost:3010/api/docs`

Default ports avoid clashes with hrflow (`5432`/`6379`/`3000`): API **3010**, Postgres **5433**, Redis **6380**.

## Stack layout

Matches hrflow Nest conventions: `config/`, `common/`, `core/`, `database/`, `prisma/`, `modules/*` with `controllers|services|dto|interfaces`. Files should stay ≤ ~200 LOC.

## Status

Tasks 0–3 complete (scaffold, auth, ledger, Flutterwave funding + webhook). Next: Task 4 — P2P withdrawals.
