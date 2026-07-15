const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const base = process.env.API_BASE || 'http://127.0.0.1:3012/api/v1';

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

async function register(prefix) {
  const email = `${prefix}${Date.now()}@example.com`;
  const username = `${prefix}${Date.now().toString().slice(-6)}`;
  const reg = await req('POST', '/auth/register', {
    body: { email, username, password: 'Password1!' },
  });
  return {
    token: reg.accessToken,
    username: reg.data.user.username,
    walletId: reg.data.user.walletId,
  };
}

async function main() {
  const a = await register('snd');
  const b = await register('rcv');

  const prisma = new PrismaClient();
  await prisma.walletTransaction.create({
    data: {
      walletId: a.walletId,
      type: 'CREDIT',
      purpose: 'FLUTTERWAVE_FUNDING',
      status: 'SUCCESSFUL',
      amount: 10000,
      idempotencyKey: `seed-${Date.now()}`,
    },
  });
  await prisma.$disconnect();

  const meA0 = await req('GET', '/wallets/me', { token: a.token });
  console.log('A_BAL0', meA0.data.wallet.balance);

  const key = randomUUID();
  const wd = await req('POST', '/withdrawals', {
    token: a.token,
    headers: { 'Idempotency-Key': key },
    body: {
      destinationType: 'WALLET',
      recipientUsername: b.username,
      amount: 4000,
    },
  });
  console.log('WD', wd.data.withdrawal.status, wd.data.withdrawal.id);

  const replay = await req('POST', '/withdrawals', {
    token: a.token,
    headers: { 'Idempotency-Key': key },
    body: {
      destinationType: 'WALLET',
      recipientUsername: b.username,
      amount: 4000,
    },
  });
  console.log('REPLAY', replay.data.withdrawal.id === wd.data.withdrawal.id);

  try {
    await req('POST', '/withdrawals', {
      token: a.token,
      headers: { 'Idempotency-Key': key },
      body: {
        destinationType: 'WALLET',
        recipientUsername: b.username,
        amount: 5000,
      },
    });
    console.log('CONFLICT_UNEXPECTED');
  } catch (e) {
    console.log('CONFLICT', e.status);
  }

  try {
    await req('POST', '/withdrawals', {
      token: a.token,
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        destinationType: 'WALLET',
        recipientUsername: a.username,
        amount: 100,
      },
    });
    console.log('SELF_UNEXPECTED');
  } catch (e) {
    console.log('SELF', e.status);
  }

  try {
    await req('POST', '/withdrawals', {
      token: a.token,
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        destinationType: 'WALLET',
        recipientUsername: b.username,
        amount: 999999,
      },
    });
    console.log('OVERDRAW_UNEXPECTED');
  } catch (e) {
    console.log('OVERDRAW', e.status);
  }

  const meA1 = await req('GET', '/wallets/me', { token: a.token });
  const meB1 = await req('GET', '/wallets/me', { token: b.token });
  console.log('A_BAL1', meA1.data.wallet.balance, 'B_BAL1', meB1.data.wallet.balance);

  const txsB = await req('GET', '/wallets/me/transactions', { token: b.token });
  console.log(
    'B_TX_PURPOSE',
    txsB.data.transactions[0]?.purpose,
    txsB.data.transactions[0]?.type,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
