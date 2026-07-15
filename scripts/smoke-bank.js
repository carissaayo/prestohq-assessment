const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const base = process.env.API_BASE || 'http://127.0.0.1:3014/api/v1';

async function req(method, path, { body, token, headers } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(JSON.stringify(json));
    err.status = res.status;
    throw err;
  }
  return json;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function register(prefix) {
  const email = `${prefix}${Date.now()}@example.com`;
  const username = `${prefix}${Date.now().toString().slice(-6)}`;
  const reg = await req('POST', '/auth/register', {
    body: { email, username, password: 'Password1!' },
  });
  return {
    token: reg.accessToken,
    walletId: reg.data.user.walletId,
  };
}

async function seed(walletId, amount) {
  const prisma = new PrismaClient();
  await prisma.walletTransaction.create({
    data: {
      walletId,
      type: 'CREDIT',
      purpose: 'FLUTTERWAVE_FUNDING',
      status: 'SUCCESSFUL',
      amount,
      idempotencyKey: `seed-bank-${Date.now()}-${Math.random()}`,
    },
  });
  await prisma.$disconnect();
}

async function waitStatus(token, id, want, tries = 30) {
  for (let i = 0; i < tries; i++) {
    await sleep(500);
    const res = await req('GET', `/withdrawals/${id}`, { token });
    if (res.data.withdrawal.status === want) return res.data.withdrawal;
  }
  const last = await req('GET', `/withdrawals/${id}`, { token });
  throw new Error(`timeout status=${last.data.withdrawal.status} want=${want}`);
}

async function main() {
  const user = await register('bnk');
  await seed(user.walletId, 20000);

  // Success path
  const ok = await req('POST', '/withdrawals', {
    token: user.token,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      destinationType: 'BANK',
      bankCode: '044',
      accountNumber: '0123456789',
      accountName: 'Test User',
      amount: 3000,
    },
  });
  console.log('OK_ACCEPT', ok.data.withdrawal.status);
  const okFinal = await waitStatus(user.token, ok.data.withdrawal.id, 'SUCCESSFUL');
  console.log('OK_FINAL', okFinal.status);

  let me = await req('GET', '/wallets/me', { token: user.token });
  console.log('BAL_AFTER_OK', me.data.wallet.balance);

  // Fail on initiate → reverse
  const failInit = await req('POST', '/withdrawals', {
    token: user.token,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      destinationType: 'BANK',
      bankCode: '044',
      accountNumber: '0123456000',
      accountName: 'Fail Init',
      amount: 2000,
    },
  });
  const failInitFinal = await waitStatus(
    user.token,
    failInit.data.withdrawal.id,
    'REVERSED',
  );
  console.log('FAIL_INIT', failInitFinal.status);
  me = await req('GET', '/wallets/me', { token: user.token });
  console.log('BAL_AFTER_FAIL_INIT', me.data.wallet.balance);

  // Fail on settle → reverse
  const failSettle = await req('POST', '/withdrawals', {
    token: user.token,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      destinationType: 'BANK',
      bankCode: '044',
      accountNumber: '0123456999',
      accountName: 'Fail Settle',
      amount: 1500,
    },
  });
  const failSettleFinal = await waitStatus(
    user.token,
    failSettle.data.withdrawal.id,
    'REVERSED',
  );
  console.log('FAIL_SETTLE', failSettleFinal.status);
  me = await req('GET', '/wallets/me', { token: user.token });
  console.log('BAL_AFTER_FAIL_SETTLE', me.data.wallet.balance);

  // Expected: 20000 - 3000 = 17000 (failed ones reversed)
  if (me.data.wallet.balance !== 17000) {
    throw new Error(`unexpected final balance ${me.data.wallet.balance}`);
  }
  console.log('BANK_FLOW_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
