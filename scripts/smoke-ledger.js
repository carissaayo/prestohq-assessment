const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { WalletLedgerService } = require('../dist/modules/wallets/services/wallet-ledger.service');

const base = process.env.API_BASE || 'http://127.0.0.1:3011/api/v1';

async function req(method, path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(JSON.stringify(json));
    err.status = res.status;
    throw err;
  }
  return json;
}

async function main() {
  const email = `ledger${Date.now()}@example.com`;
  const username = `led${Date.now().toString().slice(-8)}`;
  const reg = await req('POST', '/auth/register', {
    email,
    username,
    password: 'Password1!',
  });
  const token = reg.accessToken;
  const walletId = reg.data.user.walletId;

  const me0 = await req('GET', '/wallets/me', null, token);
  console.log('BAL0', me0.data.wallet.balance);

  const prisma = new PrismaClient();
  await prisma.walletTransaction.create({
    data: {
      walletId,
      type: 'CREDIT',
      purpose: 'FLUTTERWAVE_FUNDING',
      status: 'SUCCESSFUL',
      amount: 10000,
      idempotencyKey: `smoke-credit-${Date.now()}`,
    },
  });
  await prisma.$disconnect();

  const me1 = await req('GET', '/wallets/me', null, token);
  console.log('BAL1', me1.data.wallet.balance);

  const txs = await req('GET', '/wallets/me/transactions', null, token);
  console.log('TX_COUNT', txs.data.transactions.length);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const ledger = app.get(WalletLedgerService);
  const debit = await ledger.postDebitSuccessful({
    walletId,
    amount: 2500,
    purpose: 'BANK_PAYOUT',
    idempotencyKey: `smoke-debit-${Date.now()}`,
  });
  console.log('DEBIT', debit.created, debit.balanceAfter);

  try {
    await ledger.postDebitSuccessful({
      walletId,
      amount: 999999,
      purpose: 'BANK_PAYOUT',
      idempotencyKey: `smoke-overdraw-${Date.now()}`,
    });
    console.log('OVERDRAW_UNEXPECTED');
  } catch (e) {
    console.log('OVERDRAW_STATUS', e.getStatus?.() ?? e.status);
  }

  await app.close();

  const me2 = await req('GET', '/wallets/me', null, token);
  console.log('BAL2', me2.data.wallet.balance);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
