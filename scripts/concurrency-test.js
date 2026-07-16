/**
 * Standalone concurrency probe against a running API.
 * Prefer `npm run test:concurrency` (Jest e2e) for CI assertions.
 *
 * Usage:
 *   API_BASE=http://127.0.0.1:3010/api/v1 node scripts/concurrency-test.js
 */
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const base = process.env.API_BASE || 'http://127.0.0.1:3010/api/v1';

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
  return { status: res.status, json };
}

async function register(prefix) {
  const email = `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
  const username = `${prefix}${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 1000)}`;
  const password = 'Password1!';
  const pin = '1234';
  const res = await req('POST', '/auth/register', {
    body: {
      email,
      username,
      firstName: 'Test',
      lastName: 'User',
      password,
      confirmPassword: password,
    },
  });
  if (res.status >= 400) throw new Error(JSON.stringify(res.json));
  const pinRes = await req('POST', '/auth/pin', {
    token: res.json.accessToken,
    body: { pin, confirmPin: pin, password },
  });
  if (pinRes.status >= 400) throw new Error(JSON.stringify(pinRes.json));
  const me = await req('GET', '/auth/me', { token: res.json.accessToken });
  if (me.status >= 400) throw new Error(JSON.stringify(me.json));
  return {
    token: res.json.accessToken,
    username: me.json.data.user.username,
    walletId: me.json.data.user.walletId,
    pin,
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
      idempotencyKey: `script-seed-${randomUUID()}`,
    },
  });
  await prisma.$disconnect();
}

async function balance(token) {
  const res = await req('GET', '/wallets/me', { token });
  return res.json.data.wallet.balance;
}

async function main() {
  console.log('API_BASE', base);

  const sender = await register('oca');
  const recipient = await register('ocb');
  await seed(sender.walletId, 10_000);

  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      req('POST', '/withdrawals', {
        token: sender.token,
        headers: { 'Idempotency-Key': randomUUID() },
        body: {
          destinationType: 'WALLET',
          recipientUsername: recipient.username,
          amount: 6_000,
          pin: sender.pin,
        },
      }),
    ),
  );

  const ok = results.filter((r) => r.status === 200 || r.status === 201);
  const fail = results.filter((r) => r.status === 422);
  console.log('overdraw ok=', ok.length, '422=', fail.length);
  if (ok.length !== 1 || fail.length !== 19) {
    throw new Error('overdraw assertion failed');
  }

  const a = await register('oba');
  const b = await register('obb');
  await seed(a.walletId, 10_000);
  await seed(b.walletId, 10_000);

  const bi = await Promise.all([
    ...Array.from({ length: 10 }, () =>
      req('POST', '/withdrawals', {
        token: a.token,
        headers: { 'Idempotency-Key': randomUUID() },
        body: {
          destinationType: 'WALLET',
          recipientUsername: b.username,
          amount: 6_000,
          pin: a.pin,
        },
      }),
    ),
    ...Array.from({ length: 10 }, () =>
      req('POST', '/withdrawals', {
        token: b.token,
        headers: { 'Idempotency-Key': randomUUID() },
        body: {
          destinationType: 'WALLET',
          recipientUsername: a.username,
          amount: 6_000,
          pin: b.pin,
        },
      }),
    ),
  ]);

  for (const r of bi) {
    if (![200, 201, 422].includes(r.status)) {
      throw new Error(`unexpected status ${r.status}`);
    }
  }

  const aBal = await balance(a.token);
  const bBal = await balance(b.token);
  console.log('bidirectional a=', aBal, 'b=', bBal, 'sum=', aBal + bBal);
  if (aBal < 0 || bBal < 0 || aBal + bBal !== 20_000) {
    throw new Error('bidirectional assertion failed');
  }

  console.log('CONCURRENCY_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
