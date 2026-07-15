const { randomUUID } = require('crypto');

const base = process.env.API_BASE || 'http://127.0.0.1:3011/api/v1';

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

async function main() {
  const email = `fund${Date.now()}@example.com`;
  const username = `fnd${Date.now().toString().slice(-8)}`;
  const reg = await req('POST', '/auth/register', {
    body: { email, username, password: 'Password1!' },
  });
  const token = reg.accessToken;
  const key = randomUUID();

  const created = await req('POST', '/transfers', {
    token,
    headers: { 'Idempotency-Key': key },
    body: { amount: 5000 },
  });
  console.log('CREATED', created.data.transfer.status, created.data.transfer.checkoutUrl?.slice(0, 40));

  const replay = await req('POST', '/transfers', {
    token,
    headers: { 'Idempotency-Key': key },
    body: { amount: 5000 },
  });
  console.log('REPLAY_SAME_ID', replay.data.transfer.id === created.data.transfer.id);

  try {
    await req('POST', '/transfers', {
      token,
      headers: { 'Idempotency-Key': key },
      body: { amount: 6000 },
    });
    console.log('CONFLICT_UNEXPECTED');
  } catch (e) {
    console.log('CONFLICT_STATUS', e.status);
  }

  const me0 = await req('GET', '/wallets/me', { token });
  console.log('BAL_BEFORE', me0.data.wallet.balance);

  const eventId = Date.now();
  const wh = await req('POST', '/webhooks/flutterwave', {
    headers: { 'verif-hash': 'mock-webhook-secret' },
    body: {
      event: 'charge.completed',
      data: {
        id: eventId,
        tx_ref: created.data.transfer.flutterwaveTxRef,
        status: 'successful',
        amount: 50,
        currency: 'NGN',
      },
    },
  });
  console.log('WEBHOOK', wh.status, wh.webhookEventId);

  const wh2 = await req('POST', '/webhooks/flutterwave', {
    headers: { 'verif-hash': 'mock-webhook-secret' },
    body: {
      event: 'charge.completed',
      data: {
        id: eventId,
        tx_ref: created.data.transfer.flutterwaveTxRef,
        status: 'successful',
        amount: 50,
        currency: 'NGN',
      },
    },
  });
  console.log('WEBHOOK2_SAME', wh2.webhookEventId === wh.webhookEventId);

  let bal = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const me = await req('GET', '/wallets/me', { token });
    bal = me.data.wallet.balance;
    if (bal === 5000) break;
  }
  console.log('BAL_AFTER', bal);

  const transfer = await req('GET', `/transfers/${created.data.transfer.id}`, {
    token,
  });
  console.log('TRANSFER_STATUS', transfer.data.transfer.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
